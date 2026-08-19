window.TASKFLOW_CONFIG = window.TASKFLOW_CONFIG || {};

const isLocalFile = window.location.protocol === 'file:';
const isLocalHost = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);

// Default to local backend when running locally, otherwise use deployed Render URL.
window.TASKFLOW_CONFIG.apiBaseUrl =
    window.TASKFLOW_CONFIG.apiBaseUrl ||
    (isLocalFile || isLocalHost ? 'http://localhost:8080' : 'https://task-management-system-backend-em55.onrender.com');
