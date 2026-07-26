/**
 * MezoMenu - Firebase Configuration
 * Realtime Database Setup
 */

// Firebase Configuration
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || "YOUR_API_KEY",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "YOUR_PROJECT.firebaseapp.com",
    databaseURL: process.env.FIREBASE_DATABASE_URL || "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
    projectId: process.env.FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "YOUR_PROJECT.appspot.com",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "YOUR_SENDER_ID",
    appId: process.env.FIREBASE_APP_ID || "YOUR_APP_ID"
};

// Initialize Firebase (if not already initialized)
let firebaseApp;
let db;
let auth;

try {
    if (typeof firebase !== 'undefined') {
        firebaseApp = firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        auth = firebase.auth();
        console.log('✅ Firebase initialized successfully');
    } else {
        console.warn('⚠️ Firebase SDK not loaded. Using fallback mode.');
    }
} catch (error) {
    if (error.code === 'app/duplicate-app') {
        firebaseApp = firebase.app();
        db = firebaseApp.database();
        auth = firebaseApp.auth();
    } else {
        console.error('❌ Firebase initialization error:', error);
    }
}

// ========================================
// Database References Helper
// ========================================

/**
 * Get restaurant-specific database reference
 * Ensures complete isolation between restaurants
 * @param {string} restaurantId - The restaurant's unique ID
 * @param {string} path - Additional path within the restaurant's data
 * @returns {firebase.database.Reference}
 */
function getRestaurantRef(restaurantId, path = '') {
    if (!db) return null;
    
    const basePath = `restaurants/${restaurantId}`;
    const fullPath = path ? `${basePath}/${path}` : basePath;
    
    return db.ref(fullPath);
}

/**
 * Get public menu reference (for customer PWA)
 * @param {string} slug - Restaurant's URL slug
 * @returns {firebase.database.Reference}
 */
function getMenuRef(slug) {
    if (!db) return null;
    return db.ref(`public_menus/${slug}`);
}

// ========================================
// Authentication Helpers
// ========================================

/**
 * Register new restaurant owner
 * @param {string} email 
 * @param {string} password 
 * @param {object} userData - Additional user data
 * @returns {Promise}
 */
async function registerUser(email, password, userData = {}) {
    if (!auth) {
        // Fallback for development without Firebase
        console.log('📝 Registration (dev mode):', email);
        return { user: { uid: 'dev_user_' + Date.now() } };
    }

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Store additional user data
        await db.ref(`users/${user.uid}`).set({
            email,
            displayName: userData.fullName || '',
            phone: userData.phone || '',
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            ...userData
        });

        return userCredential;
    } catch (error) {
        console.error('Registration error:', error);
        throw error;
    }
}

/**
 * Login existing user
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise}
 */
async function loginUser(email, password) {
    if (!auth) {
        // Fallback for development
        console.log('🔐 Login (dev mode):', email);
        localStorage.setItem('mezomenu_user', JSON.stringify({
            uid: 'dev_user_1',
            email: email,
            displayName: 'أحمد محمد',
            restaurantId: 'restaurant_1'
        }));
        return { user: { uid: 'dev_user_1' } };
    }

    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        
        // Get user's restaurant ID
        const snapshot = await db.ref(`users/${userCredential.user.uid}/restaurantId`).once('value');
        if (snapshot.exists()) {
            localStorage.setItem('mezomenu_restaurant_id', snapshot.val());
        }

        return userCredential;
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
}

/**
 * Logout current user
 * @returns {Promise}
 */
async function logoutUser() {
    if (auth) {
        await auth.signOut();
    }
    
    // Clear local storage
    localStorage.removeItem('mezomenu_user');
    localStorage.removeItem('mezomenu_restaurant_id');
    localStorage.removeItem('mezomenu_auth_token');
    
    window.location.href = '../login.html';
}

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
function isAuthenticated() {
    if (auth && auth.currentUser) {
        return true;
    }
    
    // Check local storage for dev mode
    return !!localStorage.getItem('mezomenu_user');
}

/**
 * Get current user data
 * @returns {object|null}
 */
function getCurrentUser() {
    if (auth && auth.currentUser) {
        return auth.currentUser;
    }
    
    // Return from local storage (dev mode)
    const userData = localStorage.getItem('mezomenu_user');
    return userData ? JSON.parse(userData) : null;
}

/**
 * Get current restaurant ID
 * @returns {string|null}
 */
function getRestaurantId() {
    return localStorage.getItem('mezomenu_restaurant_id') || 'restaurant_1';
}

// ========================================
// Data Operations
// ========================================

/**
 * Fetch restaurant data
 * @param {string} restaurantId 
 * @returns {Promise<object>}
 */
async function fetchRestaurantData(restaurantId) {
    if (!db) {
        // Mock data for development
        return getMockRestaurantData();
    }

    try {
        const snapshot = await getRestaurantRef(restaurantId).once('value');
        return snapshot.val() || {};
    } catch (error) {
        console.error('Error fetching restaurant data:', error);
        return {};
    }
}

/**
 * Update restaurant data
 * @param {string} restaurantId 
 * @param {object} data 
 * @returns {Promise}
 */
async function updateRestaurantData(restaurantId, data) {
    if (!db) {
        console.log('💾 Update (dev mode):', data);
        return true;
    }

    try {
        await getRestaurantRef(restaurantId).update(data);
        return true;
    } catch (error) {
        console.error('Error updating restaurant data:', error);
        throw error;
    }
}

/**
 * Add menu item
 * @param {string} restaurantId 
 * @param {object} item 
 * @returns {Promise<string>} - New item ID
 */
async function addMenuItem(restaurantId, item) {
    if (!db) {
        console.log('➕ Add menu item (dev mode):', item);
        return 'item_' + Date.now();
    }

    try {
        const newItemRef = getRestaurantRef(restaurantId, 'menu/items').push();
        await newItemRef.set({
            ...item,
            id: newItemRef.key,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            updatedAt: firebase.database.ServerValue.TIMESTAMP
        });
        return newItemRef.key;
    } catch (error) {
        console.error('Error adding menu item:', error);
        throw error;
    }
}

/**
 * Update menu item
 * @param {string} restaurantId 
 * @param {string} itemId 
 * @param {object} updates 
 * @returns {Promise}
 */
async function updateMenuItem(restaurantId, itemId, updates) {
    if (!db) {
        console.log('✏️ Update menu item (dev mode):', itemId, updates);
        return true;
    }

    try {
        await getRestaurantRef(restaurantId, `menu/items/${itemId}`).update({
            ...updates,
            updatedAt: firebase.database.ServerValue.TIMESTAMP
        });
        return true;
    } catch (error) {
        console.error('Error updating menu item:', error);
        throw error;
    }
}

/**
 * Delete menu item
 * @param {string} restaurantId 
 * @param {string} itemId 
 * @returns {Promise}
 */
async function deleteMenuItem(restaurantId, itemId) {
    if (!db) {
        console.log('🗑️ Delete menu item (dev mode):', itemId);
        return true;
    }

    try {
        await getRestaurantRef(restaurantId, `menu/items/${itemId}`).remove();
        return true;
    } catch (error) {
        console.error('Error deleting menu item:', error);
        throw error;
    }
}

/**
 * Add category
 * @param {string} restaurantId 
 * @param {object} category 
 * @returns {Promise<string>}
 */
async function addCategory(restaurantId, category) {
    if (!db) {
        console.log('📁 Add category (dev mode):', category);
        return 'cat_' + Date.now();
    }

    try {
        const newCatRef = getRestaurantRef(restaurantId, 'menu/categories').push();
        await newCatRef.set({
            ...category,
            id: newCatRef.key,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        });
        return newCatRef.key;
    } catch (error) {
        console.error('Error adding category:', error);
        throw error;
    }
}

/**
 * Fetch orders for a restaurant
 * @param {string} restaurantId 
 * @param {number} limit - Number of orders to fetch
 * @returns {Promise<Array>}
 */
async function fetchOrders(restaurantId, limit = 50) {
    if (!db) {
        return getMockOrders();
    }

    try {
        const snapshot = await getRestaurantRef(restaurantId, 'orders')
            .orderByChild('createdAt')
            .limitToLast(limit)
            .once('value');
        
        const orders = [];
        snapshot.forEach(child => {
            orders.push({ id: child.key, ...child.val() });
        });
        return orders.reverse();
    } catch (error) {
        console.error('Error fetching orders:', error);
        return [];
    }
}

/**
 * Update order status
 * @param {string} restaurantId 
 * @param {string} orderId 
 * @param {string} status 
 * @returns {Promise}
 */
async function updateOrderStatus(restaurantId, orderId, status) {
    if (!db) {
        console.log('📦 Update order status (dev mode):', orderId, status);
        return true;
    }

    try {
        await getRestaurantRef(restaurantId, `orders/${orderId}`).update({
            status,
            updatedAt: firebase.database.ServerValue.TIMESTAMP
        });

        // Send notification about status change
        await sendOrderNotification(restaurantId, orderId, status);

        return true;
    } catch (error) {
        console.error('Error updating order status:', error);
        throw error;
    }
}

// ========================================
// Real-time Listeners
// ======================================== */

/**
 * Listen for new orders in real-time
 * @param {string} restaurantId 
 * @param {Function} callback 
 */
function listenForNewOrders(restaurantId, callback) {
    if (!db) {
        console.log('👂 Listening for orders (dev mode)');
        return () => {};
    }

    const ref = getRestaurantRef(restaurantId, 'orders')
        .orderByChild('createdAt')
        .limitToLast(1);

    ref.on('child_added', (snapshot) => {
        callback({ id: snapshot.key, ...snapshot.val() });
    });

    return () => ref.off('child_added');
}

/**
 * Listen for menu changes
 * @param {string} restaurantId 
 * @param {Function} callback 
 */
function listenToMenuChanges(restaurantId, callback) {
    if (!db) {
        return () => {};
    }

    const ref = getRestaurantRef(restaurantId, 'menu');
    ref.on('value', (snapshot) => {
        callback(snapshot.val());
    });

    return () => ref.off('value');
}

// ========================================
// Notifications
// ========================================

/**
 * Send order notification via push notification
 * @param {string} restaurantId 
 * @param {string} orderId 
 * @param {string} status 
 */
async function sendOrderNotification(restaurantId, orderId, status) {
    // This would integrate with FCM or Web Push API
    console.log(`🔔 Notification: Order ${orderId} is now ${status}`);
    
    // Request permission and send browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('تحديث الطلب', {
            body: `تم تحديث حالة الطلب #${orderId} إلى ${status}`,
            icon: '/icons/icon-192.png'
        });
    }
}

// ========================================
// Mock Data for Development
// ========================================

function getMockRestaurantData() {
    return {
        id: 'restaurant_1',
        name: 'مطعم الخليج',
        nameEn: 'Al Khaleej Restaurant',
        slug: 'al-khaleej',
        description: 'مطعم شرقي أصيل يقدم أشهى المأكولات العربية والشرقية',
        logo: '🍕',
        coverImage: null,
        cuisineType: 'arabic',
        address: 'القاهرة، شارع العباس، بجوار ميدان الجيش',
        city: 'cairo',
        phone: '+201234567890',
        whatsappNumber: '+201234567890',
        currency: 'EGP',
        currencySymbol: 'ج.م',
        plan: 'pro',
        isActive: true,
        createdAt: Date.now(),
        settings: {
            enableWhatsApp: true,
            enableNotifications: true,
            language: 'ar',
            theme: 'default'
        },
        menu: {
            categories: [
                { id: 'cat_1', name: 'المقبلات', order: 1 },
                { id: 'cat_2', name: 'الأطباق الرئيسية', order: 2 },
                { id: 'cat_3', name: 'المشروبات', order: 3 },
                { id: 'cat_4', name: 'الحلويات', order: 4 }
            ],
            items: [
                {
                    id: 'item_1',
                    name: 'بيتزا مارجريتا',
                    description: 'صلصة طماطم، موزاريلا، ريحان طازج',
                    price: 85,
                    categoryId: 'cat_2',
                    image: null,
                    emoji: '🍕',
                    isAvailable: true,
                    isPopular: true
                },
                {
                    id: 'item_2',
                    name: 'برجر لحم',
                    'description': 'لحم بقري 100%، خس، طماطم، صلصة خاصة',
                    price: 95,
                    categoryId: 'cat_2',
                    image: null,
                    emoji: '🍔',
                    isAvailable: true,
                    isPopular: true
                },
                {
                    id: 'item_3',
                    name: 'سلطة سيزر',
                    description: 'خس، كرانشي، بارميزان، صلصة سيزر',
                    price: 55,
                    categoryId: 'cat_1',
                    image: null,
                    emoji: '🥗',
                    isAvailable: true,
                    isPopular: true
                }
            ]
        }
    };
}

function getMockOrders() {
    return [
        {
            id: 'ord_1024',
            orderId: '#ORD-1024',
            customerName: 'محمد علي',
            customerPhone: '+201011111111',
            items: [
                { itemId: 'item_1', name: 'بيتزا مارجريتا', quantity: 1, price: 85 },
                { itemId: 'item_2', name: 'برجر لحم', quantity: 1, price: 95 },
                { itemId: 'item_5', name: 'عصير مانجو', quantity: 1, price: 35 }
            ],
            total: 215,
            status: 'pending',
            paymentMethod: 'cash',
            notes: 'بدون بصل في البرجر',
            createdAt: Date.now() - 1800000,
            updatedAt: Date.now() - 1800000
        },
        {
            id: 'ord_1023',
            orderId: '#ORD-1023',
            customerName: 'سارة أحمد',
            customerPhone: '+201022222222',
            items: [
                { itemId: 'item_1', name: 'بيتزا مارجريتا', quantity: 2, price: 170 },
                { itemId: 'item_6', name: 'باستا ألفريدو', quantity: 1, price: 110 },
                { itemId: 'item_9', name: 'تشيزكيك', quantity: 2, price: 80 }
            ],
            total: 360,
            status: 'completed',
            paymentMethod: 'card',
            createdAt: Date.now() - 7200000,
            updatedAt: Date.now() - 3600000
        },
        {
            id: 'ord_1022',
            orderId: '#ORD-1022',
            customerName: 'خالد محمود',
            customerPhone: '+201033333333',
            items: [
                { itemId: 'item_3', name: 'سلطة سيزر', quantity: 1, price: 55 },
                { itemId: 'item_4', name: 'شوربة عدس', quantity: 1, price: 40 }
            ],
            total: 95,
            status: 'new',
            paymentMethod: 'cash',
            createdAt: Date.now() - 600000,
            updatedAt: Date.now() - 600000
        }
    ];
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        firebaseConfig,
        getRestaurantRef,
        getMenuRef,
        registerUser,
        loginUser,
        logoutUser,
        isAuthenticated,
        getCurrentUser,
        getRestaurantId,
        fetchRestaurantData,
        updateRestaurantData,
        addMenuItem,
        updateMenuItem,
        deleteMenuItem,
        addCategory,
        fetchOrders,
        updateOrderStatus,
        listenForNewOrders,
        listenToMenuChanges
    };
}
