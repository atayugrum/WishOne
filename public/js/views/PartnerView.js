import { authService } from '../services/AuthService.js';
import { firestoreService } from '../services/FirestoreService.js';
import { CATEGORIES } from '../config/categories.js'; // NEW
import { i18n } from '../services/LocalizationService.js'; // NEW

// Helper: Calculate days left (Same as HomeView)
function getCountdown(dateString) {
    if (!dateString) return null;
    const target = new Date(dateString);
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

export const PartnerView = {
    render: async () => {
        const user = authService.currentUser;
        const profile = authService.userProfile;

        if (!user || !profile) return `<div class="view-header"><h1>Loading...</h1></div>`;

        // STATE 1: ALREADY CONNECTED
        if (profile.partnerId) {
            return await PartnerView.renderPartnerList(profile.partnerId);
        }

        // STATE 2: NOT CONNECTED
        window.handleLinkPartner = async () => {
            const emailInput = document.getElementById('partner-email');
            const btn = document.getElementById('btn-link');
            const email = emailInput.value.trim();

            if (!email) return;

            try {
                btn.textContent = "Searching...";
                btn.disabled = true;
                await firestoreService.linkPartner(user.uid, email);
                alert("Connected! Refreshing...");
                window.location.reload();
            } catch (error) {
                alert(error.message);
                btn.textContent = i18n.t('partner.connect');
                btn.disabled = false;
            }
        };

        return `
            <div class="view-header">
                <h1>${i18n.t('partner.title')}</h1>
                <p>${i18n.t('partner.subtitle')}</p>
            </div>

            <div class="glass-panel" style="max-width: 500px; margin: 40px auto; padding: 40px; text-align: center;">
                <div style="font-size: 60px; margin-bottom: 20px;">❤️</div>
                <h3 style="margin-bottom: 16px;">${i18n.t('partner.connect')}</h3>
                <p style="color: var(--text-secondary); margin-bottom: 32px;">
                    Enter your partner's email address to sync accounts.
                </p>

                <div class="form-group">
                    <input type="email" id="partner-email" placeholder="${i18n.t('partner.inputPlaceholder')}" style="text-align: center;">
                </div>

                <button id="btn-link" class="btn-primary" style="width: 100%; margin-top: 16px;" onclick="window.handleLinkPartner()">
                    ${i18n.t('partner.connect')}
                </button>
            </div>
        `;
    },

    renderPartnerList: async (partnerId) => {
        const currentUser = authService.currentUser;
        const partnerProfile = await firestoreService.getUserProfile(partnerId);
        const partnerName = partnerProfile ? partnerProfile.displayName : "Partner";
        const items = await firestoreService.getWishlist(partnerId);

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
                    btn.onclick = () => window.handleGiftItem(itemId, currentUser.uid);

                } else {
                    // APPLY UNCLAIMED STATE
                    if (currentClaimedBy !== currentUser.uid) {
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
                await firestoreService.toggleClaimItem(itemId, currentUser.uid, currentClaimedBy);

                // Success! No need to do anything else.

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
                // Revert click handler (tricky, but reloading is safer if state desyncs)
                window.location.reload();
            }
        };

        if (items.length === 0) {
            return `
                <div class="view-header">
                    <h1>${partnerName}'s Wishlist</h1>
                    <p class="empty-state">No wishes yet.</p>
                </div>`;
        }

        const gridContent = items.map(item => {
            const isClaimedByMe = item.claimedBy === currentUser.uid;
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
                <h1>${partnerName}'s Wishlist</h1>
                <p>Pick a gift. Keep it a surprise.</p>
            </div>
            <div class="masonry-grid">
                ${gridContent}
            </div>
        `;
    }
};