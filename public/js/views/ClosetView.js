import { authService } from '../services/AuthService.js';
import { firestoreService } from '../services/FirestoreService.js';
import { CATEGORIES } from '../config/categories.js';
import { i18n } from '../services/LocalizationService.js';
import { aiService } from '../services/AIService.js'; // Import AI

export const ClosetView = {
    render: async () => {
        const user = authService.currentUser;
        if (!user) return `<div class="empty-state">Login first.</div>`;

        const items = await firestoreService.getCloset(user.uid);

        window.handleDeleteOwned = async (id) => {
            if (confirm(i18n.t('closet.delete_confirm'))) {
                // AI Reaction: Letting go
                aiService.triggerReaction('delete_owned', { title: 'Memory' });

                await firestoreService.deleteItem(id);
                const app = document.getElementById('app');
                ClosetView.render().then(html => app.innerHTML = html);
            }
        };

        window.handleReturnToWishlist = async (id) => {
            if (confirm(i18n.t('common.confirm'))) {
                // AI Reaction: Change of plans
                aiService.triggerReaction('return_wish', { title: 'Item' });

                await firestoreService.unmarkOwned(id);
                const app = document.getElementById('app');
                ClosetView.render().then(html => app.innerHTML = html);
            }
        };

        if (items.length === 0) {
            // AI Reaction: Empty state encouragement
            setTimeout(() => {
                if (window.aiCompanion) window.aiCompanion.say("Your closet is waiting for your dreams!", "zen");
            }, 500);

            return `
                <div class="view-header">
                    <h1>${i18n.t('closet.title')}</h1>
                    <p>${i18n.t('closet.subtitle')}</p>
                </div>
                <div class="glass-panel empty-state-card">
                    <span class="empty-icon">🧥</span>
                    <h3 class="empty-title">${i18n.t('closet.empty')}</h3>
                    <p class="empty-text">${i18n.t('closet.empty_desc')}</p>
                    <button class="btn-primary" onclick="window.location.hash='#/'">${i18n.t('closet.go_wishlist')}</button>
                </div>
            `;
        }

        const gridContent = items.map(item => {
            const catConfig = CATEGORIES[item.category] || CATEGORIES['Other'];
            const icon = catConfig ? catConfig.icon : '📦';

            return `
                <article class="glass-panel card card-owned" style="position:relative;">
                    <div style="position:absolute; top:10px; right:10px; display:flex; gap:8px; z-index:10;">
                        <button class="icon-btn" onclick="window.handleReturnToWishlist('${item.id}')" title="${i18n.t('closet.return')}" style="background:rgba(255,255,255,0.8); border-radius:50%; width:32px; height:32px; font-size:1rem;">↺</button>
                        <button class="icon-btn" onclick="window.handleDeleteOwned('${item.id}')" title="${i18n.t('common.delete')}" style="background:rgba(255,255,255,0.8); color:#ff3b30; border-radius:50%; width:32px; height:32px; font-size:1rem;">&times;</button>
                    </div>
                    <div class="card-img-container"><img src="${item.imageUrl}" class="card-img"></div>
                    <div class="card-content">
                        <h3 style="color: var(--text-secondary); text-decoration: line-through;">${item.title}</h3>
                        <div class="card-meta"><span class="tag">${icon} ${item.category}</span></div>
                    </div>
                </article>
            `;
        }).join('');

        return `
            <div class="view-header"><h1>${i18n.t('closet.title')}</h1><p>${i18n.t('closet.subtitle')}</p></div>
            <div class="masonry-grid">${gridContent}</div>
        `;
    }
};