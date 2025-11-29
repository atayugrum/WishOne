import { authService } from '../services/AuthService.js';
import { i18n } from '../services/LocalizationService.js';

export const WelcomeView = {
    render: async () => {
        let isLoginMode = true;

        window.setAuthMode = (mode) => {
            isLoginMode = mode === 'login';
            updateUI();
        };

        window.toggleLang = () => {
            i18n.toggle();
            // Re-render
            document.getElementById('app').innerHTML = ''; // Force clear
            WelcomeView.render().then(html => document.getElementById('app').innerHTML = html);
        };

        window.toggleAbout = () => {
            const el = document.getElementById('about-modal');
            el.style.display = el.style.display === 'none' ? 'flex' : 'none';
        };

        const updateUI = () => {
            const submitBtn = document.getElementById('auth-submit-btn');
            const nameField = document.getElementById('field-name');
            const tabLogin = document.getElementById('tab-login');
            const tabSignup = document.getElementById('tab-signup');
            const errorMsg = document.getElementById('auth-error');

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
            errorMsg.style.display = 'none';
        };

        window.handleAuthSubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const name = document.getElementById('name').value;
            const btn = document.getElementById('auth-submit-btn');
            const errorMsg = document.getElementById('auth-error');

            errorMsg.style.display = 'none';
            btn.disabled = true;
            btn.textContent = i18n.t('common.loading');

            try {
                if (isLoginMode) {
                    await authService.loginWithEmail(email, password);
                } else {
                    await authService.registerWithEmail(email, password, name);
                }
                // Auth listener in app.js handles redirect
            } catch (error) {
                let message = "Authentication failed.";
                if (error.code === 'auth/invalid-credential') message = "Invalid email or password.";
                if (error.code === 'auth/email-already-in-use') message = "Email already registered.";
                if (error.code === 'auth/weak-password') message = "Password too short.";
                errorMsg.textContent = message;
                errorMsg.style.display = 'block';
                btn.disabled = false;
                btn.textContent = isLoginMode ? "Log In" : "Sign Up";
            }
        };

        window.handleGoogleLogin = async () => {
            try { await authService.login(); } catch (error) { alert("Google Login failed."); }
        };

        setTimeout(() => { if(document.getElementById('auth-submit-btn')) updateUI(); }, 0);

        // Mascot: Simple greeting
        if (window.aiCompanion) window.aiCompanion.say("Hello! I'm your WishOne guide.", "welcome");

        return `
            <div class="welcome-container">
                <div class="premium-glow"></div>

                <button onclick="window.toggleLang()" class="btn-text" style="position:absolute; top:20px; right:20px; z-index:10; font-weight:bold;">${i18n.lang.toUpperCase()}</button>

                <div class="glass-panel auth-card">
                    <div class="brand-hero">
                        <img src="/img/icon.png" alt="WishOne" style="width: 64px; border-radius: 12px; box-shadow: 0 8px 20px rgba(0,0,0,0.1); margin-bottom: 16px; object-fit: contain;">
                        <h1 class="hero-title" style="font-size:2rem;">WishOne</h1>
                        <p style="font-size:0.9rem; color:var(--text-secondary); margin-top:-4px;">${i18n.t('welcome.by')}</p>
                        <p class="hero-subtitle" style="margin-top:12px; font-style:italic;">"${i18n.t('welcome.slogan')}"</p>
                    </div>

                    <div class="auth-tabs">
                        <div id="tab-login" class="auth-tab active" onclick="window.setAuthMode('login')">Log In</div>
                        <div id="tab-signup" class="auth-tab" onclick="window.setAuthMode('signup')">Sign Up</div>
                    </div>

                    <form onsubmit="window.handleAuthSubmit(event)" style="width: 100%;">
                        <div class="form-group" id="field-name" style="display:none; animation: fadeUp 0.3s;">
                            <label>${i18n.t('profile.fullname')}</label>
                            <div class="input-with-icon"><span class="input-icon">👤</span><input type="text" id="name" placeholder="Name"></div>
                        </div>
                        <div class="form-group">
                            <label>Email</label>
                            <div class="input-with-icon"><span class="input-icon">✉️</span><input type="email" id="email" placeholder="name@example.com" required></div>
                        </div>
                        <div class="form-group">
                            <label>Password</label>
                            <div class="input-with-icon"><span class="input-icon">🔒</span><input type="password" id="password" placeholder="••••••" required minlength="6"></div>
                        </div>
                        <p id="auth-error" style="color: #ff3b30; font-size: 0.9rem; display: none; margin-bottom: 16px; text-align:center;"></p>
                        <button type="submit" id="auth-submit-btn" class="btn-primary" style="width: 100%;">Log In</button>
                    </form>

                    <div class="social-divider" style="margin: 24px 0;"><span>${i18n.t('common.or')}</span></div>
                    <button class="btn-primary btn-google" onclick="window.handleGoogleLogin()" style="width: 100%; background: white; color: #1D1D1F; border: 1px solid rgba(0,0,0,0.1);">
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" height="18"><span>Google</span>
                    </button>

                    <button class="btn-text" onclick="window.toggleAbout()" style="margin-top:24px; font-size:0.8rem; opacity:0.7;">${i18n.t('welcome.about')}</button>
                </div>
            </div>

            <div id="about-modal" class="modal-overlay">
                <div class="modal-content" style="text-align:center;">
                    <div class="modal-header" style="justify-content:center;"><h3>${i18n.t('welcome.about')}</h3></div>
                    <p style="margin-bottom:24px;">${i18n.t('welcome.about_text')}</p>
                    <p style="font-size:0.8rem; color:var(--text-tertiary);">${i18n.t('welcome.rights')}</p>
                    <button class="btn-primary" onclick="window.toggleAbout()" style="margin-top:20px;">Close</button>
                </div>
            </div>
        `;
    }
};