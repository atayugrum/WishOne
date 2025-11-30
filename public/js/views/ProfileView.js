import { authService } from '../services/AuthService.js';
import { firestoreService } from '../services/FirestoreService.js';
import { premiumModal } from '../components/PremiumModal.js';
import { i18n } from '../services/LocalizationService.js';

export const ProfileView = {
    render: async () => {
        const user = authService.currentUser;
        const profile = authService.userProfile;

        if (!user || !profile) return `<div class="empty-state">Please login first.</div>`;

        // Stats
        let wishlistCount = 0;
        let closetCount = 0;
        try {
            const [w, c] = await Promise.all([
                firestoreService.getWishlist(user.uid, user.uid),
                firestoreService.getCloset(user.uid)
            ]);
            wishlistCount = w.length;
            closetCount = c.length;
        } catch (e) { console.warn("Failed to load stats", e); }

        const level = Math.floor(closetCount / 5) + 1;
        const progress = (closetCount % 5) * 20;

        let defaultVis = profile.defaultVisibility;
        if (!defaultVis) {
            defaultVis = profile.isPrivate ? 'private' : 'public';
        }

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

                <div style="display:flex; justify-content:space-between; margin-bottom:32px; background:rgba(0,0,0,0.03); padding:16px; border-radius:16px;">
                    <div style="text-align:center; flex:1;">
                        <div style="font-size:1.5rem; font-weight:700;">${level}</div>
                        <div style="font-size:0.75rem; color:var(--text-secondary); text-transform:uppercase;">Level</div>
                    </div>
                    <div style="width:1px; background:rgba(0,0,0,0.1);"></div>
                    <div style="text-align:center; flex:1;">
                        <div style="font-size:1.5rem; font-weight:700;">${wishlistCount}</div>
                        <div style="font-size:0.75rem; color:var(--text-secondary); text-transform:uppercase;">Wishes</div>
                    </div>
                    <div style="width:1px; background:rgba(0,0,0,0.1);"></div>
                    <div style="text-align:center; flex:1;">
                        <div style="font-size:1.5rem; font-weight:700;">${closetCount}</div>
                        <div style="font-size:0.75rem; color:var(--text-secondary); text-transform:uppercase;">Fulfilled</div>
                    </div>
                </div>
                
                <div style="margin-bottom:32px;">
                    <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:4px; color:var(--text-secondary);">
                        <span>Next Level</span>
                        <span>${progress}%</span>
                    </div>
                    <div style="width:100%; height:8px; background:rgba(0,0,0,0.05); border-radius:4px; overflow:hidden;">
                        <div style="width:${progress}%; height:100%; background:var(--accent-color); transition:width 0.5s ease;"></div>
                    </div>
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

                    <div class="form-group">
                        <label>${i18n.t('profile.privacy_label')}</label>
                        <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:8px;">${i18n.t('profile.privacy_desc')}</p>
                        <select id="input-visibility">
                            <option value="public" ${defaultVis === 'public' ? 'selected' : ''}>${i18n.t('profile.public')}</option>
                            <option value="friends" ${defaultVis === 'friends' ? 'selected' : ''}>${i18n.t('profile.friends_only')}</option>
                            <option value="private" ${defaultVis === 'private' ? 'selected' : ''}>${i18n.t('profile.only_me')}</option>
                        </select>
                    </div>

                    <button type="submit" id="btn-save-profile" class="btn-primary" style="width:100%; margin-top:16px;">${i18n.t('profile.save_changes')}</button>
                </form>

                <div style="margin-top:40px; padding-top:20px; border-top:1px solid rgba(255,59,48,0.2); display:flex; justify-content:space-between; align-items:center;">
                    <h4 style="color:#ff3b30; margin:0;">${i18n.t('profile.danger_zone')}</h4>
                    <div style="display:flex; gap:12px;">
                        <button class="btn-text" id="btn-export-data" style="color: var(--accent-color);">Export Data</button>
                        <button class="btn-text" id="btn-logout" style="color: var(--text-primary);">${i18n.t('profile.logout')}</button>
                        <button id="btn-delete-acc" class="btn-text" style="color: #ff3b30;">${i18n.t('profile.delete_account')}</button>
                    </div>
                </div>
            </div>
        `;
    },

    afterRender: async () => {
        const user = authService.currentUser;
        if (!user) return;

        const upgradeBtn = document.getElementById('btn-upgrade');
        if (upgradeBtn) {
            upgradeBtn.onclick = () => premiumModal.open();
        }

        document.getElementById('btn-logout').onclick = async () => {
            if (confirm(i18n.t('profile.logout') + "?")) {
                await authService.logout();
                window.location.reload();
            }
        };

        // Export Data Handler
        document.getElementById('btn-export-data').onclick = async () => {
            const btn = document.getElementById('btn-export-data');
            btn.textContent = "Generating...";
            btn.disabled = true;

            try {
                const data = await firestoreService.exportAllData(user.uid);
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `wishone-data-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.showToast("Data export started!", "💾");
            } catch (e) {
                console.error(e);
                alert("Export failed.");
            } finally {
                btn.textContent = "Export Data";
                btn.disabled = false;
            }
        };

        const form = document.getElementById('profile-form');
        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                const btn = document.getElementById('btn-save-profile');
                btn.textContent = i18n.t('common.saving');
                btn.disabled = true;

                const newVis = document.getElementById('input-visibility').value;

                const formData = {
                    displayName: document.getElementById('input-fullname').value,
                    username: document.getElementById('input-username').value,
                    birthday: document.getElementById('input-birthday').value,
                    photoURL: document.getElementById('input-photo').value,
                    defaultVisibility: newVis,
                    isPrivate: newVis === 'private'
                };

                try {
                    await firestoreService.updateUserProfile(user.uid, formData);

                    if (authService.userProfile) {
                        Object.assign(authService.userProfile, formData);
                    }

                    window.showToast(i18n.t('common.success'), "💾");

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
                    alert("Delete failed.");
                    btn.disabled = false;
                }
            }
        };
    }
};