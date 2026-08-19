'use strict';

/* ── API helpers ─────────────────────────────────────────── */
function getApiBaseUrl() {
    return (window.TASKFLOW_CONFIG || {}).apiBaseUrl || '';
}
function apiUrl(path) { return `${getApiBaseUrl()}${path}`; }

/* ── Redirect if already logged in ──────────────────────── */
(function checkExistingSession() {
    const token = sessionStorage.getItem('tf-token');
    if (token) {
        fetch(apiUrl('/api/me'), { headers: { 'Authorization': 'Bearer ' + token } })
            .then(res => { if (res.ok) window.location.replace('./index.html'); })
            .catch(() => {});
    }
})();

/* ── Theme ───────────────────────────────────────────────── */
const themeToggle = document.getElementById('themeToggle');

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('tf-theme', theme);
    themeToggle.innerHTML = theme === 'dark'
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
    themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
}

(function initTheme() {
    applyTheme(localStorage.getItem('tf-theme') || 'light');
})();

themeToggle.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(cur === 'light' ? 'dark' : 'light');
});

/* ── Tab switching ───────────────────────────────────────── */
const tabSignIn  = document.getElementById('tab-signin');
const tabSignUp  = document.getElementById('tab-signup');
const panelSignIn = document.getElementById('panel-signin');
const panelSignUp = document.getElementById('panel-signup');

function showTab(tab) {
    const isSignIn = tab === 'signin';
    tabSignIn.classList.toggle('auth-tab--active', isSignIn);
    tabSignUp.classList.toggle('auth-tab--active', !isSignIn);
    tabSignIn.setAttribute('aria-selected', String(isSignIn));
    tabSignUp.setAttribute('aria-selected', String(!isSignIn));
    panelSignIn.classList.toggle('auth-panel--hidden', !isSignIn);
    panelSignUp.classList.toggle('auth-panel--hidden', isSignIn);
    clearLoginErrors();
    clearRegisterErrors();
    setTimeout(() => {
        const first = isSignIn
            ? document.getElementById('loginUsername')
            : document.getElementById('regUsername');
        first && first.focus();
    }, 0);
}

tabSignIn.addEventListener('click', () => showTab('signin'));
tabSignUp.addEventListener('click', () => showTab('signup'));

/* ── Sign In ─────────────────────────────────────────────── */
const loginForm           = document.getElementById('loginForm');
const loginUsernameInput  = document.getElementById('loginUsername');
const loginPasswordInput  = document.getElementById('loginPassword');
const loginPasswordToggle = document.getElementById('loginPasswordToggle');
const loginBtn            = document.getElementById('loginBtn');
const loginError          = document.getElementById('loginError');

function clearLoginErrors() {
    loginError.hidden = true;
    loginError.textContent = '';
    loginUsernameInput.classList.remove('field-input--error');
    loginPasswordInput.classList.remove('field-input--error');
    document.getElementById('login-username-error').textContent = '';
    document.getElementById('login-password-error').textContent = '';
}

loginPasswordToggle.addEventListener('click', () => {
    const hidden = loginPasswordInput.type === 'password';
    loginPasswordInput.type = hidden ? 'text' : 'password';
    loginPasswordToggle.setAttribute('aria-pressed', String(hidden));
    loginPasswordToggle.setAttribute('aria-label', hidden ? 'Hide password' : 'Show password');
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearLoginErrors();
    const username = loginUsernameInput.value.trim();
    const password = loginPasswordInput.value.trim();
    let valid = true;
    if (!username) {
        loginUsernameInput.classList.add('field-input--error');
        document.getElementById('login-username-error').textContent = 'Username is required.';
        valid = false;
    }
    if (!password) {
        loginPasswordInput.classList.add('field-input--error');
        document.getElementById('login-password-error').textContent = 'Password is required.';
        valid = false;
    }
    if (!valid) return;

    loginBtn.disabled = true;
    loginBtn.classList.add('is-loading');
    try {
        const res  = await fetch(apiUrl('/api/login'), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (!res.ok) { loginError.textContent = data.error || 'Login failed.'; loginError.hidden = false; return; }
        sessionStorage.setItem('tf-token',    data.token);
        sessionStorage.setItem('tf-username', data.username);
        window.location.replace('./index.html');
    } catch {
        loginError.textContent = 'Could not reach the server. Is the backend running?';
        loginError.hidden = false;
    } finally {
        loginBtn.disabled = false;
        loginBtn.classList.remove('is-loading');
    }
});

/* ── Sign Up ─────────────────────────────────────────────── */
const registerForm      = document.getElementById('registerForm');
const regUsernameInput  = document.getElementById('regUsername');
const regPasswordInput  = document.getElementById('regPassword');
const regConfirmInput   = document.getElementById('regConfirm');
const regPasswordToggle = document.getElementById('regPasswordToggle');
const regConfirmToggle  = document.getElementById('regConfirmToggle');
const registerBtn       = document.getElementById('registerBtn');
const registerError     = document.getElementById('registerError');

function clearRegisterErrors() {
    registerError.hidden = true;
    registerError.textContent = '';
    [regUsernameInput, regPasswordInput, regConfirmInput].forEach(el => el.classList.remove('field-input--error'));
    ['reg-username-error','reg-password-error','reg-confirm-error'].forEach(id => {
        document.getElementById(id).textContent = '';
    });
}

function makeEyeToggle(btn, input) {
    btn.addEventListener('click', () => {
        const hidden = input.type === 'password';
        input.type = hidden ? 'text' : 'password';
        btn.setAttribute('aria-pressed', String(hidden));
        btn.setAttribute('aria-label', hidden ? 'Hide password' : 'Show password');
    });
}
makeEyeToggle(regPasswordToggle, regPasswordInput);
makeEyeToggle(regConfirmToggle, regConfirmInput);

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearRegisterErrors();
    const username = regUsernameInput.value.trim();
    const password = regPasswordInput.value.trim();
    const confirm  = regConfirmInput.value.trim();
    let valid = true;

    if (!username) {
        regUsernameInput.classList.add('field-input--error');
        document.getElementById('reg-username-error').textContent = 'Username is required.'; valid = false;
    } else if (username.length < 3) {
        regUsernameInput.classList.add('field-input--error');
        document.getElementById('reg-username-error').textContent = 'Username must be at least 3 characters.'; valid = false;
    }
    if (!password) {
        regPasswordInput.classList.add('field-input--error');
        document.getElementById('reg-password-error').textContent = 'Password is required.'; valid = false;
    } else if (password.length < 6) {
        regPasswordInput.classList.add('field-input--error');
        document.getElementById('reg-password-error').textContent = 'Password must be at least 6 characters.'; valid = false;
    }
    if (!confirm) {
        regConfirmInput.classList.add('field-input--error');
        document.getElementById('reg-confirm-error').textContent = 'Please confirm your password.'; valid = false;
    } else if (password && confirm !== password) {
        regConfirmInput.classList.add('field-input--error');
        document.getElementById('reg-confirm-error').textContent = 'Passwords do not match.'; valid = false;
    }
    if (!valid) return;

    registerBtn.disabled = true;
    registerBtn.classList.add('is-loading');
    try {
        const res  = await fetch(apiUrl('/api/register'), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (!res.ok) { registerError.textContent = data.error || 'Registration failed.'; registerError.hidden = false; return; }
        sessionStorage.setItem('tf-token',    data.token);
        sessionStorage.setItem('tf-username', data.username);
        window.location.replace('./index.html');
    } catch {
        registerError.textContent = 'Could not reach the server. Is the backend running?';
        registerError.hidden = false;
    } finally {
        registerBtn.disabled = false;
        registerBtn.classList.remove('is-loading');
    }
});
