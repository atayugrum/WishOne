// Changed port to 3001 to match server.js update
export const API_BASE_URL = 'http://localhost:3001';

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
            throw new Error(`API Error: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error("API Call Failed:", error);
        // Better error for UI to handle
        if (error.message.includes('Failed to fetch')) {
            console.warn("Backend seems down. Ensure server is running on port 3001.");
            throw new Error("Server unreachable");
        }
        throw error;
    }
}