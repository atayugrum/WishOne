import { authService } from '../services/AuthService.js';
import { i18n } from '../services/LocalizationService.js';

export class Header {
    constructor() {
        this.element = null;
    }

    mount(selector) {
        this.element = document.querySelector(selector);
        this.render();
    }

    render() {
        const user = authService.currentUser;
        const profile = authService.userProfile;

        // [FIX] Add safe check for user before accessing properties
        const userInitial = (user && user.displayName) ? user.displayName.charAt(0).toUpperCase() : '?';
        const photoURL = (profile && profile.photoURL) ? profile.photoURL : 'https://placehold.co/100';

        const html = `
            <header class="floating-header">
                <div class="header-left">
                    <img src="img/logo.png" alt="WishOne" class="brand-logo-small">
                </div>
                
                <nav class="header-nav">
                    <div class="nav-pills">
                        <a href="#/" class="nav-link" data-link>${i18n.t('nav.home')}</a>
                        <a href="#/inspo" class="nav-link" data-link>${i18n.t('nav.inspo')}</a>
                        <a href="#/closet" class="nav-link" data-link>${i18n.t('nav.closet')}</a>
                        <a href="#/combos" class="nav-link" data-link>${i18n.t('nav.combos')}</a>
                        <a href="#/friends" class="nav-link" data-link>${i18n.t('nav.friends')}</a>
                    </div>
                </nav>

                <div class="header-actions">
                    ${user ? `
                        <div class="user-avatar" onclick="window.location.hash='#/profile'">
                            ${profile && profile.photoURL ?
                    `<img src="${photoURL}" alt="Profile">` :
                    `<div style="width:100%; height:100%; background:var(--accent-color); color:white; display:flex; align-items:center; justify-content:center; font-weight:700;">${userInitial}</div>`
                }
                        </div>
                        <button class="icon-btn" onclick="window.location.hash='#/settings'" title="${i18n.t('nav.settings')}">⚙️</button>
                    ` : `
                        <a href="#/welcome" class="nav-link">Login</a>
                    `}
                </div>
            </header>
        `;

        if (this.element) {
            // Check if header already exists to avoid dupes
            const existing = document.querySelector('.floating-header');
            if (existing) existing.remove();

            // Insert at top of body
            document.body.insertAdjacentHTML('afterbegin', html);

            // Bind Logic
            this.bindEvents();
        }
    }

    bindEvents() {
        // Active Link Logic
        const updateActive = () => {
            const hash = window.location.hash || '#/';
            document.querySelectorAll('.nav-link').forEach(link => {
                if (link.getAttribute('href') === hash) link.classList.add('active');
                else link.classList.remove('active');
            });
        };
        window.addEventListener('hashchange', updateActive);
        updateActive();
    }

    updateUser(user) {
        this.render();
    }

    hide() {
        const el = document.querySelector('.floating-header');
        if (el) el.style.display = 'none';
    }

    show() {
        const el = document.querySelector('.floating-header');
        if (el) el.style.display = 'flex';
    }
}