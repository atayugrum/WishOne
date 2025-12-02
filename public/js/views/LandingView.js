/* public/js/views/LandingView.js */
import { router } from '../utils/Router.js';

export const LandingView = {
    render: async () => {
        return `
            <div class="lab-gradient-bg"></div>

            <div class="hub-view-container">
                <div class="hub-hero-card">
                    
                    <img src="img/icon.png" alt="WishOne" class="hub-logo">
                    
                    <h1 class="hub-title">Welcome to Lab</h1>
                    <p class="hub-subtitle">
                        Your AI-powered space for wishes, style, and planning.
                        <br>Ready to manifest?
                    </p>

                    <div class="hub-actions">
                        <button id="btn-to-auth" class="hub-btn primary">
                            <span>✨ Start Manifesting</span>
                        </button>
                    </div>

                </div>
                
                <div style="margin-top:32px; display:flex; gap:16px; opacity:0.8;">
                    <div style="text-align:center;">
                        <span style="font-size:1.5rem;">🧥</span>
                        <p style="font-size:0.75rem; color:var(--text-tertiary);">Closet</p>
                    </div>
                    <div style="text-align:center;">
                        <span style="font-size:1.5rem;">🤖</span>
                        <p style="font-size:0.75rem; color:var(--text-tertiary);">AI Stylist</p>
                    </div>
                    <div style="text-align:center;">
                        <span style="font-size:1.5rem;">🎨</span>
                        <p style="font-size:0.75rem; color:var(--text-tertiary);">Inspo</p>
                    </div>
                </div>
            </div>
        `;
    },

    afterRender: async () => {
        const btnEnter = document.getElementById('btn-to-auth');
        if (btnEnter) {
            btnEnter.onclick = () => {
                window.location.hash = '#/auth';
            };
        }

        // Ensure header is hidden on landing
        const header = document.querySelector('.floating-header');
        if (header) header.style.display = 'none';
    }
};