import { authService } from '../services/AuthService.js';
import { premiumModal } from './PremiumModal.js';

export class AdSlot {
    constructor() {
        this.element = document.createElement('div');
        this.element.className = 'ad-slot glass-panel';
        this.render();
    }

    render() {
        // Don't render for Premium users
        if (authService.isPremium) {
            this.element.style.display = 'none';
            return;
        }

        this.element.innerHTML = `
            <div class="ad-content" style="cursor: pointer;">
                <span class="ad-badge">Sponsored</span>
                <h3>Upgrade to Premium</h3>
                <p>Remove ads and unlock unlimited AI tools & price tracking!</p>
                <div style="margin-top:8px; font-weight:bold; color:var(--accent-color);">Tap to Upgrade →</div>
            </div>
        `;

        this.element.addEventListener('click', () => {
            premiumModal.open();
        });
    }

    getElement() {
        return this.element;
    }
}