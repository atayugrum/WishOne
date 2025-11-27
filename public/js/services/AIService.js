import { authService } from './AuthService.js';
import { apiCall } from '../config/api.js';

export class AIService {
    constructor() {
        this.quotes = {
            welcome: [
                "Good energy today.",
                "Ready to manifest?",
                "Your dreams look good on you."
            ]
        };
    }

    // Decide what to say based on the item added
    async getReaction(item) {
        try {
            // Try to get a smart reaction from the backend
            const response = await apiCall('/api/ai/reaction', 'POST', {
                action: 'add_item',
                userContext: { name: authService.currentUser?.displayName || 'User' },
                item: item
            });
            return response.message;
        } catch (e) {
            // Fallback to local logic if offline/error
            return this.getLocalReaction(item);
        }
    }

    getLocalReaction(item) {
        if (item.price > 20000) return "A big goal. You deserve it.";
        const cat = item.category ? item.category.toLowerCase() : '';
        if (cat === 'fashion') return "This is going to look amazing.";
        if (cat === 'tech') return "Upgrade time?";
        return "Added to your vision.";
    }

    getWelcomeMessage() {
        const user = authService.currentUser;
        const name = user ? user.displayName.split(' ')[0] : 'Dreamer';
        return `Welcome back, ${name}. ${this.getRandom(this.quotes.welcome)}`;
    }

    getRandom(array) {
        return array[Math.floor(Math.random() * array.length)];
    }
}

export const aiService = new AIService();