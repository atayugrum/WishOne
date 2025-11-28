import { authService } from '../services/AuthService.js';
import { firestoreService } from '../services/FirestoreService.js';
import { premiumModal } from '../components/PremiumModal.js';

export const ProfileView = {
    render: async () => {
        const user = authService.currentUser;
        const profile = authService.userProfile;
        if (!user || !profile) return `<div class="empty-state">Please login first.</div>`;

        window.handleLogout = async () => {
            if (confirm("Log out?")) { await authService.logout(); window.location.reload(); }
        };

        window.openPremium = () => premiumModal.open();

        window.toggleVisibility = async (checkbox) => {
            const isPrivate = checkbox.checked;
            const statusLabel = document.getElementById('visibility-status');
            const shareSection = document.getElementById('share-link-section');

            statusLabel.textContent = isPrivate ? "Only Me" : "Public";

            try {
                await firestoreService.updateUserProfile(user.uid, { isPrivate: isPrivate });
                // Toggle Share Section visibility
                if (isPrivate) {
                    shareSection.style.opacity = '0.5';
                    shareSection.style.pointerEvents = 'none';
                } else {
                    shareSection.style.opacity = '1';
                    shareSection.style.pointerEvents = 'auto';
                }
            } catch (e) {
                console.error("Failed to update visibility", e);
                checkbox.checked = !isPrivate;
                alert("Could not update settings.");
            }
        };

        window.copyPublicLink = () => {
            const url = `${window.location.origin}/#/share?uid=${user.uid}`;
            navigator.clipboard.writeText(url).then(() => {
                window.showToast("Link copied!", "🔗");
            });
        };

        const isPrivate = profile.isPrivate === true;

        return `
            <div class="view-header"><h1>My Profile</h1></div>
            <div class="glass-panel" style="max-width: 600px; margin: 0 auto; padding: 32px;">
                <div style="text-align: center; margin-bottom: 32px;">
                    <img src="${profile.photoURL}" style="width: 100px; height: 100px; border-radius: 50%;">
                    <h3>${profile.displayName}</h3>
                    
                    <div style="margin-top:12px;">
                        <span class="tag" style="background:${profile.plan === 'premium' ? '#FFD700' : '#eee'}; color:${profile.plan === 'premium' ? '#5a4a00' : '#555'}; font-size:0.9rem; padding:6px 12px;">
                            ${profile.plan === 'premium' ? '👑 Premium Plan' : 'Free Plan'}
                        </span>
                    </div>

                    ${profile.plan !== 'premium' ? `
                        <button class="btn-primary" onclick="window.openPremium()" style="margin-top:16px; background:linear-gradient(135deg, #1D1D1F, #434344);">
                            Upgrade to Premium
                        </button>
                    ` : ''}
                </div>

                <div class="form-group">
                    <label>Email</label>
                    <input type="text" value="${profile.email}" disabled style="opacity:0.7">
                </div>
                
                <hr style="border:0; border-top:1px solid rgba(0,0,0,0.1); margin: 24px 0;">

                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
                    <div>
                        <label style="margin-bottom:4px;">Wishlist Visibility</label>
                        <p style="font-size:0.8rem; color:var(--text-secondary);">Allow others to see your list via link?</p>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span id="visibility-status" style="font-size:0.9rem; color:var(--text-primary); font-weight:600; width:60px; text-align:right;">${isPrivate ? 'Only Me' : 'Public'}</span>
                        <label class="toggle-switch-label">
                            <input type="checkbox" onchange="window.toggleVisibility(this)" ${isPrivate ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>

                <div id="share-link-section" style="transition: opacity 0.3s; ${isPrivate ? 'opacity: 0.5; pointer-events: none;' : ''}">
                    <label>Your Public Link</label>
                    <div style="display: flex; gap: 8px;">
                        <input type="text" value="${window.location.origin}/#/share?uid=${user.uid}" readonly style="font-size: 0.85rem; color: var(--text-secondary); background: rgba(0,0,0,0.03);">
                        <button class="btn-primary" onclick="window.copyPublicLink()" style="min-width: 80px;">Copy</button>
                    </div>
                </div>

                <hr style="border:0; border-top:1px solid rgba(0,0,0,0.1); margin: 24px 0;">

                <button class="btn-text" onclick="window.handleLogout()" style="color: #ff3b30; width:100%;">Log Out</button>
            </div>
        `;
    }
};