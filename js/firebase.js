/**
 * MezoMenu - Firebase Configuration & API Integration
 * Uses Firebase Realtime Database REST API
 * 
 * ⚠️ مهم: قبل الاستخدام، تأكد من:
 * 1. إنشاء مشروع Firebase
 * 2. تفعيل Realtime Database
 * 3. تغيير قواعد الأمان للسماح بالوصول (للتطوير)
 */

// ============================================
// 🔧 CONFIGURATION - غيّر هذه القيم
// ============================================

const FIREBASE_CONFIG = {
    // 🔴 REQUIRED: ضع رابط قاعدة بيانات Firebase هنا
    // مثال: 'https://your-project-id-default-rtdb.firebaseio.com'
    DATABASE_URL: 'https://menu-b41e6-default-rtdb.firebaseio.com',
    
    // 🔵 OPTIONAL: مفتاح API إذا كانت قواعد الأمان تتطلب مصادقة
    // احصل عليه من: Firebase Console > Project Settings > General > Web API Key
    API_KEY: '',
    
    // 🟢 وضع التشغيل: 'direct' أو 'worker'
    MODE: 'direct' // استخدم 'worker' عند نشر Cloudflare Worker
};

// ============================================
// Auto-configuration
// ============================================

// Base URL for Firebase requests
const FIREBASE_BASE_URL = FIREBASE_CONFIG.DATABASE_URL;

/**
 * Build URL with optional authentication
 */
function buildFirebaseUrl(path) {
    let url = `${FIREBASE_BASE_URL}/${path}.json`;
    
    // Add API key if available (for authenticated access)
    if (FIREBASE_CONFIG.API_KEY) {
        url += `?access_token=${FIREBASE_CONFIG.API_KEY}`;
    }
    
    return url;
}

// ============================================
// Firebase REST API Helper Functions
// ============================================

/**
 * Generic fetch wrapper for Firebase REST API
 * With proper error handling and debugging
 */
async function firebaseRequest(path, options = {}) {
    const url = buildFirebaseUrl(path);
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    try {
        console.log(`[Firebase] ${options.method || 'GET'} ${url}`);
        
        const response = await fetch(url, mergedOptions);
        
        // Handle specific HTTP errors
        if (response.status === 401) {
            throw new FirebaseError('AUTH_REQUIRED', `
                ❌ خطأ في المصادقة (401)
                
                الحلول الممكنة:
                1. افتح Firebase Console > Realtime Database > Rules
                2. غيّر القواعد إلى:
                
                   {
                     "rules": {
                       ".read": true,
                       ".write": true
                     }
                   }
                   
                3. انقر "Publish"
                
                أو أضف API_KEY في إعدادات FIREBASE_CONFIG
            `);
        }
        
        if (response.status === 404) {
            throw new FirebaseError('NOT_FOUND', `المسار غير موجود: ${path}`);
        }
        
        if (response.status === 403) {
            throw new FirebaseError('FORBIDDEN', `ممنوع الوصول. تحقق من قواعد الأمان.`);
        }
        
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }
        
        // Handle empty responses (e.g., DELETE returns null)
        const text = await response.text();
        return text && text !== 'null' ? JSON.parse(text) : null;
        
    } catch (error) {
        // Re-throw Firebase errors as-is
        if (error instanceof FirebaseError) {
            throw error;
        }
        
        // Wrap other errors
        console.error('[Firebase] Request Error:', error);
        throw new FirebaseError('NETWORK_ERROR', error.message);
    }
}

/**
 * Custom Firebase Error class
 */
class FirebaseError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'FirebaseError';
        this.code = code;
    }
}

// ============================================
// CRUD Operations
// ============================================

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
    const result = await firebaseRequest(path, {
        method: 'POST',
        body: JSON.stringify(data)
    });
    return result; // Returns { name: "newId" }
}

/**
 * PUT - Update/Replace data at specific path
 */
async function firebasePut(path, data) {
    await firebaseRequest(path, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
    return data;
}

/**
 * PATCH - Partial update of data
 */
async function firebasePatch(path, data) {
    await firebaseRequest(path, {
        method: 'PATCH',
        body: JSON.stringify(data)
    });
    return data;
}

/**
 * DELETE - Remove data at specific path
 */
async function firebaseDelete(path) {
    await firebaseRequest(path, { method: 'DELETE' });
    return true;
}

// ============================================
// Data Models & Types
// ============================================

const MenuItemType = {
    id: null,
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

const CategoryType = {
    id: null,
    name: '',
    description: '',
    icon: 'fa-utensils',
    image: '',
    order: 0,
    createdAt: null
};

const OrderType = {
    id: null,
    customerName: '',
    customerPhone: '',
    items: [],
    total: 0,
    status: 'pending',
    notes: '',
    address: '',
    createdAt: null,
    updatedAt: null
};

const PromotionType = {
    id: null,
    title: '',
    description: '',
    type: 'percentage',
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

const ReservationType = {
    id: null,
    customerName: '',
    phone: '',
    date: '',
    time: '',
    guests: 1,
    status: 'confirmed',
    notes: '',
    createdAt: null
};

const NotificationType = {
    id: null,
    title: '',
    message: '',
    type: 'system',
    read: false,
    data: {},
    createdAt: null
};

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
        if (!data) return [];
        return Object.entries(data).map(([id, item]) => ({ 
            id, 
            ...item,
            price: Number(item.price) || 0,
            orderCount: Number(item.orderCount) || 0
        }));
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
        if (!data) return [];
        return Object.entries(data).map(([id, cat]) => ({ 
            id, 
            ...cat,
            order: Number(cat.order) || 0
        }));
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
        if (!data) return [];
        return Object.entries(data)
            .map(([id, order]) => ({ 
                id, 
                ...order,
                total: Number(order.total) || 0
            }))
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
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
        try {
            await NotificationsAPI.create({
                title: 'طلب جديد',
                message: `طلب جديد #${result.name} من ${orderData.customerName}`,
                type: 'order',
                data: { orderId: result.name }
            });
        } catch (e) {
            console.warn('Could not create notification:', e);
        }
        
        return { id: result.name, ...newOrder };
    }
    
    static async updateStatus(id, status) {
        const updateData = {
            status,
            updatedAt: new Date().toISOString()
        };
        
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
        if (!data) return [];
        return Object.entries(data).map(([id, promo]) => ({ 
            id, 
            ...promo,
            value: Number(promo.value) || 0,
            usageCount: Number(promo.usageCount) || 0
        }));
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
        if (!data) return [];
        return Object.entries(data)
            .map(([id, res]) => ({ id, ...res }))
            .sort((a, b) => new Date(a.date + ' ' + a.time) - new Date(b.date + ' ' + b.time));
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
        
        try {
            await NotificationsAPI.create({
                title: 'حجز جديد',
                message: `حجز جديد من ${reservationData.customerName} لـ ${reservationData.guests} أشخاص`,
                type: 'reservation',
                data: { reservationId: result.name }
            });
        } catch (e) {
            console.warn('Could not create notification:', e);
        }
        
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
        if (!data) return [];
        return Object.entries(data)
            .map(([id, notif]) => ({ id, ...notif }))
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
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
        for (const notif of unread) {
            await this.markAsRead(notif.id);
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
        return data || { ...SettingsType };
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
            OrdersAPI.getStats().catch(() => ({ total: 0, revenue: 0 })),
            MenuItemsAPI.getAll().catch(() => []),
            ReservationsAPI.getToday().catch(() => []),
            PromotionsAPI.getActive().catch(() => [])
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
// Image Upload & Compression
// ============================================

/**
 * Compress image before upload
 * @param {File} file - Image file to compress
 * @param {number} maxWidth - Maximum width in pixels
 * @param {number} quality - JPEG quality (0-1)
 * @returns {Promise<File>} Compressed file
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
                
                // Calculate new dimensions
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

/**
 * Upload image (converts to base64 for Firebase storage)
 * For production, use R2 or Firebase Storage instead
 */
async function uploadImage(file, path = 'images') {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Analyze menu image using AI (via Worker)
 */
async function analyzeMenuImage(imageBase64, options = {}) {
    // Check if we're in worker mode
    if (FIREBASE_CONFIG.MODE === 'worker') {
        const workerURL = window.location.origin;
        const response = await fetch(`${workerURL}/api/ai/analyze`, {
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
        throw new Error(
            '⚠️ تحليل الصور يتطلب نشر Cloudflare Worker\n\n' +
            '1. انشر Worker باستخدام: wrangler deploy\n' +
            '2. غيّر MODE إلى "worker" في FIREBASE_CONFIG'
        );
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
    config: FIREBASE_CONFIG,
    
    // Error class
    FirebaseError
};

// Log configuration status
console.log(`%c[MezoMenu] Firebase Config Loaded`, 'color: #FF6B35; font-weight: bold');
console.log(`  Database URL: ${FIREBASE_CONFIG.DATABASE_URL}`);
console.log(`  Mode: ${FIREBASE_CONFIG.MODE}`);
console.log(`  API Key: ${FIREBASE_CONFIG.API_KEY ? '✓ Set' : '✗ Not set'}`);

// Show setup instructions if no API key
if (!FIREBASE_CONFIG.API_KEY) {
    console.log(`%c⚠️ تلميح: إذا واجهت خطأ 401، تأكد من قواعد أمان Firebase`, 'color: #FDCB6E;');
}
