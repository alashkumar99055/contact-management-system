/* ================================================================
   TaskFlow — script.js
   Full task-management SPA logic:
   - Auth guard, session management
   - Sidebar navigation (Dashboard, All Tasks, Today, Upcoming,
     Completed, High Priority, Category views, Settings)
   - Task CRUD: create, read, update, delete, toggle complete
   - Category CRUD: create, delete
   - Client-side filter, sort, search
   - Dashboard stats and panels
   - Add/Edit task modal
   - Add category modal
   - Delete confirmation modal
   - Toast notifications
   - Light / Dark theme toggle (persisted)
   - Responsive sidebar toggle
   ================================================================ */

'use strict';

/* ── API config ──────────────────────────────────────────────── */
function getApiBaseUrl() { return (window.TASKFLOW_CONFIG || {}).apiBaseUrl || ''; }
function apiUrl(path)    { return `${getApiBaseUrl()}${path}`; }

/* ── Auth ────────────────────────────────────────────────────── */
function getToken()    { return sessionStorage.getItem('tf-token'); }
function getUsername() { return sessionStorage.getItem('tf-username') || ''; }

function authHeaders(extra = {}) {
    const t = getToken();
    return { ...extra, ...(t ? { 'Authorization': 'Bearer ' + t } : {}) };
}

function handleUnauthorized() {
    sessionStorage.removeItem('tf-token');
    sessionStorage.removeItem('tf-username');
    window.location.replace('./login.html');
}

/* Guard: redirect to login if no token */
(function guardPage() {
    if (!getToken()) window.location.replace('./login.html');
})();

/* ── State ───────────────────────────────────────────────────── */
let allTasks      = [];   // full list from server
let allCategories = [];   // full list from server
let currentView   = 'dashboard';
let currentCatFilter = null;  // category id string when viewing a category
let pendingDeleteId  = null;
let editingTaskId    = null;  // null = create mode, string = edit mode

/* ── Persistent settings ─────────────────────────────────────── */
function getSetting(key, def) { return localStorage.getItem('tf-' + key) ?? def; }
function setSetting(key, val) { localStorage.setItem('tf-' + key, val); }

/* ── DOM refs ────────────────────────────────────────────────── */
const sidebar           = document.getElementById('sidebar');
const sidebarOverlay    = document.getElementById('sidebarOverlay');
const sidebarToggle     = document.getElementById('sidebarToggle');
const navItems          = document.querySelectorAll('.nav-item[data-view]');
const pageTitle         = document.getElementById('pageTitle');
const categoryNavList   = document.getElementById('categoryNavList');
const addCategoryBtn    = document.getElementById('addCategoryBtn');

const viewDashboard     = document.getElementById('view-dashboard');
const viewTasks         = document.getElementById('view-tasks');
const viewSettings      = document.getElementById('view-settings');

const statTotal         = document.getElementById('statTotal');
const statPending       = document.getElementById('statPending');
const statDone          = document.getElementById('statDone');
const statOverdue       = document.getElementById('statOverdue');
const dashToday         = document.getElementById('dashToday');
const dashUpcoming      = document.getElementById('dashUpcoming');
const dashHigh          = document.getElementById('dashHigh');

const taskList          = document.getElementById('taskList');
const searchInput       = document.getElementById('searchInput');
const filterStatus      = document.getElementById('filterStatus');
const filterPriority    = document.getElementById('filterPriority');
const filterCategory    = document.getElementById('filterCategory');
const sortBy            = document.getElementById('sortBy');

const addTaskTopBtn     = document.getElementById('addTaskTopBtn');
const themeToggle       = document.getElementById('themeToggle');
const logoutBtn         = document.getElementById('logoutBtn');
const usernameLabel     = document.getElementById('usernameLabel');

// Task modal
const taskModalBackdrop = document.getElementById('taskModalBackdrop');
const taskModal         = document.getElementById('taskModal');
const taskModalTitle    = document.getElementById('taskModalTitle');
const taskModalClose    = document.getElementById('taskModalClose');
const taskModalCancel   = document.getElementById('taskModalCancel');
const taskModalSave     = document.getElementById('taskModalSave');
const taskForm          = document.getElementById('taskForm');
const taskIdInput       = document.getElementById('taskIdInput');
const taskTitleInput    = document.getElementById('taskTitle');
const taskDescInput     = document.getElementById('taskDescription');
const taskPriorityInput = document.getElementById('taskPriority');
const taskCategoryInput = document.getElementById('taskCategory');
const taskDueDateInput  = document.getElementById('taskDueDate');
const taskDueTimeInput  = document.getElementById('taskDueTime');
const taskTagsInput     = document.getElementById('taskTags');
const taskTitleError    = document.getElementById('taskTitleError');

// Category modal
const catModalBackdrop  = document.getElementById('catModalBackdrop');
const catModal          = document.getElementById('catModal');
const catModalClose     = document.getElementById('catModalClose');
const catModalCancel    = document.getElementById('catModalCancel');
const catModalSave      = document.getElementById('catModalSave');
const catNameInput      = document.getElementById('catName');
const catNameError      = document.getElementById('catNameError');
const catColorInput     = document.getElementById('catColor');
const colorSwatches     = document.getElementById('colorSwatches');

// Delete modal
const deleteBackdrop    = document.getElementById('deleteBackdrop');
const deleteModal       = document.getElementById('deleteModal');
const deleteTaskName    = document.getElementById('deleteTaskName');
const deleteCancelBtn   = document.getElementById('deleteCancelBtn');
const deleteConfirmBtn  = document.getElementById('deleteConfirmBtn');

// Toast
const toastContainer    = document.getElementById('toastContainer');

// Settings
const settingsThemeLight     = document.getElementById('settingsThemeLight');
const settingsThemeDark      = document.getElementById('settingsThemeDark');
const settingsDefaultPriority= document.getElementById('settingsDefaultPriority');
const settingsCategoryList   = document.getElementById('settingsCategoryList');
const settingsAddCategoryBtn = document.getElementById('settingsAddCategoryBtn');
const settingsLogoutBtn      = document.getElementById('settingsLogoutBtn');

/* ================================================================
   THEME
   ================================================================ */
const THEME_ICONS = {
    light: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
    dark:  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
};

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    setSetting('theme', theme);
    // In dark mode show sun icon (click → go light). In light mode show moon.
    themeToggle.innerHTML = theme === 'dark' ? THEME_ICONS.dark : THEME_ICONS.light;
    themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    settingsThemeLight.setAttribute('aria-pressed', String(theme === 'light'));
    settingsThemeDark.setAttribute('aria-pressed',  String(theme === 'dark'));
}

function initTheme() { applyTheme(getSetting('theme', 'light')); }

themeToggle.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(cur === 'light' ? 'dark' : 'light');
});
settingsThemeLight.addEventListener('click', () => applyTheme('light'));
settingsThemeDark.addEventListener('click',  () => applyTheme('dark'));

/* ================================================================
   TOAST
   ================================================================ */
function showToast(text, type = 'success') {
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.setAttribute('role', 'status');
    el.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            ${type === 'error'
                ? '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'
                : '<polyline points="20 6 9 17 4 12"/>'}
        </svg>
        <span>${escHtml(text)}</span>`;
    toastContainer.appendChild(el);
    // Trigger animation
    requestAnimationFrame(() => el.classList.add('toast--visible'));
    setTimeout(() => {
        el.classList.remove('toast--visible');
        el.addEventListener('transitionend', () => el.remove(), { once: true });
    }, 3200);
}

/* ================================================================
   HTML ESCAPE
   ================================================================ */
function escHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ================================================================
   DATE UTILITIES
   ================================================================ */
function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function inNDays(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function isOverdue(task) {
    if (!task.dueDate || task.status === 'completed') return false;
    return task.dueDate < todayStr();
}

function isDueToday(task) {
    return task.dueDate === todayStr() && task.status !== 'completed';
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(m,10)-1]} ${parseInt(d,10)}, ${y}`;
}

function relativeDue(task) {
    if (!task.dueDate) return '';
    const today = todayStr();
    if (task.dueDate === today) return 'Today';
    if (task.dueDate < today)  return 'Overdue';
    const diff = Math.round((new Date(task.dueDate) - new Date(today)) / 86400000);
    if (diff === 1) return 'Tomorrow';
    if (diff <= 7)  return `In ${diff} days`;
    return formatDate(task.dueDate);
}

/* ================================================================
   NAVIGATION
   ================================================================ */
const VIEW_TITLES = {
    dashboard:     'Dashboard',
    all:           'All Tasks',
    today:         'Today',
    upcoming:      'Upcoming',
    completed:     'Completed',
    'high-priority': 'High Priority',
    settings:      'Settings',
};

function switchView(view, catId = null) {
    currentView       = view;
    currentCatFilter  = catId;

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('nav-item--active');
        el.removeAttribute('aria-current');
    });
    if (catId) {
        const catBtn = document.querySelector(`.nav-item[data-cat="${catId}"]`);
        if (catBtn) { catBtn.classList.add('nav-item--active'); catBtn.setAttribute('aria-current', 'page'); }
    } else {
        const btn = document.querySelector(`.nav-item[data-view="${view}"]`);
        if (btn) { btn.classList.add('nav-item--active'); btn.setAttribute('aria-current', 'page'); }
    }

    // Show/hide views
    viewDashboard.classList.toggle('view--hidden', view !== 'dashboard');
    viewTasks.classList.toggle('view--hidden', view === 'dashboard' || view === 'settings');
    viewSettings.classList.toggle('view--hidden', view !== 'settings');

    // Page title
    if (catId) {
        const cat = allCategories.find(c => c.id === catId);
        pageTitle.textContent = cat ? cat.name : 'Category';
    } else {
        pageTitle.textContent = VIEW_TITLES[view] || 'Tasks';
    }

    // Render appropriate content
    if (view === 'dashboard') {
        renderDashboard();
    } else if (view !== 'settings') {
        renderTaskList();
    } else {
        renderSettingsCategories();
    }

    // Close sidebar on mobile
    if (window.innerWidth < 768) closeSidebar();
}

// Nav click
navItems.forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
});

/* ================================================================
   SIDEBAR MOBILE TOGGLE
   ================================================================ */
function openSidebar() {
    sidebar.classList.add('sidebar--open');
    sidebarOverlay.classList.add('active');
    sidebarToggle.setAttribute('aria-expanded', 'true');
}
function closeSidebar() {
    sidebar.classList.remove('sidebar--open');
    sidebarOverlay.classList.remove('active');
    sidebarToggle.setAttribute('aria-expanded', 'false');
}
sidebarToggle.addEventListener('click', () => {
    sidebar.classList.contains('sidebar--open') ? closeSidebar() : openSidebar();
});
sidebarOverlay.addEventListener('click', closeSidebar);

/* ================================================================
   LOAD DATA
   ================================================================ */
async function loadAll() {
    await Promise.all([loadTasks(), loadCategories()]);
    renderAll();
}

async function loadTasks() {
    try {
        const res = await fetch(apiUrl('/api/tasks'), { headers: authHeaders() });
        if (res.status === 401) { handleUnauthorized(); return; }
        if (!res.ok) throw new Error('Failed to load tasks');
        allTasks = await res.json();
    } catch (e) {
        showToast('Could not load tasks — is the server running?', 'error');
    }
}

async function loadCategories() {
    try {
        const res = await fetch(apiUrl('/api/categories'), { headers: authHeaders() });
        if (res.status === 401) { handleUnauthorized(); return; }
        if (!res.ok) throw new Error('Failed to load categories');
        allCategories = await res.json();
    } catch (e) {
        showToast('Could not load categories.', 'error');
    }
}

function renderAll() {
    renderCategoryNav();
    populateCategoryDropdowns();
    if (currentView === 'dashboard') renderDashboard();
    else if (currentView !== 'settings') renderTaskList();
    else renderSettingsCategories();
}

/* ================================================================
   CATEGORY NAV + DROPDOWNS
   ================================================================ */
const CATEGORY_COLORS = [
    '#a78bfa','#f9a8d4','#86efac','#fde68a','#93c5fd',
    '#fdba74','#6ee7b7','#c4b5fd','#fca5a5','#5eead4',
];

function renderCategoryNav() {
    categoryNavList.innerHTML = '';
    allCategories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'nav-item nav-item--cat';
        btn.dataset.cat = cat.id;
        if (currentCatFilter === cat.id) {
            btn.classList.add('nav-item--active');
            btn.setAttribute('aria-current', 'page');
        }
        btn.innerHTML = `
            <span class="cat-dot" style="background:${escHtml(cat.color)}" aria-hidden="true"></span>
            <span class="nav-item-label">${escHtml(cat.name)}</span>`;
        btn.addEventListener('click', () => switchView('category', cat.id));
        categoryNavList.appendChild(btn);
    });
}

function populateCategoryDropdowns() {
    // Task modal dropdown
    const prev = taskCategoryInput.value;
    taskCategoryInput.innerHTML = '<option value="">No Category</option>';
    allCategories.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id; opt.textContent = c.name;
        taskCategoryInput.appendChild(opt);
    });
    taskCategoryInput.value = prev;

    // Filter bar dropdown
    const prevF = filterCategory.value;
    filterCategory.innerHTML = '<option value="all">All Categories</option>';
    allCategories.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id; opt.textContent = c.name;
        filterCategory.appendChild(opt);
    });
    filterCategory.value = prevF;
}

/* ================================================================
   DASHBOARD
   ================================================================ */
function renderDashboard() {
    const today    = todayStr();
    const week     = inNDays(7);
    const pending  = allTasks.filter(t => t.status === 'pending');
    const done     = allTasks.filter(t => t.status === 'completed');
    const overdue  = pending.filter(t => t.dueDate && t.dueDate < today);
    const dueToday = pending.filter(t => t.dueDate === today);
    const upcoming = pending.filter(t => t.dueDate && t.dueDate > today && t.dueDate <= week);
    const high     = pending.filter(t => t.priority === 'high');

    statTotal.textContent   = allTasks.length;
    statPending.textContent = pending.length;
    statDone.textContent    = done.length;
    statOverdue.textContent = overdue.length;

    renderCompactList(dashToday,    dueToday,  'No tasks due today — enjoy your day! 🎉');
    renderCompactList(dashUpcoming, upcoming,  'No upcoming tasks in the next 7 days.');
    renderCompactList(dashHigh,     high,      'No high-priority tasks. Nice work! ✅');
}

function renderCompactList(container, tasks, emptyMsg) {
    if (!tasks.length) {
        container.innerHTML = `<div class="empty-state empty-state--sm"><p class="empty-desc">${escHtml(emptyMsg)}</p></div>`;
        return;
    }
    container.innerHTML = tasks.slice(0, 8).map(t => buildCompactTaskHtml(t)).join('');
}

function buildCompactTaskHtml(t) {
    const overdue = isOverdue(t);
    return `
        <div class="task-item task-item--compact ${overdue ? 'task-item--overdue' : ''}"
             role="listitem" data-id="${escHtml(t.id)}">
            <button class="task-check ${t.status === 'completed' ? 'task-check--done' : ''}"
                    data-action="toggle" data-id="${escHtml(t.id)}"
                    aria-label="${t.status === 'completed' ? 'Mark incomplete' : 'Mark complete'}">
                ${t.status === 'completed' ? checkIcon() : ''}
            </button>
            <span class="task-item-title ${t.status === 'completed' ? 'task-item-title--done' : ''}">${escHtml(t.title)}</span>
            ${t.dueDate ? `<span class="task-due-chip ${overdue ? 'task-due-chip--overdue' : ''}">${escHtml(relativeDue(t))}</span>` : ''}
            <span class="priority-dot priority-dot--${escHtml(t.priority)}" aria-label="Priority: ${escHtml(t.priority)}" title="${escHtml(t.priority)} priority"></span>
        </div>`;
}

/* ================================================================
   TASK LIST VIEW
   ================================================================ */
function getFilteredSortedTasks() {
    const today  = todayStr();
    const week   = inNDays(7);
    const query  = searchInput.value.trim().toLowerCase();
    const fStat  = filterStatus.value;
    const fPri   = filterPriority.value;
    const fCat   = filterCategory.value;
    const sort   = sortBy.value;

    let tasks = [...allTasks];

    // View-level pre-filter
    switch (currentView) {
        case 'today':        tasks = tasks.filter(t => t.dueDate === today && t.status !== 'completed'); break;
        case 'upcoming':     tasks = tasks.filter(t => t.dueDate && t.dueDate > today && t.dueDate <= week); break;
        case 'completed':    tasks = tasks.filter(t => t.status === 'completed'); break;
        case 'high-priority':tasks = tasks.filter(t => t.priority === 'high' && t.status !== 'completed'); break;
        case 'category':     tasks = tasks.filter(t => t.categoryId === currentCatFilter); break;
        default: break; // 'all' — no pre-filter
    }

    // Toolbar filters
    if (fStat !== 'all')   tasks = tasks.filter(t => t.status === fStat);
    if (fPri  !== 'all')   tasks = tasks.filter(t => t.priority === fPri);
    if (fCat  !== 'all')   tasks = tasks.filter(t => t.categoryId === fCat);

    // Search
    if (query) {
        tasks = tasks.filter(t =>
            t.title.toLowerCase().includes(query) ||
            (t.description || '').toLowerCase().includes(query) ||
            (t.tags || '').toLowerCase().includes(query) ||
            (t.categoryName || '').toLowerCase().includes(query)
        );
    }

    // Sort
    const priOrder = { high: 0, medium: 1, low: 2 };
    tasks.sort((a, b) => {
        switch (sort) {
            case 'priority':
                if (priOrder[a.priority] !== priOrder[b.priority])
                    return priOrder[a.priority] - priOrder[b.priority];
                // secondary: due date asc
                if (!a.dueDate && !b.dueDate) return 0;
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return a.dueDate.localeCompare(b.dueDate);
            case 'dueDate':
                if (!a.dueDate && !b.dueDate) return 0;
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return a.dueDate.localeCompare(b.dueDate);
            case 'createdAt':
                return (b.createdAt || '').localeCompare(a.createdAt || '');
            case 'title':
                return a.title.localeCompare(b.title);
            default: return 0;
        }
    });

    return tasks;
}

function renderTaskList() {
    const tasks = getFilteredSortedTasks();
    if (!tasks.length) {
        const q = searchInput.value.trim();
        taskList.innerHTML = buildEmptyState(q);
        return;
    }
    taskList.innerHTML = tasks.map(t => buildTaskItemHtml(t)).join('');
}

function buildEmptyState(query) {
    if (query) {
        return `<div class="empty-state">
            <div class="empty-icon" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
            <p class="empty-title">No results for "${escHtml(query)}"</p>
            <p class="empty-desc">Try a different search term or adjust your filters.</p>
        </div>`;
    }
    const msgs = {
        today:    ['You\'re all caught up!', 'No tasks due today. Enjoy your free time.'],
        upcoming: ['Nothing upcoming', 'No tasks due in the next 7 days.'],
        completed:['No completed tasks yet', 'Mark tasks as done and they\'ll appear here.'],
        'high-priority': ['No high-priority tasks', 'All clear — no urgent items right now.'],
        default:  ['No tasks yet', 'Hit "+ Add Task" to create your first task.'],
    };
    const [title, desc] = msgs[currentView] || msgs.default;
    return `<div class="empty-state">
        <div class="empty-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        </div>
        <p class="empty-title">${escHtml(title)}</p>
        <p class="empty-desc">${escHtml(desc)}</p>
        <button class="btn btn-primary" onclick="openTaskModal()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Task
        </button>
    </div>`;
}

function buildTaskItemHtml(t) {
    const overdue   = isOverdue(t);
    const isDone    = t.status === 'completed';
    const dueLabel  = relativeDue(t);
    const cat       = allCategories.find(c => c.id === t.categoryId);
    const tags      = (t.tags || '').split(',').map(s => s.trim()).filter(Boolean);

    return `
    <article class="task-item ${isDone ? 'task-item--done' : ''} ${overdue ? 'task-item--overdue' : ''}"
             role="listitem" data-id="${escHtml(t.id)}">

        <button class="task-check ${isDone ? 'task-check--done' : ''}"
                data-action="toggle" data-id="${escHtml(t.id)}"
                aria-label="${isDone ? 'Mark incomplete' : 'Mark complete'}">
            ${isDone ? checkIcon() : ''}
        </button>

        <div class="task-body">
            <div class="task-row-top">
                <span class="task-title ${isDone ? 'task-title--done' : ''}">${escHtml(t.title)}</span>
                <span class="priority-badge priority-badge--${escHtml(t.priority)}">${escHtml(t.priority)}</span>
            </div>

            ${t.description ? `<p class="task-desc">${escHtml(t.description)}</p>` : ''}

            <div class="task-meta">
                ${dueLabel ? `
                <span class="task-meta-item ${overdue ? 'task-meta-item--overdue' : isDueToday(t) ? 'task-meta-item--today' : ''}">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    ${escHtml(dueLabel)}${t.dueTime ? ' · ' + escHtml(t.dueTime) : ''}
                </span>` : ''}

                ${cat ? `
                <span class="task-meta-item">
                    <span class="cat-dot cat-dot--sm" style="background:${escHtml(cat.color)}" aria-hidden="true"></span>
                    ${escHtml(cat.name)}
                </span>` : ''}

                ${tags.map(tag => `<span class="tag-chip">#${escHtml(tag)}</span>`).join('')}
            </div>
        </div>

        <div class="task-actions">
            <button class="icon-btn icon-btn--sm" data-action="edit" data-id="${escHtml(t.id)}" aria-label="Edit ${escHtml(t.title)}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="icon-btn icon-btn--sm icon-btn--danger" data-action="delete" data-id="${escHtml(t.id)}" aria-label="Delete ${escHtml(t.title)}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
        </div>
    </article>`;
}

function checkIcon() {
    return `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;
}

/* ================================================================
   TASK LIST EVENT DELEGATION
   ================================================================ */
function setupTaskListDelegation(container) {
    container.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const { action, id } = btn.dataset;
        if (action === 'toggle') await handleToggle(id);
        if (action === 'edit')   openTaskModalForEdit(id);
        if (action === 'delete') openDeleteModal(id);
    });
}

setupTaskListDelegation(taskList);
setupTaskListDelegation(dashToday);
setupTaskListDelegation(dashUpcoming);
setupTaskListDelegation(dashHigh);

/* ================================================================
   TOGGLE TASK
   ================================================================ */
async function handleToggle(taskId) {
    try {
        const res = await fetch(apiUrl(`/api/tasks/${taskId}/toggle`), {
            method: 'PUT', headers: authHeaders(),
        });
        if (res.status === 401) { handleUnauthorized(); return; }
        if (!res.ok) throw new Error();
        const updated = await res.json();
        // Update in-place
        const idx = allTasks.findIndex(t => t.id === updated.id);
        if (idx !== -1) allTasks[idx] = updated;
        renderAll();
        showToast(updated.status === 'completed' ? 'Task completed! ✓' : 'Task marked as pending.');
    } catch {
        showToast('Could not update task.', 'error');
    }
}

/* ================================================================
   SEARCH + FILTER LISTENERS
   ================================================================ */
searchInput.addEventListener('input', () => {
    if (currentView !== 'dashboard' && currentView !== 'settings') renderTaskList();
});
filterStatus.addEventListener('change',   renderTaskList);
filterPriority.addEventListener('change', renderTaskList);
filterCategory.addEventListener('change', renderTaskList);
sortBy.addEventListener('change',         renderTaskList);

/* ================================================================
   ADD TASK MODAL
   ================================================================ */
function openTaskModal() {
    editingTaskId = null;
    taskModalTitle.textContent = 'New Task';
    taskModalSave.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        Save Task`;
    taskForm.reset();
    taskIdInput.value = '';
    taskTitleError.textContent = '';
    taskPriorityInput.value = getSetting('defaultPriority', 'medium');
    showModal(taskModal, taskModalBackdrop);
    setTimeout(() => taskTitleInput.focus(), 50);
}

function openTaskModalForEdit(taskId) {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;
    editingTaskId = taskId;
    taskModalTitle.textContent = 'Edit Task';
    taskModalSave.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        Update Task`;
    taskTitleError.textContent = '';
    taskIdInput.value       = task.id;
    taskTitleInput.value    = task.title;
    taskDescInput.value     = task.description || '';
    taskPriorityInput.value = task.priority;
    taskCategoryInput.value = task.categoryId || '';
    taskDueDateInput.value  = task.dueDate || '';
    taskDueTimeInput.value  = task.dueTime || '';
    taskTagsInput.value     = task.tags || '';
    showModal(taskModal, taskModalBackdrop);
    setTimeout(() => taskTitleInput.focus(), 50);
}

addTaskTopBtn.addEventListener('click', openTaskModal);

taskModalClose.addEventListener('click',  () => hideModal(taskModal, taskModalBackdrop));
taskModalCancel.addEventListener('click', () => hideModal(taskModal, taskModalBackdrop));
taskModalBackdrop.addEventListener('click', () => hideModal(taskModal, taskModalBackdrop));

taskModalSave.addEventListener('click', async () => {
    const title = taskTitleInput.value.trim();
    if (!title) {
        taskTitleError.textContent = 'Title is required.';
        taskTitleInput.focus();
        return;
    }
    taskTitleError.textContent = '';

    const payload = {
        title,
        description: taskDescInput.value.trim(),
        priority:    taskPriorityInput.value,
        status:      editingTaskId ? (allTasks.find(t => t.id === editingTaskId)?.status || 'pending') : 'pending',
        categoryId:  taskCategoryInput.value,
        dueDate:     taskDueDateInput.value,
        dueTime:     taskDueTimeInput.value,
        tags:        taskTagsInput.value.trim(),
    };

    taskModalSave.disabled = true;
    taskModalSave.classList.add('is-loading');

    try {
        let res, data;
        if (editingTaskId) {
            res  = await fetch(apiUrl(`/api/tasks/${editingTaskId}`), {
                method: 'PUT',
                headers: authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify(payload),
            });
        } else {
            res  = await fetch(apiUrl('/api/tasks'), {
                method: 'POST',
                headers: authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify(payload),
            });
        }
        if (res.status === 401) { handleUnauthorized(); return; }
        if (!res.ok) throw new Error();
        data = await res.json();

        if (editingTaskId) {
            const idx = allTasks.findIndex(t => t.id === editingTaskId);
            if (idx !== -1) allTasks[idx] = data;
            showToast('Task updated.');
        } else {
            allTasks.unshift(data);
            showToast('Task created! ✓');
        }

        hideModal(taskModal, taskModalBackdrop);
        renderAll();
    } catch {
        showToast('Could not save task. Please try again.', 'error');
    } finally {
        taskModalSave.disabled = false;
        taskModalSave.classList.remove('is-loading');
    }
});

/* ================================================================
   DELETE MODAL
   ================================================================ */
function openDeleteModal(taskId) {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;
    pendingDeleteId = taskId;
    deleteTaskName.textContent = `"${task.title}"`;
    showModal(deleteModal, deleteBackdrop);
    setTimeout(() => deleteConfirmBtn.focus(), 50);
}

deleteCancelBtn.addEventListener('click', () => hideModal(deleteModal, deleteBackdrop));
deleteBackdrop.addEventListener('click',  () => hideModal(deleteModal, deleteBackdrop));

deleteConfirmBtn.addEventListener('click', async () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    hideModal(deleteModal, deleteBackdrop);

    // Optimistic removal
    const el = document.querySelector(`.task-item[data-id="${id}"]`);
    if (el) { el.style.opacity = '0.35'; el.style.pointerEvents = 'none'; }

    try {
        const res = await fetch(apiUrl(`/api/tasks/${id}`), {
            method: 'DELETE', headers: authHeaders(),
        });
        if (res.status === 401) { handleUnauthorized(); return; }
        if (!res.ok) throw new Error();
        allTasks = allTasks.filter(t => t.id !== id);
        showToast('Task deleted.');
        renderAll();
    } catch {
        if (el) { el.style.opacity = ''; el.style.pointerEvents = ''; }
        showToast('Could not delete task.', 'error');
    }
});

/* ================================================================
   CATEGORY MODAL
   ================================================================ */
function buildColorSwatches() {
    colorSwatches.innerHTML = '';
    CATEGORY_COLORS.forEach(color => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'color-swatch';
        btn.style.background = color;
        btn.dataset.color = color;
        btn.setAttribute('aria-label', `Color ${color}`);
        if (color === catColorInput.value) btn.classList.add('color-swatch--selected');
        btn.addEventListener('click', () => {
            catColorInput.value = color;
            document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('color-swatch--selected'));
            btn.classList.add('color-swatch--selected');
        });
        colorSwatches.appendChild(btn);
    });
}

function openCategoryModal() {
    catNameInput.value  = '';
    catNameError.textContent = '';
    catColorInput.value = CATEGORY_COLORS[0];
    buildColorSwatches();
    showModal(catModal, catModalBackdrop);
    setTimeout(() => catNameInput.focus(), 50);
}

[addCategoryBtn, settingsAddCategoryBtn].forEach(btn => {
    btn.addEventListener('click', openCategoryModal);
});
catModalClose.addEventListener('click',  () => hideModal(catModal, catModalBackdrop));
catModalCancel.addEventListener('click', () => hideModal(catModal, catModalBackdrop));
catModalBackdrop.addEventListener('click', () => hideModal(catModal, catModalBackdrop));

catModalSave.addEventListener('click', async () => {
    const name = catNameInput.value.trim();
    if (!name) { catNameError.textContent = 'Name is required.'; catNameInput.focus(); return; }
    catNameError.textContent = '';
    catModalSave.disabled = true;
    catModalSave.classList.add('is-loading');
    try {
        const res = await fetch(apiUrl('/api/categories'), {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ name, color: catColorInput.value }),
        });
        if (res.status === 401) { handleUnauthorized(); return; }
        if (!res.ok) throw new Error();
        const cat = await res.json();
        allCategories.push(cat);
        hideModal(catModal, catModalBackdrop);
        renderAll();
        showToast(`Category "${cat.name}" created.`);
    } catch {
        showToast('Could not create category.', 'error');
    } finally {
        catModalSave.disabled = false;
        catModalSave.classList.remove('is-loading');
    }
});

/* ================================================================
   SETTINGS
   ================================================================ */
function renderSettingsCategories() {
    if (!allCategories.length) {
        settingsCategoryList.innerHTML = `<p class="empty-desc" style="padding:0.5rem 0;">No categories yet.</p>`;
        return;
    }
    settingsCategoryList.innerHTML = allCategories.map(cat => `
        <div class="settings-cat-row">
            <span class="cat-dot" style="background:${escHtml(cat.color)}" aria-hidden="true"></span>
            <span class="settings-cat-name">${escHtml(cat.name)}</span>
            <button class="icon-btn icon-btn--sm icon-btn--danger" data-action="delete-cat" data-id="${escHtml(cat.id)}"
                    aria-label="Delete category ${escHtml(cat.name)}">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
        </div>`).join('');
}

settingsCategoryList.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="delete-cat"]');
    if (!btn) return;
    const id  = btn.dataset.id;
    const cat = allCategories.find(c => c.id === id);
    if (!cat) return;
    if (!confirm(`Delete category "${cat.name}"? Tasks in this category will be uncategorized.`)) return;
    try {
        const res = await fetch(apiUrl(`/api/categories/${id}`), {
            method: 'DELETE', headers: authHeaders(),
        });
        if (!res.ok) throw new Error();
        allCategories = allCategories.filter(c => c.id !== id);
        // Remove category from tasks locally
        allTasks.forEach(t => { if (t.categoryId === id) { t.categoryId = ''; t.categoryName = ''; } });
        renderAll();
        showToast(`Category "${cat.name}" deleted.`);
    } catch {
        showToast('Could not delete category.', 'error');
    }
});

settingsDefaultPriority.addEventListener('change', () => {
    setSetting('defaultPriority', settingsDefaultPriority.value);
});

/* ================================================================
   MODAL HELPERS
   ================================================================ */
function showModal(modal, backdrop) {
    backdrop.removeAttribute('hidden');
    backdrop.classList.add('active');
    modal.classList.add('modal--open');
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleModalKey);
}

function hideModal(modal, backdrop) {
    backdrop.classList.remove('active');
    modal.classList.remove('modal--open');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', handleModalKey);
    pendingDeleteId = null;
}

function handleModalKey(e) {
    if (e.key === 'Escape') {
        if (taskModal.classList.contains('modal--open'))   hideModal(taskModal, taskModalBackdrop);
        if (catModal.classList.contains('modal--open'))    hideModal(catModal, catModalBackdrop);
        if (deleteModal.classList.contains('modal--open')) hideModal(deleteModal, deleteBackdrop);
    }
}

/* ================================================================
   LOGOUT
   ================================================================ */
async function doLogout() {
    try {
        await fetch(apiUrl('/api/logout'), { method: 'POST', headers: authHeaders() });
    } catch (_) {}
    sessionStorage.removeItem('tf-token');
    sessionStorage.removeItem('tf-username');
    window.location.replace('./login.html');
}

logoutBtn.addEventListener('click', doLogout);
settingsLogoutBtn.addEventListener('click', doLogout);

/* ================================================================
   INIT
   ================================================================ */
function init() {
    // Set username
    usernameLabel.textContent = getUsername();

    // Apply saved settings
    initTheme();
    settingsDefaultPriority.value = getSetting('defaultPriority', 'medium');

    // Load data and render
    loadAll().then(() => switchView('dashboard'));
}

init();
