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
                
                <button class="btn-text" onclick="window.handleLogout()" style="color: #ff3b30; width:100%;">Log Out</button>
            </div>
        `;
    }
};