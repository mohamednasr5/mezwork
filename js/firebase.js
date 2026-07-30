/**
 * MezoMenu - Firebase Configuration & API Integration
 * Uses Firebase Realtime Database REST API
 */

// ============================================
// Configuration
// ============================================
const CONFIG = {
    // Firebase Configuration
    firebase: {
        projectId: 'menu-b41e6',
        databaseURL: 'https://menu-b41e6-default-rtdb.firebaseio.com',
        // If using Worker as proxy, set this to your worker URL
        // Otherwise, use direct Firebase URL
        apiBase: null // Will be set based on environment
    },
    
    // Cloudflare Worker URL (for API proxy)
    // Set this to your deployed worker URL
    workerURL: window.location.origin, // Same origin for local dev
    
    // R2 Storage
    r2: {
        bucket: 'mezomenu-images'
    }
};

// Auto-detect if we're using Worker or direct Firebase
const isWorkerMode = false; // Set to true when using Worker

// Base URL for API calls
const API_BASE = isWorkerMode 
    ? (CONFIG.workerURL + '/api') 
    : CONFIG.firebase.databaseURL;

// ============================================
// Firebase REST API Helper Functions
// ============================================

/**
 * Generic fetch wrapper for Firebase REST API
 */
async function firebaseRequest(path, options = {}) {
    const url = `${API_BASE}/${path}.json`;
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    try {
        const response = await fetch(url, mergedOptions);
        
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }
        
        // Handle empty responses (e.g., DELETE)
        const text = await response.text();
        return text ? JSON.parse(text) : null;
    } catch (error) {
        console.error('Firebase Request Error:', error);
        throw error;
    }
}

/**
 * GET - Retrieve data from Firebase
 */
async function firebaseGet(path) {
    return firebaseRequest(path, { method: 'GET' });
}

/**
 * POST - Create new data with auto-generated ID
 */
async function firebasePost(path, data) {
    return firebaseRequest(path, {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

/**
 * PUT - Update/Replace data at specific path
 */
async function firebasePut(path, data) {
    return firebaseRequest(path, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}

/**
 * PATCH - Partial update of data
 */
async function firebasePatch(path, data) {
    return firebaseRequest(path, {
        method: 'PATCH',
        body: JSON.stringify(data)
    });
}

/**
 * DELETE - Remove data at specific path
 */
async function firebaseDelete(path) {
    return firebaseRequest(path, { method: 'DELETE' });
}

// ============================================
// Data Models & Types
// ============================================

/**
 * Menu Item Type
 */
const MenuItemType = {
    id: '',
    name: '',
    description: '',
    price: 0,
    categoryId: '',
    image: '',
    available: true,
    featured: false,
    spicy: false,
    vegetarian: false,
    ingredients: [],
    orderCount: 0,
    createdAt: null,
    updatedAt: null
};

/**
 * Category Type
 */
const CategoryType = {
    id: '',
    name: '',
    description: '',
    icon: 'fa-utensils',
    image: '',
    order: 0,
    createdAt: null
};

/**
 * Order Type
 */
const OrderType = {
    id: '',
    customerName: '',
    customerPhone: '',
    items: [],
    total: 0,
    status: 'pending', // pending, preparing, ready, delivered, cancelled
    notes: '',
    address: '',
    createdAt: null,
    updatedAt: null
};

/**
 * Order Item Type
 */
const OrderItemType = {
    itemId: '',
    itemName: '',
    quantity: 1,
    price: 0,
    notes: ''
};

/**
 * Promotion Type
 */
const PromotionType = {
    id: '',
    title: '',
    description: '',
    type: 'percentage', // percentage, fixed, bogo, free_delivery
    value: 0,
    code: '',
    startDate: '',
    endDate: '',
    image: '',
    active: true,
    usageCount: 0,
    maxUsage: null,
    createdAt: null
};

/**
 * Reservation Type
 */
const ReservationType = {
    id: '',
    customerName: '',
    phone: '',
    date: '',
    time: '',
    guests: 1,
    status: 'confirmed', // confirmed, pending, cancelled, completed
    notes: '',
    createdAt: null
};

/**
 * Notification Type
 */
const NotificationType = {
    id: '',
    title: '',
    message: '',
    type: 'system', // order, reservation, promotion, system
    read: false,
    data: {},
    createdAt: null
};

/**
 * Settings Type
 */
const SettingsType = {
    restaurantName: '',
    address: '',
    phone: '',
    email: '',
    description: '',
    logo: '',
    currency: 'EGP',
    workingHours: {
        openingTime: '10:00',
        closingTime: '23:00',
        days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    },
    socialMedia: {
        facebook: '',
        instagram: '',
        twitter: ''
    },
    features: {
        delivery: true,
        pickup: true,
        dineIn: true,
        reservations: true
    }
};

// ============================================
// API Service Classes
// ============================================

/**
 * Menu Items API
 */
class MenuItemsAPI {
    static basePath = 'menuItems';
    
    static async getAll() {
        const data = await firebaseGet(this.basePath);
        return data ? Object.entries(data).map(([id, item]) => ({ id, ...item })) : [];
    }
    
    static async getById(id) {
        return firebaseGet(`${this.basePath}/${id}`);
    }
    
    static async getByCategory(categoryId) {
        const all = await this.getAll();
        return all.filter(item => item.categoryId === categoryId);
    }
    
    static async create(itemData) {
        const newItem = {
            ...itemData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            orderCount: 0
        };
        const result = await firebasePost(this.basePath, newItem);
        return { id: result.name, ...newItem };
    }
    
    static async update(id, updateData) {
        const updatedData = {
            ...updateData,
            updatedAt: new Date().toISOString()
        };
        await firebasePut(`${this.basePath}/${id}`, updatedData);
        return { id, ...updatedData };
    }
    
    static async delete(id) {
        return firebaseDelete(`${this.basePath}/${id}`);
    }
    
    static async search(query) {
        const all = await this.getAll();
        const lowerQuery = query.toLowerCase();
        return all.filter(item => 
            item.name?.toLowerCase().includes(lowerQuery) ||
            item.description?.toLowerCase().includes(lowerQuery) ||
            item.ingredients?.some(ing => ing.toLowerCase().includes(lowerQuery))
        );
    }
}

/**
 * Categories API
 */
class CategoriesAPI {
    static basePath = 'categories';
    
    static async getAll() {
        const data = await firebaseGet(this.basePath);
        return data ? Object.entries(data).map(([id, cat]) => ({ id, ...cat })) : [];
    }
    
    static async getById(id) {
        return firebaseGet(`${this.basePath}/${id}`);
    }
    
    static async create(categoryData) {
        const newCategory = {
            ...categoryData,
            createdAt: new Date().toISOString(),
            order: categoryData.order || 0
        };
        const result = await firebasePost(this.basePath, newCategory);
        return { id: result.name, ...newCategory };
    }
    
    static async update(id, updateData) {
        await firebasePut(`${this.basePath}/${id}`, updateData);
        return { id, ...updateData };
    }
    
    static async delete(id) {
        return firebaseDelete(`${this.basePath}/${id}`);
    }
}

/**
 * Orders API
 */
class OrdersAPI {
    static basePath = 'orders';
    
    static async getAll() {
        const data = await firebaseGet(this.basePath);
        return data 
            ? Object.entries(data)
                .map(([id, order]) => ({ id, ...order }))
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            : [];
    }
    
    static async getById(id) {
        return firebaseGet(`${this.basePath}/${id}`);
    }
    
    static async create(orderData) {
        const newOrder = {
            ...orderData,
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        const result = await firebasePost(this.basePath, newOrder);
        
        // Create notification for new order
        await NotificationsAPI.create({
            title: 'طلب جديد',
            message: `طلب جديد #${result.name} من ${orderData.customerName}`,
            type: 'order',
            data: { orderId: result.name }
        });
        
        return { id: result.name, ...newOrder };
    }
    
    static async updateStatus(id, status) {
        const updateData = {
            status,
            updatedAt: new Date().toISOString()
        };
        
        // Add completed/delivered timestamp
        if (status === 'delivered') {
            updateData.deliveredAt = new Date().toISOString();
        }
        
        await firebasePatch(`${this.basePath}/${id}`, updateData);
        return { id, ...updateData };
    }
    
    static async update(id, updateData) {
        const updatedData = {
            ...updateData,
            updatedAt: new Date().toISOString()
        };
        await firebasePatch(`${this.basePath}/${id}`, updatedData);
        return { id, ...updatedData };
    }
    
    static async delete(id) {
        return firebaseDelete(`${this.basePath}/${id}`);
    }
    
    static async getRecent(limit = 5) {
        const all = await this.getAll();
        return all.slice(0, limit);
    }
    
    static async getByStatus(status) {
        const all = await this.getAll();
        return all.filter(order => order.status === status);
    }
    
    static async getStats() {
        const all = await this.getAll();
        const today = new Date().toDateString();
        
        const todayOrders = all.filter(o => 
            new Date(o.createdAt).toDateString() === today
        );
        
        return {
            total: all.length,
            today: todayOrders.length,
            totalRevenue: all
                .filter(o => o.status === 'delivered')
                .reduce((sum, o) => sum + (o.total || 0), 0),
            byStatus: {
                pending: all.filter(o => o.status === 'pending').length,
                preparing: all.filter(o => o.status === 'preparing').length,
                ready: all.filter(o => o.status === 'ready').length,
                delivered: all.filter(o => o.status === 'delivered').length,
                cancelled: all.filter(o => o.status === 'cancelled').length
            }
        };
    }
}

/**
 * Promotions API
 */
class PromotionsAPI {
    static basePath = 'promotions';
    
    static async getAll() {
        const data = await firebaseGet(this.basePath);
        return data 
            ? Object.entries(data).map(([id, promo]) => ({ id, ...promo }))
            : [];
    }
    
    static async getActive() {
        const all = await this.getAll();
        const now = new Date();
        return all.filter(promo => 
            promo.active && 
            new Date(promo.startDate) <= now && 
            new Date(promo.endDate) >= now
        );
    }
    
    static async create(promoData) {
        const newPromo = {
            ...promoData,
            usageCount: 0,
            createdAt: new Date().toISOString()
        };
        const result = await firebasePost(this.basePath, newPromo);
        return { id: result.name, ...newPromo };
    }
    
    static async update(id, updateData) {
        await firebasePut(`${this.basePath}/${id}`, updateData);
        return { id, ...updateData };
    }
    
    static async delete(id) {
        return firebaseDelete(`${this.basePath}/${id}`);
    }
}

/**
 * Reservations API
 */
class ReservationsAPI {
    static basePath = 'reservations';
    
    static async getAll() {
        const data = await firebaseGet(this.basePath);
        return data 
            ? Object.entries(data)
                .map(([id, res]) => ({ id, ...res }))
                .sort((a, b) => new Date(a.date + ' ' + a.time) - new Date(b.date + ' ' + b.time))
            : [];
    }
    
    static async getToday() {
        const all = await this.getAll();
        const today = new Date().toISOString().split('T')[0];
        return all.filter(res => res.date === today);
    }
    
    static async create(reservationData) {
        const newReservation = {
            ...reservationData,
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        const result = await firebasePost(this.basePath, newReservation);
        
        // Create notification
        await NotificationsAPI.create({
            title: 'حجز جديد',
            message: `حجز جديد من ${reservationData.customerName} لـ ${reservationData.guests} أشخاص`,
            type: 'reservation',
            data: { reservationId: result.name }
        });
        
        return { id: result.name, ...newReservation };
    }
    
    static async updateStatus(id, status) {
        await firebasePatch(`${this.basePath}/${id}`, { status });
        return { id, status };
    }
    
    static async update(id, updateData) {
        await firebasePatch(`${this.basePath}/${id}`, updateData);
        return { id, ...updateData };
    }
    
    static async delete(id) {
        return firebaseDelete(`${this.basePath}/${id}`);
    }
}

/**
 * Notifications API
 */
class NotificationsAPI {
    static basePath = 'notifications';
    
    static async getAll() {
        const data = await firebaseGet(this.basePath);
        return data 
            ? Object.entries(data)
                .map(([id, notif]) => ({ id, ...notif }))
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            : [];
    }
    
    static async getUnread() {
        const all = await this.getAll();
        return all.filter(n => !n.read);
    }
    
    static async create(notificationData) {
        const newNotification = {
            ...notificationData,
            read: false,
            createdAt: new Date().toISOString()
        };
        const result = await firebasePost(this.basePath, newNotification);
        return { id: result.name, ...newNotification };
    }
    
    static async markAsRead(id) {
        await firebasePatch(`${this.basePath}/${id}`, { read: true });
        return { id, read: true };
    }
    
    static async markAllAsRead() {
        const unread = await this.getUnread();
        const updates = {};
        unread.forEach(notif => {
            updates[`${this.basePath}/${notif.id}/read`] = true;
        });
        if (Object.keys(updates).length > 0) {
            await firebasePatch('', updates);
        }
        return unread.length;
    }
    
    static async delete(id) {
        return firebaseDelete(`${this.basePath}/${id}`);
    }
    
    static async getUnreadCount() {
        const unread = await this.getUnread();
        return unread.length;
    }
}

/**
 * Settings API
 */
class SettingsAPI {
    static basePath = 'settings';
    
    static async get() {
        const data = await firebaseGet(this.basePath);
        return data || SettingsType;
    }
    
    static async update(settingsData) {
        await firebasePut(this.basePath, settingsData);
        return settingsData;
    }
    
    static async updatePartial(settingsData) {
        await firebasePatch(this.basePath, settingsData);
        return settingsData;
    }
}

/**
 * Dashboard API
 */
class DashboardAPI {
    static async getStats() {
        const [orders, menuItems, reservations, promotions] = await Promise.all([
            OrdersAPI.getStats(),
            MenuItemsAPI.getAll(),
            ReservationsAPI.getToday(),
            PromotionsAPI.getActive()
        ]);
        
        return {
            orders: orders,
            menuItems: {
                total: menuItems.length,
                available: menuItems.filter(i => i.available).length
            },
            reservations: {
                today: reservations.length
            },
            promotions: {
                active: promotions.length
            },
            recentOrders: await OrdersAPI.getRecent(5),
            topItems: menuItems
                .sort((a, b) => (b.orderCount || 0) - (a.orderCount || 0))
                .slice(0, 5)
        };
    }
}

// ============================================
// Image Upload (Direct to R2 or via Worker)
// ============================================

/**
 * Upload image to storage
 * Supports both direct upload and Worker proxy
 */
async function uploadImage(file, path = 'images') {
    // For now, convert to base64 and store reference
    // In production, use R2 or Firebase Storage
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64 = e.target.result;
            
            if (isWorkerMode) {
                // Upload via Worker to R2
                try {
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('path', path);
                    
                    const response = await fetch(`${CONFIG.workerURL}/api/upload`, {
                        method: 'POST',
                        body: formData
                    });
                    
                    if (!response.ok) throw new Error('Upload failed');
                    const data = await response.json();
                    resolve(data.url);
                } catch (error) {
                    reject(error);
                }
            } else {
                // Store base64 in Firebase (for demo/small images)
                // In production, limit size or use proper storage
                resolve(base64);
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Compress image before upload
 */
function compressImage(file, maxWidth = 1024, quality = 0.85) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob(
                    (blob) => {
                        resolve(new File([blob], file.name, { type: 'image/jpeg' }));
                    },
                    'image/jpeg',
                    quality
                );
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// ============================================
// AI Analysis API (via Worker)
// ============================================

/**
 * Analyze menu image using AI
 */
async function analyzeMenuImage(imageBase64, options = {}) {
    if (isWorkerMode) {
        // Use Worker AI endpoint
        const response = await fetch(`${CONFIG.workerURL}/api/ai/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image: imageBase64,
                category: options.category || '',
                currency: options.currency || 'EGP'
            })
        });
        
        if (!response.ok) throw new Error('AI analysis failed');
        return response.json();
    } else {
        // Direct AI API call (requires CORS or same-origin)
        throw new Error('AI analysis requires Worker mode. Please deploy the Cloudflare Worker.');
    }
}

// ============================================
// Export for use in app.js
// ============================================
window.MezoMenuAPI = {
    // API Classes
    MenuItems: MenuItemsAPI,
    Categories: CategoriesAPI,
    Orders: OrdersAPI,
    Promotions: PromotionsAPI,
    Reservations: ReservationsAPI,
    Notifications: NotificationsAPI,
    Settings: SettingsAPI,
    Dashboard: DashboardAPI,
    
    // Utilities
    uploadImage,
    compressImage,
    analyzeMenuImage,
    
    // Config
    config: CONFIG,
    isWorkerMode
};
