/* public/js/utils/Router.js */
export class Router {
    constructor(routes = {}) {
        this.routes = routes;
        this.guard = null;
        // Bind the event listener once
        window.addEventListener('hashchange', () => this.handleLocation());
        window.addEventListener('load', () => this.handleLocation());
    }

    setRoutes(routes) {
        this.routes = routes;
    }

    setGuard(guardFn) {
        this.guard = guardFn;
    }

    navigate(path) {
        window.location.hash = path;
    }

    async handleLocation() {
        let path = window.location.hash.slice(1) || '/';

        // Normalize path (remove trailing slash)
        if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);

        // 1. Run Guard (Auth/Beta/Onboarding checks)
        if (this.guard) {
            const redirect = await this.guard(path);
            if (redirect && redirect !== path) {
                window.location.hash = redirect;
                return;
            }
        }

        // 2. Match Route
        let route = this.routes[path];

        // Handle 404
        if (!route) {
            route = this.routes['404'];
        }

        const app = document.getElementById('app');
        if (!app || !route) return;

        // 3. Render
        try {
            if (route.template) {
                app.innerHTML = route.template;
            } else if (route.render) {
                // Supports async render (e.g. AppShell fetching data)
                app.innerHTML = await route.render();
                if (route.afterRender) await route.afterRender();
            }
        } catch (e) {
            console.error("Router Render Error:", e);
            app.innerHTML = `<div class="empty-state"><h3>Error loading view</h3><p>${e.message}</p></div>`;
        }
    }
}

// Export a singleton instance to be used across the app
export const router = new Router();