import { firestoreService } from '../services/FirestoreService.js';
import { i18n } from '../services/LocalizationService.js';

export const PublicWishlistView = {
    render: async () => {
        // Extract UID from URL: #/share?uid=XYZ
        const params = new URLSearchParams(window.location.hash.split('?')[1]);
        const targetUid = params.get('uid');

        if (!targetUid) return `<div class="empty-state">Invalid Link.</div>`;

        try {
            // Get profile and items
            const [profile, items] = await Promise.all([
                firestoreService.getUserProfile(targetUid),
                firestoreService.getWishlist(targetUid, null) // Viewer ID is null (public)
            ]);

            if (!profile) return `<div class="empty-state">User not found.</div>`;

            // Filter out any archived items (just in case service returned them, though it shouldn't for public)
            const activeItems = items.filter(i => i.status === 'wish');

            if (activeItems.length === 0) {
                return `
                    <div class="view-header"><h1>${profile.displayName}'s Wishlist</h1></div>
                    <div class="empty-state"><p>This list is empty or private.</p></div>
                `;
            }

            const gridHtml = activeItems.map(item => `
                <article class="glass-panel card">
                    <div class="card-img-container">
                        <img src="${item.imageUrl}" class="card-img" onerror="this.src='https://placehold.co/600x400'">
                    </div>
                    <div class="card-content">
                        <h3>${item.title}</h3>
                        <div class="card-meta">
                            <span class="tag">${item.category}</span>
                            <span class="price">${item.price} ${item.currency}</span>
                        </div>
                        ${item.link ? `<a href="${item.link}" target="_blank" class="btn-primary" style="display:block; text-align:center; margin-top:12px; text-decoration:none; font-size:0.85rem;">View Store</a>` : ''}
                    </div>
                </article>
            `).join('');

            return `
                <div class="view-header" style="text-align:center;">
                    <img src="${profile.photoURL}" style="width:80px; height:80px; border-radius:50%; margin-bottom:16px;">
                    <h1>${profile.displayName}'s Wishlist</h1>
                    <p>Curated on WishOne</p>
                </div>
                <div class="masonry-grid" style="margin-top:32px;">
                    ${gridHtml}
                </div>
                <div style="text-align:center; margin-top:60px; padding-bottom:40px;">
                    <a href="/" style="color:var(--accent-color); font-weight:600;">Create your own list on WishOne</a>
                </div>
            `;

        } catch (error) {
            console.error(error);
            return `<div class="empty-state">This list is private.</div>`;
        }
    }
};