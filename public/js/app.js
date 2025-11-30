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
import './utils/Toast.js';

const routes = {
    '/': HomeView,
    '/welcome': WelcomeView,
    '/onboarding': OnboardingView,
    '/friends': FriendsView,
    '/friend-wishlist': FriendWishlistView,
    '/share': PublicWishlistView, // Public Route
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

    // Timeout fallback (kept as safety net)
    const authTimeout = setTimeout(() => {
        const app = document.getElementById('app');
        if (app && app.innerText.includes('Loading...')) {
            console.warn("Auth check timed out. Forcing Welcome View.");
            window.location.hash = '#/welcome';
            router.handleLocation(); // Guard will re-check anyway
        }
    }, 3000);

    // [NEW] Centralized Route Guard Logic
    const routeGuard = (path, user, profile) => {
        // 1. PUBLIC ROUTES (Always accessible)
        // /share is public (read-only wishlist)
        if (path.startsWith('/share')) return null;

        // 2. STATE: GUEST (No User)
        if (!user) {
            // Guests can ONLY see /welcome
            if (path === '/welcome') return null;
            return '/welcome';
        }

        // 3. STATE: INCOMPLETE (User exists, profile incomplete)
        // Gate: profileComplete property
        if (profile && !profile.isProfileComplete) {
            // Can ONLY see /onboarding (mapped from /complete-profile)
            if (path === '/onboarding') return null;
            return '/onboarding';
        }

        // 4. STATE: COMPLETE (User exists, profile complete)
        // Cannot see /welcome or /onboarding
        if (path === '/welcome' || path === '/onboarding') {
            return '/';
        }

        // Otherwise allow (Home, Friends, etc.)
        return null;
    };

    authService.init((user, profile) => {
        clearTimeout(authTimeout);

        // Update UI State
        if (user) {
            header.updateUser(user);
            // Hide header only on onboarding to focus user
            if (profile && !profile.isProfileComplete) {
                header.hide();
            } else {
                header.show();
            }
        } else {
            header.hide();
        }

        // Trigger AI reaction on Login (only if complete and hitting home)
        if (user && profile && profile.isProfileComplete && (window.location.hash === '#/' || window.location.hash === '')) {
            setTimeout(() => {
                aiService.triggerReaction('login', { name: user.displayName || 'Dreamer' });
            }, 1000);
        }

        // [NEW] Update Router Guard with fresh state
        router.setGuard((path) => routeGuard(path, user, profile));

        // Re-evaluate current location with new guard
        router.handleLocation();
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