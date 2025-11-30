const CACHE_NAME = 'wishone-v1';
const ASSETS_TO_CACHE = [
    '/app.html',
    '/index.html',
    '/css/main.css',
    '/css/components.css',
    '/css/variables.css',
    '/js/app.js',
    '/img/icon.png',
    '/img/logo.png',
    '/404.html'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('fetch', (event) => {
    // Only cache GET requests
    if (event.request.method !== 'GET') return;

    // Skip Firestore/API requests
    if (event.request.url.includes('firestore') || event.request.url.includes('/api/')) return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // Return cached if found, else fetch
            return cachedResponse || fetch(event.request).then((response) => {
                // If valid response, cache it for next time (dynamic caching)
                if (response && response.status === 200 && response.type === 'basic') {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            });
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME) {
                        return caches.delete(name);
                    }
                })
            );
        })
    );
});