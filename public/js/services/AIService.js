/* public/js/services/AIService.js */
import { authService } from './AuthService.js';
import { apiCall } from '../config/api.js';
import { FEATURES } from '../config/limits.js';

export class AIService {

    // 1. Centralized API Wrapper
    async _callAI(endpoint, payload, featureName = null) {
        // Check limits if feature name provided
        if (featureName && !authService.canUseFeature(featureName)) {
            throw new Error("LIMIT_REACHED");
        }

        // Global "Thinking" state for the mascot
        if (window.aiCompanion) window.aiCompanion.setState('thinking');

        try {
            const result = await apiCall(endpoint, 'POST', payload);

            // Track usage
            if (featureName) authService.trackFeatureUsage(featureName);

            // Success feedback
            if (window.aiCompanion) window.aiCompanion.setState('idle'); // Reset

            return result;
        } catch (error) {
            console.error(`AI Error [${endpoint}]:`, error);
            if (window.aiCompanion) window.aiCompanion.say("My brain is tired...", "error");
            throw error;
        }
    }

    // 2. Link Parsing ("Magic Add")
    async parseProductLink(url) {
        const data = await this._callAI('/api/product/metadata', { url }, FEATURES.MAGIC_ADD);
        if (window.aiCompanion) window.aiCompanion.say("I found it!", "magic");
        return data;
    }

    // 3. Combo Suggestions
    async getComboSuggestions(items, occasion = null) {
        const data = await this._callAI('/api/ai/combo-suggestions', { items, occasion }, FEATURES.AI_COMBOS);
        if (window.aiCompanion) window.aiCompanion.say("Try this look!", "presenting");
        return data.suggestions || [];
    }

    // 4. Purchase Planner
    async getPurchasePlan(wishlistItems, budget, currency = 'TRY') {
        const data = await this._callAI('/api/ai/purchase-planner', { wishlistItems, budget, currency }, FEATURES.AI_PLANNER);
        if (window.aiCompanion) window.aiCompanion.say("Here's a smart plan.", "thinking");
        return data;
    }

    // 5. Style Profile (New)
    async getStyleProfile(items) {
        // No specific limit for style profile yet, or reuse PLANNER limit
        const data = await this._callAI('/api/ai/style-profile', { items });
        return data;
    }

    // 6. Moodboard Ideas
    async getMoodboardSuggestions(title, existingPins) {
        const data = await this._callAI('/api/ai/moodboard', { title, existingPins }, FEATURES.MAGIC_ADD);
        return data;
    }

    // 7. Reactions (Mascot)
    async triggerReaction(actionType, itemData = {}) {
        // Fire and forget - don't await
        const context = {
            itemName: itemData.title || "item",
            user: authService.currentUser ? authService.currentUser.displayName : "User"
        };

        apiCall('/api/ai/reaction', 'POST', { userAction: actionType, context })
            .then(res => {
                if (window.aiCompanion) window.aiCompanion.say(res.message, res.mood);
            })
            .catch(() => { });
    }
}

export const aiService = new AIService();