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
import { firestoreService } from './services/FirestoreService.js';
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
    '/share': PublicWishlistView,
    '/inspo': InspoView,
    '/closet': ClosetView,
    '/combos': ComboView,
    '/profile': ProfileView,
    '404': { template: '<h1>404 - Not Found</h1>' }
};

const checkReminders = async (user) => {
    try {
        const items = await firestoreService.getWishlist(user.uid, user.uid);
        const now = new Date();
        const threeDays = 3 * 24 * 60 * 60 * 1000;

        let dueCount = 0;
        let urgentItem = null;

        items.forEach(item => {
            if (item.targetDate && item.status === 'wish') {
                const target = new Date(item.targetDate);
                const diff = target - now;
                if (diff > 0 && diff < threeDays) {
                    dueCount++;
                    urgentItem = item.title;
                }
            }
        });

        if (dueCount > 0) {
            const msg = dueCount === 1
                ? `Reminder: "${urgentItem}" is due soon!`
                : `You have ${dueCount} wishes due soon!`;

            setTimeout(() => {
                window.showToast(msg, "⏰");
                if (window.aiCompanion) window.aiCompanion.say(msg, "thinking");
            }, 2000);
        }
    } catch (e) {
        console.warn("Reminder check failed", e);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    LogService.info('App Started');

    // [NEW] Register SW
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(() => console.log('SW registered'))
            .catch(err => console.log('SW failed', err));
    }

    const header = new Header();
    header.mount('body');

    try { window.aiCompanion = new AICompanion(); } catch (e) { console.error(e); }

    const router = new Router(routes);

    const authTimeout = setTimeout(() => {
        const app = document.getElementById('app');
        if (app && app.innerText.includes('Loading...')) {
            window.location.hash = '#/welcome';
            router.handleLocation();
        }
    }, 3000);

    const routeGuard = (path, user, profile) => {
        if (path.startsWith('/share')) return null;
        if (!user) {
            if (path === '/welcome') return null;
            return '/welcome';
        }
        if (profile && !profile.isProfileComplete) {
            if (path === '/onboarding') return null;
            return '/onboarding';
        }
        if (path === '/welcome' || path === '/onboarding') {
            return '/';
        }
        return null;
    };

    authService.init((user, profile) => {
        clearTimeout(authTimeout);

        if (user) {
            header.updateUser(user);
            if (profile && !profile.isProfileComplete) {
                header.hide();
            } else {
                header.show();
                if (!window.hasCheckedReminders) {
                    checkReminders(user);
                    window.hasCheckedReminders = true;
                }
            }
        } else {
            header.hide();
        }

        if (user && profile && profile.isProfileComplete && (window.location.hash === '#/' || window.location.hash === '')) {
            setTimeout(() => {
                aiService.triggerReaction('login', { name: user.displayName || 'Dreamer' });
            }, 1000);
        }

        router.setGuard((path) => routeGuard(path, user, profile));
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