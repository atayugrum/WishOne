import { Router } from './utils/Router.js';
import { Header } from './components/Header.js';
import { HomeView } from './views/HomeView.js';
import { WelcomeView } from './views/WelcomeView.js';
import { FriendsView } from './views/FriendsView.js';
import { FriendWishlistView } from './views/FriendWishlistView.js';
import { PublicWishlistView } from './views/PublicWishlistView.js'; // NEW
import { InspoView } from './views/InspoView.js';
import { ClosetView } from './views/ClosetView.js';
import { ComboView } from './views/ComboView.js';
import { ProfileView } from './views/ProfileView.js';
import { authService } from './services/AuthService.js';
import { LogService } from './services/LogService.js'; // NEW

// Import AI modules
import { AICompanion } from './components/AICompanion.js';
import { aiService } from './services/AIService.js';

const routes = {
    '/': HomeView,
    '/welcome': WelcomeView,
    '/friends': FriendsView,
    '/friend-wishlist': FriendWishlistView,
    '/share': PublicWishlistView, // NEW: Public Route
    '/inspo': InspoView,
    '/closet': ClosetView,
    '/combos': ComboView,
    '/profile': ProfileView,
    '404': { template: '<h1>404 - Not Found</h1>' }
};

document.addEventListener('DOMContentLoaded', () => {
    LogService.info('App Started');

    // 1. Initialize Header
    const header = new Header();
    header.mount('body');

    // 2. Initialize AI Companion (Global)
    try {
        window.aiCompanion = new AICompanion();
    } catch (e) {
        LogService.error('AI Companion Init Failed', { error: e.message });
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
            // Allow public share route even if logged out
            if (!window.location.hash.startsWith('#/share')) {
                window.location.hash = '#/welcome';
            }
            router.handleLocation();
        }
    });

    // 5. Offline/Online Handling
    window.addEventListener('offline', () => {
        window.showToast("You are offline. Changes may not save.", "📡");
        document.body.style.filter = "grayscale(0.8)";
        LogService.warn('Network Status', { status: 'offline' });
    });

    window.addEventListener('online', () => {
        window.showToast("Back online!", "🟢");
        document.body.style.filter = "";
        LogService.info('Network Status', { status: 'online' });
    });
});