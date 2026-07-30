/* ===================================
   MezoMenu - Main JavaScript
   Firebase + R2 + Worker Integration
   =================================== */

// ==========================================
// Configuration
// ==========================================

const CONFIG = {
    // Worker API URL (Change this to your Cloudflare Worker URL)
    WORKER_URL: 'https://menu.nonm1724.workers.dev',
    
    // Firebase Configuration
    FIREBASE: {
        apiKey: "AIzaSyB9SyGG0MNGWU-bmMVZVJITW0bxDbbkB94",
        authDomain: "menu-b41e6.firebaseapp.com",
        databaseURL: "https://menu-b41e6-default-rtdb.firebaseio.com",
        projectId: "menu-b41e6",
        storageBucket: "menu-b41e6.firebasestorage.app",
        messagingSenderId: "912801475897",
        appId: "1:912801475897:web:4b35f7a144b7c2cc3b4ce8"
    },
    
    // App Settings
    APP_NAME: 'MezoMenu',
    DEFAULT_CURRENCY: 'EGP',
    DEFAULT_LANGUAGE: 'ar'
};

// ==========================================
// State Management
// ==========================================

const AppState = {
    user: null,
    restaurant: null,
    menu: { categories: [], items: [] },
    cart: [],
    currentLanguage: CONFIG.DEFAULT_LANGUAGE,
    isLoading: false,
    isOnline: navigator.onLine,
    lastSyncTime: null
};

// ==========================================
// Firebase Database Helper
// ==========================================

const FirebaseDB = {
    
    /**
     * Get data from Firebase path
     */
    async get(path) {
        try {
            const url = `${CONFIG.FIREBASE.databaseURL}/${path}.json`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Firebase GET error:', error);
            return null;
        }
    },
    
    /**
     * Set data at path (PUT)
     */
    async set(path, data) {
        try {
            const url = `${CONFIG.FIREBASE.databaseURL}/${path}.json`;
            const response = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return response.ok;
        } catch (error) {
            console.error('Firebase SET error:', error);
            return false;
        }
    },
    
    /**
     * Update data at path (PATCH)
     */
    async update(path, data) {
        try {
            const existingData = await this.get(path);
            const updatedData = { ...existingData, ...data };
            return await this.set(path, updatedData);
        } catch (error) {
            console.error('Firebase UPDATE error:', error);
            return false;
        }
    },
    
    /**
     * Push new data (POST)
     */
    async push(path, data) {
        try {
            const url = `${CONFIG.FIREBASE.databaseURL}/${path}.json`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (response.ok) {
                const result = await response.json();
                return result.name; // Returns the new key
            }
            return null;
        } catch (error) {
            console.error('Firebase PUSH error:', error);
            return null;
        }
    },
    
    /**
     * Delete data at path
     */
    async delete(path) {
        try {
            const url = `${CONFIG.FIREBASE.databaseURL}/${path}.json`;
            const response = await fetch(url, { method: 'DELETE' });
            return response.ok;
        } catch (error) {
            console.error('Firebase DELETE error:', error);
            return false;
        }
    }
};

// ==========================================
// API Service (Worker Backend)
// ==========================================

const ApiService = {
    
    /**
     * Make API request to Worker
     */
    async request(endpoint, options = {}) {
        try {
            const url = `${CONFIG.WORKER_URL}${endpoint}`;
            const response = await fetch(url, {
                headers: { 
                    'Content-Type': 'application/json',
                    ...options.headers 
                },
                ...options
            });
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || `API Error: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API Request error:', error);
            throw error;
        }
    },
    
    // Dashboard
    async getDashboardStats() {
        return this.request('/api/dashboard');
    },
    
    // Menu
    async getMenu() {
        return this.request('/api/menu');
    },
    
    async createMenuItem(data) {
        return this.request('/api/menu', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    
    async updateMenuItem(id, data) {
        return this.request('/api/menu', {
            method: 'PUT',
            body: JSON.stringify({ id, ...data })
        });
    },
    
    async deleteMenuItem(id) {
        return this.request(`/api/menu?id=${id}`, {
            method: 'DELETE'
        });
    },
    
    // Orders
    async getOrders(filters = {}) {
        const params = new URLSearchParams(filters).toString();
        return this.request(`/api/orders?${params}`);
    },
    
    async createOrder(data) {
        return this.request('/api/orders', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    
    async updateOrderStatus(id, status) {
        return this.request('/api/orders', {
            method: 'PUT',
            body: JSON.stringify({ id, status })
        });
    },
    
    // Settings
    async getSettings() {
        return this.request('/api/settings');
    },
    
    async updateSettings(data) {
        return this.request('/api/settings', {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },
    
    // Promotions
    async getPromotions() {
        return this.request('/api/promotions');
    },
    
    async createPromotion(data) {
        return this.request('/api/promotions', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    
    // Upload
    async uploadImage(file, type = 'menu-item') {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);
        
        return this.request('/api/upload', {
            method: 'POST',
            body: formData,
            headers: {} // Let browser set content-type for FormData
        });
    },
    
    // AI Analysis
    async analyzeMenu(file) {
        const formData = new FormData();
        formData.append('file', file);
        
        return this.request('/api/ai/analyze', {
            method: 'POST',
            body: formData,
            headers: {}
        });
    }
};

// ==========================================
// Menu Items Management
// ==========================================

const MenuManager = {
    
    /**
     * Get all categories and items
     */
    async getAll() {
        const [categories, items] = await Promise.all([
            FirebaseDB.get('menu/categories'),
            FirebaseDB.get('menu/items')
        ]);
        
        AppState.menu.categories = categories || {};
        AppState.menu.items = items || {};
        
        return {
            categories: AppState.menu.categories,
            items: AppState.menu.items
        };
    },
    
    /**
     * Add new category
     */
    async addCategory(categoryData) {
        const category = {
            name: categoryData.name,
            icon: categoryData.icon || '🍽️',
            order: Object.keys(AppState.menu.categories).length,
            active: true,
            createdAt: Date.now()
        };
        
        const id = await FirebaseDB.push('menu/categories', category);
        if (id) {
            AppState.menu.categories[id] = { id, ...category };
        }
        
        return id;
    },
    
    /**
     * Update category
     */
    async updateCategory(id, updates) {
        const success = await FirebaseDB.update(`menu/categories/${id}`, updates);
        if (success && AppState.menu.categories[id]) {
            Object.assign(AppState.menu.categories[id], updates);
        }
        return success;
    },
    
    /**
     * Delete category
     */
    async deleteCategory(id) {
        const success = await FirebaseDB.delete(`menu/categories/${id}`);
        if (success) {
            delete AppState.menu.categories[id];
        }
        return success;
    },
    
    /**
     * Add new item
     */
    async addItem(itemData) {
        const item = {
            name: itemData.name,
            description: itemData.description || '',
            price: itemData.price,
            category: itemData.category,
            image: itemData.image || '',
            available: itemData.available !== false,
            popular: itemData.popular || false,
            preparationTime: itemData.preparationTime || 15,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        
        const id = await FirebaseDB.push('menu/items', item);
        if (id) {
            AppState.menu.items[id] = { id, ...item };
        }
        
        return id;
    },
    
    /**
     * Update item
     */
    async updateItem(id, updates) {
        const success = await FirebaseDB.update(
            `menu/items/${id}`, 
            { ...updates, updatedAt: Date.now() }
        );
        if (success && AppState.menu.items[id]) {
            Object.assign(AppState.menu.items[id], updates);
        }
        return success;
    },
    
    /**
     * Delete item
     */
    async deleteItem(id) {
        const success = await FirebaseDB.delete(`menu/items/${id}`);
        if (success) {
            delete AppState.menu.items[id];
        }
        return success;
    },
    
    /**
     * Get items by category
     */
    getItemsByCategory(categoryId) {
        const items = {};
        Object.entries(AppState.menu.items).forEach(([id, item]) => {
            if (item.category === categoryId) {
                items[id] = item;
            }
        });
        return items;
    }
};

// ==========================================
// Orders Management
// ==========================================

const OrdersManager = {
    
    /**
     * Get all orders
     */
    async getAll() {
        const orders = await FirebaseDB.get('orders');
        return orders || {};
    },
    
    /**
     * Create new order
     */
    async create(orderData) {
        const order = {
            customerName: orderData.customerName,
            customerPhone: orderData.customerPhone,
            customerEmail: orderData.customerEmail || '',
            items: orderData.items || [],
            totalAmount: orderData.totalAmount || 0,
            status: 'pending',
            paymentMethod: orderData.paymentMethod || 'cash',
            paymentStatus: 'pending',
            notes: orderData.notes || '',
            tableNumber: orderData.tableNumber,
            deliveryAddress: orderData.deliveryAddress,
            orderType: orderData.orderType || 'dine-in',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        
        const id = await FirebaseDB.push('orders', order);
        
        // Create notification
        if (id) {
            await NotificationsManager.create({
                title: { ar: 'طلب جديد', en: 'New Order' },
                message: { 
                    ar: `طلب جديد من ${order.customerName}`, 
                    en: `New order from ${order.customerName}` 
                },
                type: 'order',
                read: false,
                targetRole: 'admin',
                link: `orders.html?id=${id}`
            });
        }
        
        return id ? { id, ...order } : null;
    },
    
    /**
     * Update order status
     */
    async updateStatus(orderId, status) {
        return FirebaseDB.update(`orders/${orderId}`, {
            status,
            updatedAt: Date.now()
        });
    },
    
    /**
     * Delete order
     */
    async delete(orderId) {
        return FirebaseDB.delete(`orders/${orderId}`);
    },
    
    /**
     * Get today's orders
     */
    async getToday() {
        const allOrders = await this.getAll();
        const today = new Date().toDateString();
        
        const todayOrders = {};
        Object.entries(allOrders).forEach(([id, order]) => {
            if (new Date(order.createdAt).toDateString() === today) {
                todayOrders[id] = order;
            }
        });
        
        return todayOrders;
    },
    
    /**
     * Get stats
     */
    async getStats() {
        const allOrders = await this.getAll();
        const ordersList = Object.values(allOrders);
        
        const totalOrders = ordersList.length;
        const totalRevenue = ordersList
            .filter(o => o.paymentStatus === 'paid')
            .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        
        const uniqueCustomers = new Set(ordersList.map(o => o.customerPhone)).size;
        const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
        
        // Orders by status
        const ordersByStatus = {};
        ordersList.forEach(order => {
            ordersByStatus[order.status] = (ordersByStatus[order.status] || 0) + 1;
        });
        
        // Today's stats
        const today = new Date().toDateString();
        const todayOrders = ordersList.filter(o => 
            new Date(o.createdAt).toDateString() === today
        );
        const todayRevenue = todayOrders
            .filter(o => o.paymentStatus === 'paid')
            .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        
        return {
            totalOrders,
            totalRevenue,
            totalCustomers: uniqueCustomers,
            averageOrderValue,
            ordersByStatus,
            todayOrders: todayOrders.length,
            todayRevenue,
            recentOrders: ordersList
                .sort((a, b) => b.createdAt - a.createdAt)
                .slice(0, 10)
        };
    }
};

// ==========================================
// Settings Manager
// ==========================================

const SettingsManager = {
    
    /**
     * Get restaurant settings
     */
    async get() {
        let settings = await FirebaseDB.get('settings/restaurant');
        
        if (!settings) {
            settings = this.getDefaultSettings();
        }
        
        AppState.restaurant = settings;
        return settings;
    },
    
    /**
     * Get default settings
     */
    getDefaultSettings() {
        return {
            name: { ar: 'مطعم المبروك', en: 'Al-Mabrouk Restaurant' },
            description: { ar: 'أفضل مطعم في المنطقة', en: 'Best restaurant in town' },
            logo: '',
            coverImage: '',
            phone: '+201234567890',
            whatsapp: '+201234567890',
            email: 'info@mezomenu.com',
            address: { ar: 'القاهرة، مصر', en: 'Cairo, Egypt' },
            currency: CONFIG.DEFAULT_CURRENCY,
            language: CONFIG.DEFAULT_LANGUAGE,
            workingHours: {
                open: '10:00',
                close: '23:00',
                days: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']
            },
            socialMedia: {},
            features: {
                reservations: true,
                delivery: true,
                takeaway: true,
                qrOrdering: true
            },
            theme: {
                primaryColor: '#ff6b35',
                secondaryColor: '#f7931e'
            }
        };
    },
    
    /**
     * Update settings
     */
    async update(settings) {
        const success = await FirebaseDB.set('settings/restaurant', settings);
        if (success) {
            AppState.restaurant = settings;
        }
        return success;
    }
};

// ==========================================
// Notifications Manager
// ==========================================

const NotificationsManager = {
    
    /**
     * Get all notifications
     */
    async getAll() {
        const notifications = await FirebaseDB.get('notifications');
        return notifications || {};
    },
    
    /**
     * Get unread count
     */
    async getUnreadCount() {
        const all = await this.getAll();
        return Object.values(all).filter(n => !n.read).length;
    },
    
    /**
     * Create notification
     */
    async create(notificationData) {
        const notification = {
            title: notificationData.title,
            message: notificationData.message,
            type: notificationData.type || 'info',
            read: false,
            targetRole: notificationData.targetRole || 'all',
            createdAt: Date.now(),
            link: notificationData.link || ''
        };
        
        return FirebaseDB.push('notifications', notification);
    },
    
    /**
     * Mark as read
     */
    async markAsRead(id) {
        return FirebaseDB.update(`notifications/${id}`, { read: true });
    },
    
    /**
     * Mark all as read
     */
    async markAllAsRead() {
        const all = await this.getAll();
        const updates = {};
        Object.keys(all).forEach(key => {
            updates[key] = true;
        });
        return FirebaseDB.set('notifications', all);
    },
    
    /**
     * Delete notification
     */
    async delete(id) {
        return FirebaseDB.delete(`notifications/${id}`);
    }
};

// ==========================================
// Promotions Manager
// ==========================================

const PromotionsManager = {
    
    /**
     * Get all promotions
     */
    async getAll() {
        const promotions = await FirebaseDB.get('promotions');
        return promotions || {};
    },
    
    /**
     * Get active promotions
     */
    async getActive() {
        const all = await this.getAll();
        const now = Date.now();
        const active = {};
        
        Object.entries(all).forEach(([key, promo]) => {
            if (promo.active && 
                new Date(promo.startDate).getTime() <= now && 
                new Date(promo.endDate).getTime() >= now) {
                active[key] = promo;
            }
        });
        
        return active;
    },
    
    /**
     * Create promotion
     */
    async create(promoData) {
        const promotion = {
            title: promoData.title,
            description: promoData.description,
            discountType: promoData.discountType || 'percentage',
            discountValue: promoData.discountValue,
            startDate: promoData.startDate,
            endDate: promoData.endDate,
            code: promoData.code || '',
            minOrderAmount: promoData.minOrderAmount,
            active: promoData.active !== false,
            image: promoData.image || '',
            createdAt: Date.now()
        };
        
        return FirebaseDB.push('promotions', promotion);
    },
    
    /**
     * Update promotion
     */
    async update(id, updates) {
        return FirebaseDB.update(`promotions/${id}`, updates);
    },
    
    /**
     * Delete promotion
     */
    async delete(id) {
        return FirebaseDB.delete(`promotions/${id}`);
    }
};

// ==========================================
// Reservations Manager
// ==========================================

const ReservationsManager = {
    
    /**
     * Get all reservations
     */
    async getAll() {
        const reservations = await FirebaseDB.get('reservations');
        return reservations || {};
    },
    
    /**
     * Create reservation
     */
    async create(reservationData) {
        const reservation = {
            customerName: reservationData.customerName,
            customerPhone: reservationData.customerPhone,
            customerEmail: reservationData.customerEmail || '',
            date: reservationData.date,
            time: reservationData.time,
            guests: reservationData.guests,
            status: 'pending',
            notes: reservationData.notes || '',
            tableNumber: reservationData.tableNumber,
            createdAt: Date.now()
        };
        
        const id = await FirebaseDB.push('reservations', reservation);
        
        // Create notification
        if (id) {
            await NotificationsManager.create({
                title: { ar: 'حجز جديد', en: 'New Reservation' },
                message: { 
                    ar: `حجز جديد من ${reservationData.customerName}`, 
                    en: `New reservation from ${reservationData.customerName}` 
                },
                type: 'info',
                targetRole: 'admin',
                link: `reservations.html?id=${id}`
            });
        }
        
        return id;
    },
    
    /**
     * Update reservation
     */
    async update(id, updates) {
        return FirebaseDB.update(`reservations/${id}`, updates);
    },
    
    /**
     * Delete reservation
     */
    async delete(id) {
        return FirebaseDB.delete(`reservations/${id}`);
    }
};

// ==========================================
// Image Compression Utility
// ==========================================

const ImageUtils = {
    
    /**
     * Compress image to max dimensions and quality
     */
    compress(file, maxWidth = 1024, quality = 0.85) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const canvas = document.createElement('canvas');
            
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                
                // Calculate new dimensions
                if (width > height && width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                } else if (height > maxWidth) {
                    width = Math.round((width * maxWidth) / height);
                    height = maxWidth;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    canvas.toBlob(
                        (blob) => {
                            if (blob) {
                                const compressedFile = new File([blob], file.name, {
                                    type: 'image/jpeg',
                                    lastModified: Date.now()
                                });
                                resolve(compressedFile);
                            } else {
                                reject(new Error('Failed to compress image'));
                            }
                        },
                        'image/jpeg',
                        quality
                    );
                }
            };
            
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = URL.createObjectURL(file);
        });
    },
    
    /**
     * Convert File to Base64
     */
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
};

// ==========================================
// AI Analysis Service
// ==========================================

const AIAnalyzer = {
    
    /**
     * Analyze menu image with multi-provider fallback
     */
    async analyzeImage(file) {
        try {
            // Compress image first
            console.log('[AI] Compressing image...');
            const compressedFile = await ImageUtils.compress(file, 1024, 0.85);
            const base64 = await ImageUtils.fileToBase64(compressedFile);
            
            console.log(`[AI] Image compressed. Size: ${(base64.length * 3 / 4 / 1024).toFixed(1)}KB`);
            
            // Send to Worker for analysis
            const result = await ApiService.analyzeMenu(compressedFile);
            
            if (result.success) {
                return {
                    success: true,
                    data: result.data,
                    provider: result.provider || 'unknown'
                };
            } else {
                throw new Error(result.error || 'Analysis failed');
            }
            
        } catch (error) {
            console.error('[AI] Analysis error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },
    
    /**
     * Import extracted data to menu
     */
    async importToMenu(analysisResult) {
        if (!analysisResult || !analysisResult.categories) {
            throw new Error('No data to import');
        }
        
        let importedItems = 0;
        
        for (const category of analysisResult.categories) {
            // Create category
            const categoryId = await MenuManager.addCategory({
                name: category.name,
                icon: category.icon || '🍽️'
            });
            
            if (categoryId) {
                // Create items in this category
                for (const item of category.items) {
                    await MenuManager.addItem({
                        name: item.name,
                        description: item.description || { ar: '', en: '' },
                        price: item.price,
                        category: categoryId,
                        available: item.available !== false
                    });
                    importedItems++;
                }
            }
        }
        
        return importedItems;
    }
};

// ==========================================
// UI Utilities
// ==========================================

const UI = {
    
    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        const container = document.querySelector('.toast-container') || this.createToastContainer();
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <i class="fas fa-${this.getToastIcon(type)}"></i>
            <span>${message}</span>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },
    
    createToastContainer() {
        const container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
        return container;
    },
    
    getToastIcon(type) {
        const icons = {
            success: 'check-circle',
            danger: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    },
    
    /**
     * Format currency
     */
    formatCurrency(amount, currency = null) {
        const curr = currency || AppState.restaurant?.currency || CONFIG.DEFAULT_CURRENCY;
        return `${parseFloat(amount || 0).toFixed(2)} ${curr}`;
    },
    
    /**
     * Format date
     */
    formatDate(timestamp, locale = 'ar-EG') {
        return new Date(timestamp).toLocaleDateString(locale, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },
    
    /**
     * Show loading state
     */
    showLoading(element, text = 'جاري التحميل...') {
        if (element) {
            element.innerHTML = `
                <div class="loading-overlay">
                    <div>
                        <div class="spinner"></div>
                        <p style="margin-top: 1rem;">${text}</p>
                    </div>
                </div>
            `;
        }
    },
    
    /**
     * Hide loading state
     */
    hideLoading(element, originalContent = '') {
        if (element) {
            element.innerHTML = originalContent;
        }
    },
    
    /**
     * Confirm action
     */
    confirm(message) {
        return confirm(message);
    },
    
    /**
     * Debounce function
     */
    debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};

// ==========================================
// Auth Helpers (Basic)
// ==========================================

const Auth = {
    
    /**
     * Check if user is logged in
     */
    isLoggedIn() {
        return localStorage.getItem('mezomenu_user') !== null;
    },
    
    /**
     * Get current user
     */
    getUser() {
        const userData = localStorage.getItem('mezomenu_user');
        return userData ? JSON.parse(userData) : null;
    },
    
    /**
     * Save user session
     */
    saveUser(user) {
        localStorage.setItem('mezomenu_user', JSON.stringify(user));
    },
    
    /**
     * Clear user session
     */
    logout() {
        localStorage.removeItem('mezomenu_user');
        window.location.href = 'login.html';
    },
    
    /**
     * Require auth (redirect if not logged in)
     */
    requireAuth() {
        if (!this.isLoggedIn()) {
            window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
            return false;
        }
        return true;
    }
};

// ==========================================
// Initialize Firebase SDK
// ==========================================

function initFirebase() {
    // Load Firebase SDK from CDN
    const scripts = [
        'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js',
        'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js',
        'https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js'
    ];
    
    let loaded = 0;
    
    return new Promise((resolve, reject) => {
        scripts.forEach(src => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => {
                loaded++;
                if (loaded === scripts.length) {
                    // Initialize Firebase
                    if (!firebase.apps.length) {
                        firebase.initializeApp(CONFIG.FIREBASE);
                    }
                    resolve(firebase);
                }
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    });
}

// ==========================================
// Export for use
// ==========================================

// Make available globally
window.MezoMenu = {
    CONFIG,
    AppState,
    FirebaseDB,
    ApiService,
    MenuManager,
    OrdersManager,
    SettingsManager,
    NotificationsManager,
    PromotionsManager,
    ReservationsManager,
    ImageUtils,
    AIAnalyzer,
    UI,
    Auth,
    initFirebase
};

console.log('%c🍽️ MezoMenu Loaded!', 'color: #ff6b35; font-size: 16px; font-weight: bold;');
