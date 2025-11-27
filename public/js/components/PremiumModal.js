import { authService } from '../services/AuthService.js';

export class PremiumModal {
    constructor() {
        this.overlay = null;
        this.render();
    }

    render() {
        // Prevent duplicates
        if (document.querySelector('.premium-modal')) return;

        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay premium-modal';

        this.overlay.innerHTML = `
            <div class="modal-content glass-panel" style="max-width: 500px; text-align: center; border: 1px solid rgba(255,215,0,0.3);">
                <div class="modal-header" style="justify-content: center; position: relative;">
                    <h2 style="background: linear-gradient(135deg, #FFD700 0%, #FDB931 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Upgrade to Premium</h2>
                    <button class="close-btn" style="position: absolute; right: 0;">&times;</button>
                </div>
                
                <div class="premium-features" style="margin: 24px 0; text-align: left;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:12px; padding:12px; background:rgba(255,255,255,0.5); border-radius:12px;">
                        <span>✨ Magic Add</span>
                        <div>
                            <span style="color:var(--text-secondary); text-decoration:line-through; margin-right:8px;">3/day</span>
                            <strong>Unlimited</strong>
                        </div>
                    </div>
                    
                    <div style="display:flex; justify-content:space-between; margin-bottom:12px; padding:12px; background:rgba(255,255,255,0.5); border-radius:12px;">
                        <span>🤖 AI Stylist & Planner</span>
                        <div>
                            <span style="color:var(--text-secondary); text-decoration:line-through; margin-right:8px;">1/day</span>
                            <strong>Unlimited</strong>
                        </div>
                    </div>

                    <div style="display:flex; justify-content:space-between; margin-bottom:12px; padding:12px; background:rgba(255,255,255,0.5); border-radius:12px;">
                        <span>📉 Auto Price Tracking</span>
                        <div>
                            <span style="color:var(--text-secondary); margin-right:8px;">Manual</span>
                            <strong>Daily Checks</strong>
                        </div>
                    </div>

                    <div style="display:flex; justify-content:space-between; margin-bottom:12px; padding:12px; background:rgba(255,255,255,0.5); border-radius:12px;">
                        <span>🚫 Ads</span>
                        <div>
                            <span style="color:var(--text-secondary); margin-right:8px;">Yes</span>
                            <strong>No Ads</strong>
                        </div>
                    </div>
                </div>

                <button id="btn-confirm-upgrade" class="btn-primary" style="width: 100%; background: linear-gradient(135deg, #1D1D1F 0%, #434344 100%); color: #FFD700;">
                    Unlock Premium ($4.99/mo)
                </button>
                <button class="btn-text close-trigger" style="margin-top: 12px;">Maybe Later</button>
            </div>
        `;

        document.body.appendChild(this.overlay);
        this.bindEvents();
    }

    bindEvents() {
        const close = () => {
            this.overlay.classList.remove('active');
            setTimeout(() => this.overlay.style.display = 'none', 300);
        };

        this.overlay.querySelectorAll('.close-btn, .close-trigger').forEach(btn => {
            btn.addEventListener('click', close);
        });

        this.overlay.querySelector('#btn-confirm-upgrade').addEventListener('click', async () => {
            const btn = this.overlay.querySelector('#btn-confirm-upgrade');
            btn.textContent = "Processing...";
            btn.disabled = true;

            try {
                await authService.upgradeToPremium();
                alert("Welcome to Premium! 🌟");
                window.location.reload();
            } catch (error) {
                console.error(error);
                alert("Upgrade failed.");
                btn.textContent = "Unlock Premium ($4.99/mo)";
                btn.disabled = false;
            }
        });
    }

    open() {
        this.overlay.style.display = 'flex';
        requestAnimationFrame(() => this.overlay.classList.add('active'));
    }
}

export const premiumModal = new PremiumModal();