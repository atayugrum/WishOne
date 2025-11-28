// js/views/WelcomeView.js
import { authService } from '../services/AuthService.js';

export const WelcomeView = {
    render: async () => {
        // State
        let isLoginMode = true;

        // Toggle Handler
        window.setAuthMode = (mode) => {
            isLoginMode = mode === 'login';
            updateUI();
        };

        const updateUI = () => {
            const submitBtn = document.getElementById('auth-submit-btn');
            const nameField = document.getElementById('field-name');
            const tabLogin = document.getElementById('tab-login');
            const tabSignup = document.getElementById('tab-signup');
            const errorMsg = document.getElementById('auth-error');

            // Update Tabs
            if (isLoginMode) {
                tabLogin.classList.add('active');
                tabSignup.classList.remove('active');
                submitBtn.textContent = "Log In";
                nameField.style.display = 'none';
                nameField.querySelector('input').required = false;
            } else {
                tabLogin.classList.remove('active');
                tabSignup.classList.add('active');
                submitBtn.textContent = "Sign Up";
                nameField.style.display = 'block';
                nameField.querySelector('input').required = true;
            }

            // Clear errors on toggle
            errorMsg.style.display = 'none';
        };

        // Form Handler
        window.handleAuthSubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const name = document.getElementById('name').value;
            const btn = document.getElementById('auth-submit-btn');
            const errorMsg = document.getElementById('auth-error');

            errorMsg.style.display = 'none';
            btn.disabled = true;
            btn.textContent = "Processing...";

            try {
                if (isLoginMode) {
                    await authService.loginWithEmail(email, password);
                } else {
                    await authService.registerWithEmail(email, password, name);
                }
                // Auth listener in app.js handles redirect
            } catch (error) {
                console.error(error);
                let message = "Authentication failed.";
                if (error.code === 'auth/invalid-credential') message = "Invalid email or password.";
                if (error.code === 'auth/email-already-in-use') message = "Email already registered.";
                if (error.code === 'auth/weak-password') message = "Password should be at least 6 characters.";

                errorMsg.textContent = message;
                errorMsg.style.display = 'block';
                btn.disabled = false;
                btn.textContent = isLoginMode ? "Log In" : "Sign Up";

                // Shake Animation
                const card = document.querySelector('.auth-card');
                card.style.transform = 'translateX(10px)';
                setTimeout(() => card.style.transform = 'translateX(0)', 100);
                setTimeout(() => card.style.transform = 'translateX(-10px)', 200);
                setTimeout(() => card.style.transform = 'translateX(0)', 300);
            }
        };

        window.handleGoogleLogin = async () => {
            try {
                await authService.login();
            } catch (error) {
                alert("Google Login failed.");
            }
        };

        // Initial Render
        setTimeout(() => updateUI(), 0);

        return `
            <div class="welcome-container">
                <div class="glass-panel auth-card">
                    
                    <div class="brand-hero">
                        <img src="img/logo.jpg" alt="WishOne Logo" style="width: 120px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); margin-bottom: 24px;">
                        <h1 class="hero-title">WishOne</h1>
                        <p class="hero-subtitle">Zen. Fluid. Emotional.</p>
                    </div>

                    <div class="auth-tabs">
                        <div id="tab-login" class="auth-tab active" onclick="window.setAuthMode('login')">Log In</div>
                        <div id="tab-signup" class="auth-tab" onclick="window.setAuthMode('signup')">Sign Up</div>
                    </div>

                    <form onsubmit="window.handleAuthSubmit(event)" style="width: 100%;">
                        
                        <div class="form-group" id="field-name" style="display:none; animation: fadeUp 0.3s;">
                            <label>Full Name</label>
                            <div class="input-with-icon">
                                <span class="input-icon">👤</span>
                                <input type="text" id="name" placeholder="Your Name">
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Email</label>
                            <div class="input-with-icon">
                                <span class="input-icon">✉️</span>
                                <input type="email" id="email" placeholder="name@example.com" required>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Password</label>
                            <div class="input-with-icon">
                                <span class="input-icon">🔒</span>
                                <input type="password" id="password" placeholder="••••••" required minlength="6">
                            </div>
                        </div>

                        <p id="auth-error" style="color: #ff3b30; font-size: 0.9rem; display: none; margin-bottom: 16px; text-align:center;"></p>

                        <button type="submit" id="auth-submit-btn" class="btn-primary" style="width: 100%;">
                            Log In
                        </button>
                    </form>

                    <div class="social-divider">
                        <span>OR CONTINUE WITH</span>
                    </div>

                    <button class="btn-primary btn-google" onclick="window.handleGoogleLogin()" style="width: 100%;">
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" height="18">
                        <span>Google</span>
                    </button>

                </div>
            </div>
        `;
    }
};