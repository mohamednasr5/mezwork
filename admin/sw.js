/* ===================================
   MezoMenu Admin PWA - Service Worker
   =================================== */

const CACHE_NAME = 'mezomenu-admin-v1';
const STATIC_ASSETS = [
    '/',
    '/admin/',
    '/admin/dashboard.html',
    '/admin/login.html',
    '/admin/register.html',
    '/admin/menu.html',
    '/admin/orders.html',
    /admin/settings.html',
    '/admin/ai-import.html',
    '/admin/notifications.html',
    '/assets/css/main.css',
    '/assets/css/admin.css',
    '/assets/js/main.js',
    '/assets/js/orders.js',
    /assets/js/settings.js',
    '/assets/js/ai-import.js',
    '/assets/js/notifications.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Install Event - Cache Static Assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Admin Service Worker...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
            .catch((error) => console.error('[SW] Cache error:', error))
    );
});

// Activate Event - Clean Old Caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Admin Service Worker...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch Event - Network First Strategy
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip external API calls (let them fail/handle normally)
    if (url.hostname.includes('workers.dev') || 
        url.hostname.includes('firebaseio.com') ||
        url.hostname.includes('cloudflare.com')) {
        return;
    }

    // For navigation requests (HTML pages)
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Cache successful responses
                    if (response.ok) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Fallback to cache
                    return caches.match(request).then((cachedResponse) => {
                        return cachedResponse || caches.match('/admin/login.html');
                    });
                })
        );
        return;
    }

    // For static assets - Cache First Strategy
    if (url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff2?)$/)) {
        event.respondWith(
            caches.match(request)
                .then((cachedResponse) => {
                    if (cachedResponse) {
                        // Update cache in background
                        fetch(request).then((response) => {
                            if (response.ok) {
                                caches.open(CACHE_NAME).then((cache) => {
                                    cache.put(request, response);
                                });
                            }
                        }).catch(() => {});
                        
                        return cachedResponse;
                    }

                    // Not in cache, fetch from network
                    return fetch(request)
                        .then((response) => {
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

    // Default: Network with Cache Fallback
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

// Background Sync for Orders
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync:', event.tag);

    if (event.tag === 'sync-orders') {
        event.waitUntil(syncOrders());
    } else if (event.tag === 'sync-settings') {
        event.waitUntil(syncSettings());
    }
});

// Push Notifications
self.addEventListener('push', (event) => {
    console.log('[SW] Push received');

    let data = {
        title: 'MezoMenu',
        body: 'إشعار جديد',
        icon: '/assets/images/icon-192.png',
        badge: '/assets/images/badge-72.png'
    };

    if (event.data) {
        try {
            data = { ...data, ...event.data.json() };
        } catch (e) {
            data.body = event.data.text();
        }
    }

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: data.icon,
            badge: data.badge,
            dir: 'rtl',
            lang: 'ar',
            vibrate: [200, 100, 200],
            tag: 'mezomenu-notification',
            actions: [
                { action: 'view', title: 'عرض' },
                { action: 'dismiss', title: 'تجاهل' }
            ],
            data: data.url || '/admin/orders.html'
        })
    );
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event.action);

    event.notification.close();

    if (event.action === 'dismiss') return;

    const urlToOpen = event.notification.data || '/admin/orders.html';

    event.waitUntil(
        clients.matchAll({ type: 'window' })
            .then((clientList) => {
                // Focus existing window if available
                for (const client of clientList) {
                    if (client.url.includes(urlToOpen) && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Open new window
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// Helper Functions
async function syncOrders() {
    console.log('[SW] Syncing orders...');
    // Implementation for syncing offline orders
}

async function syncSettings() {
    console.log('[SW] Syncing settings...');
    // Implementation for syncing offline settings changes
}
