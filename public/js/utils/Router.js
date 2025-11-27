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
        const hash = window.location.hash.slice(1) || '/';

        // 2. Find matching route
        const route = this.routes[hash] || this.routes['404'];

        // 3. Fluid Transition: Fade Out
        this.appContainer.classList.add('view-exit');

        // Wait for CSS transition (matches --duration-std)
        setTimeout(async () => {
            // 4. Render New View
            const viewContent = typeof route.render === 'function'
                ? await route.render()
                : route.template;

            this.appContainer.innerHTML = viewContent;

            // 4.5. Call afterRender hook
            if (route.afterRender && typeof route.afterRender === 'function') {
                await route.afterRender();
            }

            // 5. Update Active State
            document.dispatchEvent(new CustomEvent('route-changed', { detail: { route: hash } }));

            // 6. Fluid Transition: Fade In
            window.scrollTo(0, 0);
            this.appContainer.classList.remove('view-exit');
            this.appContainer.classList.add('view-enter');

            // Cleanup animation class
            setTimeout(() => {
                this.appContainer.classList.remove('view-enter');
            }, 300); // Slightly longer than 250ms to ensure completion

        }, 200); // 200ms exit
    }
}