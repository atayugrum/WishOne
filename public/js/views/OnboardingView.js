import { authService } from '../services/AuthService.js';
import { i18n } from '../services/LocalizationService.js';

export const OnboardingView = {
    render: async () => {
        window.handleOnboarding = async (e) => {
            e.preventDefault();
            const username = document.getElementById('ob-username').value.trim();
            const birthday = document.getElementById('ob-birthday').value;
            const btn = document.getElementById('ob-btn');

            if (!username || !birthday) return alert("Please fill all fields.");

            btn.disabled = true;
            btn.textContent = i18n.t('common.saving');

            try {
                await authService.completeProfile({ username, birthday });
                window.location.hash = '#/'; // Go home
            } catch (err) {
                console.error(err);
                alert("Error saving profile.");
                btn.disabled = false;
            }
        };

        return `
            <div class="welcome-container">
                <div class="glass-panel auth-card">
                    <h2 style="margin-bottom:8px;">${i18n.t('onboarding.title')}</h2>
                    <p style="margin-bottom:24px; color:var(--text-secondary);">${i18n.t('onboarding.subtitle')}</p>

                    <form onsubmit="window.handleOnboarding(event)" style="width: 100%;">
                        <div class="form-group">
                            <label>${i18n.t('onboarding.username')}</label>
                            <input type="text" id="ob-username" required placeholder="@dreamer">
                        </div>
                        <div class="form-group">
                            <label>${i18n.t('onboarding.birthday')}</label>
                            <input type="date" id="ob-birthday" required>
                        </div>
                        <button type="submit" id="ob-btn" class="btn-primary" style="width: 100%; margin-top:16px;">${i18n.t('onboarding.complete')}</button>
                    </form>
                </div>
            </div>
        `;
    }
};