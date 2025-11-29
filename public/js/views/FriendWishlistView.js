import { authService } from '../services/AuthService.js';
import { firestoreService } from '../services/FirestoreService.js';
import { CATEGORIES } from '../config/categories.js';
import { i18n } from '../services/LocalizationService.js';

// Helper: Calculate days left (Localized)
function getCountdown(dateString) {
    if (!dateString) return null;
    const target = new Date(dateString);
    if (isNaN(target.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    const diffTime = target - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: i18n.t('time.overdue') || "Overdue", class: "tag-overdue", days: diffDays };
    if (diffDays === 0) return { text: i18n.t('time.today') || "Today!", class: "tag-urgent", days: 0 };
    if (diffDays <= 7) return { text: `${diffDays} ${i18n.t('time.days_left') || "days left"}`, class: "tag-urgent", days: diffDays };
    if (diffDays <= 30) return { text: `${diffDays} ${i18n.t('time.days_left') || "days left"}`, class: "tag-soon", days: diffDays };
    return { text: `${Math.round(diffDays / 30)} ${i18n.t('time.months') || "months"}`, class: "tag-far", days: diffDays };
}

export const FriendWishlistView = {
    render: async () => {
        const user = authService.currentUser;
        const friendId = sessionStorage.getItem('currentFriendId');

        if (!user) return `<div class="view-header"><h1>Login Required</h1></div>`;
        if (!friendId) {
            window.location.hash = '#/friends';
            return '';
        }

        const [friendProfile, items] = await Promise.all([
            firestoreService.getUserProfile(friendId),
            firestoreService.getWishlist(friendId)
        ]);

        const friendName = friendProfile ? friendProfile.displayName : "Friend";

        // Privacy Check
        if (friendProfile && friendProfile.isPrivate) {
            return `
                <div class="view-header">
                    <button class="btn-text" onclick="window.location.hash='#/friends'" style="margin-bottom:16px;">← ${i18n.t('common.back') || "Back"}</button>
                </div>
                <div class="glass-panel empty-state-card">
                    <span class="empty-icon">🔒</span>
                    <h3 class="empty-title">${i18n.t('friends.private_title') || "Private Wishlist"}</h3>
                    <p class="empty-text">${friendName} ${i18n.t('friends.private_msg') || "has made their wishlist private."}</p>
                </div>
            `;
        }

        window.handleGiftItem = async (itemId, currentClaimedBy) => {
            const btn = document.querySelector(`[data-gift-btn="${itemId}"]`);
            const card = btn.closest('.card');
            const isClaiming = !currentClaimedBy; 
            const originalBtnHTML = btn.innerHTML;
            const originalCardClass = card.className;
            const existingBadge = card.querySelector('.gift-badge');

            try {
                if (isClaiming) {
                    btn.innerHTML = "✅";
                    card.classList.add('card-gifted');
                    if (!existingBadge) {
                        const badge = document.createElement('div');
                        badge.className = 'gift-badge';
                        badge.innerText = i18n.t('friends.reserved_by_you') || 'Reserved by You';
                        card.prepend(badge);
                    }
                    btn.onclick = () => window.handleGiftItem(itemId, user.uid);
                } else {
                    if (currentClaimedBy !== user.uid) {
                        alert(i18n.t('friends.already_reserved') || "Someone else is already getting this!");
                        return;
                    }
                    btn.innerHTML = "🎁";
                    card.classList.remove('card-gifted');
                    if (existingBadge) existingBadge.remove();
                    btn.onclick = () => window.handleGiftItem(itemId, null);
                }
                await firestoreService.toggleClaimItem(itemId, user.uid, currentClaimedBy);
            } catch (error) {
                console.error("Claim failed:", error);
                alert(i18n.t('common.error'));
                btn.innerHTML = originalBtnHTML;
                card.className = originalCardClass;
                window.location.reload();
            }
        };

        if (items.length === 0) {
            return `
                <div class="view-header">
                    <button class="btn-text" onclick="window.location.hash='#/friends'" style="margin-bottom:16px;">← ${i18n.t('common.back') || "Back"}</button>
                    <h1>${friendName}'s Wishlist</h1>
                </div>
                <div class="glass-panel empty-state-card">
                    <span class="empty-icon">📭</span>
                    <h3 class="empty-title">${i18n.t('friends.empty_title') || "Nothing Here Yet"}</h3>
                    <p class="empty-text">${friendName} ${i18n.t('friends.empty_msg') || "hasn't added any wishes yet."}</p>
                </div>`;
        }

        const gridContent = items.map(item => {
            const isClaimedByMe = item.claimedBy === user.uid;
            const isClaimedByOther = item.claimedBy && !isClaimedByMe;
            let cardClass = "glass-panel card";
            let btnIcon = "🎁";
            let btnClass = "card-action-btn gift-btn";
            let statusBadge = "";

            if (isClaimedByMe) {
                cardClass += " card-gifted";
                btnIcon = "✅";
                statusBadge = `<div class="gift-badge">${i18n.t('friends.reserved_by_you') || 'Reserved by You'}</div>`;
            } else if (isClaimedByOther) {
                cardClass += " card-locked";
                btnIcon = "🔒";
                btnClass += " disabled";
            }

            const catConfig = CATEGORIES[item.category] || (item.category ? { icon:'✨', color:'#ccc' } : CATEGORIES['Other']);
            const icon = catConfig ? catConfig.icon : '📦';
            const subText = item.subcategory ? `• ${item.subcategory}` : '';
            const claimArg = item.claimedBy ? `'${item.claimedBy}'` : 'null';
            const timeData = getCountdown(item.targetDate);
            let timeBadge = '';
            if (timeData) {
                timeBadge = `<div class="card-overlay-badge"><span class="time-tag ${timeData.class}">⏳ ${timeData.text}</span></div>`;
            }

            return `
                <article class="${cardClass}">
                    ${statusBadge}
                    <button class="${btnClass}" data-gift-btn="${item.id}" onclick="window.handleGiftItem('${item.id}', ${claimArg})">${btnIcon}</button>
                    <div class="card-img-container">
                         ${timeBadge}
                         <img src="${item.imageUrl}" class="card-img" onerror="this.src='https://placehold.co/600x400'">
                    </div>
                    <div class="card-content">
                        <h3>${item.title}</h3>
                        <div class="card-meta">
                            <span class="tag">${icon} ${item.category || catConfig.label} ${subText}</span>
                            <span class="price">${item.price} ${item.currency}</span>
                        </div>
                    </div>
                </article>
            `;
        }).join('');

        return `
            <div class="view-header">
                <div style="margin-bottom:16px;">
                    <button class="btn-text" onclick="window.location.hash='#/friends'">← ${i18n.t('common.back') || "Back"}</button>
                </div>
                <h1>${friendName}'s Wishlist</h1>
                <p>${i18n.t('friends.subtitle')}</p>
            </div>
            <div class="masonry-grid">
                ${gridContent}
            </div>
        `;
    }
};