import { Router } from './utils/Router.js';
import { AppShell } from './views/AppShell.js';
import { HomeView } from './views/HomeView.js';
import { WishlistView } from './views/WishlistView.js'; // [NEW]
import { LandingView } from './views/LandingView.js';
import { OnboardingView } from './views/OnboardingView.js';
import { InspoView } from './views/InspoView.js';
import { ClosetView } from './views/ClosetView.js';
import { ComboView } from './views/ComboView.js';
import { FriendsView } from './views/FriendsView.js';
import { ProfileView } from './views/ProfileView.js';
import { SettingsView } from './views/SettingsView.js';
import { authService } from './services/AuthService.js';
import { settingsService } from './services/SettingsService.js';
import { LogService } from './services/LogService.js';
import { AICompanion } from './components/AICompanion.js';
import './utils/Toast.js';

const routes = {
    '/': LandingView,
    '/onboarding': OnboardingView,

    // Authenticated Routes (Wrapped in Shell)
    '/app/home': {
        render: () => AppShell.render(HomeView),
        afterRender: () => AppShell.afterRender(HomeView)
    },
    // [FIX] Now pointing to separate WishlistView
    '/app/wishlist': {
        render: () => AppShell.render(WishlistView),
        afterRender: () => AppShell.afterRender(WishlistView)
    },
    '/app/inspo': {
        render: () => AppShell.render(InspoView),
        afterRender: () => AppShell.afterRender(InspoView)
    },
    '/app/closet': {
        render: () => AppShell.render(ClosetView),
        afterRender: () => AppShell.afterRender(ClosetView)
    },
    '/app/combos': {
        render: () => AppShell.render(ComboView),
        afterRender: () => AppShell.afterRender(ComboView)
    },
    '/app/friends': {
        render: () => AppShell.render(FriendsView),
        afterRender: () => AppShell.afterRender(FriendsView)
    },
    '/app/profile': {
        render: () => AppShell.render(ProfileView),
        afterRender: () => AppShell.afterRender(ProfileView)
    },

    '/settings': SettingsView,

    '404': { template: '<div class="empty-state"><h1>404</h1><p>Page not found.</p><a href="#/app/home">Go Home</a></div>' }
};

document.addEventListener('DOMContentLoaded', async () => {
    LogService.info('App Started');
    await settingsService.init();

    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');

    const router = new Router(routes);

    const routeGuard = (path, user, profile) => {
        const isPublic = path === '/' || path.startsWith('/share');
        if (!user && !isPublic) return '/';
        if (user) {
            if (path !== '/onboarding') {
                if (profile && !profile.hasCompletedSignupProfile) return '/onboarding';
            }
            if (path === '/') return '/app/home';
        }
        return null;
    };

    authService.init((user, profile) => {
        if (user) {
            if (!window.aiCompanion) { try { window.aiCompanion = new AICompanion(); } catch (e) { } }
        }
        router.setGuard((path) => routeGuard(path, user, profile));
        router.handleLocation();
    });
});