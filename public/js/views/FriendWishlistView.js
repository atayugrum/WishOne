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

    if (diffDays < 0) return { text: i18n.t('time.overdue') || "Overdue", class: "tag-overdue" };
    if (diffDays === 0) return { text: i18n.t('time.today') || "Today!", class: "tag-urgent" };
    if (diffDays <= 7) return { text: `${diffDays} ${i18n.t('time.days_left') || "days left"}`, class: "tag-urgent" };
    if (diffDays <= 30) return { text: `${diffDays} ${i18n.t('time.days_left') || "days left"}`, class: "tag-soon" };
    return { text: `${Math.round(diffDays / 30)} ${i18n.t('time.months') || "months"}`, class: "tag-far" };
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
            firestoreService.getWishlist(friendId, user.uid)
        ]);

        const friendName = friendProfile ? friendProfile.displayName : "Friend";

        // Privacy Check (Should be handled by getWishlist, but double check)
        if (items.length === 0 && friendProfile && friendProfile.isPrivate) {
            // If getWishlist returns 0 and profile is private, likely strictly private
            // But getWishlist now handles friend-logic, so if we see 0 it just means nothing to show
        }

        window.handleGiftItem = async (itemId, currentClaimedBy) => {
            const btn = document.querySelector(`[data-gift-btn="${itemId}"]`);
            const card = btn.closest('.card');
            const isClaiming = !currentClaimedBy;
            const originalBtnHTML = btn.innerHTML;

            try {
                // Optimistic UI Update
                if (isClaiming) {
                    btn.innerHTML = "✅";
                    card.classList.add('card-gifted');
                    if (!card.querySelector('.gift-badge')) {
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
                    const existingBadge = card.querySelector('.gift-badge');
                    if (existingBadge) existingBadge.remove();
                    btn.onclick = () => window.handleGiftItem(itemId, null);
                }
                await firestoreService.toggleClaimItem(itemId, user.uid, currentClaimedBy);
            } catch (error) {
                console.error("Claim failed:", error);
                alert(i18n.t('common.error'));
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
                    <p class="empty-text">${friendName} has no visible wishes.</p>
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

            const catConfig = CATEGORIES[item.category] || CATEGORIES['Other'];
            const icon = catConfig.icon || '📦';
            const claimArg = item.claimedBy ? `'${item.claimedBy}'` : 'null';
            const timeData = getCountdown(item.targetDate);

            // Badges
            let badges = '';
            if (timeData) badges += `<span class="time-tag ${timeData.class}">⏳ ${timeData.text}</span>`;
            if (item.occasion) badges += `<span class="time-tag tag-far" style="margin-left:4px;">🎉 ${item.occasion}</span>`;

            return `
                <article class="${cardClass}" style="position:relative;">
                    ${statusBadge}
                    <button class="${btnClass}" data-gift-btn="${item.id}" onclick="window.handleGiftItem('${item.id}', ${claimArg})">${btnIcon}</button>
                    <div class="card-img-container">
                         <img src="${item.imageUrl}" class="card-img" onerror="this.src='https://placehold.co/600x400'">
                    </div>
                    <div class="card-content">
                        <h3>${item.title}</h3>
                        <div style="margin-bottom:8px; display:flex; flex-wrap:wrap; gap:4px;">${badges}</div>
                        <div class="card-meta">
                            <span class="tag">${icon} ${item.category || 'Item'}</span>
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