import { authService } from './AuthService.js';

export class AIService {
    constructor() {
        this.quotes = {
            welcome: [
                "Good energy today.",
                "Ready to manifest?",
                "Your dreams look good on you."
            ],
            highPrice: [
                "A big goal. You deserve it.",
                "Let's start saving for this one.",
                "Quality over quantity."
            ],
            fashion: [
                "This is going to look amazing.",
                "Add this to your closet soon!",
                "Style is eternal."
            ],
            tech: [
                "Upgrade time?",
                "Future proof.",
                "Tech makes life smoother."
            ],
            completed: [
                "You manifested it!",
                "Another dream reality.",
                "Proud of you."
            ]
        };
    }

    // Decide what to say based on the item added
    getReaction(item) {
        // 1. Price Check
        if (item.price > 20000) {
            return this.getRandom(this.quotes.highPrice);
        }

        // 2. Time Check (Long term)
        if (item.targetDate) {
            const days = Math.ceil((new Date(item.targetDate) - new Date()) / (1000 * 60 * 60 * 24));
            if (days > 90) return "Patience is the key to manifestation.";
            if (days < 7 && days > 0) return "Almost yours!";
        }

        // 3. Category Check
        const cat = item.category ? item.category.toLowerCase() : '';
        if (cat === 'fashion') return this.getRandom(this.quotes.fashion);
        if (cat === 'tech') return this.getRandom(this.quotes.tech);
        if (cat === 'home') return "Your sanctuary is getting an upgrade.";
        if (cat === 'experience') return "Memories over things. Good choice.";
        if (cat === 'wellness') return "Invest in yourself first.";

        // 4. Default
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