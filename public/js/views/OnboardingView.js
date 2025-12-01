/* public/js/views/OnboardingView.js */
import { authService } from '../services/AuthService.js';
import { firestoreService } from '../services/FirestoreService.js';
import { router } from '../utils/Router.js';

let step = 1;

export const OnboardingView = {
    render: async () => {
        return `
            <div style="max-width:400px; margin:40px auto; padding:20px; text-align:center;">
                
                <div style="display:flex; gap:8px; justify-content:center; margin-bottom:32px;">
                    <div class="step-dot active" id="dot-1"></div>
                    <div class="step-dot" id="dot-2"></div>
                    <div class="step-dot" id="dot-3"></div>
                </div>

                <div id="onboarding-step-content" class="fade-in">
                    </div>

            </div>
            
            <style>
                .step-dot { width:10px; height:10px; border-radius:50%; background:#eee; transition:all 0.3s; }
                .step-dot.active { background:var(--accent-color); transform:scale(1.2); }
                .onboarding-img { width:100%; max-width:200px; margin-bottom:24px; }
            </style>
        `;
    },

    afterRender: async () => {
        step = 1;
        OnboardingView.renderStep(step);
    },

    renderStep: (currentStep) => {
        const container = document.getElementById('onboarding-step-content');
        document.querySelectorAll('.step-dot').forEach((d, i) => {
            d.classList.toggle('active', i + 1 === currentStep);
        });

        if (currentStep === 1) {
            // PROFILE SETUP
            container.innerHTML = `
                <div style="font-size:3rem; margin-bottom:16px;">👋</div>
                <h2>Let's get to know you</h2>
                <p style="color:var(--text-secondary); margin-bottom:24px;">Pick a unique username.</p>
                
                <form id="onboard-form-1" style="text-align:left;">
                    <div class="form-group">
                        <label>Username</label>
                        <input type="text" id="ob-username" required placeholder="dreamer123" pattern="[a-zA-Z0-9_]+" style="text-transform:lowercase;">
                        <small id="username-error" style="color:red; display:none;">Username taken or invalid.</small>
                    </div>
                    <button type="submit" class="btn-primary" style="width:100%; margin-top:16px;">Next →</button>
                </form>
            `;

            document.getElementById('onboard-form-1').onsubmit = async (e) => {
                e.preventDefault();
                const username = document.getElementById('ob-username').value.trim().toLowerCase();
                const btn = e.target.querySelector('button');
                btn.disabled = true;
                
                const isUnique = await firestoreService.checkUsernameUnique(username);
                if (isUnique) {
                    const user = authService.currentUser;
                    await firestoreService.updateUserProfile(user.uid, { username, hasCompletedSignupProfile: true }); // Partial save
                    OnboardingView.renderStep(2);
                } else {
                    document.getElementById('username-error').style.display = 'block';
                    btn.disabled = false;
                }
            };

        } else if (currentStep === 2) {
            // TUTORIAL
            container.innerHTML = `
                <div style="font-size:3rem; margin-bottom:16px;">✨</div>
                <h2>Visualize Your Dreams</h2>
                <p style="color:var(--text-secondary); margin-bottom:24px;">
                    Add items from any store, organize them into boards, and use AI to plan your budget.
                </p>
                <div class="glass-panel" style="padding:16px; margin-bottom:24px; text-align:left;">
                    <div>✅ <b>Wishlist:</b> Save what you want.</div>
                    <div style="margin-top:8px;">✅ <b>Closet:</b> Track what you own.</div>
                    <div style="margin-top:8px;">✅ <b>AI:</b> Get styling & budget tips.</div>
                </div>
                <button id="btn-next-2" class="btn-primary" style="width:100%;">Got it!</button>
            `;
            document.getElementById('btn-next-2').onclick = () => OnboardingView.renderStep(3);

        } else if (currentStep === 3) {
            // READY
            container.innerHTML = `
                <div style="font-size:3rem; margin-bottom:16px;">🚀</div>
                <h2>You're All Set!</h2>
                <p style="color:var(--text-secondary); margin-bottom:24px;">Your journey starts now.</p>
                <button id="btn-finish" class="btn-magic" style="width:100%; padding:14px;">Enter WishOne</button>
            `;
            
            document.getElementById('btn-finish').onclick = async () => {
                const user = authService.currentUser;
                // Mark fully complete
                await firestoreService.updateUserProfile(user.uid, { hasCompletedSignupProfile: true }); 
                router.navigate('/app/home');
            };
        }
    }
};