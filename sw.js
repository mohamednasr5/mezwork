/**
 * ===================================
 * MezoMenu - Service Worker
 * PWA offline support and caching
 * ===================================
 */

const CACHE_NAME = 'mezomenu-v1';
const STATIC_CACHE = 'mezomenu-static-v1';
const DYNAMIC_CACHE = 'mezomenu-dynamic-v1';

// Files to cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/login.html',
    '/register.html',
    '/admin/',
    '/css/main.css',
    '/css/auth.css',
    '/css/admin.css',
    '/css/menu.css',
    '/css/landing.css',
    '/js/main.js',
    '/js/auth.js',
    /js/admin\.js/,
    /js/menu\.js/,
    '/manifest-admin.json',
    '/manifest-menu.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                // Skip waiting to activate immediately
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[SW] Cache install failed:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => {
                            return name !== STATIC_CACHE && 
                                   name !== DYNAMIC_CACHE &&
                                   name !== CACHE_NAME;
                        })
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                // Take control of all pages immediately
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip chrome extensions and other non-http(s)
    if (!url.protocol.startsWith('http')) {
        return;
    }

    // Strategy for different request types
    
    // 1. Static assets - Cache First, Network Fallback
    if (isStaticAsset(url)) {
        event.respondWith(cacheFirst(request));
        return;
    }
    
    // 2. API calls - Network First, Cache Fallback
    if (isAPIRequest(url)) {
        event.respondWith(networkFirst(request));
        return;
    }
    
    // 3. Pages - Stale While Revalidate
    if (isPageRequest(url)) {
        event.respondWith(staleWhileRevalidate(request));
        return;
    }
    
    // Default: Network First
    event.respondWith(networkFirst(request));
});

/**
 * Cache First Strategy
 * Serve from cache, fallback to network
 */
async function cacheFirst(request) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
        // Update cache in background
        fetchAndCache(request);
        return cachedResponse;
    }
    
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('[SW] CacheFirst failed:', error);
        return getOfflineFallback();
    }
}

/**
 * Network First Strategy
 * Try network first, fallback to cache
 */
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('[SW] NetworkFirst failed:', error);
        
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        return getOfflineFallback();
    }
}

/**
 * Stale While Revalidate Strategy
 * Serve from cache immediately, update in background
 */
async function staleWhileRevalidate(request) {
    const cache = await caches.open(DYNAMIC_CACHE);
    const cachedResponse = await cache.match(request);
    
    // Fetch in background
    const fetchPromise = fetch(request)
        .then((networkResponse) => {
            if (networkResponse.ok) {
                cache.put(request, networkResponse.clone());
            }
            return networkResponse;
        })
        .catch(() => cachedResponse); // Return cache if network fails
    
    return cachedResponse || fetchPromise;
}

/**
 * Fetch and cache response
 */
async function fetchAndCache(request) {
    try {
        const response = await fetch(request);
        
        if (response.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, response);
        }
    } catch (error) {
        // Silent fail for background updates
    }
}

/**
 * Get offline fallback page
 */
async function getOfflineFallback() {
    const offlineCache = await caches.open(CACHE_NAME);
    let offlineResponse = await offlineCache.match('/offline.html');
    
    if (!offlineResponse) {
        // Create basic offline response
        offlineResponse = new Response(
            `<!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>غير متصل - MezoMenu</title>
                <style>
                    body { font-family: Cairo, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f9fafb; color: #374151; text-align: center; padding: 20px; }
                    .container { max-width: 400px; }
                    h1 { font-size: 2rem; margin-bottom: 10px; color: #dc2626; }
                    p { font-size: 1.125rem; margin-bottom: 20px; }
                    button { background: #dc2626; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 1rem; cursor: pointer; font-family: Cairo, sans-serif; }
                    button:hover { background: #b91c1c; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>📡 غير متصل</h1>
                    <p>يبدو أنك غير متصل بالإنترنت. تحقق من اتصالك وحاول مرة أخرى.</p>
                    <button onclick="location.reload()">إعادة المحاولة</button>
                </div>
            </body>
            </html>`,
            {
                headers: { 'Content-Type': 'text/html' }
            }
        );
        
        offlineCache.put('/offline.html', offlineResponse);
    }
    
    return offlineResponse;
}

/**
 * Check if request is for static asset
 */
function isStaticAsset(url) {
    const staticExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2'];
    return staticExtensions.some(ext => url.pathname.endsWith(ext));
}

/**
 * Check if request is API call
 */
function isAPIRequest(url) {
    return url.pathname.startsWith('/api/');
}

/**
 * Check if request is for HTML page
 */
function isPageRequest(url) {
    return url.pathname.endsWith('.html') || 
           url.pathname === '/' || 
           url.pathname.startsWith('/admin/') ||
           url.pathname.startsWith('/menu/');
}

// ==================== PUSH NOTIFICATIONS ====================

// Handle push notifications
self.addEventListener('push', (event) => {
    console.log('[SW] Push received');
    
    let data = {
        title: 'MezoMenu',
        body: 'إشعار جديد',
        icon: '/assets/icons/icon-192x192.png',
        badge: '/assets/icons/icon-72x72.png',
        tag: 'mezomenu-notification',
        requireInteraction: false,
        data: {}
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
            tag: data.tag,
            requireInteraction: data.requireInteraction,
            data: data.data,
            actions: [
                { action: 'view', title: 'عرض' },
                { action: 'dismiss', title: 'تجاهل' }
            ]
        })
    );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification click:', event.action);
    
    event.notification.close();
    
    if (event.action === 'dismiss') {
        return;
    }
    
    // Open or focus the app
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // If a window is already open, focus it
                for (const client of clientList) {
                    if (client.url.includes(self.registration.scope) && 'focus' in client) {
                        return client.focus();
                    }
                }
                
                // Otherwise open a new window
                if (clients.openWindow) {
                    return clients.openWindow(event.notification.data.url || '/');
                }
            })
    );
});

// ==================== BACKGROUND SYNC ====================

// Handle background sync for offline orders
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync:', event.tag);
    
    if (event.tag === 'sync-orders') {
        event.waitUntil(syncPendingOrders());
    }
});

/**
 * Sync pending orders when back online
 */
async function syncPendingOrders() {
    try {
        // Get pending orders from IndexedDB
        const pendingOrders = await getPendingOrders();
        
        for (const order of pendingOrders) {
            try {
                // Retry sending order
                const response = await fetch('/api/orders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(order)
                });
                
                if (response.ok) {
                    // Remove from pending
                    await removePendingOrder(order.id);
                    
                    // Show success notification
                    self.registration.showNotification('تم إرسال الطلب!', {
                        body: `تم إرسال طلبك #${order.id} بنجاح`,
                        icon: '/assets/icons/icon-192x192.png',
                        tag: 'order-synced'
                    });
                }
            } catch (error) {
                console.error('[SW] Failed to sync order:', order.id, error);
            }
        }
    } catch (error) {
        console.error('[SW] Sync failed:', error);
    }
}

// Placeholder functions for IndexedDB operations
async function getPendingOrders() {
    // Would implement with IndexedDB
    return [];
}

async function removePendingOrder(orderId) {
    // Would implement with IndexedDB
}

console.log('[SW] Service Worker loaded');
