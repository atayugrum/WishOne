// js/views/WelcomeView.js
import { authService } from '../services/AuthService.js';

export const WelcomeView = {
    render: async () => {
        // We attach the login event to the window so the HTML can call it
        window.handleHeroLogin = async () => {
            try {
                const button = document.querySelector('#hero-login-btn');
                button.textContent = "Entering...";
                button.disabled = true;
                await authService.login();
                // Auth listener in app.js will handle the redirect
            } catch (error) {
                alert("Login failed. Try again.");
                const button = document.querySelector('#hero-login-btn');
                button.textContent = "Continue with Google";
                button.disabled = false;
            }
        };

        return `
            <div class="welcome-container">
                <div class="glass-panel hero-card">
                    <h1 class="hero-title">WishOne</h1>
                    <p class="hero-subtitle">Zen. Fluid. Emotional.<br>Your shared aesthetic wishlist.</p>
                    
                    <div class="hero-divider"></div>

                    <button id="hero-login-btn" class="btn-primary hero-btn" onclick="window.handleHeroLogin()">
                        Continue with Google
                    </button>
                    
                    <p class="hero-footer">Private • Secure • Beautiful</p>
                </div>
            </div>
        `;
    }
};