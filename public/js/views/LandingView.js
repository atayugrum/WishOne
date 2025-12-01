import { authService } from '../services/AuthService.js';

export const LandingView = {
    render: async () => {
        return `
            <div class="landing-container">
                <div class="landing-hero">
                    <img src="img/logo.png" alt="WishOne" class="landing-logo floating-anim">
                    <h1 class="hero-title">WishOne</h1>
                    <p class="hero-subtitle">A calm place for your wishes, wardrobe, and dreams.</p>
                    
                    <div class="landing-actions">
                        <button class="btn-primary" id="btn-login-landing" style="font-size:1.1rem; padding:16px 32px;">
                            Sign In / Join Beta
                        </button>
                        <br>
                        <button class="btn-text" onclick="alert('You are on the waitlist! We will notify you.')" style="margin-top:16px; opacity:0.7;">
                            Join Waitlist
                        </button>
                    </div>
                </div>

                <div class="landing-features">
                    <div class="feature-card">
                        <span style="font-size:2rem;">✨</span>
                        <h3>Wishlist</h3>
                        <p>Track what you want with deadlines & priorities.</p>
                    </div>
                    <div class="feature-card">
                        <span style="font-size:2rem;">🧥</span>
                        <h3>Closet</h3>
                        <p>Manage what you own and build your style.</p>
                    </div>
                    <div class="feature-card">
                        <span style="font-size:2rem;">🎨</span>
                        <h3>Outfits</h3>
                        <p>Mix & Match items on a creative canvas.</p>
                    </div>
                    <div class="feature-card">
                        <span style="font-size:2rem;">🤖</span>
                        <h3>AI Stylist</h3>
                        <p>Get smart suggestions for combos & shopping.</p>
                    </div>
                </div>
                
                <footer class="landing-footer" style="margin-top:60px; opacity:0.5; font-size:0.8rem;">
                    &copy; 2025 AtOne. All rights reserved.
                </footer>
            </div>
        `;
    },

    afterRender: async () => {
        const btn = document.getElementById('btn-login-landing');
        if (btn) {
            btn.onclick = async () => {
                btn.textContent = "Connecting...";
                btn.disabled = true;
                try {
                    await authService.loginWithGoogle();
                    // Auth listener in app.js triggers redirect
                } catch (e) {
                    console.error(e);
                    btn.textContent = "Error. Try Again.";
                    btn.disabled = false;
                }
            };
        }

        // Ensure old header is gone
        const oldHeader = document.querySelector('.floating-header');
        if (oldHeader) oldHeader.style.display = 'none';
    }
};