import { Router } from './utils/Router.js';
import { Header } from './components/Header.js';
import { HomeView } from './views/HomeView.js';
import { WelcomeView } from './views/WelcomeView.js';
import { FriendsView } from './views/FriendsView.js';
import { FriendWishlistView } from './views/FriendWishlistView.js';
import { InspoView } from './views/InspoView.js';
import { ClosetView } from './views/ClosetView.js';
import { ComboView } from './views/ComboView.js';
import { authService } from './services/AuthService.js';

// Import AI modules
import { AICompanion } from './components/AICompanion.js';
import { aiService } from './services/AIService.js';

const routes = {
    '/': HomeView,
    '/welcome': WelcomeView,
    '/friends': FriendsView,
    '/friend-wishlist': FriendWishlistView,
    '/inspo': InspoView,
    '/closet': ClosetView,
    '/combos': ComboView,
    '404': { template: '<h1>404 - Not Found</h1>' }
};

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Header
    const header = new Header();
    header.mount('body');

    // 2. Initialize AI Companion (Global)
    try {
        window.aiCompanion = new AICompanion();
    } catch (e) {
        // Silent fail
    }

    // 3. Initialize Router
    const router = new Router(routes);

    // 4. Auth Listener
    authService.init((user) => {
        if (user) {
            header.updateUser(user);
            header.show();

            // AI Greet (Safely)
            if (window.aiCompanion) {
                setTimeout(() => {
                    const msg = aiService.getWelcomeMessage();
                    window.aiCompanion.say(msg);
                }, 1000);
            }

            if (window.location.hash === '#/welcome') {
                window.location.hash = '#/';
            }
            router.handleLocation();
        } else {
            header.hide();
            window.location.hash = '#/welcome';
            router.handleLocation();
        }
    });
});
