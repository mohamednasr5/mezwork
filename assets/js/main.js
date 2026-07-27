/* ===================================
   MezoMenu SaaS - Main JavaScript
   Functions & Utilities - REAL DATABASE INTEGRATION
   =================================== */

// ==========================================
// Configuration - Connected to Live Worker
// ==========================================
const CONFIG = {
    API_URL: 'https://menu.nonm1724.workers.dev',
    FIREBASE_DB: 'https://menu-b41e6-default-rtdb.firebaseio.com',
    DEFAULT_CURRENCY: 'EGP',
    DEFAULT_LANGUAGE: 'ar',
    NVIDIA_API_KEY: '', // Set your NVIDIA API key here or in environment
    FIREBASE_CONFIG: {
        databaseURL: 'https://menu-b41e6-default-rtdb.firebaseio.com'
    }
};

// ==========================================
// State Management
// ==========================================
const AppState = {
    user: null,
    restaurant: null,
    menu: { categories: [], items: [] },
    cart: [],
    currentLanguage: 'ar',
    isLoading: false,
    isOnline: navigator.onLine,
    lastSyncTime: null
};

// ==========================================
// Firebase Realtime Database Direct Connection
// ==========================================
const FirebaseDB = {
    
    /**
     * Get data from Firebase path
     */
    async get(path) {
        try {
            const url = `${CONFIG.FIREBASE_DB}/${path}.json`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Firebase GET error:', error);
            return null;
        }
    },

    /**
     * Set data at Firebase path (requires auth)
     */
    async set(path, data, token = null) {
        try {
            const url = `${CONFIG.FIREBASE_DB}/${path}.json`;
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            
            const response = await fetch(url, {
                method: 'PUT',
                headers,
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Firebase SET error:', error);
            throw error;
        }
    },

    /**
     * Push new data to Firebase path
     */
    async push(path, data, token = null) {
        try {
            const url = `${CONFIG.FIREBASE_DB}/${path}.json`;
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Firebase PUSH error:', error);
            throw error;
        }
    },

    /**
     * Update data at Firebase path (PATCH)
     */
    async update(path, data, token = null) {
        try {
            const url = `${CONFIG.FIREBASE_DB}/${path}.json`;
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            
            const response = await fetch(url, {
                method: 'PATCH',
                headers,
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Firebase UPDATE error:', error);
            throw error;
        }
    },

    /**
     * Delete data from Firebase path
     */
    async remove(path, token = null) {
        try {
            const url = `${CONFIG.FIREBASE_DB}/${path}.json`;
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            
            const response = await fetch(url, {
                method: 'DELETE',
                headers
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return true;
        } catch (error) {
            console.error('Firebase REMOVE error:', error);
            throw error;
        }
    },

    /**
     * Query with ordering and filtering
     */
    async query(path, orderBy, equalTo, limitToFirst = null) {
        try {
            let url = `${CONFIG.FIREBASE_DB}/${path}.json?orderBy="${orderBy}"&equalTo="${equalTo}"`;
            if (limitToFirst) url += `&limitToFirst=${limitToFirst}`;
            
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Firebase QUERY error:', error);
            return null;
        }
    },

    /**
     * Listen for real-time changes (polling-based for REST API)
     */
    onValue(path, callback, intervalMs = 5000) {
        let lastData = null;
        
        const poll = async () => {
            try {
                const data = await this.get(path);
                if (JSON.stringify(data) !== JSON.stringify(lastData)) {
                    lastData = data;
                    callback(data);
                }
            } catch (error) {
                console.error('Polling error:', error);
            }
        };

        // Initial call
        poll();
        
        // Set up polling
        return setInterval(poll, intervalMs);
    }
};

// ==========================================
// Worker API Integration
// ==========================================
const WorkerAPI = {
    
    /**
     * Login with email/password via Worker
     */
    async login(email, password) {
        const response = await fetch(`${CONFIG.API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        return await response.json();
    },

    /**
     * Register new user via Worker
     */
    async register(userData) {
        const response = await fetch(`${CONFIG.API_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        return await response.json();
    },

    /**
     * Get menu data via Worker
     */
    async getMenu(restaurantId) {
        const response = await fetch(`${CONFIG.API_URL}/api/menu?restaurantId=${restaurantId}`);
        return await response.json();
    },

    /**
     * Save menu data via Worker
     */
    async saveMenu(menuData, token) {
        const response = await fetch(`${CONFIG.API_URL}/api/menu`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(menuData)
        });
        return await response.json();
    },

    /**
     * Upload file via Worker
     */
    async uploadFile(file, type = 'image') {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);

        const response = await fetch(`${CONFIG.API_URL}/api/upload`, {
            method: 'POST',
            body: formData
        });
        return await response.json();
    },

    /**
     * AI Analyze image via Worker
     */
    async analyzeImage(imageUrl, type = 'menu') {
        const response = await fetch(`${CONFIG.API_URL}/api/ai/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl, type })
        });
        return await response.json();
    },

    /**
     * AI Chat completion via Worker
     */
    async chat(message, context = '') {
        const response = await fetch(`${CONFIG.API_URL}/api/ai/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, context })
        });
        return await response.json();
    },

    /**
     * Generate image via AI
     */
    async generateImage(prompt) {
        const response = await fetch(`${CONFIG.API_URL}/api/ai/image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });
        return await response.json();
    },

    /**
     * Check AI service status
     */
    async checkAIStatus() {
        try {
            const response = await fetch(`${CONFIG.API_URL}/api/ai/status`);
            return await response.json();
        } catch (error) {
            return { success: false, status: 'offline', error: error.message };
        }
    },

    /**
     * Get orders for restaurant
     */
    async getOrders(restaurantId) {
        const response = await fetch(`${CONFIG.API_URL}/api/orders?restaurantId=${restaurantId}`);
        return await response.json();
    },

    /**
     * Update order status
     */
    async updateOrderStatus(orderId, status, token) {
        const response = await fetch(`${CONFIG.API_URL}/api/orders/${orderId}/status`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status })
        });
        return await response.json();
    },

    /**
     * Get notifications
     */
    async getNotifications(restaurantId) {
        const response = await fetch(`${CONFIG.API_URL}/api/notifications?restaurantId=${restaurantId}`);
        return await response.json();
    },

    /**
     * Get restaurant settings
     */
    async getRestaurant(restaurantId) {
        const response = await fetch(`${CONFIG.API_URL}/api/restaurants/${restaurantId}`);
        return await response.json();
    },

    /**
     * Save restaurant settings
     */
    async saveRestaurant(restaurantId, data, token) {
        const response = await fetch(`${CONFIG.API_URL}/api/restaurants/${restaurantId}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });
        return await response.json();
    }
};

// ==========================================
// NVIDIA AI Integration (Alternative AI Provider)
// ==========================================
const NVIDIA_AI = {
    
    /**
     * Chat completion using NVIDIA API
     */
    async chat(messages, model = 'meta/llama3-70b-instruct') {
        if (!CONFIG.NVIDIA_API_KEY) {
            console.warn('NVIDIA API key not configured');
            return null;
        }

        try {
            const response = await fetch(
                'https://integrate.api.nvidia.com/v1/chat/completions',
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${CONFIG.NVIDIA_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model,
                        messages,
                        max_tokens: 1024,
                        temperature: 0.7
                    })
                }
            );

            if (!response.ok) {
                throw new Error(`NVIDIA API error: ${response.status}`);
            }

            const data = await response.json();
            return data.choices[0]?.message?.content;
        } catch (error) {
            console.error('NVIDIA AI error:', error);
            throw error;
        }
    },

    /**
     * Image analysis using NVIDIA VILA model
     */
    async analyzeImage(imageBase64, prompt = 'Describe this menu image in detail') {
        if (!CONFIG.NVIDIA_API_KEY) {
            console.warn('NVIDIA API key not configured');
            return null;
        }

        try {
            const response = await fetch(
                'https://integrate.api.nvidia.com/v1/chat/completions',
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${CONFIG.NVIDIA_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'nvidia/neva-22b',
                        messages: [
                            {
                                role: 'user',
                                content: [
                                    { type: 'text', text: prompt },
                                    { type: 'image_url', image_url: { url: imageBase64 } }
                                ]
                            }
                        ],
                        max_tokens: 2048
                    })
                }
            );

            if (!response.ok) {
                throw new Error(`NVIDIA API error: ${response.status}`);
            }

            const data = await response.json();
            return data.choices[0]?.message?.content;
        } catch (error) {
            console.error('NVIDIA Image Analysis error:', error);
            throw error;
        }
    }
};

// ==========================================
// Authentication System
// ==========================================
const Auth = {
    
    /**
     * Login user
     */
    async login(email, password) {
        showLoading('جاري تسجيل الدخول...');
        
        try {
            const result = await WorkerAPI.login(email, password);
            
            if (result.success && result.data) {
                // Store auth data
                AppState.user = result.data.user;
                localStorage.setItem('user', JSON.stringify(result.data.user));
                localStorage.setItem('authToken', result.data.token || '');
                
                if (result.data.user?.restaurantId) {
                    localStorage.setItem('restaurantId', result.data.user.restaurantId);
                    // Load restaurant data
                    await this.loadRestaurantData(result.data.user.restaurantId);
                }
                
                hideLoading();
                showNotification('success', 'تم تسجيل الدخول بنجاح!');
                
                return { success: true, user: result.data.user };
            } else {
                hideLoading();
                showNotification('error', result.error || 'فشل تسجيل الدخول');
                return { success: false, error: result.error };
            }
        } catch (error) {
            hideLoading();
            showNotification('error', 'حدث خطأ: ' + error.message);
            return { success: false, error: error.message };
        }
    },

    /**
     * Register new user
     */
    async register(userData) {
        showLoading('جاري إنشاء الحساب...');
        
        try {
            const result = await WorkerAPI.register({
                ...userData,
                createdAt: new Date().toISOString()
            });
            
            if (result.success && result.data) {
                // Auto-login after registration
                AppState.user = result.data.user;
                localStorage.setItem('user', JSON.stringify(result.data.user));
                localStorage.setItem('authToken', result.data.token || '');
                
                if (result.data.user?.restaurantId) {
                    localStorage.setItem('restaurantId', result.data.user.restaurantId);
                }
                
                hideLoading();
                showNotification('success', 'تم إنشاء الحساب بنجاح!');
                
                return { success: true, user: result.data.user };
            } else {
                hideLoading();
                showNotification('error', result.error || 'فشل إنشاء الحساب');
                return { success: false, error: result.error };
            }
        } catch (error) {
            hideLoading();
            showNotification('error', 'حدث خطأ: ' + error.message);
            return { success: false, error: error.message };
        }
    },

    /**
     * Gmail/Google OAuth registration helper
     */
    async registerWithGoogle(idToken) {
        showLoading('جاري التسجيل بحساب Google...');
        
        try {
            const result = await fetch(`${CONFIG.API_URL}/api/auth/google`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken })
            });
            
            const data = await result.json();
            
            if (data.success) {
                AppState.user = data.user;
                localStorage.setItem('user', JSON.stringify(data.user));
                localStorage.setItem('authToken', data.token || '');
                
                hideLoading();
                showNotification('success', 'تم التسجيل بحساب Google بنجاح!');
                return { success: true, user: data.user };
            } else {
                hideLoading();
                showNotification('error', data.error || 'فشل التسجيل');
                return { success: false, error: data.error };
            }
        } catch (error) {
            hideLoading();
            showNotification('error', 'حدث خطأ: ' + error.message);
            return { success: false, error: error.message };
        }
    },

    /**
     * Load restaurant data after login
     */
    async loadRestaurantData(restaurantId) {
        try {
            const restaurantData = await FirebaseDB.get(`restaurants/${restaurantId}`);
            if (restaurantData) {
                AppState.restaurant = restaurantData;
                localStorage.setItem('restaurant', JSON.stringify(restaurantData));
            }
            
            // Load menu data
            const menuData = await FirebaseDB.get(`menus/${restaurantId}`);
            if (menuData) {
                AppState.menu = menuData;
            }
        } catch (error) {
            console.error('Error loading restaurant data:', error);
        }
    },

    /**
     * Logout user
     */
    logout() {
        AppState.user = null;
        AppState.restaurant = null;
        AppState.menu = { categories: [], items: [] };
        
        localStorage.removeItem('user');
        localStorage.removeItem('authToken');
        localStorage.removeItem('restaurantId');
        localStorage.removeItem('restaurant');
        sessionStorage.clear();
        
        window.location.href = 'login.html';
    },

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        const token = localStorage.getItem('authToken');
        const user = localStorage.getItem('user');
        return !!(token && user);
    },

    /**
     * Get current user
     */
    getCurrentUser() {
        if (!AppState.user) {
            const userData = localStorage.getItem('user');
            if (userData) {
                AppState.user = JSON.parse(userData);
            }
        }
        return AppState.user;
    },

    /**
     * Get auth token
     */
    getToken() {
        return localStorage.getItem('authToken') || '';
    }
};

// ==========================================
// Dashboard Data Service (Real-time from Firebase)
// ==========================================
const DashboardService = {
    
    /**
     * Fetch real dashboard statistics from Firebase
     */
    async getStats(restaurantId) {
        if (!restaurantId) {
            const user = Auth.getCurrentUser();
            restaurantId = user?.restaurantId || localStorage.getItem('restaurantId') || 'default';
        }

        try {
            // Parallel fetch all data
            const [orders, menu, restaurant, analytics] = await Promise.all([
                FirebaseDB.get(`orders/${restaurantId}`),
                FirebaseDB.get(`menus/${restaurantId}`),
                FirebaseDB.get(`restaurants/${restaurantId}`),
                FirebaseDB.get(`analytics/${restaurantId}`)
            ]);

            // Process orders
            const ordersList = orders ? Object.entries(orders).map(([id, order]) => ({
                id,
                ...order
            })) : [];

            // Calculate stats
            const stats = {
                // Order stats
                totalOrders: ordersList.length,
                pendingOrders: ordersList.filter(o => o.status === 'pending').length,
                confirmedOrders: ordersList.filter(o => o.status === 'confirmed').length,
                preparingOrders: ordersList.filter(o => o.status === 'preparing').length,
                readyOrders: ordersList.filter(o => o.status === 'ready').length,
                deliveredOrders: ordersList.filter(o => o.status === 'delivered').length,
                cancelledOrders: ordersList.filter(o => o.status === 'cancelled').length,

                // Revenue calculation
                totalRevenue: ordersList
                    .filter(o => o.status === 'delivered')
                    .reduce((sum, o) => sum + (o.total || o.amount || 0), 0),
                
                todayRevenue: ordersList
                    .filter(o => {
                        const today = new Date().toDateString();
                        return o.createdAt && new Date(o.createdAt).toDateString() === today && o.status === 'delivered';
                    })
                    .reduce((sum, o) => sum + (o.total || o.amount || 0), 0),

                // Customer stats
                uniqueCustomers: [...new Set(ordersList.map(o => o.customerEmail || o.customerPhone))].length,
                
                // Menu stats
                totalCategories: menu?.categories?.length || 0,
                totalItems: menu?.categories?.reduce((sum, cat) => sum + (cat.items?.length || 0), 0) || 0,

                // Restaurant info
                restaurantName: restaurant?.name || 'المطعم',
                rating: restaurant?.rating || 0,
                views: analytics?.totalViews || analytics?.views || 0,
                
                // Recent activity
                recentOrders: ordersList
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .slice(0, 10),

                // Trend calculations (compare to previous period)
                revenueTrend: this.calculateTrend(analytics?.revenueHistory || []),
                ordersTrend: this.calculateTrend(analytics?.ordersHistory || [])
            };

            return { success: true, stats };
        } catch (error) {
            console.error('Dashboard stats error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Calculate trend percentage
     */
    calculateTrend(historyArray) {
        if (!historyArray || historyArray.length < 2) return 0;
        const len = historyArray.length;
        const current = historyArray[len - 1];
        const previous = historyArray[len - 2];
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
    },

    /**
     * Get real-time updates listener
     */
    subscribeToUpdates(restaurantId, callback) {
        return FirebaseDB.onValue(`restaurants/${restaurantId}`, callback, 10000);
    }
};

// ==========================================
// Orders Service (Real-time from Firebase)
// ==========================================
const OrdersService = {
    
    /**
     * Fetch real orders from Firebase
     */
    async getOrders(restaurantId) {
        if (!restaurantId) {
            const user = Auth.getCurrentUser();
            restaurantId = user?.restaurantId || localStorage.getItem('restaurantId') || 'default';
        }

        try {
            const orders = await FirebaseDB.get(`orders/${restaurantId}`);
            
            if (orders) {
                const ordersList = Object.entries(orders).map(([id, order]) => ({
                    id,
                    ...order
                }));
                
                return { 
                    success: true, 
                    orders: ordersList.sort((a, b) => 
                        new Date(b.createdAt || b.timestamp) - new Date(a.createdAt || a.timestamp)
                    )
                };
            }
            
            return { success: true, orders: [] };
        } catch (error) {
            console.error('Get orders error:', error);
            return { success: false, error: error.message, orders: [] };
        }
    },

    /**
     * Create new order
     */
    async createOrder(orderData, restaurantId) {
        if (!restaurantId) {
            restaurantId = Auth.getCurrentUser()?.restaurantId || localStorage.getItem('restaurantId');
        }

        try {
            const order = {
                ...orderData,
                id: 'ORD' + Date.now(),
                status: 'pending',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const result = await FirebaseDB.push(`orders/${restaurantId}`, order, Auth.getToken());
            
            return { success: true, orderId: result.name, order };
        } catch (error) {
            console.error('Create order error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Update order status
     */
    async updateStatus(orderId, newStatus, restaurantId) {
        if (!restaurantId) {
            restaurantId = Auth.getCurrentUser()?.restaurantId || localStorage.getItem('restaurantId');
        }

        try {
            await FirebaseDB.update(
                `orders/${restaurantId}/${orderId}`,
                { status: newStatus, updatedAt: new Date().toISOString() },
                Auth.getToken()
            );
            
            return { success: true };
        } catch (error) {
            console.error('Update order status error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Get single order details
     */
    async getOrderDetails(orderId, restaurantId) {
        if (!restaurantId) {
            restaurantId = Auth.getCurrentUser()?.restaurantId || localStorage.getItem('restaurantId');
        }

        try {
            const order = await FirebaseDB.get(`orders/${restaurantId}/${orderId}`);
            
            if (order) {
                return { success: true, order: { id: orderId, ...order } };
            }
            
            return { success: false, error: 'Order not found' };
        } catch (error) {
            console.error('Get order details error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Subscribe to real-time order updates
     */
    subscribeToNewOrders(restaurantId, callback) {
        return FirebaseDB.onValue(`orders/${restaurantId}`, (data) => {
            if (data) {
                const orders = Object.entries(data).map(([id, order]) => ({
                    id,
                    ...order
                }));
                callback(orders);
            }
        }, 5000); // Poll every 5 seconds
    }
};

// ==========================================
// Notifications Service (Real-time)
// ==========================================
const NotificationsService = {
    
    /**
     * Fetch real notifications
     */
    async getNotifications(restaurantId) {
        if (!restaurantId) {
            restaurantId = Auth.getCurrentUser()?.restaurantId || localStorage.getItem('restaurantId') || 'default';
        }

        try {
            const notifications = await FirebaseDB.get(`notifications/${restaurantId}`);
            
            if (notifications) {
                const notifList = Object.entries(notifications).map(([id, notif]) => ({
                    id,
                    ...notif
                }));
                
                return { 
                    success: true, 
                    notifications: notifList.sort((a, b) => 
                        new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || a.createdAt)
                    )
                };
            }
            
            return { success: true, notifications: [] };
        } catch (error) {
            console.error('Get notifications error:', error);
            return { success: false, error: error.message, notifications: [] };
        }
    },

    /**
     * Create notification
     */
    async createNotification(notificationData, restaurantId) {
        if (!restaurantId) {
            restaurantId = Auth.getCurrentUser()?.restaurantId || localStorage.getItem('restaurantId');
        }

        try {
            const notification = {
                ...notificationData,
                id: generateId(),
                timestamp: new Date().toISOString(),
                read: false
            };

            await FirebaseDB.push(`notifications/${restaurantId}`, notification);
            
            return { success: true, notification };
        } catch (error) {
            console.error('Create notification error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Mark notification as read
     */
    async markAsRead(notificationId, restaurantId) {
        if (!restaurantId) {
            restaurantId = Auth.getCurrentUser()?.restaurantId || localStorage.getItem('restaurantId');
        }

        try {
            await FirebaseDB.update(
                `notifications/${restaurantId}/${notificationId}`,
                { read: true },
                Auth.getToken()
            );
            
            return { success: true };
        } catch (error) {
            console.error('Mark as read error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Mark all as read
     */
    async markAllAsRead(restaurantId) {
        if (!restaurantId) {
            restaurantId = Auth.getCurrentUser()?.restaurantId || localStorage.getItem('restaurantId');
        }

        try {
            const result = await FirebaseDB.get(`notifications/${restaurantId}`);
            
            if (result) {
                const updates = {};
                Object.keys(result).forEach(key => {
                    updates[`${key}/read`] = true;
                });
                
                await FirebaseDB.update(`notifications/${restaurantId}`, updates, Auth.getToken());
            }
            
            return { success: true };
        } catch (error) {
            console.error('Mark all as read error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Auto-generate order notification
     */
    async generateOrderNotification(order) {
        return this.createNotification({
            type: 'orders',
            title: `طلب جديد #${order.id}`,
            message: `لقد تلقيت طلباً جديداً من ${order.customerName} بمبلغ ${formatCurrency(order.total)}`,
            actionUrl: 'orders.html',
            priority: 'high'
        });
    }
};

// ==========================================
// Utility Functions
// ==========================================

/**
 * Format currency
 */
function formatCurrency(amount, currency = CONFIG.DEFAULT_CURRENCY) {
    const symbols = { EGP: 'ج.م', USD: '$', SAR: 'ر.س', AED: 'د.إ' };
    return `${Number(amount).toFixed(2)} ${symbols[currency] || currency}`;
}

/**
 * Format date/time in Arabic
 */
function formatDateTime(dateString) {
    if (!dateString) return '---';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '---';
    
    const options = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return date.toLocaleDateString('ar-EG', options);
}

/**
 * Format short date
 */
function formatDateShort(dateString) {
    if (!dateString) return '---';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '---';
    
    return date.toLocaleDateString('ar-EG', {
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Generate unique ID
 */
function generateId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Debounce function
 */
function debounce(func, wait) {
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

/**
 * Show loading overlay
 */
function showLoading(message = 'جاري التحميل...') {
    AppState.isLoading = true;
    let loader = document.getElementById('loadingOverlay');
    
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'loadingOverlay';
        loader.innerHTML = `
            <div class="loader-content">
                <div class="spinner"></div>
                <p class="loader-message">${message}</p>
            </div>
        `;
        document.body.appendChild(loader);
    }
    
    loader.querySelector('.loader-message').textContent = message;
    loader.classList.add('active');
}

/**
 * Hide loading overlay
 */
function hideLoading() {
    AppState.isLoading = false;
    const loader = document.getElementById('loadingOverlay');
    if (loader) {
        loader.classList.remove('active');
    }
}

/**
 * Show notification toast
 */
function showNotification(type, message, duration = 4000) {
    // Remove existing notifications
    const existing = document.querySelector('.notification-toast');
    if (existing) existing.remove();

    const icons = {
        success: 'check-circle',
        error: 'times-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };

    const toast = document.createElement('div');
    toast.className = `notification-toast ${type}`;
    toast.innerHTML = `
        <i class="fas fa-${icons[type] || 'info-circle'}"></i>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
    `;

    document.body.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Auto-remove
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * Show confirmation dialog
 */
function showConfirm(title, message, onConfirm, onCancel) {
    const modal = document.createElement('div');
    modal.className = 'confirm-modal-overlay';
    modal.innerHTML = `
        <div class="confirm-modal">
            <h3><i class="fas fa-exclamation-triangle"></i> ${title}</h3>
            <p>${message}</p>
            <div class="confirm-actions">
                <button class="btn btn-danger" id="confirmYes">تأكيد</button>
                <button class="btn btn-secondary" id="confirmNo">إلغاء</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('confirmYes').onclick = () => {
        modal.remove();
        if (onConfirm) onConfirm();
    };

    document.getElementById('confirmNo').onclick = () => {
        modal.remove();
        if (onCancel) onCancel();
    };
}

/**
 * Get restaurant ID from storage
 */
function getRestaurantIdFromStorage() {
    const user = Auth.getCurrentUser();
    return user?.restaurantId || localStorage.getItem('restaurantId') || 'default';
}

/**
 * Get auth token
 */
function getAuthToken() {
    return Auth.getToken();
}

/**
 * Time ago formatter
 */
function getTimeAgo(timestamp) {
    if (!timestamp) return 'الآن';
    
    const now = new Date();
    const date = new Date(timestamp);
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'الآن';
    
    const intervals = [
        { label: 'دقيقة', seconds: 60, plural: 'دقائق' },
        { label: 'ساعة', seconds: 3600, plural: 'ساعات' },
        { label: 'يوم', seconds: 86400, plural: 'أيام' },
        { label: 'أسبوع', seconds: 604800, plural: 'أسابيع' },
        { label: 'شهر', seconds: 2592000, plural: 'أشهر' }
    ];

    for (const interval of intervals) {
        const count = Math.floor(seconds / interval.seconds);
        if (count >= 1) {
            return count === 1 ? `منذ ${interval.label}` : `منذ ${count} ${interval.plural}`;
        }
    }

    return formatDateTime(timestamp);
}

/**
 * Validate email
 */
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate phone (Egyptian format)
 */
function isValidPhone(phone) {
    return /^(\+20|0)?1[0-25][0-9]{8}$/.test(phone.replace(/\s/g, ''));
}

/**
 * URL validator
 */
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

/**
 * Copy to clipboard
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showNotification('success', 'تم النسخ!');
    } catch (error) {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showNotification('success', 'تم النسخ!');
    }
}

/**
 * Print element
 */
function printElement(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const win = window.open('', '_blank');
    win.document.write(`
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <title>طباعة</title>
            <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
            <style>
                body { font-family: 'Cairo', sans-serif; padding: 20px; direction: rtl; }
                @media print { body { padding: 0; } }
            </style>
        </head>
        <body>${element.innerHTML}</body>
        </html>
    `);
    win.document.close();
    win.print();
}

/**
 * Download as JSON
 */
function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Initialize app common functionality
 */
function initApp() {
    // Check online status
    window.addEventListener('online', () => {
        AppState.isOnline = true;
        showNotification('success', 'تم استعادة الاتصال بالإنترنت');
    });

    window.addEventListener('offline', () => {
        AppState.isOnline = false;
        showNotification('warning', 'لا يوجد اتصال بالإنترنت');
    });

    // Restore user session
    if (Auth.isAuthenticated()) {
        Auth.getCurrentUser();
        const restaurantId = localStorage.getItem('restaurantId');
        if (restaurantId) {
            Auth.loadRestaurantData(restaurantId);
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);

// Export for use in other modules
window.CONFIG = CONFIG;
window.AppState = AppState;
window.FirebaseDB = FirebaseDB;
window.WorkerAPI = WorkerAPI;
window.NVIDIA_AI = NVIDIA_AI;
window.Auth = Auth;
window.DashboardService = DashboardService;
window.OrdersService = OrdersService;
window.NotificationsService = NotificationsService;
