import { authService } from '../services/AuthService.js';
import { i18n } from '../services/LocalizationService.js';

export class Header {
    constructor() {
        this.element = document.createElement('header');
        this.element.className = 'floating-header';
        this.element.style.display = 'none';
        this.render();
        this.bindEvents();
    }

    show() { this.element.style.display = 'flex'; }
    hide() { this.element.style.display = 'none'; }

    render() {
        const currentLang = i18n.lang.toUpperCase();

        this.element.innerHTML = `
            <div class="logo">
                <span class="logo-text">WishOne</span>
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

                <button id="toggle-love" class="icon-btn">❤️</button>
                <div id="auth-container"></div>
            </div>
        `;
    }

    bindEvents() {
        // 1. Language Toggle
        this.element.querySelector('#toggle-lang').addEventListener('click', () => {
            i18n.toggle();
        });

        // 2. Love Mode
        this.element.querySelector('#toggle-love').addEventListener('click', () => {
            document.body.classList.toggle('mode-love');
        });

        // 3. Navigation Highlighting
        document.addEventListener('route-changed', (e) => {
            const currentPath = e.detail.route;
            const links = this.element.querySelectorAll('.nav-link');
            links.forEach(link => {
                if (link.dataset.path === currentPath) link.classList.add('active');
                else link.classList.remove('active');
            });
        });

        // 4. Profile Navigation (UPDATED)
        const authContainer = this.element.querySelector('#auth-container');
        authContainer.addEventListener('click', (e) => {
            if (e.target.closest('.user-avatar')) {
                // Navigate to Profile Settings instead of logging out
                window.location.hash = '#/profile';
            }
        });
    }

    updateUser(user) {
        const container = this.element.querySelector('#auth-container');
        if (user) {
            container.innerHTML = `
                <div class="user-avatar">
                    <img src="${user.photoURL}" alt="${user.displayName}">
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