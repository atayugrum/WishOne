// js/config/api.js

const getBaseUrl = () => {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
        return 'http://localhost:3001'; // Local Functions Emulator
    }
    return ''; // Production (same origin)
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
        if (error.message.includes('Failed to fetch')) {
            console.warn("Backend unreachable. Ensure server is running on port 3001.");
            throw new Error("Service unavailable. Please try again later.");
        }
        throw error;
    }
}