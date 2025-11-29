import { authService } from './AuthService.js';
import { apiCall } from '../config/api.js';

export class AIService {

    // Trigger a dynamic reaction based on user action
    async triggerReaction(actionType, itemData = {}) {
        // Immediate local feedback (optional)
        if (window.aiCompanion) window.aiCompanion.setState('thinking');

        try {
            const user = authService.currentUser;

            // Build context for the AI
            const context = {
                itemName: itemData.title || "item",
                itemCategory: itemData.category || "general",
                user: user ? (user.displayName || "User") : "User"
            };

            // Call Backend
            const response = await apiCall('/api/ai/reaction', 'POST', {
                userAction: actionType,
                context: context
            });

            // Show result
            if (window.aiCompanion) {
                // response.message comes from Gemini
                // response.mood comes from Gemini
                window.aiCompanion.say(response.message, response.mood);
            }
            return response;

        } catch (e) {
            console.error("AI Reaction Failed:", e);
            // Silent fallback so the app doesn't break
            if (window.aiCompanion) window.aiCompanion.say("Nice choice!", "idle");
        }
    }

    getWelcomeMessage() {
        const user = authService.currentUser;
        const name = user ? user.displayName.split(' ')[0] : 'Dreamer';
        return {
            text: `Welcome back, ${name}. Ready to manifest?`,
            mood: 'welcome'
        };
    }
}

export const aiService = new AIService();