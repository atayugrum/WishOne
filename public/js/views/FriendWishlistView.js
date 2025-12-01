/* public/js/views/FriendWishlistView.js */
import { authService } from '../services/AuthService.js';
import { firestoreService } from '../services/FirestoreService.js';
import { CATEGORIES } from '../config/categories.js';
import { i18n } from '../services/LocalizationService.js';

export const FriendWishlistView = {
    render: async () => {
        const user = authService.currentUser;
        // Extract friend ID from hash: #/friend/UID
        const friendId = window.location.hash.split('/friend/')[1];

        if (!user) return `<div class="view-header"><h1>Login Required</h1></div>`;
        if (!friendId) return `<div class="empty-state">User not found.</div>`;

        try {
            const [friendProfile, items, stats] = await Promise.all([
                firestoreService.getUserProfile(friendId),
                firestoreService.getWishlist(friendId, user.uid),
                firestoreService.getUserStats(friendId)
            ]);

            if (!friendProfile) return `<div class="empty-state">User not found.</div>`;

            const isFriend = await firestoreService.checkIsFriend(friendId, user.uid);
            const isMe = friendId === user.uid;

            // Profile Header
            let html = `
                <div class="view-header">
                    <button class="btn-text" onclick="window.history.back()" style="margin-bottom:16px;">← Back</button>
                    
                    <div class="glass-panel" style="padding:24px; display:flex; align-items:center; gap:24px; flex-wrap:wrap;">
                        <img src="${friendProfile.photoURL}" style="width:80px; height:80px; border-radius:50%; object-fit:cover;">
                        <div style="flex:1;">
                            <h2 style="margin:0;">${friendProfile.displayName}</h2>
                            <p style="color:var(--text-secondary);">@${friendProfile.username}</p>
                            ${friendProfile.bio ? `<p style="margin-top:8px; font-size:0.9rem;">${friendProfile.bio}</p>` : ''}
                            ${friendProfile.links && friendProfile.links.length ? `<p style="margin-top:4px; font-size:0.8rem; color:var(--accent-color);">🔗 ${friendProfile.links[0]}</p>` : ''}
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:1.2rem; font-weight:700;">${stats.totalWishes}</div>
                            <div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-secondary);">Wishes</div>
                        </div>
                    </div>

                    <div style="margin-top:24px; display:flex; gap:12px;">
                        <div class="auth-tab active">Wishlist</div>
                        </div>
                </div>
            `;

            if (items.length === 0) {
                html += `<div class="empty-state"><p>No public wishes.</p></div>`;
            } else {
                const grid = items.map(item => {
                    const catConfig = CATEGORIES[item.category] || CATEGORIES['Other'];
                    const icon = catConfig.icon || '📦';
                    // Gift Button Logic
                    const isClaimed = item.claimedBy === user.uid;
                    const isAvailable = !item.claimedBy;
                    let btnHtml = '';

                    if (isAvailable) btnHtml = `<button class="card-action-btn gift-btn" onclick="window.claimItem('${item.id}')">🎁</button>`;
                    else if (isClaimed) btnHtml = `<span class="tag" style="position:absolute; top:10px; right:10px; background:#FFD700;">Reserved by You</span>`;
                    else btnHtml = `<span class="tag" style="position:absolute; top:10px; right:10px;">Reserved</span>`;

                    return `
                        <article class="glass-panel card">
                            ${btnHtml}
                            <div class="card-img-container"><img src="${item.imageUrl}" class="card-img"></div>
                            <div class="card-content">
                                <h3>${item.title}</h3>
                                <div class="card-meta"><span class="tag">${icon} ${item.category}</span></div>
                            </div>
                        </article>
                    `;
                }).join('');
                html += `<div class="masonry-grid" style="margin-top:24px;">${grid}</div>`;
            }

            window.claimItem = async (id) => {
                if (confirm("Reserve this gift?")) {
                    await firestoreService.toggleClaimItem(id, user.uid, null);
                    window.location.reload();
                }
            };

            return html;

        } catch (e) {
            console.error(e);
            // Private Profile Fallback
            if (e.message === 'Private Profile') {
                return `
                    <div class="view-header"><button class="btn-text" onclick="window.history.back()">← Back</button></div>
                    <div class="empty-state">
                        <span class="empty-icon">🔒</span>
                        <h3>Private Profile</h3>
                        <p>You must be friends to see this.</p>
                    </div>
                `;
            }
            return `<div class="empty-state">Error loading profile.</div>`;
        }
    }
};