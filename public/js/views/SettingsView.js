/* public/js/views/SettingsView.js */
import { authService } from '../services/AuthService.js';
import { settingsService } from '../services/SettingsService.js';
import { i18n } from '../services/LocalizationService.js';
import { firestoreService } from '../services/FirestoreService.js';
import { apiCall } from '../config/api.js';

export const SettingsView = {
    render: async () => {
        const user = authService.currentUser;
        if (!user) return `<div class="empty-state">Please login.</div>`;

        const settings = settingsService.getSettings();
        const profile = authService.userProfile;

        return `
            <div class="view-header">
                <h1>${i18n.t('settings.title')}</h1>
            </div>

            <div style="max-width: 600px; margin: 0 auto; padding-bottom: 80px;">
                
                <!-- 1. Account -->
                <div class="glass-panel" style="padding: 24px; margin-bottom: 24px;">
                    <h3 style="margin-bottom: 16px; border-bottom: 1px solid rgba(0,0,0,0.1); padding-bottom:8px;">${i18n.t('settings.account')}</h3>
                    <div style="display:flex; align-items:center; gap:16px; margin-bottom:16px;">
                        <img src="${profile?.photoURL || 'https://placehold.co/50'}" style="width:50px; height:50px; border-radius:50%; object-fit:cover;">
                        <div>
                            <div style="font-weight:600;">${profile?.displayName || 'User'}</div>
                            <div style="font-size:0.9rem; color:var(--text-secondary);">${user.email}</div>
                        </div>
                    </div>
                    <button class="btn-text" onclick="window.location.hash='#/profile'" style="color:var(--accent-color);">Edit Profile →</button>
                </div>

                <!-- 2. Language & Theme -->
                <div class="glass-panel" style="padding: 24px; margin-bottom: 24px;">
                    <h3 style="margin-bottom: 16px; border-bottom: 1px solid rgba(0,0,0,0.1); padding-bottom:8px;">${i18n.t('settings.appearance')}</h3>
                    
                    <div class="form-group">
                        <label>${i18n.t('settings.language')}</label>
                        <div class="btn-group" style="margin-top:8px;">
                            <button class="filter-chip ${settings.language === 'en' ? 'active' : ''}" onclick="window.updateLang('en')">English</button>
                            <button class="filter-chip ${settings.language === 'tr' ? 'active' : ''}" onclick="window.updateLang('tr')">Türkçe</button>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Theme</label>
                        <div class="btn-group" style="margin-top:8px;">
                            <button class="filter-chip ${settings.theme === 'light' ? 'active' : ''}" onclick="window.updateTheme('light')">☀️ ${i18n.t('settings.theme_light')}</button>
                            <button class="filter-chip ${settings.theme === 'dark' ? 'active' : ''}" onclick="window.updateTheme('dark')">🌙 ${i18n.t('settings.theme_dark')}</button>
                            <button class="filter-chip ${settings.theme === 'system' ? 'active' : ''}" onclick="window.updateTheme('system')">💻 ${i18n.t('settings.theme_system')}</button>
                        </div>
                    </div>
                </div>

                <!-- 3. Notifications -->
                <div class="glass-panel" style="padding: 24px; margin-bottom: 24px;">
                    <h3 style="margin-bottom: 16px; border-bottom: 1px solid rgba(0,0,0,0.1); padding-bottom:8px;">${i18n.t('settings.notifications')}</h3>
                    
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <div>
                            <div style="font-weight:500;">Wishlist Reminders</div>
                            <div style="font-size:0.8rem; color:var(--text-secondary);">Target dates & expiries</div>
                        </div>
                        <label class="toggle-switch-label">
                            <input type="checkbox" id="toggle-notif-wish" ${settings.notifications.wishlistReminders ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="font-weight:500;">Gift & Occasions</div>
                            <div style="font-size:0.8rem; color:var(--text-secondary);">Upcoming birthdays & holidays</div>
                        </div>
                        <label class="toggle-switch-label">
                            <input type="checkbox" id="toggle-notif-gift" ${settings.notifications.giftReminders ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>

                <!-- 4. Data -->
                <div class="glass-panel" style="padding: 24px; margin-bottom: 24px;">
                    <h3 style="margin-bottom: 16px; border-bottom: 1px solid rgba(0,0,0,0.1); padding-bottom:8px;">${i18n.t('settings.data')}</h3>
                    <div style="display:flex; flex-direction:column; gap:12px;">
                        <button class="btn-primary" id="btn-export-wishlist" style="width:100%;">
                            📥 ${i18n.t('settings.export_data')} (JSON)
                        </button>
                    </div>
                </div>

                <!-- 5. Danger Zone -->
                <div style="padding: 24px; border:1px solid #ff3b30; border-radius:24px; background:rgba(255, 59, 48, 0.05);">
                    <h3 style="margin-bottom: 16px; color:#ff3b30;">${i18n.t('profile.danger_zone')}</h3>
                    <button class="btn-text" id="btn-delete-account" style="color:#ff3b30; font-weight:600;">
                        🗑️ ${i18n.t('profile.delete_account')}
                    </button>
                </div>

            </div>
        `;
    },

    afterRender: async () => {
        const user = authService.currentUser;
        if (!user) return;

        // Theme Handlers
        window.updateTheme = (theme) => {
            settingsService.updateSettings({ theme });
            SettingsView.refresh();
        };

        // Language Handlers
        window.updateLang = (lang) => {
            settingsService.updateSettings({ language: lang });
            // Full refresh to re-render all components
            window.location.reload();
        };

        // Notification Toggles
        const toggleWish = document.getElementById('toggle-notif-wish');
        const toggleGift = document.getElementById('toggle-notif-gift');

        toggleWish.onchange = (e) => {
            const current = settingsService.getSettings().notifications;
            settingsService.updateSettings({ notifications: { ...current, wishlistReminders: e.target.checked } });
        };

        toggleGift.onchange = (e) => {
            const current = settingsService.getSettings().notifications;
            settingsService.updateSettings({ notifications: { ...current, giftReminders: e.target.checked } });
        };

        // Export (Calls Backend)
        document.getElementById('btn-export-wishlist').onclick = async () => {
            const btn = document.getElementById('btn-export-wishlist');
            btn.textContent = "Processing...";
            btn.disabled = true;
            try {
                // Call Cloud Function for Export
                const data = await apiCall('/api/export/wishlist', 'POST', { userId: user.uid });

                // Trigger Download
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `wishlist-export-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                window.showToast("Export complete!", "📥");
            } catch (e) {
                console.error(e);
                alert("Export failed.");
            } finally {
                btn.textContent = `📥 ${i18n.t('settings.export_data')} (JSON)`;
                btn.disabled = false;
            }
        };

        // Delete Account
        document.getElementById('btn-delete-account').onclick = async () => {
            if (confirm(i18n.t('settings.delete_acc_confirm'))) {
                const doubleCheck = prompt("Type 'DELETE' to confirm:");
                if (doubleCheck === 'DELETE') {
                    try {
                        await firestoreService.deleteUserData(user.uid);
                        await authService.deleteUserAccount();
                        window.location.reload();
                    } catch (e) { alert("Deletion failed. Re-login and try again."); }
                }
            }
        };
    },

    refresh: async () => {
        const app = document.getElementById('app');
        app.innerHTML = await SettingsView.render();
        await SettingsView.afterRender();
    }
};