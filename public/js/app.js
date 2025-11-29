import { Router } from './utils/Router.js';
import { Header } from './components/Header.js';
import { HomeView } from './views/HomeView.js';
import { WelcomeView } from './views/WelcomeView.js';
import { OnboardingView } from './views/OnboardingView.js'; // NEW
import { FriendsView } from './views/FriendsView.js';
import { FriendWishlistView } from './views/FriendWishlistView.js';
import { PublicWishlistView } from './views/PublicWishlistView.js';
import { InspoView } from './views/InspoView.js';
import { ClosetView } from './views/ClosetView.js';
import { ComboView } from './views/ComboView.js';
import { ProfileView } from './views/ProfileView.js';
import { authService } from './services/AuthService.js';
import { LogService } from './services/LogService.js';
import { AICompanion } from './components/AICompanion.js';
import { aiService } from './services/AIService.js';

const routes = {
    '/': HomeView,
    '/welcome': WelcomeView,
    '/onboarding': OnboardingView, // NEW
    '/friends': FriendsView,
    '/friend-wishlist': FriendWishlistView,
    '/share': PublicWishlistView,
    '/inspo': InspoView,
    '/closet': ClosetView,
    '/combos': ComboView,
    '/profile': ProfileView,
    '404': { template: '<h1>404 - Not Found</h1>' }
};

document.addEventListener('DOMContentLoaded', () => {
    LogService.info('App Started');
    const header = new Header();
    header.mount('body');

    try { window.aiCompanion = new AICompanion(); } catch (e) { console.error(e); }

    const router = new Router(routes);

    authService.init((user, profile) => {
        if (user) {
            // Check Profile Completion (Task 1.7)
            if (profile && !profile.isProfileComplete) {
                header.hide();
                window.location.hash = '#/onboarding';
                router.handleLocation();
                return;
            }

            header.updateUser(user);
            header.show();

            // Only greet on Home to avoid spamming
            if (window.location.hash === '#/' || window.location.hash === '') {
                setTimeout(() => {
                    aiService.triggerReaction('login', { name: user.displayName || 'Dreamer' });
                }, 1000);
            }

            if (window.location.hash === '#/welcome' || window.location.hash === '#/onboarding') {
                window.location.hash = '#/';
            }
            router.handleLocation();
        } else {
            header.hide();
            if (!window.location.hash.startsWith('#/share')) {
                window.location.hash = '#/welcome';
            }
            router.handleLocation();
        }
    });

    window.addEventListener('offline', () => {
        if (window.aiCompanion) window.aiCompanion.say("Offline...", "error");
        document.body.style.filter = "grayscale(0.8)";
    });
    window.addEventListener('online', () => {
        if (window.aiCompanion) window.aiCompanion.say("Online!", "welcome");
        document.body.style.filter = "";
    });
});