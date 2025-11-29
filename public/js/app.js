import { Router } from './utils/Router.js';
import { Header } from './components/Header.js';
import { HomeView } from './views/HomeView.js';
import { WelcomeView } from './views/WelcomeView.js';
import { OnboardingView } from './views/OnboardingView.js';
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
    '/onboarding': OnboardingView,
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

    // SAFETY FALLBACK: If stuck on "Loading..." for >3s, force Welcome screen.
    const authTimeout = setTimeout(() => {
        const app = document.getElementById('app');
        if (app && app.innerText.includes('Loading...')) {
            console.warn("Auth check timed out. Forcing Welcome View.");
            window.location.hash = '#/welcome';
            router.handleLocation();
        }
    }, 3000);

    authService.init((user, profile) => {
        clearTimeout(authTimeout); // Cancel fallback if auth loads in time

        if (window.location.hash.startsWith('#/share')) {
            if (user) header.updateUser(user);
            router.handleLocation();
            return;
        }

        if (user) {
            // Milestone 1: Critical Registration Flow Check
            if (profile && !profile.isProfileComplete) {
                header.hide();
                if (window.location.hash !== '#/onboarding') {
                    window.location.hash = '#/onboarding';
                }
                router.handleLocation();
                return;
            }

            header.updateUser(user);
            header.show();

            if (window.location.hash === '#/welcome' || window.location.hash === '#/onboarding') {
                window.location.hash = '#/';
            }

            if (window.location.hash === '#/' || window.location.hash === '') {
                setTimeout(() => {
                    aiService.triggerReaction('login', { name: user.displayName || 'Dreamer' });
                }, 1000);
            }

            router.handleLocation();
        } else {
            header.hide();
            if (window.location.hash !== '#/welcome') {
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