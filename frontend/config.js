window.CONTACTFLOW_CONFIG = window.CONTACTFLOW_CONFIG || {};

const isLocalFile = window.location.protocol === 'file:';
const isLocalHost = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);

// Render replaces the deployment placeholder during the static-site build.
// Keep the service-name URL as a fallback so a skipped build substitution does
// not turn every API request into a request for the literal placeholder.
const deployedApiUrl = '__BACKEND_URL__';
const defaultDeployedApiUrl = 'https://contactflow-backend.onrender.com';
window.CONTACTFLOW_CONFIG.apiBaseUrl =
    window.CONTACTFLOW_CONFIG.apiBaseUrl ||
    (isLocalFile || isLocalHost
        ? 'http://localhost:8080'
        : deployedApiUrl.startsWith('__')
            ? defaultDeployedApiUrl
            : deployedApiUrl);
