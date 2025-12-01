/* public/js/services/AIService.js */
import { apiCall } from '../config/api.js';

class AIService {
    
    // 1. Magic Get (Product Metadata)
    async getProductMetadata(url) {
        return apiCall('/api/product/metadata', 'POST', { url });
    }

    // 2. Combo Suggestions
    // items: Array of { id, title, category }
    async getComboSuggestions(items) {
        // Send lightweight payload
        const simplified = items.map(i => ({ id: i.id, title: i.title, category: i.category }));
        return apiCall('/api/ai/combo-suggestions', 'POST', { closetItems: simplified });
    }

    // 3. Purchase Planner
    // items: Array of { id, title, price, priority }
    async getPurchasePlan(items, budget, currency = 'TRY') {
        const simplified = items.map(i => ({ 
            id: i.id, 
            title: i.title, 
            price: i.price, 
            priority: i.priority 
        }));
        return apiCall('/api/ai/purchase-planner', 'POST', { wishlistItems: simplified, budget, currency });
    }

    // 4. Moodboard Helper
    async getMoodboardSuggestions(title, existingPins) {
        return apiCall('/api/ai/moodboard', 'POST', { title, existingPins });
    }

    // 5. Style Profile Analysis
    async getStyleProfile(items) {
        const simplified = items.map(i => ({ title: i.title, category: i.category }));
        return apiCall('/api/ai/style-profile', 'POST', { items: simplified });
    }

    // 6. Mascot Reaction
    async triggerReaction(action, context) {
        try {
            const res = await apiCall('/api/ai/reaction', 'POST', { userAction: action, context });
            if (window.mascot) {
                window.mascot.setMood(res.mood || 'happy', res.message || 'Nice!');
            }
        } catch (e) {
            console.warn("Mascot reaction failed", e);
        }
    }
}

export const aiService = new AIService();