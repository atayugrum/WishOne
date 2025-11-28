// js/config/api.js

// Dynamic Environment Detection
const getBaseUrl = () => {
    const host = window.location.hostname;

    // 1. Local Development
    if (host === 'localhost' || host === '127.0.0.1') {
        return 'http://localhost:3001';
    }

    // 2. Production (Firebase Hosting rewrites /api to Cloud Functions or Container)
    // If you deploy server.js to Cloud Run/Functions, you might use a specific URL.
    // For now, we assume the backend is served relative or proxied.
    return '';
};

export const API_BASE_URL = getBaseUrl();

export async function apiCall(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error("API Call Failed:", error);

        // Context-aware errors
        if (error.message.includes('Failed to fetch')) {
            console.warn("Backend unreachable. Is the server running?");
            throw new Error("Service unavailable. Please try again later.");
        }
        throw error;
    }
}