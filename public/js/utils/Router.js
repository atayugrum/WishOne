// js/utils/Router.js

export class Router {
    constructor(routes) {
        this.routes = routes;
        this.appContainer = document.getElementById('app');
        this.guard = null; // [NEW] Guard function

        // Bind navigation events
        window.addEventListener('hashchange', () => this.handleLocation());
        window.addEventListener('DOMContentLoaded', () => this.handleLocation());
    }

    // [NEW] Set a guard function that returns a redirect path or null
    setGuard(guardFn) {
        this.guard = guardFn;
    }

    async handleLocation() {
        // 1. Get current hash
        const fullHash = window.location.hash.slice(1) || '/';
        const [path, queryString] = fullHash.split('?');

        // [NEW] 1.5 Run Guard Check
        if (this.guard) {
            const redirectPath = this.guard(path);
            if (redirectPath && redirectPath !== path) {
                console.log(`[Router] Guard redirecting from ${path} to ${redirectPath}`);
                window.location.hash = '#' + redirectPath;
                return; // Stop rendering, wait for hashchange
            }
        }

        // Parse Query Params
        const params = {};
        if (queryString) {
            new URLSearchParams(queryString).forEach((value, key) => {
                params[key] = value;
            });
        }

        // 2. Find matching route
        const route = this.routes[path] || this.routes['404'];

        // 3. Fluid Transition: Fade Out
        this.appContainer.classList.add('view-exit');

        setTimeout(async () => {
            // 4. Render New View
            const viewContent = typeof route.render === 'function'
                ? await route.render(params)
                : route.template;

            this.appContainer.innerHTML = viewContent;

            if (route.afterRender && typeof route.afterRender === 'function') {
                await route.afterRender(params);
            }

            document.dispatchEvent(new CustomEvent('route-changed', { detail: { route: path } }));

            window.scrollTo(0, 0);
            this.appContainer.classList.remove('view-exit');
            this.appContainer.classList.add('view-enter');

            setTimeout(() => {
                this.appContainer.classList.remove('view-enter');
            }, 300);

        }, 200);
    }
}