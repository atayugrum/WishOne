import { authService } from '../services/AuthService.js';
import { firestoreService } from '../services/FirestoreService.js';
import { CATEGORIES } from '../config/categories.js';
import { i18n } from '../services/LocalizationService.js';

// Helper: Calculate days left (Same as HomeView)
function getCountdown(dateString) {
    if (!dateString) return null;
    const target = new Date(dateString);
    if (isNaN(target.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    const diffTime = target - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: "Overdue", class: "tag-overdue", days: diffDays };
    if (diffDays === 0) return { text: "Today!", class: "tag-urgent", days: 0 };
    if (diffDays <= 7) return { text: `${diffDays} days left`, class: "tag-urgent", days: diffDays };
    if (diffDays <= 30) return { text: `${diffDays} days`, class: "tag-soon", days: diffDays };
    return { text: `${Math.round(diffDays / 30)} months`, class: "tag-far", days: diffDays };
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

        // --- OPTIMISTIC UI UPDATE LOGIC ---
        window.handleGiftItem = async (itemId, currentClaimedBy) => {
            const btn = document.querySelector(`[data-gift-btn="${itemId}"]`);
            const card = btn.closest('.card');

            // 1. Optimistic UI Update
            const isClaiming = !currentClaimedBy; // If null, we are claiming. If set, we are unclaiming.

            // Save original state for revert
            const originalBtnHTML = btn.innerHTML;
            const originalCardClass = card.className;
            const existingBadge = card.querySelector('.gift-badge');

            try {
                if (isClaiming) {
                    // APPLY CLAIMED STATE
                    btn.innerHTML = "✅";
                    card.classList.add('card-gifted');

                    // Add badge if not exists
                    if (!existingBadge) {
                        const badge = document.createElement('div');
                        badge.className = 'gift-badge';
                        badge.innerText = 'Reserved by You';
                        card.prepend(badge);
                    }

                    // Update onclick to be an unclaim action
                    btn.onclick = () => window.handleGiftItem(itemId, user.uid);

                } else {
                    // APPLY UNCLAIMED STATE
                    if (currentClaimedBy !== user.uid) {
                        alert("Someone else is already getting this!");
                        return;
                    }

                    btn.innerHTML = "🎁";
                    card.classList.remove('card-gifted');

                    if (existingBadge) existingBadge.remove();

                    // Update onclick to be a claim action
                    btn.onclick = () => window.handleGiftItem(itemId, null);
                }

                // 2. Perform API Call
                await firestoreService.toggleClaimItem(itemId, user.uid, currentClaimedBy);

            } catch (error) {
                console.error("Claim failed:", error);
                alert("Something went wrong. Reverting...");

                // 3. Revert UI on Error
                btn.innerHTML = originalBtnHTML;
                card.className = originalCardClass;
                if (isClaiming && card.querySelector('.gift-badge')) {
                    card.querySelector('.gift-badge').remove();
                } else if (!isClaiming && existingBadge) {
                    card.prepend(existingBadge);
                }
                window.location.reload();
            }
        };

        if (items.length === 0) {
            return `
                <div class="view-header">
                    <button class="btn-text" onclick="window.location.hash='#/friends'" style="margin-bottom:16px;">← Back to Friends</button>
                    <h1>${friendName}'s Wishlist</h1>
                    <p class="empty-state">No wishes yet.</p>
                </div>`;
        }

        const gridContent = items.map(item => {
            const isClaimedByMe = item.claimedBy === user.uid;
            const isClaimedByOther = item.claimedBy && !isClaimedByMe;

            // Styles
            let cardClass = "glass-panel card";
            let btnIcon = "🎁";
            let btnClass = "card-action-btn gift-btn";
            let statusBadge = "";

            if (isClaimedByMe) {
                cardClass += " card-gifted";
                btnIcon = "✅";
                statusBadge = `<div class="gift-badge">Reserved by You</div>`;
            } else if (isClaimedByOther) {
                cardClass += " card-locked";
                btnIcon = "🔒";
                btnClass += " disabled";
            }

            // Rich Data Logic
            const catConfig = CATEGORIES[item.category] || CATEGORIES['Other'];
            const icon = catConfig ? catConfig.icon : '📦';
            const subText = item.subcategory ? `• ${item.subcategory}` : '';
            const claimArg = item.claimedBy ? `'${item.claimedBy}'` : 'null';

            // Time Logic
            const timeData = getCountdown(item.targetDate);
            let timeBadge = '';
            if (timeData) {
                timeBadge = `<div class="card-overlay-badge"><span class="time-tag ${timeData.class}">⏳ ${timeData.text}</span></div>`;
            }

            return `
                <article class="${cardClass}">
                    ${statusBadge}
                    
                    <button class="${btnClass}" 
                            data-gift-btn="${item.id}"
                            onclick="window.handleGiftItem('${item.id}', ${claimArg})">
                        ${btnIcon}
                    </button>

                    <div class="card-img-container">
                         ${timeBadge}
                         <img src="${item.imageUrl}" class="card-img" onerror="this.src='https://placehold.co/600x400'">
                    </div>
                    <div class="card-content">
                        <h3>${item.title}</h3>
                        <div class="card-meta">
                            <span class="tag">
                                ${icon} ${item.category} ${subText}
                            </span>
                            <span class="price">${item.price} ${item.currency}</span>
                        </div>
                    </div>
                </article>
            `;
        }).join('');

        return `
            <div class="view-header">
                <div style="margin-bottom:16px;">
                    <button class="btn-text" onclick="window.location.hash='#/friends'">← Back to Friends</button>
                </div>
                <h1>${friendName}'s Wishlist</h1>
                <p>Pick a gift. Keep it a surprise.</p>
            </div>
            <div class="masonry-grid">
                ${gridContent}
            </div>
        `;
    }
};
