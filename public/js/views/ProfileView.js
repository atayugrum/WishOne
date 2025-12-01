/* public/js/views/ProfileView.js */
import { authService } from '../services/AuthService.js';
import { firestoreService } from '../services/FirestoreService.js';
import { i18n } from '../services/LocalizationService.js';
import { GamificationService } from '../services/GamificationService.js';
import { aiService } from '../services/AIService.js';
import { FEATURES } from '../config/limits.js';
import { premiumModal } from '../components/PremiumModal.js';

export const ProfileView = {
    render: async () => {
        return `
            <div class="view-header">
                <h1>${i18n.t('nav.profile')}</h1>
            </div>
            <div id="profile-content" class="fade-in">
                <div class="loading-spinner">${i18n.t('common.loading')}</div>
            </div>
        `;
    },

    afterRender: async () => {
        const user = authService.currentUser;
        if (!user) return;

        const container = document.getElementById('profile-content');
        
        try {
            const [profile, stats, items] = await Promise.all([
                firestoreService.getUserProfile(user.uid),
                firestoreService.getUserStats(user.uid),
                firestoreService.getCloset(user.uid) // Need items for style analysis
            ]);

            const level = GamificationService.calculateLevel(stats.fulfilled || 0);
            const styleProfile = profile.styleProfile || null;

            // Generate Style Tags HTML
            let styleHtml = `
                <div style="text-align:center; padding:20px; color:var(--text-tertiary);">
                    <p>Unlock your Style DNA to get personalized advice.</p>
                    <button class="btn-magic" id="btn-analyze-style" style="margin-top:12px;">✨ Analyze My Style</button>
                </div>
            `;

            if (styleProfile) {
                styleHtml = `
                    <div style="text-align:left;">
                        <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px;">
                            ${(styleProfile.vibes || []).map(v => `<span class="tag" style="background:var(--accent-color); color:white;">${v}</span>`).join('')}
                            ${(styleProfile.colors || []).map(c => `<span class="tag">${c}</span>`).join('')}
                        </div>
                        <p style="font-size:0.9rem; font-style:italic;">"${styleProfile.summary}"</p>
                        <div style="margin-top:12px; background:rgba(0,0,0,0.03); padding:8px; border-radius:8px; font-size:0.85rem;">
                            <b>💡 Tip:</b> ${styleProfile.shoppingAdvice}
                        </div>
                        <button class="btn-text" id="btn-analyze-style" style="margin-top:12px; font-size:0.8rem;">🔄 Re-analyze</button>
                    </div>
                `;
            }

            container.innerHTML = `
                <div class="glass-panel" style="padding:24px; text-align:center; margin-bottom:24px; position:relative;">
                    <button id="btn-edit-profile" class="btn-text" style="position:absolute; top:16px; right:16px;">✎ Edit</button>
                    
                    <div style="position:relative; display:inline-block;">
                        <img src="${profile.photoURL || 'https://placehold.co/100'}" style="width:100px; height:100px; border-radius:50%; object-fit:cover; border:3px solid var(--accent-color);">
                        <div style="position:absolute; bottom:0; right:0; background:var(--accent-color); color:white; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:0.8rem;">
                            ${level}
                        </div>
                    </div>
                    
                    <h2 style="margin:12px 0 4px;">${profile.displayName || 'User'}</h2>
                    <p style="color:var(--text-tertiary); font-size:0.9rem;">@${profile.username || 'username'}</p>
                    
                    <div id="bio-display" style="margin-top:12px; color:var(--text-secondary); max-width:400px; margin-left:auto; margin-right:auto;">
                        ${profile.bio || 'No bio yet.'}
                    </div>

                    <form id="profile-edit-form" style="display:none; margin-top:16px; max-width:400px; margin-left:auto; margin-right:auto; text-align:left;">
                        <div class="form-group">
                            <label>Display Name</label>
                            <input name="displayName" value="${profile.displayName || ''}">
                        </div>
                        <div class="form-group">
                            <label>Bio</label>
                            <textarea name="bio" rows="3">${profile.bio || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label>Profile Visibility</label>
                            <select name="profileVisibility">
                                <option value="public" ${profile.profileVisibility === 'public' ? 'selected' : ''}>🌍 Public</option>
                                <option value="friends_only" ${profile.profileVisibility === 'friends_only' ? 'selected' : ''}>👥 Friends Only</option>
                            </select>
                        </div>
                        <div style="display:flex; gap:8px; margin-top:16px;">
                            <button type="submit" class="btn-primary" style="flex:1;">Save</button>
                            <button type="button" id="btn-cancel-edit" class="btn-text" style="flex:1;">Cancel</button>
                        </div>
                    </form>
                </div>

                <div class="glass-panel" style="padding:20px; margin-bottom:24px;">
                    <h3 style="margin-top:0;">🧬 Style DNA</h3>
                    <div id="style-dna-content">
                        ${styleHtml}
                    </div>
                </div>

                <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; margin-bottom:24px;">
                    <div class="glass-panel" style="padding:16px; text-align:center;">
                        <div style="font-size:1.5rem; font-weight:700; color:var(--accent-color);">${stats.totalWishes || 0}</div>
                        <div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-tertiary);">Wishes</div>
                    </div>
                    <div class="glass-panel" style="padding:16px; text-align:center;">
                        <div style="font-size:1.5rem; font-weight:700; color:#34C759;">${stats.fulfilled || 0}</div>
                        <div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-tertiary);">Fulfilled</div>
                    </div>
                    <div class="glass-panel" style="padding:16px; text-align:center;">
                        <div style="font-size:1.5rem; font-weight:700; color:#007AFF;" id="friend-count">-</div>
                        <div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-tertiary);">Friends</div>
                    </div>
                </div>

                <div class="glass-panel" style="padding:0; overflow:hidden;">
                    <button class="list-item-btn" onclick="window.location.hash='#settings'">
                        <span>⚙️ Settings</span>
                        <span>›</span>
                    </button>
                    <button class="list-item-btn" onclick="authService.logout()">
                        <span style="color:#ff3b30;">🚪 Log Out</span>
                    </button>
                </div>
            `;

            // Friend Count
            firestoreService.getFriends(user.uid).then(friends => {
                const el = document.getElementById('friend-count');
                if(el) el.innerText = friends.length;
            });

            // Analyze Handler
            const bindAnalyze = () => {
                const btn = document.getElementById('btn-analyze-style');
                if(!btn) return;
                
                btn.onclick = async () => {
                    if (!authService.canUseFeature(FEATURES.AI_COMBOS)) { premiumModal.open(); return; } // Use similar feature limit

                    btn.disabled = true;
                    btn.innerHTML = 'Analyzing...';
                    
                    try {
                        const styleData = await aiService.getStyleProfile(items);
                        if(styleData && styleData.vibes) {
                            // Save to profile
                            await firestoreService.updateUserProfile(user.uid, { styleProfile: styleData });
                            window.showToast("Style DNA Updated!", "🧬");
                            ProfileView.afterRender(); // Refresh
                        } else {
                            window.showToast("Could not analyze style.");
                        }
                    } catch(e) {
                        console.error(e);
                        window.showToast("AI Service Error");
                    } finally {
                        btn.disabled = false;
                        btn.innerHTML = '✨ Analyze My Style';
                    }
                };
            };
            bindAnalyze();

            // Edit Profile Handlers
            const btnEdit = document.getElementById('btn-edit-profile');
            const btnCancel = document.getElementById('btn-cancel-edit');
            const form = document.getElementById('profile-edit-form');
            const bioDisplay = document.getElementById('bio-display');

            btnEdit.onclick = () => {
                bioDisplay.style.display = 'none';
                btnEdit.style.display = 'none';
                form.style.display = 'block';
            };

            btnCancel.onclick = () => {
                form.style.display = 'none';
                bioDisplay.style.display = 'block';
                btnEdit.style.display = 'block';
            };

            form.onsubmit = async (e) => {
                e.preventDefault();
                const fd = new FormData(form);
                const updates = {
                    displayName: fd.get('displayName'),
                    bio: fd.get('bio'),
                    profileVisibility: fd.get('profileVisibility')
                };
                
                await firestoreService.updateUserProfile(user.uid, updates);
                window.showToast('Profile updated');
                ProfileView.afterRender();
            };

        } catch (e) {
            console.error(e);
            container.innerHTML = `<div class="empty-state">Error loading profile.</div>`;
        }
    }
};