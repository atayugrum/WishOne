import { authService } from '../services/AuthService.js';
import { premiumModal } from './PremiumModal.js';

export class AdSlot {
    constructor(config = {}) {
        this.element = document.createElement('div');
        this.element.className = 'ad-slot glass-panel';
        this.config = {
            provider: 'internal', // 'internal' | 'adsense' | 'custom'
            ...config
        };
        this.render();
    }

    render() {
        // 1. Premium Check (Task 6: Freemium)
        if (authService.isPremium) {
            this.element.style.display = 'none';
            return;
        }

        this.element.innerHTML = ''; // Clear

        // 2. Provider Logic
        if (this.config.provider === 'adsense') {
            this._renderAdSense();
        } else {
            this._renderInternalAd();
        }
    }

    _renderInternalAd() {
        this.element.innerHTML = `
            <div class="ad-content" style="cursor: pointer;">
                <span class="ad-badge">Sponsored</span>
                <h3>Upgrade to Premium</h3>
                <p>Remove ads, unlock unlimited AI tools, and get price drop alerts!</p>
                <div style="margin-top:8px; font-weight:bold; color:var(--accent-color);">Tap to Upgrade →</div>
            </div>
        `;

        this.element.addEventListener('click', () => {
            premiumModal.open();
        });
    }

    _renderAdSense() {
        // Placeholder for future AdSense integration
        // In real app: inject <ins> tag and push to window.adsbygoogle
        this.element.innerHTML = `
            <div class="ad-network-placeholder" style="padding:20px; text-align:center; color:#999; font-size:0.8rem;">
                [Ad Network Space]
            </div>
        `;
    }

    getElement() {
        return this.element;
    }
}