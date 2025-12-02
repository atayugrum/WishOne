/* public/js/components/Header.js */
import { authService } from '../services/AuthService.js';

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
        const photoURL = (profile && profile.photoURL) ? profile.photoURL : 'https://placehold.co/100';

        // 3-Column Layout: Logo | Nav Links | Profile/Settings
        const html = `
            <header class="app-topbar">
                
                <div class="header-left">
                    <a href="#/app/home" class="brand-link">
                        <img src="img/logo.png" alt="WishOne" class="brand-logo">
                        <span class="brand-text">WishOne</span>
                    </a>
                </div>
                
                <nav class="header-center desktop-only">
                    <a href="#/app/home" class="nav-link" data-path="/app/home">Home</a>
                    <a href="#/app/wishlist" class="nav-link" data-path="/app/wishlist">Wishlist</a>
                    <a href="#/app/closet" class="nav-link" data-path="/app/closet">Closet</a>
                    <a href="#/app/inspo" class="nav-link" data-path="/app/inspo">Inspo</a>
                    <a href="#/app/friends" class="nav-link" data-path="/app/friends">Friends</a>
                </nav>

                <div class="header-right">
                    ${user ? `
                        <button class="icon-btn" onclick="window.location.hash='#/app/settings'" title="Settings">
                            ⚙️
                        </button>
                        <div class="user-avatar-small" onclick="window.location.hash='#/app/profile'">
                            <img src="${photoURL}" alt="Profile">
                        </div>
                    ` : `
                        <a href="#/auth" class="nav-link">Log In</a>
                    `}
                </div>
            </header>
        `;

        if (this.element) {
            this.element.innerHTML = html;
            this.bindEvents();
        }
    }

    bindEvents() {
        // Highlight active link based on current hash
        const updateActive = () => {
            const hash = window.location.hash || '#/app/home';
            // Simple check: does the hash contain the data-path?
            const links = this.element.querySelectorAll('.nav-link');
            links.forEach(link => {
                const path = link.dataset.path;
                if (path && hash.includes(path)) {
                    link.classList.add('active');
                } else {
                    link.classList.remove('active');
                }
            });
        };

        window.addEventListener('hashchange', updateActive);
        updateActive(); // Initial run
    }
}