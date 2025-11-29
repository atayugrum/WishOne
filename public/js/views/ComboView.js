import { authService } from '../services/AuthService.js';
import { firestoreService } from '../services/FirestoreService.js';
import { i18n } from '../services/LocalizationService.js';

export const ComboView = {
    render: async () => {
        const user = authService.currentUser;
        if (!user) return `<div class="empty-state">Login required.</div>`;

        // Get closet items to show in the sidebar
        let closetItems = [];
        try {
            closetItems = await firestoreService.getCloset(user.uid);
        } catch (e) {
            console.error(e);
        }

        return `
            <div class="view-header">
                <h1>${i18n.t('combos.title')}</h1>
            </div>
            
            <div class="combo-layout">
                <div class="combo-canvas" id="combo-canvas">
                    <div class="canvas-placeholder">${i18n.t('combos.drag_text')}</div>
                </div>
                
                <div class="combo-sidebar">
                    <h3 style="margin-bottom: 12px; font-size: 1rem;">${i18n.t('combos.closet_section')}</h3>
                    
                    ${closetItems.length > 0 ? `
                        <div class="closet-grid-mini">
                            ${closetItems.map(item => `
                                <div class="closet-item-mini" draggable="true">
                                    <img src="${item.imageUrl}" alt="${item.title}" style="width:100%; height:100%; object-fit:cover;">
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <p style="font-size:0.8rem; color:var(--text-secondary);">${i18n.t('combos.empty_closet')}</p>
                    `}
                </div>
            </div>
        `;
    }
};