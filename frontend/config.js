window.CONTACTFLOW_CONFIG = window.CONTACTFLOW_CONFIG || {};

const isLocalFile = window.location.protocol === 'file:';
const isLocalHost = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);

// Local backend when running on localhost / file:// — change to your deployed URL when hosting.
window.CONTACTFLOW_CONFIG.apiBaseUrl =
    window.CONTACTFLOW_CONFIG.apiBaseUrl ||
    (isLocalFile || isLocalHost
        ? 'http://localhost:8080'
        : 'https://your-deployed-backend.onrender.com'); // ← replace with your hosted URL
