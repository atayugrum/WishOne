import { authService } from '../services/AuthService.js';
import { firestoreService } from '../services/FirestoreService.js';
import { premiumModal } from '../components/PremiumModal.js';
import { i18n } from '../services/LocalizationService.js';

export const ProfileView = {
    render: async () => {
        const user = authService.currentUser;
        const profile = authService.userProfile;

        if (!user || !profile) return `<div class="empty-state">Please login first.</div>`;

        const isPrivate = profile.isPrivate === true;
        // Check both boolean flag and legacy string plan
        const isPremium = profile.premium === true || profile.plan === 'premium';

        return `
            <div class="view-header"><h1>${i18n.t('profile.title')}</h1></div>
            <div class="glass-panel" style="max-width: 600px; margin: 0 auto; padding: 32px;">
                
                <div style="text-align: center; margin-bottom: 32px;">
                    <img src="${profile.photoURL}" style="width: 100px; height: 100px; border-radius: 50%; object-fit:cover; box-shadow:0 8px 20px rgba(0,0,0,0.1);">
                    <h3>${profile.displayName}</h3>
                    <p style="color:var(--text-secondary); font-size:0.9rem;">@${profile.username || 'user'}</p>
                    
                    <div style="margin-top:12px;">
                        <span class="tag" style="background:${isPremium ? '#FFD700' : '#eee'}; color:${isPremium ? '#5a4a00' : '#555'}; font-size:0.9rem; padding:6px 12px; border-radius:12px; font-weight:600;">
                            ${isPremium ? '👑 Premium Plan' : 'Free Plan'}
                        </span>
                    </div>

                    ${!isPremium ? `
                        <button id="btn-upgrade" class="btn-primary" style="margin-top:16px; background:linear-gradient(135deg, #1D1D1F, #434344);">
                            Upgrade to Premium
                        </button>
                    ` : ''}
                </div>

                <form id="profile-form">
                    <h4 style="margin-bottom:16px; border-bottom:1px solid rgba(0,0,0,0.1); padding-bottom:8px;">${i18n.t('profile.basic_info')}</h4>
                    
                    <div class="form-row">
                        <div class="form-group" style="flex:1;">
                            <label>${i18n.t('profile.fullname')}</label>
                            <input type="text" id="input-fullname" value="${profile.displayName || ''}" required>
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label>${i18n.t('profile.username')}</label>
                            <input type="text" id="input-username" value="${profile.username || ''}" required>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Avatar URL</label>
                        <input type="url" id="input-photo" value="${profile.photoURL || ''}">
                    </div>

                    <div class="form-group">
                        <label>${i18n.t('profile.birthday')}</label>
                        <input type="date" id="input-birthday" value="${profile.birthday || ''}">
                    </div>

                    <h4 style="margin:24px 0 16px; border-bottom:1px solid rgba(0,0,0,0.1); padding-bottom:8px;">${i18n.t('profile.privacy_settings')}</h4>

                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
                        <div>
                            <label style="margin-bottom:4px;">${i18n.t('profile.privacy_label')}</label>
                            <p style="font-size:0.8rem; color:var(--text-secondary);">${i18n.t('profile.privacy_desc')}</p>
                        </div>
                        <label class="toggle-switch-label">
                            <input type="checkbox" id="input-privacy" ${isPrivate ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>

                    <button type="submit" id="btn-save-profile" class="btn-primary" style="width:100%; margin-top:16px;">${i18n.t('profile.save_changes')}</button>
                </form>

                <div style="margin-top:40px; padding-top:20px; border-top:1px solid rgba(255,59,48,0.2); display:flex; justify-content:space-between; align-items:center;">
                    <h4 style="color:#ff3b30; margin:0;">${i18n.t('profile.danger_zone')}</h4>
                    <div>
                        <button class="btn-text" id="btn-logout" style="color: var(--text-primary); margin-right:16px;">${i18n.t('profile.logout')}</button>
                        <button id="btn-delete-acc" class="btn-text" style="color: #ff3b30;">${i18n.t('profile.delete_account')}</button>
                    </div>
                </div>
            </div>
        `;
    },

    afterRender: async () => {
        const user = authService.currentUser;
        if (!user) return;

        // Upgrade Button
        const upgradeBtn = document.getElementById('btn-upgrade');
        if (upgradeBtn) {
            upgradeBtn.onclick = () => premiumModal.open();
        }

        // Logout
        document.getElementById('btn-logout').onclick = async () => {
            if (confirm(i18n.t('profile.logout') + "?")) {
                await authService.logout();
                window.location.reload();
            }
        };

        // Save Profile
        const form = document.getElementById('profile-form');
        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                const btn = document.getElementById('btn-save-profile');
                btn.textContent = i18n.t('common.saving');
                btn.disabled = true;

                const formData = {
                    displayName: document.getElementById('input-fullname').value,
                    username: document.getElementById('input-username').value,
                    birthday: document.getElementById('input-birthday').value,
                    photoURL: document.getElementById('input-photo').value,
                    isPrivate: document.getElementById('input-privacy').checked
                };

                try {
                    await firestoreService.updateUserProfile(user.uid, formData);

                    // Local update
                    if (authService.userProfile) {
                        Object.assign(authService.userProfile, formData);
                    }

                    window.showToast(i18n.t('common.success'), "💾");

                    // Refresh to update header avatar etc.
                    const app = document.getElementById('app');
                    app.innerHTML = await ProfileView.render();
                    await ProfileView.afterRender();
                } catch (err) {
                    console.error(err);
                    alert(i18n.t('common.error'));
                } finally {
                    const newBtn = document.getElementById('btn-save-profile');
                    if (newBtn) {
                        newBtn.textContent = i18n.t('profile.save_changes');
                        newBtn.disabled = false;
                    }
                }
            };
        }

        // Delete Account
        document.getElementById('btn-delete-acc').onclick = async () => {
            if (confirm(i18n.t('profile.delete_confirm'))) {
                const btn = document.getElementById('btn-delete-acc');
                btn.textContent = "Deleting...";
                btn.disabled = true;
                try {
                    await firestoreService.deleteUserData(user.uid);
                    await authService.deleteUserAccount();
                    window.location.reload();
                } catch (e) {
                    alert("Delete failed. You may need to re-login first.");
                    console.error(e);
                    btn.textContent = i18n.t('profile.delete_account');
                    btn.disabled = false;
                }
            }
        };
    }
};