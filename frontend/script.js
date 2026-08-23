/* ================================================================
   ContactFlow — script.js
   Full SPA logic: dashboard, CRUD, search/filter/sort,
   favorites, categories, detail panel, import/export CSV,
   theme, responsive sidebar, toasts, modals.
   ================================================================ */
'use strict';

/* ── API ──────────────────────────────────────────────────────── */
function getApiBaseUrl() { return (window.CONTACTFLOW_CONFIG || {}).apiBaseUrl || ''; }
function apiUrl(path)    { return `${getApiBaseUrl()}${path}`; }

/* ── Auth ─────────────────────────────────────────────────────── */
function getToken()    { return sessionStorage.getItem('cf-token'); }
function getUsername() { return sessionStorage.getItem('cf-username') || ''; }
function authHeaders(extra = {}) {
    const t = getToken();
    return { ...extra, ...(t ? { Authorization: 'Bearer ' + t } : {}) };
}
function handleUnauthorized() {
    sessionStorage.removeItem('cf-token');
    sessionStorage.removeItem('cf-username');
    window.location.replace('./login.html');
}
(function guard() { if (!getToken()) window.location.replace('./login.html'); })();

/* ── State ────────────────────────────────────────────────────── */
let allContacts     = [];
let currentView     = 'all';
let currentCat      = '';
let pendingDeleteId = null;
let editingId       = null;
let detailContactId = null;
let filterFavOnly   = false;

/* ── Settings ─────────────────────────────────────────────────── */
function getSetting(k, d) { return localStorage.getItem('cf-' + k) ?? d; }
function setSetting(k, v) { localStorage.setItem('cf-' + k, v); }

/* ── DOM ──────────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const sidebar        = $('sidebar');
const sidebarOverlay = $('sidebarOverlay');
const sidebarToggle  = $('sidebarToggle');
const pageTitle      = $('pageTitle');
const usernameLabel  = $('usernameLabel');
const sidebarAvatar  = $('sidebarAvatar');
const logoutBtn      = $('logoutBtn');
const themeToggle    = $('themeToggle');
const addContactBtn  = $('addContactBtn');
const searchInput    = $('searchInput');
const filterCategory = $('filterCategory');
const sortBy         = $('sortBy');
const filterFavBtn   = $('filterFavBtn');
const importBtn      = $('importBtn');
const exportBtn      = $('exportBtn');
const csvFileInput   = $('csvFileInput');
const resultsCount   = $('resultsCount');
const contactList    = $('contactList');
const navBadgeAll    = $('navBadgeAll');
const navBadgeFav    = $('navBadgeFav');
const toastContainer = $('toastContainer');

// Views
const viewDashboard = $('view-dashboard');
const viewAll       = $('view-all');
const viewSettings  = $('view-settings');

// Contact modal
const contactModalBackdrop = $('contactModalBackdrop');
const contactModal         = $('contactModal');
const contactModalTitle    = $('contactModalTitle');
const contactModalClose    = $('contactModalClose');
const contactModalCancel   = $('contactModalCancel');
const contactModalSave     = $('contactModalSave');
const contactForm          = $('contactForm');
const contactIdInput       = $('contactIdInput');
const contactNameInput     = $('contactName');
const contactPhoneInput    = $('contactPhone');
const contactEmailInput    = $('contactEmail');
const contactAddressInput  = $('contactAddress');
const contactCategoryInput = $('contactCategory');
const contactFavoriteInput = $('contactFavorite');
const contactNotesInput    = $('contactNotes');
const contactNameError     = $('contactNameError');
const contactEmailError    = $('contactEmailError');
const modalAvatar          = $('modalAvatar');

// Detail panel
const detailOverlay   = $('detailOverlay');
const detailPanel     = $('detailPanel');
const detailClose     = $('detailClose');
const detailEditBtn   = $('detailEditBtn');
const detailDeleteBtn = $('detailDeleteBtn');
const detailPanelBody = $('detailPanelBody');

// Delete modal
const deleteBackdrop    = $('deleteBackdrop');
const deleteModal       = $('deleteModal');
const deleteContactName = $('deleteContactName');
const deleteCancelBtn   = $('deleteCancelBtn');
const deleteConfirmBtn  = $('deleteConfirmBtn');

// Settings
const settingsThemeLight = $('settingsThemeLight');
const settingsThemeDark  = $('settingsThemeDark');
const settingsLogoutBtn  = $('settingsLogoutBtn');
const settingsExportBtn  = $('settingsExportBtn');
const settingsImportBtn  = $('settingsImportBtn');

/* ================================================================
   THEME
   ================================================================ */
const ICONS = {
    moon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
    sun:  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
};

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    setSetting('theme', theme);
    themeToggle.innerHTML = theme === 'dark' ? ICONS.sun : ICONS.moon;
    themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light' : 'Switch to dark');
    settingsThemeLight.setAttribute('aria-pressed', String(theme === 'light'));
    settingsThemeDark.setAttribute('aria-pressed',  String(theme === 'dark'));
}
themeToggle.addEventListener('click', () => {
    applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});
settingsThemeLight.addEventListener('click', () => applyTheme('light'));
settingsThemeDark.addEventListener('click',  () => applyTheme('dark'));

/* ================================================================
   TOAST
   ================================================================ */
function showToast(text, type = 'success') {
    const icon = type === 'error'
        ? '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'
        : type === 'info'
            ? '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'
            : '<polyline points="20 6 9 17 4 12"/>';
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.setAttribute('role', 'status');
    el.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${icon}</svg><span>${escHtml(text)}</span>`;
    toastContainer.appendChild(el);
    requestAnimationFrame(() => el.classList.add('toast--visible'));
    setTimeout(() => {
        el.classList.remove('toast--visible');
        el.addEventListener('transitionend', () => el.remove(), { once: true });
    }, 3400);
}

/* ================================================================
   UTILS
   ================================================================ */
function escHtml(s) {
    return String(s ?? '')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getInitials(name) {
    return (name || '?').trim().split(/\s+/).slice(0,2).map(w => w[0]?.toUpperCase() || '').join('');
}

function avatarColor(name) {
    const C = ['#6366f1','#ec4899','#10b981','#f59e0b','#3b82f6','#ef4444','#06b6d4','#8b5cf6','#f97316','#14b8a6'];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return C[Math.abs(h) % C.length];
}

function catClass(cat) {
    const m = { Family:'cat--family', Friends:'cat--friends', Work:'cat--work', College:'cat--college', Other:'cat--other' };
    return m[cat] || 'cat--other';
}

function catColor(cat) {
    const m = { Family:'#fbbf24', Friends:'#34d399', Work:'#60a5fa', College:'#a78bfa', Other:'#94a3b8' };
    return m[cat] || '#94a3b8';
}

function weekAgo() {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
}

/* ================================================================
   NAVIGATION
   ================================================================ */
const VIEW_TITLES = { dashboard:'Dashboard', all:'All Contacts', favorites:'Favorites', settings:'Settings' };

function switchView(view, cat = '') {
    currentView = view;
    currentCat  = cat;

    // Nav active state
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('nav-item--active');
        el.removeAttribute('aria-current');
    });
    if (view === 'cat') {
        const btn = document.querySelector(`.nav-item[data-cat="${escHtml(cat)}"]`);
        if (btn) { btn.classList.add('nav-item--active'); btn.setAttribute('aria-current','page'); }
    } else {
        const btn = document.querySelector(`.nav-item[data-view="${view}"]`);
        if (btn) { btn.classList.add('nav-item--active'); btn.setAttribute('aria-current','page'); }
    }

    // Show/hide views
    viewDashboard.classList.toggle('view--hidden', view !== 'dashboard');
    viewAll.classList.toggle('view--hidden',       view === 'dashboard' || view === 'settings');
    viewSettings.classList.toggle('view--hidden',  view !== 'settings');

    // Page title
    if (view === 'cat') {
        pageTitle.textContent = cat ? cat : 'All Categories';
        if (cat) filterCategory.value = cat;
    } else {
        pageTitle.textContent = VIEW_TITLES[view] || 'Contacts';
    }

    if (view === 'dashboard') renderDashboard();
    else if (view === 'favorites') { filterFavOnly = true; filterFavBtn.classList.add('active'); renderContactList(); }
    else if (view === 'cat') renderContactList();
    else if (view === 'all') renderContactList();

    if (window.innerWidth < 768) closeSidebar();
}

document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
        const v = btn.dataset.view;
        const c = btn.dataset.cat ?? '';
        if (v === 'cat') { filterCategory.value = c; switchView('cat', c); }
        else { if (v !== 'favorites') { filterFavOnly = false; filterFavBtn.classList.remove('active'); } switchView(v); }
    });
});

/* ── Sidebar mobile ─────────────────────────────────────────────── */
function openSidebar() { sidebar.classList.add('sidebar--open'); sidebarOverlay.classList.add('active'); sidebarToggle.setAttribute('aria-expanded','true'); }
function closeSidebar() { sidebar.classList.remove('sidebar--open'); sidebarOverlay.classList.remove('active'); sidebarToggle.setAttribute('aria-expanded','false'); }
sidebarToggle.addEventListener('click', () => sidebar.classList.contains('sidebar--open') ? closeSidebar() : openSidebar());
sidebarOverlay.addEventListener('click', closeSidebar);

/* ================================================================
   LOAD DATA
   ================================================================ */
async function loadContacts() {
    const params = buildQueryParams();
    try {
        const res = await fetch(apiUrl(`/api/contacts?${params}`), { headers: authHeaders() });
        if (res.status === 401) { handleUnauthorized(); return; }
        if (!res.ok) throw new Error(await res.text());
        allContacts = await res.json();
    } catch (e) {
        showToast('Could not load contacts — is the server running?', 'error');
        allContacts = [];
    }
}

function buildQueryParams() {
    const params = new URLSearchParams();
    const q = searchInput.value.trim();
    if (q) params.set('search', q);
    const cat = (currentView === 'cat') ? currentCat : filterCategory.value;
    if (cat) params.set('category', cat);
    if (filterFavOnly) params.set('favorites', 'true');
    params.set('sort', sortBy.value || 'name_asc');
    return params.toString();
}

/* ================================================================
   RENDER CONTACT LIST
   ================================================================ */
function renderContactList() {
    if (!allContacts.length) {
        const q = searchInput.value.trim();
        contactList.innerHTML = buildEmptyState(q);
        resultsCount.textContent = '';
        return;
    }
    resultsCount.textContent = `${allContacts.length} contact${allContacts.length !== 1 ? 's' : ''}`;
    contactList.innerHTML = allContacts.map(c => buildCardHtml(c)).join('');
}

function buildEmptyState(query) {
    if (query) {
        return `<div class="empty-state fade-up">
            <div class="empty-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
            <p class="empty-title">No results for "${escHtml(query)}"</p>
            <p class="empty-desc">Try a different name, phone, or email.</p>
        </div>`;
    }
    if (filterFavOnly) {
        return `<div class="empty-state fade-up">
            <div class="empty-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>
            <p class="empty-title">No favorites yet</p>
            <p class="empty-desc">Star a contact to add them to your favorites.</p>
        </div>`;
    }
    return `<div class="empty-state fade-up">
        <div class="empty-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div>
        <p class="empty-title">No contacts yet</p>
        <p class="empty-desc">Click "+ Add Contact" to create your first contact.</p>
        <button class="btn btn-primary" onclick="openContactModal()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Contact
        </button>
    </div>`;
}

function buildCardHtml(c) {
    const initials = getInitials(c.name);
    const color    = avatarColor(c.name);
    const catCls   = c.category ? catClass(c.category) : '';
    const catBadge = c.category
        ? `<span class="contact-card-cat ${catCls}">${escHtml(c.category)}</span>` : '';
    const favCls   = c.favorite ? 'is-fav' : '';
    const starFill = c.favorite ? 'currentColor' : 'none';

    const phoneLine   = c.phone ? `<div class="contact-detail">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        <span>${escHtml(c.phone)}</span></div>` : '';
    const emailLine   = c.email ? `<div class="contact-detail">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        <span>${escHtml(c.email)}</span></div>` : '';
    const notesLine   = c.notes ? `<p class="contact-notes-preview">${escHtml(c.notes)}</p>` : '';

    return `<article class="contact-card fade-up" role="listitem" data-id="${escHtml(c.id)}"
        style="--card-accent:${color}">
        <div class="contact-card-hd">
            <div class="contact-avatar" style="background:${color}">${escHtml(initials)}</div>
            <div class="contact-card-info">
                <div class="contact-card-name">${escHtml(c.name)}</div>
                ${catBadge}
            </div>
            <div class="contact-card-actions">
                <button class="contact-fav-btn ${favCls}" data-action="fav" data-id="${escHtml(c.id)}" aria-label="Toggle favorite" title="Toggle favorite">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="${starFill}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </button>
                <button class="icon-btn icon-btn--sm" data-action="edit" data-id="${escHtml(c.id)}" aria-label="Edit">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="icon-btn icon-btn--sm icon-btn--danger" data-action="delete" data-id="${escHtml(c.id)}" aria-label="Delete">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </button>
            </div>
        </div>
        <div class="contact-card-details">
            ${phoneLine}${emailLine}${notesLine}
        </div>
    </article>`;
}

/* Card event delegation */
contactList.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]');
    if (btn) {
        e.stopPropagation();
        const { action, id } = btn.dataset;
        if (action === 'fav')    await toggleFav(id);
        if (action === 'edit')   openContactModalForEdit(id);
        if (action === 'delete') openDeleteModal(id);
        return;
    }
    // Click on card body → open detail panel
    const card = e.target.closest('.contact-card');
    if (card) openDetailPanel(card.dataset.id);
});

/* ================================================================
   SEARCH / FILTER / SORT
   ================================================================ */
let searchDebounce;
searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(async () => {
        await loadContacts();
        renderContactList();
        updateBadges();
    }, 250);
});

filterCategory.addEventListener('change', async () => {
    currentCat = filterCategory.value;
    await loadContacts();
    renderContactList();
});

sortBy.addEventListener('change', async () => {
    await loadContacts();
    renderContactList();
});

filterFavBtn.addEventListener('click', async () => {
    filterFavOnly = !filterFavOnly;
    filterFavBtn.classList.toggle('active', filterFavOnly);
    await loadContacts();
    renderContactList();
});

/* ================================================================
   DASHBOARD
   ================================================================ */
async function renderDashboard() {
    try {
        const res = await fetch(apiUrl('/api/dashboard'), { headers: authHeaders() });
        if (res.status === 401) { handleUnauthorized(); return; }
        if (!res.ok) throw new Error();
        const data = await res.json();

        $('dTotal').textContent  = data.total;
        $('dFavs').textContent   = data.favorites;
        $('dCats').textContent   = (data.byCategory || []).filter(c => c.category !== 'Uncategorized').length;

        // Count added this week
        const weekCount = (data.recent || []).filter(c => {
            return c.createdAt && new Date(c.createdAt) > weekAgo();
        }).length;
        $('dRecent').textContent = weekCount;

        // Recently added list
        const recentEl = $('dashRecentList');
        if (!data.recent || !data.recent.length) {
            recentEl.innerHTML = `<p style="font-size:0.83rem;color:var(--text-muted);padding:8px 0">No contacts yet.</p>`;
        } else {
            recentEl.innerHTML = data.recent.map(c => {
                const color = avatarColor(c.name);
                return `<div class="dash-contact-item" data-id="${escHtml(c.id)}">
                    <div class="dash-contact-item-avatar" style="background:${color}">${escHtml(getInitials(c.name))}</div>
                    <div>
                        <div class="dash-contact-item-name">${escHtml(c.name)}</div>
                        <div class="dash-contact-item-meta">${escHtml(c.phone || c.email || c.category || '')}</div>
                    </div>
                </div>`;
            }).join('');
            recentEl.querySelectorAll('.dash-contact-item').forEach(el => {
                el.addEventListener('click', () => { switchView('all'); setTimeout(() => openDetailPanel(el.dataset.id), 100); });
            });
        }

        // Category bar chart
        const catEl = $('dashCatChart');
        const cats = (data.byCategory || []).filter(c => c.count > 0 && c.category !== 'Uncategorized');
        if (!cats.length) {
            catEl.innerHTML = `<p style="font-size:0.83rem;color:var(--text-muted);padding:8px 0">No categorized contacts yet.</p>`;
        } else {
            const max = Math.max(...cats.map(c => c.count), 1);
            catEl.innerHTML = cats.map(c => {
                const pct = Math.round((c.count / max) * 100);
                const color = catColor(c.category);
                return `<div class="cat-bar-row">
                    <div class="cat-bar-label">
                        <span>${escHtml(c.category)}</span>
                        <span>${c.count}</span>
                    </div>
                    <div class="cat-bar-track">
                        <div class="cat-bar-fill" style="width:${pct}%;background:${color}"></div>
                    </div>
                </div>`;
            }).join('');
        }
    } catch {
        showToast('Could not load dashboard data.', 'error');
    }
}

/* ================================================================
   BADGES
   ================================================================ */
async function updateBadges() {
    try {
        const [allRes, favRes] = await Promise.all([
            fetch(apiUrl('/api/contacts'), { headers: authHeaders() }),
            fetch(apiUrl('/api/contacts?favorites=true'), { headers: authHeaders() }),
        ]);
        if (allRes.ok) navBadgeAll.textContent = (await allRes.json()).length || '';
        if (favRes.ok) navBadgeFav.textContent = (await favRes.json()).length || '';
    } catch {}
}

/* ================================================================
   DETAIL PANEL
   ================================================================ */
function openDetailPanel(contactId) {
    const c = allContacts.find(x => x.id === contactId);
    if (!c) return;
    detailContactId = contactId;
    const color    = avatarColor(c.name);
    const initials = getInitials(c.name);
    const catBadge = c.category
        ? `<span class="contact-card-cat ${catClass(c.category)}">${escHtml(c.category)}</span>` : '';
    const favCls   = c.favorite ? 'is-fav' : '';
    const starFill = c.favorite ? 'currentColor' : 'none';

    const field = (label, val, isLink = false) => {
        if (!val) return '';
        const display = isLink
            ? `<a href="${escHtml(val)}" target="_blank" rel="noopener">${escHtml(val)}</a>`
            : escHtml(val);
        return `<div class="detail-field">
            <div class="detail-field-label">${escHtml(label)}</div>
            <div class="detail-field-value">${display}</div>
        </div>`;
    };

    detailPanelBody.innerHTML = `
        <div class="detail-avatar-wrap">
            <div class="detail-avatar" style="background:${color}">${escHtml(initials)}</div>
            <div class="detail-name">${escHtml(c.name)}</div>
            <div class="detail-cat">${catBadge}</div>
            <button class="detail-fav-btn ${favCls}" id="detailFavBtn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="${starFill}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                ${c.favorite ? 'Favorited' : 'Add to Favorites'}
            </button>
        </div>
        <div class="detail-fields">
            ${field('Phone', c.phone)}
            ${field('Email', c.email ? 'mailto:'+c.email : '', true)}
            ${c.email ? `<div class="detail-field"><div class="detail-field-label">Email</div><div class="detail-field-value"><a href="mailto:${escHtml(c.email)}">${escHtml(c.email)}</a></div></div>` : ''}
            ${field('Address', c.address)}
            ${field('Notes', c.notes)}
        </div>`;

    // Fix: rebuild without duplicate email
    detailPanelBody.innerHTML = `
        <div class="detail-avatar-wrap">
            <div class="detail-avatar" style="background:${color}">${escHtml(initials)}</div>
            <div class="detail-name">${escHtml(c.name)}</div>
            <div class="detail-cat">${catBadge}</div>
            <button class="detail-fav-btn ${favCls}" id="detailFavBtn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="${starFill}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                ${c.favorite ? 'Favorited' : 'Add to Favorites'}
            </button>
        </div>
        <div class="detail-fields">
            ${c.phone   ? `<div class="detail-field"><div class="detail-field-label">Phone</div><div class="detail-field-value"><a href="tel:${escHtml(c.phone)}">${escHtml(c.phone)}</a></div></div>` : ''}
            ${c.email   ? `<div class="detail-field"><div class="detail-field-label">Email</div><div class="detail-field-value"><a href="mailto:${escHtml(c.email)}">${escHtml(c.email)}</a></div></div>` : ''}
            ${c.address ? `<div class="detail-field"><div class="detail-field-label">Address</div><div class="detail-field-value">${escHtml(c.address)}</div></div>` : ''}
            ${c.notes   ? `<div class="detail-field"><div class="detail-field-label">Notes</div><div class="detail-field-value">${escHtml(c.notes)}</div></div>` : ''}
        </div>`;

    $('detailFavBtn').addEventListener('click', async () => {
        await toggleFav(detailContactId);
        openDetailPanel(detailContactId); // refresh
    });

    detailPanel.removeAttribute('hidden');
    detailOverlay.removeAttribute('hidden');
}

function closeDetailPanel() {
    detailPanel.setAttribute('hidden','');
    detailOverlay.setAttribute('hidden','');
    detailContactId = null;
}

detailClose.addEventListener('click', closeDetailPanel);
detailOverlay.addEventListener('click', closeDetailPanel);
detailEditBtn.addEventListener('click', () => { closeDetailPanel(); openContactModalForEdit(detailContactId); });
detailDeleteBtn.addEventListener('click', () => { closeDetailPanel(); openDeleteModal(detailContactId); });

/* ================================================================
   FAVORITE TOGGLE
   ================================================================ */
async function toggleFav(contactId) {
    try {
        const res = await fetch(apiUrl(`/api/contacts/${contactId}/favorite`), {
            method: 'PUT', headers: authHeaders(),
        });
        if (res.status === 401) { handleUnauthorized(); return; }
        if (!res.ok) throw new Error();
        const updated = await res.json();
        const idx = allContacts.findIndex(c => c.id === contactId);
        if (idx !== -1) allContacts[idx] = updated;
        renderContactList();
        updateBadges();
        showToast(updated.favorite ? 'Added to favorites ★' : 'Removed from favorites');
    } catch {
        showToast('Could not update favorite.', 'error');
    }
}

/* ================================================================
   ADD / EDIT MODAL
   ================================================================ */
function openContactModal() {
    editingId = null;
    contactModalTitle.textContent = 'New Contact';
    contactModalSave.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save Contact`;
    contactForm.reset();
    contactIdInput.value = '';
    contactNameError.textContent = '';
    contactEmailError.textContent = '';
    modalAvatar.textContent = '?';
    modalAvatar.style.background = 'var(--accent)';
    showModal(contactModal, contactModalBackdrop);
    setTimeout(() => contactNameInput.focus(), 50);
}

function openContactModalForEdit(contactId) {
    const c = allContacts.find(x => x.id === contactId);
    if (!c) return;
    editingId = contactId;
    contactModalTitle.textContent = 'Edit Contact';
    contactModalSave.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Update Contact`;
    contactNameError.textContent  = '';
    contactEmailError.textContent = '';
    contactIdInput.value          = c.id;
    contactNameInput.value        = c.name;
    contactPhoneInput.value       = c.phone    || '';
    contactEmailInput.value       = c.email    || '';
    contactAddressInput.value     = c.address  || '';
    contactCategoryInput.value    = c.category || '';
    contactFavoriteInput.checked  = c.favorite || false;
    contactNotesInput.value       = c.notes    || '';
    updateModalAvatar();
    showModal(contactModal, contactModalBackdrop);
    setTimeout(() => contactNameInput.focus(), 50);
}

function updateModalAvatar() {
    const name = contactNameInput.value.trim();
    if (name) {
        modalAvatar.textContent = getInitials(name);
        modalAvatar.style.background = avatarColor(name);
    } else {
        modalAvatar.textContent = '?';
        modalAvatar.style.background = 'var(--accent)';
    }
}
contactNameInput.addEventListener('input', updateModalAvatar);

addContactBtn.addEventListener('click', openContactModal);
contactModalClose.addEventListener('click',    () => hideModal(contactModal, contactModalBackdrop));
contactModalCancel.addEventListener('click',   () => hideModal(contactModal, contactModalBackdrop));
contactModalBackdrop.addEventListener('click', () => hideModal(contactModal, contactModalBackdrop));

contactModalSave.addEventListener('click', async () => {
    const name = contactNameInput.value.trim();
    if (!name) { contactNameError.textContent = 'Name is required.'; contactNameInput.focus(); return; }
    contactNameError.textContent = '';

    const email = contactEmailInput.value.trim();
    if (email && !email.includes('@')) { contactEmailError.textContent = 'Enter a valid email.'; contactEmailInput.focus(); return; }
    contactEmailError.textContent = '';

    const payload = {
        name,
        phone:    contactPhoneInput.value.trim(),
        email,
        address:  contactAddressInput.value.trim(),
        category: contactCategoryInput.value,
        notes:    contactNotesInput.value.trim(),
        favorite: String(contactFavoriteInput.checked),
    };

    contactModalSave.disabled = true;
    contactModalSave.classList.add('is-loading');
    try {
        const res = editingId
            ? await fetch(apiUrl(`/api/contacts/${editingId}`), { method:'PUT',  headers: authHeaders({'Content-Type':'application/json'}), body: JSON.stringify(payload) })
            : await fetch(apiUrl('/api/contacts'),                { method:'POST', headers: authHeaders({'Content-Type':'application/json'}), body: JSON.stringify(payload) });
        if (res.status === 401) { handleUnauthorized(); return; }
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            showToast(err.error || 'Could not save contact.', 'error');
            return;
        }
        const data = await res.json();
        if (editingId) {
            const idx = allContacts.findIndex(c => c.id === editingId);
            if (idx !== -1) allContacts[idx] = data;
            showToast('Contact updated.');
        } else {
            allContacts.unshift(data);
            showToast('Contact added! ✓');
        }
        hideModal(contactModal, contactModalBackdrop);
        renderContactList();
        updateBadges();
    } catch {
        showToast('Could not save contact. Check your connection.', 'error');
    } finally {
        contactModalSave.disabled = false;
        contactModalSave.classList.remove('is-loading');
    }
});

/* ================================================================
   DELETE MODAL
   ================================================================ */
function openDeleteModal(contactId) {
    const c = allContacts.find(x => x.id === contactId);
    if (!c) return;
    pendingDeleteId = contactId;
    deleteContactName.textContent = `"${c.name}"`;
    showModal(deleteModal, deleteBackdrop);
    setTimeout(() => deleteConfirmBtn.focus(), 50);
}

deleteCancelBtn.addEventListener('click', () => hideModal(deleteModal, deleteBackdrop));
deleteBackdrop.addEventListener('click',  () => hideModal(deleteModal, deleteBackdrop));

deleteConfirmBtn.addEventListener('click', async () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    hideModal(deleteModal, deleteBackdrop);
    // Optimistic
    const el = document.querySelector(`.contact-card[data-id="${id}"]`);
    if (el) { el.style.opacity = '0.35'; el.style.pointerEvents = 'none'; }
    try {
        const res = await fetch(apiUrl(`/api/contacts/${id}`), { method:'DELETE', headers: authHeaders() });
        if (res.status === 401) { handleUnauthorized(); return; }
        if (!res.ok) throw new Error();
        allContacts = allContacts.filter(c => c.id !== id);
        showToast('Contact deleted.');
        renderContactList();
        updateBadges();
    } catch {
        if (el) { el.style.opacity = ''; el.style.pointerEvents = ''; }
        showToast('Could not delete contact.', 'error');
    }
});

/* ================================================================
   IMPORT / EXPORT
   ================================================================ */
async function exportContacts() {
    try {
        const res = await fetch(apiUrl('/api/contacts/export'), { headers: authHeaders() });
        if (res.status === 401) { handleUnauthorized(); return; }
        if (!res.ok) throw new Error();
        const csv  = await res.text();
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = 'contacts.csv';
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
        showToast('Contacts exported to CSV.');
    } catch {
        showToast('Export failed.', 'error');
    }
}

function triggerImport() { csvFileInput.value = ''; csvFileInput.click(); }

csvFileInput.addEventListener('change', async () => {
    const file = csvFileInput.files[0];
    if (!file) return;
    try {
        const text = await file.text();
        const res  = await fetch(apiUrl('/api/contacts/import'), {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'text/plain' }),
            body: text,
        });
        if (res.status === 401) { handleUnauthorized(); return; }
        const data = await res.json();
        if (!res.ok) { showToast(data.error || 'Import failed.', 'error'); return; }
        showToast(`Imported ${data.imported} contact${data.imported !== 1 ? 's' : ''} ✓`);
        await loadContacts();
        renderContactList();
        updateBadges();
    } catch {
        showToast('Import failed. Check the CSV format.', 'error');
    }
});

exportBtn.addEventListener('click', exportContacts);
importBtn.addEventListener('click', triggerImport);
settingsExportBtn.addEventListener('click', exportContacts);
settingsImportBtn.addEventListener('click', triggerImport);

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
    if (e.key !== 'Escape') return;
    if (contactModal.classList.contains('modal--open')) hideModal(contactModal, contactModalBackdrop);
    if (deleteModal.classList.contains('modal--open'))  hideModal(deleteModal, deleteBackdrop);
    if (!detailPanel.hidden) closeDetailPanel();
}

/* ================================================================
   LOGOUT
   ================================================================ */
async function doLogout() {
    try { await fetch(apiUrl('/api/logout'), { method:'POST', headers: authHeaders() }); } catch {}
    sessionStorage.removeItem('cf-token');
    sessionStorage.removeItem('cf-username');
    window.location.replace('./login.html');
}
logoutBtn.addEventListener('click', doLogout);
settingsLogoutBtn.addEventListener('click', doLogout);

/* ================================================================
   INIT
   ================================================================ */
async function init() {
    // User info
    const uname = getUsername();
    usernameLabel.textContent = uname;
    sidebarAvatar.textContent = uname ? uname[0].toUpperCase() : '?';

    // Theme
    applyTheme(getSetting('theme', 'light'));

    // Load
    await loadContacts();
    renderContactList();
    updateBadges();
    switchView('all');
}

init();
