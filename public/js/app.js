/* public/js/app.js */
import { router } from './utils/Router.js';
import { AppShell } from './views/AppShell.js';
import { HomeView } from './views/HomeView.js';
import { WishlistView } from './views/WishlistView.js';
import { LandingView } from './views/LandingView.js';
import { OnboardingView } from './views/OnboardingView.js';
import { InspoView } from './views/InspoView.js';
import { ClosetView } from './views/ClosetView.js';
import { ComboView } from './views/ComboView.js';
import { FriendsView } from './views/FriendsView.js';
import { ProfileView } from './views/ProfileView.js';
import { SettingsView } from './views/SettingsView.js';
import { AuthView } from './views/AuthView.js'; // [NEW] Import AuthView
import { authService } from './services/AuthService.js';
import { settingsService } from './services/SettingsService.js';
import { LogService } from './services/LogService.js';
import { AICompanion } from './components/AICompanion.js';
import './utils/Toast.js';

// Define Routes Map
const routes = {
    '/': LandingView,
    '/auth': AuthView, // [NEW] Auth Route
    '/onboarding': OnboardingView,

    // Authenticated Routes (Wrapped in Shell)
    '/app/home': {
        render: () => AppShell.render(),
        afterRender: async () => {
            await AppShell.afterRender();
            const content = document.getElementById('shell-content');
            if(content) {
                content.innerHTML = await HomeView.render();
                if(HomeView.afterRender) await HomeView.afterRender();
            }
        }
    },
    '/app/wishlist': {
        render: () => AppShell.render(),
        afterRender: async () => {
            await AppShell.afterRender();
            const content = document.getElementById('shell-content');
            if(content) {
                content.innerHTML = await WishlistView.render();
                if(WishlistView.afterRender) await WishlistView.afterRender();
            }
        }
    },
    '/app/inspo': {
        render: () => AppShell.render(),
        afterRender: async () => {
            await AppShell.afterRender();
            const content = document.getElementById('shell-content');
            if(content) {
                content.innerHTML = await InspoView.render();
                if(InspoView.afterRender) await InspoView.afterRender();
            }
        }
    },
    '/app/closet': {
        render: () => AppShell.render(),
        afterRender: async () => {
            await AppShell.afterRender();
            const content = document.getElementById('shell-content');
            if(content) {
                content.innerHTML = await ClosetView.render();
                if(ClosetView.afterRender) await ClosetView.afterRender();
            }
        }
    },
    '/app/combos': {
        render: () => AppShell.render(),
        afterRender: async () => {
            await AppShell.afterRender();
            const content = document.getElementById('shell-content');
            if(content) {
                content.innerHTML = await ComboView.render();
                if(ComboView.afterRender) await ComboView.afterRender();
            }
        }
    },
    '/app/friends': {
        render: () => AppShell.render(),
        afterRender: async () => {
            await AppShell.afterRender();
            const content = document.getElementById('shell-content');
            if(content) {
                content.innerHTML = await FriendsView.render();
                if(FriendsView.afterRender) await FriendsView.afterRender();
            }
        }
    },
    '/app/profile': {
        render: () => AppShell.render(),
        afterRender: async () => {
            await AppShell.afterRender();
            const content = document.getElementById('shell-content');
            if(content) {
                content.innerHTML = await ProfileView.render();
                if(ProfileView.afterRender) await ProfileView.afterRender();
            }
        }
    },
    '/app/settings': {
        render: () => AppShell.render(),
        afterRender: async () => {
            await AppShell.afterRender();
            const content = document.getElementById('shell-content');
            if(content) {
                content.innerHTML = await SettingsView.render();
                if(SettingsView.afterRender) await SettingsView.afterRender();
            }
        }
    },

    '404': { template: '<div class="empty-state"><h1>404</h1><p>Page not found.</p><a href="#/app/home">Go Home</a></div>' }
};

document.addEventListener('DOMContentLoaded', async () => {
    LogService.info('App Started');
    await settingsService.init();

    // Configure router
    router.setRoutes(routes);

    const routeGuard = (path) => {
        const user = authService.currentUser;
        const profile = authService.userProfile;

        // Public routes
        const isPublic = path === '/' || path === '/auth' || path.startsWith('/share');
        
        // Redirect logic
        if (!user && !isPublic) return '/';
        
        if (user) {
            if (path !== '/onboarding') {
                if (profile && !profile.hasCompletedSignupProfile) return '/onboarding';
            }
            // If user is on landing or auth, go to home
            if (path === '/' || path === '/auth') return '/app/home';
        }
        return null; // OK
    };

    authService.init((user, profile) => {
        if (user) {
            if (!window.aiCompanion) { 
                try { window.aiCompanion = new AICompanion(); } catch (e) { console.warn("AI Companion failed to load", e); } 
            }
        }
        router.setGuard((path) => routeGuard(path));
        router.handleLocation();
    });
});