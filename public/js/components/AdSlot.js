import { authService } from '../services/AuthService.js';

export class AdSlot {
    constructor() {
        this.element = document.createElement('div');
        this.element.className = 'ad-slot glass-panel';
        this.render();
    }

    render() {
        this.element.innerHTML = `
            <div class="ad-content">
                <span class="ad-badge">Sponsored</span>
                <h3>Upgrade to Premium</h3>
                <p>Remove ads and unlock unlimited combos!</p>
                <button class="btn-primary btn-sm" id="btn-upgrade">Remove Ads</button>
            </div>
        `;

        this.element.querySelector('#btn-upgrade').addEventListener('click', async () => {
            if (confirm("Upgrade to Premium for $4.99?")) {
                await authService.upgradeToPremium();
                window.location.reload(); // Simple reload to reflect changes
            }
        });
    }

    getElement() {
        return this.element;
    }
}
