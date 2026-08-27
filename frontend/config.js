window.CONTACTFLOW_CONFIG = window.CONTACTFLOW_CONFIG || {};

const isLocalFile = window.location.protocol === 'file:';
const isLocalHost = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);

// Render replaces the deployment placeholder during the static-site build.
const deployedApiUrl = '__BACKEND_URL__';
window.CONTACTFLOW_CONFIG.apiBaseUrl =
    window.CONTACTFLOW_CONFIG.apiBaseUrl ||
    (isLocalFile || isLocalHost
        ? 'http://localhost:8080'
        : deployedApiUrl);
