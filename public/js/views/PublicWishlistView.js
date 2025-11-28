// js/views/PublicWishlistView.js
import { firestoreService } from '../services/FirestoreService.js';
import { CATEGORIES } from '../config/categories.js';

export const PublicWishlistView = {
    render: async (params) => {
        const uid = params.uid;

        if (!uid) {
            return `<div class="empty-state"><h3>Invalid Link</h3><p>No user specified.</p></div>`;
        }

        try {
            // Fetch User & Items
            const [profile, items] = await Promise.all([
                firestoreService.getUserProfile(uid),
                firestoreService.getWishlist(uid)
            ]);

            if (!profile) {
                return `<div class="empty-state"><h3>User Not Found</h3></div>`;
            }

            // Privacy Check
            if (profile.isPrivate) {
                return `
                    <div class="view-container" style="text-align:center; padding-top:60px;">
                        <div class="glass-panel empty-state-card">
                            <span class="empty-icon">🔒</span>
                            <h2 class="empty-title">Private Wishlist</h2>
                            <p class="empty-text">@${profile.username || 'User'} has kept this list private.</p>
                            <a href="#/welcome" class="btn-text">Join WishOne</a>
                        </div>
                    </div>
                `;
            }

            // Render Public Grid
            const gridContent = items.length > 0
                ? items.map(item => PublicWishlistView.renderCard(item)).join('')
                : `<div class="empty-state"><p>${profile.displayName} hasn't added any wishes yet.</p></div>`;

            return `
                <div class="view-header" style="text-align:center;">
                    <img src="${profile.photoURL}" style="width:80px; height:80px; border-radius:50%; margin-bottom:16px; border:3px solid white; box-shadow:0 10px 20px rgba(0,0,0,0.1);">
                    <h1>${profile.displayName}'s Wishlist</h1>
                    <p style="margin-bottom:24px;">Shared via WishOne</p>
                    <a href="#/welcome" class="btn-primary" style="text-decoration:none; font-size:0.9rem;">✨ Create Your Own</a>
                </div>
                
                <div class="masonry-grid">
                    ${gridContent}
                </div>
            `;

        } catch (error) {
            console.error("Public View Error:", error);
            return `<div class="empty-state"><h3>Error loading wishlist</h3></div>`;
        }
    },

    renderCard: (item) => {
        const catConfig = CATEGORIES[item.category] || CATEGORIES['Other'];
        const icon = catConfig ? catConfig.icon : '📦';

        return `
            <article class="glass-panel card">
                <div class="card-img-container">
                    <img src="${item.imageUrl || 'https://placehold.co/600x400'}" class="card-img" onerror="this.src='https://placehold.co/600x400'">
                </div>
                <div class="card-content">
                    <h3>${item.title}</h3>
                    <div class="card-meta">
                        <span class="tag">${icon} ${item.category}</span>
                        <span class="price">${item.price} ${item.currency}</span>
                    </div>
                </div>
            </article>
        `;
    }
};