import { i18n } from '../services/LocalizationService.js';
import { authService } from '../services/AuthService.js';

export const AppShell = {
    render: async (childView) => {
        const user = authService.currentUser;
        const profile = authService.userProfile;

        // Navigation config
        const navItems = [
            { path: '/app/home', icon: '🏠', label: i18n.t('nav.home') },
            { path: '/app/wishlist', icon: '✨', label: i18n.t('nav.wishlist') },
            { path: '/app/closet', icon: '🧥', label: i18n.t('nav.closet') },
            { path: '/app/inspo', icon: '📌', label: i18n.t('nav.inspo') },
            { path: '/app/combos', icon: '🎨', label: i18n.t('nav.combos') },
            { path: '/app/friends', icon: '👥', label: i18n.t('nav.friends') },
            { path: '/app/profile', icon: '👤', label: i18n.t('nav.profile') }
        ];

        // 1. Render Child View Content
        // We await the child view's render method so we can inject it into the shell
        const childHtml = await childView.render();

        // 2. Return Full Shell HTML
        return `
            <div class="app-shell">
                <!-- Desktop Sidebar -->
                <aside class="shell-sidebar">
                    <div class="shell-logo">
                        <img src="img/logo.png" alt="WishOne">
                    </div>
                    <nav class="shell-nav">
                        ${navItems.map(item => `
                            <a href="#${item.path}" class="shell-nav-item ${window.location.hash.includes(item.path) ? 'active' : ''}">
                                <span class="nav-icon">${item.icon}</span>
                                <span class="nav-label">${item.label}</span>
                            </a>
                        `).join('')}
                    </nav>
                    <div class="shell-footer">
                        <a href="#/settings" class="shell-nav-item">
                            <span class="nav-icon">⚙️</span>
                            <span class="nav-label">${i18n.t('nav.settings')}</span>
                        </a>
                    </div>
                </aside>

                <!-- Mobile Header -->
                <header class="shell-mobile-header">
                    <img src="img/logo.png" alt="WishOne" height="32">
                    <div class="user-avatar-small" onclick="window.location.hash='#/settings'">
                        <img src="${profile?.photoURL || 'https://placehold.co/100'}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;">
                    </div>
                </header>

                <!-- Main Content Area -->
                <main class="shell-content" id="shell-main">
                    ${childHtml}
                </main>

                <!-- Mobile Bottom Bar -->
                <nav class="shell-bottom-bar">
                    ${navItems.slice(0, 5).map(item => `
                        <a href="#${item.path}" class="bottom-nav-item ${window.location.hash.includes(item.path) ? 'active' : ''}">
                            <span class="nav-icon">${item.icon}</span>
                        </a>
                    `).join('')}
                    <a href="#/app/profile" class="bottom-nav-item ${window.location.hash.includes('profile') ? 'active' : ''}">
                        <span class="nav-icon">👤</span>
                    </a>
                </nav>
            </div>
        `;
    },

    afterRender: async (childView) => {
        // Hide the old floating header if it exists (from previous modules)
        const oldHeader = document.querySelector('.floating-header');
        if (oldHeader) oldHeader.style.display = 'none';

        // Run child logic
        if (childView.afterRender) await childView.afterRender();
    }
};