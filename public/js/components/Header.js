import { authService } from '../services/AuthService.js';
import { i18n } from '../services/LocalizationService.js';

export class Header {
    constructor() {
        this.element = document.createElement('header');
        this.element.className = 'floating-header';
        this.element.style.display = 'none';
        this.render();
        this.bindEvents();
        this.loadTheme(); // [NEW] Load saved theme
    }

    show() { this.element.style.display = 'flex'; }
    hide() { this.element.style.display = 'none'; }

    render() {
        const currentLang = i18n.lang.toUpperCase();

        this.element.innerHTML = `
            <div class="logo" style="display:flex; align-items:center; gap:12px;">
                <img src="img/icon.png" alt="WishOne" class="brand-logo-small" onerror="this.style.display='none'">
                <span class="logo-text" style="font-weight:700; font-size:1.2rem; letter-spacing:-0.5px;">WishOne</span>
            </div>

            <nav class="nav-pills">
                <a href="#/" class="nav-link active" data-path="/">${i18n.t('nav.home')}</a>
                <a href="#/friends" class="nav-link" data-path="/friends">${i18n.t('nav.friends')}</a>
                <a href="#/inspo" class="nav-link" data-path="/inspo">${i18n.t('nav.inspo')}</a>
                <a href="#/closet" class="nav-link" data-path="/closet">${i18n.t('nav.closet')}</a>
                <a href="#/combos" class="nav-link" data-path="/combos">${i18n.t('nav.combos') || 'Combos'}</a>
            </nav>

            <div class="header-actions">
                <button id="toggle-lang" class="btn-text" style="font-size: 0.8rem; font-weight: 700;">
                    ${currentLang}
                </button>

                <button id="toggle-love" class="icon-btn" title="Toggle Theme">❤️</button>
                <div id="auth-container"></div>
            </div>
        `;
    }

    bindEvents() {
        this.element.querySelector('#toggle-lang').addEventListener('click', () => {
            i18n.toggle();
        });

        this.element.querySelector('#toggle-love').addEventListener('click', () => {
            document.body.classList.toggle('mode-love');
            // [NEW] Persist choice
            const isLove = document.body.classList.contains('mode-love');
            localStorage.setItem('wishone_theme', isLove ? 'love' : 'default');
        });

        document.addEventListener('route-changed', (e) => {
            const currentPath = e.detail.route;
            const links = this.element.querySelectorAll('.nav-link');
            links.forEach(link => {
                if (link.dataset.path === currentPath) link.classList.add('active');
                else link.classList.remove('active');
            });
        });

        const authContainer = this.element.querySelector('#auth-container');
        authContainer.addEventListener('click', (e) => {
            if (e.target.closest('.user-avatar')) {
                window.location.hash = '#/profile';
            }
        });
    }

    loadTheme() {
        const theme = localStorage.getItem('wishone_theme');
        if (theme === 'love') {
            document.body.classList.add('mode-love');
        }
    }

    updateUser(user) {
        const container = this.element.querySelector('#auth-container');
        if (user) {
            const photoURL = authService.userProfile?.photoURL || user.photoURL;
            container.innerHTML = `
                <div class="user-avatar">
                    <img src="${photoURL}" alt="${user.displayName}">
                </div>
            `;
        } else {
            container.innerHTML = '';
        }
    }

    mount(parentSelector) {
        document.querySelector(parentSelector).prepend(this.element);
    }
}