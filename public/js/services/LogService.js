// js/services/LogService.js

const LOG_LEVELS = {
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR'
};

export const LogService = {
    init() {
        // Capture unhandled errors
        window.addEventListener('error', (event) => {
            this.error('Global Error', { message: event.message, filename: event.filename, lineno: event.lineno });
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.error('Unhandled Promise Rejection', { reason: event.reason });
        });

        console.log('LogService Initialized');
    },

    info(action, details = {}) {
        this._log(LOG_LEVELS.INFO, action, details);
    },

    warn(action, details = {}) {
        this._log(LOG_LEVELS.WARN, action, details);
    },

    error(action, details = {}) {
        this._log(LOG_LEVELS.ERROR, action, details);
        // In a real app, you would send this to Sentry/Firebase Crashlytics here
    },

    _log(level, action, details) {
        const timestamp = new Date().toISOString();
        const payload = { timestamp, level, action, ...details };

        // Console Output (styled)
        let style = 'color: grey';
        if (level === 'WARN') style = 'color: #ff9500';
        if (level === 'ERROR') style = 'color: #ff3b30; font-weight: bold';

        console.log(`%c[${level}] ${action}`, style, details);

        // Optional: Save critical errors to localStorage for debugging later
        if (level === 'ERROR') {
            const logs = JSON.parse(localStorage.getItem('app_error_logs') || '[]');
            logs.push(payload);
            if (logs.length > 20) logs.shift(); // Keep last 20
            localStorage.setItem('app_error_logs', JSON.stringify(logs));
        }
    }
};

// Initialize immediately
LogService.init();