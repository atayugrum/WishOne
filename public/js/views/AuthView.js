/* public/js/views/AuthView.js */
import { authService } from '../services/AuthService.js';
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Internal State
let isLoginMode = true;

export const AuthView = {
    render: async () => {
        const title = isLoginMode ? 'Sign in to WishOne' : 'Create Account';
        const subtitle = isLoginMode 
            ? 'Log in to continue manifesting.' 
            : 'Join the lab to start your journey.';
        const btnText = isLoginMode ? 'Log In' : 'Create Account';
        const toggleText = isLoginMode 
            ? "Don't have an account? <b>Create one</b>" 
            : "Already have an account? <b>Log in</b>";

        return `
            <div class="lab-gradient-bg"></div>

            <div class="hub-view-container">
                <div class="hub-hero-card" style="padding: 40px 32px;">
                    
                    <h2 class="hub-title" style="font-size: 1.8rem; margin-bottom: 8px;">${title}</h2>
                    <p class="hub-subtitle" style="margin-bottom: 24px;">${subtitle}</p>

                    <form id="auth-form" style="width: 100%; display: flex; flex-direction: column; gap: 16px;">
                        
                        <div class="form-group" style="margin:0;">
                            <input type="email" id="auth-email" placeholder="Email" required 
                                style="background: rgba(255,255,255,0.8); border: 1px solid rgba(0,0,0,0.1);">
                        </div>

                        <div class="form-group" style="margin:0;">
                            <input type="password" id="auth-password" placeholder="Password" required minlength="6"
                                style="background: rgba(255,255,255,0.8); border: 1px solid rgba(0,0,0,0.1);">
                        </div>

                        ${!isLoginMode ? `
                        <div class="form-group" style="margin:0;">
                            <input type="password" id="auth-confirm" placeholder="Confirm Password" required minlength="6"
                                style="background: rgba(255,255,255,0.8); border: 1px solid rgba(0,0,0,0.1);">
                        </div>
                        ` : ''}

                        <button type="submit" class="hub-btn primary" id="btn-submit-auth">
                            <span>${btnText}</span>
                        </button>
                    </form>

                    <div style="margin: 20px 0; display: flex; align-items: center; width: 100%; gap: 12px; opacity: 0.5;">
                        <div style="height: 1px; flex: 1; background: currentColor;"></div>
                        <span style="font-size: 0.8rem; text-transform: uppercase;">or</span>
                        <div style="height: 1px; flex: 1; background: currentColor;"></div>
                    </div>

                    <button id="btn-google" class="hub-btn secondary" style="width: 100%;">
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" height="18">
                        <span>Continue with Google</span>
                    </button>

                    <p id="auth-toggle" style="margin-top: 24px; font-size: 0.9rem; cursor: pointer; color: var(--text-secondary);">
                        ${toggleText}
                    </p>

                    <div id="auth-error" style="color: #ff3b30; font-size: 0.85rem; margin-top: 12px; display: none;"></div>

                </div>
            </div>
        `;
    },

    afterRender: async () => {
        // 1. Toggle Login/Signup
        const toggleBtn = document.getElementById('auth-toggle');
        if (toggleBtn) {
            toggleBtn.onclick = async () => {
                isLoginMode = !isLoginMode;
                // Re-render to update UI state
                const app = document.getElementById('app');
                app.innerHTML = await AuthView.render();
                await AuthView.afterRender();
            };
        }

        // 2. Handle Form Submit (Email/Pass)
        const form = document.getElementById('auth-form');
        const errorEl = document.getElementById('auth-error');
        const submitBtn = document.getElementById('btn-submit-auth');

        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                errorEl.style.display = 'none';
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span>Processing...</span>';

                const email = document.getElementById('auth-email').value;
                const password = document.getElementById('auth-password').value;
                const auth = getAuth();

                try {
                    if (isLoginMode) {
                        // LOGIN
                        await signInWithEmailAndPassword(auth, email, password);
                        // app.js listener will redirect to Home
                    } else {
                        // SIGN UP
                        const confirm = document.getElementById('auth-confirm').value;
                        if (password !== confirm) throw new Error("Passwords do not match.");
                        
                        await createUserWithEmailAndPassword(auth, email, password);
                        // app.js listener will redirect to Onboarding (because profile is incomplete)
                    }
                } catch (err) {
                    console.error(err);
                    let msg = "Authentication failed.";
                    if (err.code === 'auth/invalid-credential') msg = "Invalid email or password.";
                    if (err.code === 'auth/email-already-in-use') msg = "Email already in use.";
                    if (err.code === 'auth/weak-password') msg = "Password must be at least 6 characters.";
                    if (err.message === "Passwords do not match.") msg = err.message;
                    
                    errorEl.textContent = msg;
                    errorEl.style.display = 'block';
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = `<span>${isLoginMode ? 'Log In' : 'Create Account'}</span>`;
                }
            };
        }

        // 3. Handle Google Auth
        const googleBtn = document.getElementById('btn-google');
        if (googleBtn) {
            googleBtn.onclick = async () => {
                try {
                    await authService.loginWithGoogle();
                    // app.js listener handles redirect
                } catch (e) {
                    errorEl.textContent = "Google Sign-In failed.";
                    errorEl.style.display = 'block';
                }
            };
        }
        
        // Hide global header
        const header = document.querySelector('.floating-header');
        if (header) header.style.display = 'none';
    }
};