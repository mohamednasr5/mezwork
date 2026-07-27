/* ===================================
   MezoMenu Customer PWA - Service Worker
   =================================== */

const CACHE_NAME = 'mezomenu-customer-v1';
const STATIC_ASSETS = [
    '/',
    '/customer/',
    '/customer/index.html',
    '/customer/manifest.json',
    '/assets/css/customer.css',
    '/assets/css/main.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Install Event
self.addEventListener('install', (event) => {
    console.log('[SW-Customer] Installing Service Worker...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW-Customer] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate Event
self.addEventListener('activate', (event) => {
    console.log('[SW-Customer] Activating Service Worker...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => caches.delete(name))
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch Event - Cache First for Static, Network for API
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip external APIs - let them go to network
    if (url.hostname.includes('workers.dev') || 
        url.hostname.includes('firebaseio.com')) {
        event.respondWith(fetch(request));
        return;
    }

    // For navigation requests (HTML)
    if (request.mode === 'navigate') {
        event.respondWith(
            caches.match(request)
                .then((cached) => {
                    if (cached) {
                        // Return cached version but fetch update in background
                        fetch(request).then((response) => {
                            if (response.ok) {
                                caches.open(CACHE_NAME).then((cache) => {
                                    cache.put(request, response);
                                });
                            }
                        }).catch(() => {});
                        return cached;
                    }
                    // Not in cache, try network
                    return fetch(request)
                        .then((response) => {
                            if (response.ok) {
                                const responseClone = response.clone();
                                caches.open(CACHE_NAME).then((cache) => {
                                    cache.put(request, responseClone);
                                });
                            }
                            return response;
                        })
                        .catch(() => caches.match('/customer/index.html'));
                })
        );
        return;
    }

    // For static assets - Cache First
    if (url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff2?)$/)) {
        event.respondWith(
            caches.match(request)
                .then((cachedResponse) => {
                    return cachedResponse || fetch(request).then((response) => {
                        if (response.ok) {
                            const responseClone = response.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(request, responseClone);
                            });
                        }
                        return response;
                    });
                })
        );
        return;
    }

    // Default: Network First
    event.respondWith(
        fetch(request)
            .then((response) => {
                if (response.ok) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => caches.match(request))
    );
});

// Handle menu data caching for offline access
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'CACHE_MENU_DATA') {
        const { slug, data } = event.data;
        
        caches.open(CACHE_NAME).then((cache) => {
            const response = new Response(JSON.stringify(data), {
                headers: { 'Content-Type': 'application/json' }
            });
            cache.put(`/api/menu/${slug}`, response);
        });
    }
});
