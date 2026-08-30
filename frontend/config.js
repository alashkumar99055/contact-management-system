window.CONTACTFLOW_CONFIG = window.CONTACTFLOW_CONFIG || {};

const isLocalFile = window.location.protocol === 'file:';
const isLocalHost = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);

// Production backend URL on Render
const deployedApiUrl = 'https://contact-management-system-backend-mjd1.onrender.com';
window.CONTACTFLOW_CONFIG.apiBaseUrl =
    window.CONTACTFLOW_CONFIG.apiBaseUrl ||
    (isLocalFile || isLocalHost
        ? 'http://localhost:8080'
        : deployedApiUrl);
