/**
 * MezoMenu - Service Worker
 * Handles offline functionality, caching, and push notifications
 */

const CACHE_NAME = 'mezomenu-v1';
const STATIC_CACHE = 'mezomenu-static-v1';
const DYNAMIC_CACHE = 'mezomenu-dynamic-v1';

// Files to cache immediately on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/login.html',
    '/register.html',
    '/css/style.css',
    '/css/auth.css',
    '/css/admin.css',
    '/js/app.js',
    '/js/auth.js',
    '/js/admin.js',
    '/js/firebase-config.js',
    '/js/nvidia-ai.js',
    '/manifest-admin.json',
    '/manifest-menu.json'
];

// API endpoints that can be cached
const CACHEABLE_PATTERNS = [
    /\/api\/menu\//,
    /\/api\/restaurant\//
];

// ========================================
// Install Event
// ========================================

self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
            .catch(error => {
                console.error('[SW] Failed to cache static assets:', error);
            })
    );
});

// ========================================
// Activate Event
// ========================================

self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker...');
    
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
                        .map(name => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => self.clients.claim())
    );
});

// ========================================
// Fetch Event (Network First Strategy)
// ========================================

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip Chrome extensions and other non-http(s) requests
    if (!url.protocol.startsWith('http')) return;

    // Handle API requests with network-first strategy
    if (isAPIRequest(url)) {
        event.respondWith(networkFirst(request));
        return;
    }

    // Handle static assets with cache-first strategy
    if (isStaticAsset(url)) {
        event.respondWith(cacheFirst(request));
        return;
    }

    // Default: network first with cache fallback
    event.respondWith(networkFirst(request));
});

// ========================================
// Caching Strategies
// ========================================

async function networkFirst(request) {
    try {
        // Try network first
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Cache successful responses
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        // Fallback to cache
        const cachedResponse = await caches.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return offline page for navigation requests
        if (request.mode === 'navigate') {
            return caches.match('/index.html');
        }
        
        throw error;
    }
}

async function cacheFirst(request) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
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
        throw error;
    }
}

async function staleWhileRevalidate(request) {
    const cache = await caches.open(DYNAMIC_CACHE);
    const cachedResponse = await cache.match(request);
    
    const networkPromise = fetch(request).then(response => {
        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    }).catch(() => cachedResponse);

    return cachedResponse || networkPromise;
}

// ========================================
// Helper Functions
// ========================================

function isAPIRequest(url) {
    return url.pathname.startsWith('/api/');
}

function isStaticAsset(url) {
    const staticExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2'];
    return staticExtensions.some(ext => url.pathname.endsWith(ext));
}

function shouldCache(url) {
    return CACHEABLE_PATTERNS.some(pattern => pattern.test(url.pathname));
}

// ========================================
// Background Sync for Orders
// ========================================

self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync:', event.tag);

    if (event.tag === 'sync-orders') {
        event.waitUntil(syncPendingOrders());
    }

    if (event.tag === 'sync-analytics') {
        event.waitUntil(syncAnalyticsData());
    }
});

async function syncPendingOrders() {
    try {
        // Get pending orders from IndexedDB
        const pendingOrders = await getFromIndexedDB('pending-orders');
        
        for (const order of pendingOrders) {
            try {
                await fetch('/api/orders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(order)
                });
                
                // Remove synced order
                await deleteFromIndexedDB('pending-orders', order.id);
                
                // Show notification
                showNotification('تم إرسال الطلب', `الطلب #${order.id} تم إرساله بنجاح`);
            } catch (error) {
                console.error('Failed to sync order:', order.id, error);
            }
        }
    } catch (error) {
        console.error('Error syncing orders:', error);
    }
}

async function syncAnalyticsData() {
    // Sync analytics when back online
    console.log('[SW] Syncing analytics data...');
}

// ========================================
// Push Notifications
// ========================================

self.addEventListener('push', (event) => {
    console.log('[SW] Push received:', event);

    let data = {
        title: 'MezoMenu',
        body: 'إشعار جديد',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        data: { url: '/' }
    };

    if (event.data) {
        try {
            data = { ...data, ...event.data.json() };
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: data.icon,
        badge: data.badge,
        vibrate: [100, 50, 100],
        data: data.data,
        actions: [
            { action: 'view', title: 'عرض' },
            { action: 'dismiss', title: 'إغلاق' }
        ],
        dir: 'rtl',
        lang: 'ar'
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event.action);

    event.notification.close();

    if (event.action === 'view' || !event.action) {
        const urlToOpen = event.notification.data?.url || '/';
        
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true })
                .then(clientList => {
                    // Focus existing window if available
                    for (const client of clientList) {
                        if (client.url === urlToOpen && 'focus' in client) {
                            return client.focus();
                        }
                    }
                    // Open new window
                    if (clients.openWindow) {
                        return clients.openWindow(urlToOpen);
                    }
                })
        );
    }
});

// ========================================
// IndexedDB Helpers
// ========================================

function openIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('MezoMenuDB', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Store for pending orders
            if (!db.objectStoreNames.contains('pending-orders')) {
                db.createObjectStore('pending-orders', { keyPath: 'id' });
            }
            
            // Store for menu cache
            if (!db.objectStoreNames.contains('menu-cache')) {
                db.createObjectStore('menu-cache', { keyPath: 'restaurantId' });
            }
        };
    });
}

async function getFromIndexedDB(storeName) {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function deleteFromIndexedDB(storeName, id) {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

function showNotification(title, body, data = {}) {
    self.registration.showNotification(title, {
        body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        data,
        dir: 'rtl',
        lang: 'ar'
    });
}

// ========================================
// Message Handling
// ========================================

self.addEventListener('message', (event) => {
    console.log('[SW] Message received:', event.data);

    switch (event.data?.type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
            
        case 'CLEAR_CACHE':
            clearCaches().then(() => {
                event.source.postMessage({ type: 'CACHE_CLEARED' });
            });
            break;
            
        case 'GET_VERSION':
            event.source.postMessage({ 
                type: 'VERSION', 
                version: CACHE_NAME 
            });
            break;
            
        default:
            break;
    }
});

async function clearCaches() {
    const names = await caches.keys();
    await Promise.all(names.map(name => caches.delete(name)));
    console.log('[SW] All caches cleared');
}
