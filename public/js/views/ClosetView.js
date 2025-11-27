import { authService } from '../services/AuthService.js';
import { firestoreService } from '../services/FirestoreService.js';
import { CATEGORIES } from '../config/categories.js'; // NEW
import { i18n } from '../services/LocalizationService.js'; // NEW

export const ClosetView = {
    render: async () => {
        const user = authService.currentUser;
        if (!user) return `<div class="empty-state">Login first.</div>`;

        const items = await firestoreService.getCloset(user.uid);

        if (items.length === 0) {
            return `
                <div class="view-header">
                    <h1>${i18n.t('closet.title')}</h1>
                    <p class="empty-state">${i18n.t('closet.empty')}</p>
                </div>
            `;
        }

        const gridContent = items.map(item => {
            // Rich Data Logic
            const catConfig = CATEGORIES[item.category] || CATEGORIES['Other'];
            const icon = catConfig ? catConfig.icon : '📦';
            
            return `
                <article class="glass-panel card card-owned">
                    <div class="card-img-container">
                        <img src="${item.imageUrl}" class="card-img">
                    </div>
                    <div class="card-content">
                        <h3 style="color: var(--text-secondary); text-decoration: line-through;">${item.title}</h3>
                        <div class="card-meta">
                             <span class="tag">
                                ${icon} ${item.category}
                            </span>
                            <span class="tag" style="background: rgba(52, 199, 89, 0.1); color: #34C759; border: none;">
                                ✔ Owned
                            </span>
                        </div>
                    </div>
                </article>
            `;
        }).join('');

        return `
            <div class="view-header">
                <h1>${i18n.t('closet.title')}</h1>
                <p>${i18n.t('closet.subtitle')}</p>
            </div>
            <div class="masonry-grid">
                ${gridContent}
            </div>
        `;
    }
};