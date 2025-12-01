import { authService } from '../services/AuthService.js';
import { firestoreService } from '../services/FirestoreService.js';
import { i18n } from '../services/LocalizationService.js';

let step = 1;

export const OnboardingView = {
    render: async () => {
        const user = authService.currentUser;
        if (!user) return `<div class="empty-state">Please login first.</div>`;

        // Safe defaults
        const defaultName = user.displayName ? user.displayName.split(' ')[0] : 'User';
        const defaultUser = user.email ? user.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') : 'user';

        return `
            <div class="onboarding-wrapper">
                <div class="onboarding-container glass-panel">
                    <div class="progress-dots">
                        <span class="dot ${step >= 1 ? 'active' : ''}"></span>
                        <span class="dot ${step >= 2 ? 'active' : ''}"></span>
                        <span class="dot ${step >= 3 ? 'active' : ''}"></span>
                    </div>

                    <!-- Step 1: Profile -->
                    <div id="step-1" class="onboarding-step ${step === 1 ? 'active' : ''}">
                        <h2>Welcome, ${defaultName} 👋</h2>
                        <p style="color:var(--text-secondary); margin-bottom:24px;">Let's set up your profile.</p>
                        
                        <div class="form-group">
                            <label>Pick a Username</label>
                            <input type="text" id="ob-username" placeholder="username" value="${defaultUser}">
                            <small style="color:var(--text-tertiary);">Unique handle for friends to find you.</small>
                        </div>
                        <div class="form-group">
                            <label>Birthday (Optional)</label>
                            <input type="date" id="ob-birthday">
                            <small style="color:var(--text-tertiary);">For Gift Mode suggestions.</small>
                        </div>
                        <button class="btn-primary" id="btn-next-1" style="width:100%; margin-top:16px;">Next</button>
                    </div>

                    <!-- Step 2: First Wish -->
                    <div id="step-2" class="onboarding-step ${step === 2 ? 'active' : ''}" style="display:none;">
                        <h2>Make a Wish ✨</h2>
                        <p style="color:var(--text-secondary); margin-bottom:24px;">What's one thing you're dreaming of?</p>
                        
                        <div class="form-group">
                            <input type="text" id="ob-wish-title" placeholder="e.g. Vintage Film Camera" style="font-size:1.1rem; padding:16px;">
                        </div>
                        
                        <button class="btn-primary" id="btn-next-2" style="width:100%; margin-top:16px;">Add Wish & Continue</button>
                        <button class="btn-text" id="btn-skip-2" style="width:100%; margin-top:8px; opacity:0.6;">Skip for now</button>
                    </div>

                    <!-- Step 3: Ready -->
                    <div id="step-3" class="onboarding-step ${step === 3 ? 'active' : ''}" style="display:none; text-align:center;">
                        <div style="font-size:4rem; margin-bottom:16px;">🎉</div>
                        <h2>You're All Set!</h2>
                        <p style="color:var(--text-secondary); margin-bottom:32px;">Your sanctuary is ready. Let's explore.</p>
                        <button class="btn-primary" id="btn-finish" style="width:100%;">Enter WishOne</button>
                    </div>
                </div>
            </div>
        `;
    },

    afterRender: async () => {
        const user = authService.currentUser;

        // Helper to check username uniqueness (Mock for MVP if API not ready)
        const checkUsername = async (u) => {
            // In a real implementation, call firestoreService.checkUsernameUnique(u)
            return u.length >= 3;
        };

        // Step 1: Profile
        const btn1 = document.getElementById('btn-next-1');
        if (btn1) {
            btn1.onclick = async () => {
                const username = document.getElementById('ob-username').value.toLowerCase().trim();
                const birthday = document.getElementById('ob-birthday').value;

                if (username.length < 3) return alert("Username must be at least 3 characters.");

                btn1.textContent = "Saving...";
                btn1.disabled = true;

                try {
                    await firestoreService.updateUserProfile(user.uid, {
                        username,
                        birthday,
                        hasCompletedSignupProfile: true, // Key Flag
                        isBetaUser: true // Auto-grant beta for MVP flow
                    });
                    // Refresh local profile
                    if (authService.userProfile) {
                        authService.userProfile.hasCompletedSignupProfile = true;
                        authService.userProfile.username = username;
                    }

                    // Go to Step 2
                    step = 2;
                    OnboardingView.refresh();
                } catch (e) {
                    console.error(e);
                    alert("Error saving profile. Try again.");
                    btn1.textContent = "Next";
                    btn1.disabled = false;
                }
            };
        }

        // Step 2: First Wish
        const handleStep2 = async (skip) => {
            if (!skip) {
                const title = document.getElementById('ob-wish-title').value.trim();
                if (title) {
                    const btn2 = document.getElementById('btn-next-2');
                    btn2.textContent = "Adding...";
                    try {
                        await firestoreService.addItem({
                            title,
                            status: 'wish',
                            ownerId: user.uid,
                            category: 'Other',
                            priority: 'High'
                        });
                    } catch (e) { console.warn("Wish add failed", e); }
                }
            }
            step = 3;
            OnboardingView.refresh();
        };

        const btn2 = document.getElementById('btn-next-2');
        if (btn2) btn2.onclick = () => handleStep2(false);
        const skip2 = document.getElementById('btn-skip-2');
        if (skip2) skip2.onclick = () => handleStep2(true);

        // Step 3: Finish
        const btnFinish = document.getElementById('btn-finish');
        if (btnFinish) {
            btnFinish.onclick = () => {
                // Reset step for next time logic needed? No, user flag prevents returning.
                window.location.hash = '#/app/home';
            };
        }
    },

    refresh: async () => {
        const app = document.getElementById('app');
        app.innerHTML = await OnboardingView.render();
        await OnboardingView.afterRender();
    }
};