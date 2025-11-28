// js/utils/Router.js

export class Router {
    constructor(routes) {
        this.routes = routes;
        this.appContainer = document.getElementById('app');

        // Bind navigation events
        window.addEventListener('hashchange', () => this.handleLocation());
        window.addEventListener('DOMContentLoaded', () => this.handleLocation());
    }

    async handleLocation() {
        // 1. Get current hash (default to home)
        // Support query params: #/share?uid=xyz -> path: /share, params: {uid: xyz}
        const fullHash = window.location.hash.slice(1) || '/';
        const [path, queryString] = fullHash.split('?');

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

        // Wait for CSS transition (matches --duration-std)
        setTimeout(async () => {
            // 4. Render New View
            // Pass params to the render function
            const viewContent = typeof route.render === 'function'
                ? await route.render(params)
                : route.template;

            this.appContainer.innerHTML = viewContent;

            // 4.5. Call afterRender hook
            if (route.afterRender && typeof route.afterRender === 'function') {
                await route.afterRender(params);
            }

            // 5. Update Active State
            document.dispatchEvent(new CustomEvent('route-changed', { detail: { route: path } }));

            // 6. Fluid Transition: Fade In
            window.scrollTo(0, 0);
            this.appContainer.classList.remove('view-exit');
            this.appContainer.classList.add('view-enter');

            // Cleanup animation class
            setTimeout(() => {
                this.appContainer.classList.remove('view-enter');
            }, 300);

        }, 200);
    }
}