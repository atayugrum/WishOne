/* public/js/views/AppShell.js */
import { authService } from '../services/AuthService.js';
import { Header } from '../components/Header.js';

export const AppShell = {
    render: async () => {
        return `
            <!-- Global Vibrant Background -->
            <div class="lab-gradient-bg"></div>

            <div id="app-shell" class="app-shell">
                <!-- Header Mount Point -->
                <div id="header-container"></div>

                <!-- Main Content -->
                <main class="app-main-container">
                    <div id="shell-content" class="fade-in"></div>
                </main>

                <!-- Mobile Tab Bar -->
                <nav class="mobile-tabbar">
                    <a href="#/app/home" class="nav-item"><span>🏠</span></a>
                    <a href="#/app/wishlist" class="nav-item"><span>✨</span></a>
                    <a href="#/app/closet" class="nav-item"><span>🧥</span></a>
                    <a href="#/app/profile" class="nav-item"><span>👤</span></a>
                </nav>
            </div>
        `;
    },

    afterRender: async () => {
        // Mount Header if not already there
        const container = document.getElementById('header-container');
        if (container) {
            const header = new Header();
            header.mount('#header-container');
        }
    }
};