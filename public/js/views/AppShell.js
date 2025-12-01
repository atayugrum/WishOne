/* public/js/views/AppShell.js */
import { authService } from '../services/AuthService.js';
import { i18n } from '../services/LocalizationService.js';

export const AppShell = {
    render: async () => {
        const user = authService.currentUser;
        const photoURL = user?.photoURL || 'https://placehold.co/40';

        return `
            <div id="app-shell" class="app-shell">
                <header class="app-topbar">
                    <div class="topbar-left">
                        <div class="app-logo">WishOne</div>
                    </div>
                    
                    <nav class="topbar-nav desktop-only">
                        <a href="#/app/home" class="nav-item">${i18n.t('nav.home')}</a>
                        <a href="#/app/wishlist" class="nav-item">${i18n.t('nav.wishlist')}</a>
                        <a href="#/app/inspo" class="nav-item">${i18n.t('nav.inspo')}</a>
                        <a href="#/app/closet" class="nav-item">${i18n.t('nav.closet')}</a>
                        <a href="#/app/combos" class="nav-item">${i18n.t('nav.combos')}</a>
                        <a href="#/app/friends" class="nav-item">${i18n.t('nav.friends')}</a>
                    </nav>

                    <div class="topbar-right">
                        <a href="#/app/settings" class="icon-btn" title="Settings">⚙️</a>
                        <a href="#/app/profile" class="avatar-btn">
                            <img src="${photoURL}" alt="Profile">
                        </a>
                    </div>
                </header>

                <main id="shell-content" class="app-content">
                    </main>

                <nav class="mobile-tabbar mobile-only">
                    <a href="#/app/home" class="nav-item">
                        <span class="icon">🏠</span>
                        <span class="label">${i18n.t('nav.home')}</span>
                    </a>
                    <a href="#/app/wishlist" class="nav-item">
                        <span class="icon">✨</span>
                        <span class="label">${i18n.t('nav.wishlist')}</span>
                    </a>
                    <a href="#/app/closet" class="nav-item">
                        <span class="icon">🧥</span>
                        <span class="label">${i18n.t('nav.closet')}</span>
                    </a>
                    <a href="#/app/profile" class="nav-item">
                        <span class="icon">👤</span>
                        <span class="label">${i18n.t('nav.profile')}</span>
                    </a>
                </nav>
            </div>
        `;
    },

    afterRender: async () => {
        // Any global shell logic (e.g. notifications listener)
    }
};