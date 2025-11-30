import { authService } from '../services/AuthService.js';
import { firestoreService } from '../services/FirestoreService.js';
import { i18n } from '../services/LocalizationService.js';

export const OnboardingView = {
    render: async () => {
        window.handleOnboarding = async (e) => {
            e.preventDefault();
            const usernameInput = document.getElementById('ob-username');
            const username = usernameInput.value.trim().toLowerCase();
            const birthday = document.getElementById('ob-birthday').value;
            const btn = document.getElementById('ob-btn');
            const errorMsg = document.getElementById('ob-error');

            // Basic Validation
            if (!username || username.length < 3) return alert("Username must be at least 3 chars.");
            if (!birthday) return alert("Please select your birthday.");

            btn.disabled = true;
            btn.textContent = i18n.t('common.loading');
            errorMsg.style.display = 'none';

            try {
                // [NEW] Check uniqueness
                const isUnique = await firestoreService.checkUsernameUnique(username);
                if (!isUnique) {
                    throw new Error("Username is already taken.");
                }

                await authService.completeProfile({ username, birthday });
                window.location.hash = '#/';
            } catch (err) {
                console.error(err);
                errorMsg.textContent = err.message || "Error saving profile.";
                errorMsg.style.display = 'block';
                btn.disabled = false;
                btn.textContent = i18n.t('onboarding.complete');
            }
        };

        if (window.aiCompanion) window.aiCompanion.say("One last step!", "thinking");

        return `
            <div class="welcome-container">
                <div class="glass-panel auth-card lighter-card">
                    <h2 style="margin-bottom:8px; font-size:1.8rem;">${i18n.t('onboarding.title')}</h2>
                    <p style="margin-bottom:24px; color:var(--text-secondary);">${i18n.t('onboarding.subtitle')}</p>

                    <form onsubmit="window.handleOnboarding(event)" style="width: 100%;">
                        <div class="form-group compact-group">
                            <label style="margin-left:4px;">${i18n.t('onboarding.username')}</label>
                            <div class="input-with-icon">
                                <span class="input-icon">@</span>
                                <input type="text" id="ob-username" required placeholder="dreamer" pattern="[a-zA-Z0-9_]+" title="Letters, numbers, and underscores only.">
                            </div>
                        </div>
                        <div class="form-group compact-group">
                            <label style="margin-left:4px;">${i18n.t('onboarding.birthday')}</label>
                            <div class="input-with-icon">
                                <span class="input-icon">🎂</span>
                                <input type="date" id="ob-birthday" required>
                            </div>
                        </div>
                        <p id="ob-error" style="color: #ff3b30; font-size: 0.85rem; display: none; margin-bottom: 12px; text-align:center;"></p>
                        <button type="submit" id="ob-btn" class="btn-primary compact-btn" style="width: 100%; margin-top:16px;">
                            ${i18n.t('onboarding.complete')}
                        </button>
                    </form>
                </div>
            </div>
        `;
    }
};