/* public/js/views/OnboardingView.js */
import { authService } from '../services/AuthService.js';
import { firestoreService } from '../services/FirestoreService.js';
import { router } from '../utils/Router.js';

export const OnboardingView = {
    render: async () => {
        return `
            <div class="lab-gradient-bg"></div>
            <div style="max-width:400px; margin:40px auto; padding:20px; text-align:center; position:relative; z-index:1;">
                
                <div class="hub-hero-card" style="padding: 32px 24px;">
                    <div style="font-size:3rem; margin-bottom:16px;">👋</div>
                    <h2 class="hub-title" style="font-size:1.5rem;">Let's get to know you</h2>
                    <p class="hub-subtitle" style="margin-bottom:24px;">To personalize your lab.</p>
                    
                    <form id="onboard-form" style="text-align:left; width:100%; display:flex; flex-direction:column; gap:16px;">
                        
                        <div class="form-group" style="margin:0;">
                            <label style="margin-left:4px;">Username</label>
                            <input type="text" id="ob-username" required placeholder="dreamer123" pattern="[a-zA-Z0-9_]+" style="text-transform:lowercase; background:rgba(255,255,255,0.8);">
                            <small id="username-error" style="color:red; display:none; margin-top:4px;">Username taken.</small>
                        </div>

                        <div class="form-group" style="margin:0;">
                            <label style="margin-left:4px;">Birthday</label>
                            <input type="date" id="ob-dob" required style="background:rgba(255,255,255,0.8);">
                        </div>

                        <button type="submit" class="hub-btn primary" style="width:100%; margin-top:8px;">
                            <span>Enter WishOne →</span>
                        </button>
                    </form>
                </div>

            </div>
        `;
    },

    afterRender: async () => {
        const header = document.querySelector('.floating-header');
        if (header) header.style.display = 'none';

        const form = document.getElementById('onboard-form');
        if (!form) return;

        form.onsubmit = async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('ob-username').value.trim().toLowerCase();
            const dob = document.getElementById('ob-dob').value;
            const btn = e.target.querySelector('button');
            const errorEl = document.getElementById('username-error');

            btn.disabled = true;
            btn.innerHTML = 'Checking...';
            errorEl.style.display = 'none';
            
            try {
                const isUnique = await firestoreService.checkUsernameUnique(username);
                
                if (isUnique) {
                    const user = authService.currentUser;
                    
                    // 1. Update Cloud Database
                    await firestoreService.updateUserProfile(user.uid, { 
                        username, 
                        dateOfBirth: dob,
                        hasCompletedSignupProfile: true 
                    });

                    // 2. [CRITICAL FIX] Update Local State Immediately
                    // This allows the Router Guard to let us pass
                    if (authService.userProfile) {
                        authService.userProfile.username = username;
                        authService.userProfile.dateOfBirth = dob;
                        authService.userProfile.hasCompletedSignupProfile = true;
                    }
                    
                    // 3. Navigate to Home
                    router.navigate('/app/home');
                } else {
                    errorEl.style.display = 'block';
                    btn.disabled = false;
                    btn.innerHTML = '<span>Enter WishOne →</span>';
                }
            } catch (err) {
                console.error(err);
                alert("Something went wrong. Please try again.");
                btn.disabled = false;
                btn.innerHTML = '<span>Enter WishOne →</span>';
            }
        };
    }
};