window.PASSWORD_MANAGER_CONFIG = window.PASSWORD_MANAGER_CONFIG || {};

const isLocalFile = window.location.protocol === 'file:';
const isLocalHost = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);

// Default to local backend when running locally, otherwise use deployed Render URL.
window.PASSWORD_MANAGER_CONFIG.apiBaseUrl =
    window.PASSWORD_MANAGER_CONFIG.apiBaseUrl ||
    (isLocalFile || isLocalHost ? 'http://localhost:8080' : 'https://password-manager-backend-51mg.onrender.com');
