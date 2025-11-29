import { authService } from '../services/AuthService.js';
import { i18n } from '../services/LocalizationService.js';

export const WelcomeView = {
    render: async () => {
        let isLoginMode = true;

        window.setAuthMode = (mode) => {
            isLoginMode = mode === 'login';
            updateUI();
        };

        // FIX: Re-render content immediately after toggling
        window.toggleLang = async () => {
            i18n.toggle();
            const app = document.getElementById('app');
            app.innerHTML = await WelcomeView.render();
        };

        window.toggleAbout = () => {
            const el = document.getElementById('about-modal');
            if (el) {
                if (el.style.display === 'flex') {
                    el.classList.remove('active');
                    setTimeout(() => el.style.display = 'none', 300);
                } else {
                    el.style.display = 'flex';
                    requestAnimationFrame(() => el.classList.add('active'));
                }
            }
        };

        const updateUI = () => {
            const submitBtn = document.getElementById('auth-submit-btn');
            const nameField = document.getElementById('field-name');
            const tabLogin = document.getElementById('tab-login');
            const tabSignup = document.getElementById('tab-signup');
            const errorMsg = document.getElementById('auth-error');

            if (!submitBtn) return; // Guard clause

            if (isLoginMode) {
                tabLogin.classList.add('active');
                tabSignup.classList.remove('active');
                submitBtn.textContent = i18n.lang === 'tr' ? "Giriş Yap" : "Log In";
                nameField.style.display = 'none';
                nameField.querySelector('input').required = false;
            } else {
                tabLogin.classList.remove('active');
                tabSignup.classList.add('active');
                submitBtn.textContent = i18n.lang === 'tr' ? "Kayıt Ol" : "Sign Up";
                nameField.style.display = 'block';
                nameField.querySelector('input').required = true;
            }
            if (errorMsg) errorMsg.style.display = 'none';
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
            } catch (error) {
                let message = "Authentication failed.";
                if (error.code === 'auth/invalid-credential') message = "Invalid email or password.";
                if (error.code === 'auth/email-already-in-use') message = "Email already registered.";
                if (error.code === 'auth/weak-password') message = "Password too short.";
                errorMsg.textContent = message;
                errorMsg.style.display = 'block';
                btn.disabled = false;
                btn.textContent = isLoginMode ? (i18n.lang === 'tr' ? "Giriş Yap" : "Log In") : (i18n.lang === 'tr' ? "Kayıt Ol" : "Sign Up");
            }
        };

        window.handleGoogleLogin = async () => {
            try { await authService.login(); } catch (error) { alert("Google Login failed."); }
        };

        setTimeout(() => { if(document.getElementById('auth-submit-btn')) updateUI(); }, 0);

        setTimeout(() => {
            if (window.aiCompanion) window.aiCompanion.say(i18n.t('welcome.greeting'), "welcome");
        }, 800);

        const currentLang = i18n.lang.toUpperCase();

        return `
            <div class="welcome-container">
                <div class="premium-glow"></div>

                <button onclick="window.toggleLang()" class="btn-text lang-toggle" style="position:absolute; top:20px; right:20px; z-index:10; font-weight:700; background:rgba(255,255,255,0.5); padding:8px 16px; border-radius:20px;">
                    ${currentLang === 'EN' ? '🇹🇷 TR' : '🇺🇸 EN'}
                </button>

                <div class="glass-panel auth-card lighter-card">
                    <div class="brand-hero compact-hero">
                        <img src="/img/icon.png" alt="WishOne" class="hero-icon-small">
                        <h1 class="hero-title compact-title">WishOne</h1>
                        <p class="hero-brand-text">${i18n.t('welcome.by')}</p>
                        <p class="hero-subtitle compact-subtitle">"${i18n.t('welcome.slogan')}"</p>
                    </div>

                    <div class="auth-tabs compact-tabs">
                        <div id="tab-login" class="auth-tab active" onclick="window.setAuthMode('login')">${i18n.lang === 'tr' ? "Giriş" : "Log In"}</div>
                        <div id="tab-signup" class="auth-tab" onclick="window.setAuthMode('signup')">${i18n.lang === 'tr' ? "Kayıt" : "Sign Up"}</div>
                    </div>

                    <form onsubmit="window.handleAuthSubmit(event)" style="width: 100%;">
                        <div class="form-group compact-group" id="field-name" style="display:none; animation: fadeUp 0.3s;">
                            <div class="input-with-icon"><span class="input-icon">👤</span><input type="text" id="name" placeholder="${i18n.t('profile.fullname')}"></div>
                        </div>
                        <div class="form-group compact-group">
                            <div class="input-with-icon"><span class="input-icon">✉️</span><input type="email" id="email" placeholder="Email" required></div>
                        </div>
                        <div class="form-group compact-group">
                            <div class="input-with-icon"><span class="input-icon">🔒</span><input type="password" id="password" placeholder="••••••" required minlength="6"></div>
                        </div>
                        <p id="auth-error" style="color: #ff3b30; font-size: 0.85rem; display: none; margin-bottom: 12px; text-align:center;"></p>
                        <button type="submit" id="auth-submit-btn" class="btn-primary compact-btn" style="width: 100%; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">Log In</button>
                    </form>

                    <div class="social-divider compact-divider"><span>${i18n.t('common.or')}</span></div>
                    
                    <button class="btn-primary btn-google compact-btn" onclick="window.handleGoogleLogin()" style="width: 100%;">
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" height="18"><span>Google</span>
                    </button>

                    <button class="btn-text" onclick="window.toggleAbout()" style="margin-top:20px; font-size:0.8rem; opacity:0.6;">${i18n.t('welcome.about')}</button>
                </div>
            </div>

            <div id="about-modal" class="modal-overlay">
                <div class="modal-content" style="text-align:center; max-width:400px;">
                    <div class="modal-header" style="justify-content:center; margin-bottom:16px;">
                        <h3 style="font-size:1.2rem;">${i18n.t('welcome.about_title')}</h3>
                    </div>
                    <p style="margin-bottom:16px; line-height:1.6;">${i18n.t('welcome.about_text')}</p>
                    <p style="margin-bottom:24px; font-size:0.9rem; color:var(--text-secondary); background:rgba(0,0,0,0.03); padding:12px; border-radius:12px;">
                        🤖 ${i18n.t('welcome.about_note')}
                    </p>
                    <p style="font-size:0.75rem; color:var(--text-tertiary); margin-bottom:20px;">${i18n.t('welcome.rights')}</p>
                    <button class="btn-primary" onclick="window.toggleAbout()" style="width:100%;">${i18n.t('common.back')}</button>
                </div>
            </div>
        `;
    }
};