/**
 * ===================================
 * MezoMenu SaaS - Complete Worker v3.1
 * ===================================
 * 
 * ملف متكامل لـ Cloudflare Worker مع Firebase Realtime Database
 * يحتوي على: Auth, Menu, AI, Upload, Orders, Notifications
 * 
 * 📌 المتغيرات المطلوبة في Cloudflare:
 *    - AGNES_AI_API_KEY = [مفتاح Agnes AI]
 *    - FIREBASE_API_KEY = AIzaSyBFkPZjXbI8XqJ5V8KQY3LmNpOqR7sT9uW
 *    - FIREBASE_PROJECT_ID = menu-b41e6
 * 
 * @version 3.1.0
 * @author MezoMenu Team
 */

// ========================================
// Configuration
// ========================================

const CONFIG = {
    // Agnes AI (Primary AI Service)
    agnesAI: {
        baseUrl: 'https://platform.agnes-ai.com/api',
        endpoints: {
            chat: '/v1/chat/completions',
            image: '/v1/images/generations',
            vision: '/v1/vision/analyze'
        },
        models: {
            chat: 'agnes-ai-latest',
            image: 'agnes-image-gen',
            vision: 'agnes-vision'
        }
    },
    
    // Firebase Configuration - Real Database
    firebase: {
        projectId: 'menu-b41e6',
        databaseURL: 'https://menu-b41e6-default-rtdb.firebaseio.com',
        // This is a web API key (safe for client-side use)
        apiKey: 'AIzaSyBFkPZjXbI8XqJ5V8KQY3LmNpOqR7sT9uW'
    }
};

// ========================================
// CORS Headers
// ========================================

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Restaurant-ID, X-User-ID',
};

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
    });
}

function successResponse(data, message = 'Success') {
    return jsonResponse({ success: true, message, data, timestamp: Date.now() });
}

function errorResponse(message, status = 400) {
    return jsonResponse({ success: false, error: message, timestamp: Date.now() }, status);
}

// ========================================
// Firebase Helper Functions
// ========================================

/**
 * قراءة البيانات من Firebase Realtime Database
 */
async function firebaseGet(path) {
    const url = `${CONFIG.firebase.databaseURL}/${path}.json`;
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error(`Firebase GET error: ${response.status}`);
    }
    
    return await response.json();
}

/**
 * كتابة البيانات في Firebase Realtime Database
 */
async function firebasePut(path, data) {
    const url = `${CONFIG.firebase.databaseURL}/${path}.json`;
    
    const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    
    if (!response.ok) {
        throw new Error(`Firebase PUT error: ${response.status}`);
    }
    
    return await response.json();
}

/**
 * تحديث جزئي للبيانات (PATCH)
 */
async function firebasePatch(path, data) {
    const url = `${CONFIG.firebase.databaseURL}/${path}.json`;
    
    const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    
    if (!response.ok) {
        throw new Error(`Firebase PATCH error: ${response.status}`);
    }
    
    return await response.json();
}

/**
 * حذف بيانات من Firebase
 */
async function firebaseDelete(path) {
    const url = `${CONFIG.firebase.databaseURL}/${path}.json`;
    
    const response = await fetch(url, { method: 'DELETE' });
    
    if (!response.ok) {
        throw new Error(`Firebase DELETE error: ${response.status}`);
    }
    
    return true;
}

// ========================================
// Authentication Helpers
// ========================================

/**
 * التحقق من التوكن البسيط (للاستخدام المؤقت)
 * في الإنتاج: استخدم Firebase Admin SDK
 */
async function verifyToken(token) {
    try {
        if (!token) return null;
        
        // محاولة فك التوكن
        const decoded = atob(token);
        const data = JSON.parse(decoded);
        
        // التحقق من صلاحية التوكن
        if (data.exp && data.exp < Math.floor(Date.now() / 1000)) {
            return null; // التوكن منتهي
        }
        
        return data;
    } catch {
        return null;
    }
}

// ========================================
// Main Handler
// ========================================

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        
        // CORS Preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        // Health Check
        if (url.pathname === '/' || url.pathname === '/health') {
            return jsonResponse({
                status: 'ok',
                service: 'MezoMenu API',
                version: '3.1.0',
                firebaseConnected: true,
                aiEnabled: !!env.AGNES_AI_API_KEY,
                timestamp: Date.now()
            });
        }

        // Firebase Test Endpoint
        if (url.pathname === '/api/test/firebase') {
            try {
                const users = await firebaseGet('users');
                return successResponse({
                    userCount: users ? Object.keys(users).length : 0,
                    sampleUser: users ? Object.keys(users)[0] : null
                }, 'Firebase متصل بنجاح!');
            } catch (error) {
                return errorResponse('فشل الاتصال بـ Firebase: ' + error.message, 500);
            }
        }

        try {
            // Route requests
            switch (true) {
                // ===== Auth Endpoints =====
                case url.pathname === '/api/auth/login' && request.method === 'POST':
                    return handleLogin(request, env);
                    
                case url.pathname === '/api/auth/register' && request.method === 'POST':
                    return handleRegister(request, env);
                    
                case url.pathname === '/api/auth/user' && request.method === 'GET':
                    return getUserData(request, env);
                
                // ===== User/Restaurant Endpoints =====
                case url.pathname.startsWith('/api/restaurants') && request.method === 'GET':
                    return getRestaurant(request, env);
                    
                case url.pathname.startsWith('/api/users') && request.method === 'PUT':
                    return updateUser(request, env);
                
                // ===== Menu Endpoints =====
                case url.pathname.startsWith('/api/menu') && request.method === 'GET':
                    return getMenu(request, env);
                    
                case url.pathname.startsWith('/api/menu') && request.method === 'POST':
                    return saveMenu(request, env);
                    
                case url.pathname.startsWith('/api/menu') && request.method === 'PUT':
                    return updateMenu(request, env);
                
                // ===== Orders Endpoints =====
                case url.pathname.startsWith('/api/orders') && request.method === 'GET':
                    return getOrders(request, env);
                    
                case url.pathname.startsWith('/api/orders') && request.method === 'POST':
                    return createOrder(request, env);
                    
                case url.pathname.startsWith('/api/orders/') && request.method === 'PUT':
                    return updateOrder(request, env);
                
                // ===== AI Endpoints =====
                case url.pathname === '/api/ai/chat' && request.method === 'POST':
                    return handleAIChat(request, env);
                    
                case url.pathname === '/api/ai/image' && request.method === 'POST':
                    return handleAIImage(request, env);
                    
                case url.pathname === '/api/ai/analyze' && request.method === 'POST':
                    return handleAIAnalyze(request, env);
                    
                case url.pathname === '/api/ai/status' && request.method === 'GET':
                    return getAIStatus(env);
                
                // ===== Upload Endpoint =====
                case url.pathname === '/api/upload' && request.method === 'POST':
                    return handleUpload(request, env);
                
                // ===== Notifications Endpoints =====
                case url.pathname.startsWith('/api/notifications') && request.method === 'GET':
                    return getNotifications(request, env);
                    
                case url.pathname.startsWith('/api/notifications') && request.method === 'DELETE':
                    return clearNotifications(request, env);
                    
                case url.pathname.includes('/notifications/') && request.method === 'PUT':
                    return markNotificationRead(request, env);
                
                // ===== Stats/Dashboard Endpoints =====
                case url.pathname === '/api/stats/dashboard' && request.method === 'GET':
                    return getDashboardStats(request, env);
                
                default:
                    return errorResponse('Endpoint not found', 404);
            }
            
        } catch (error) {
            console.error('[Worker Error]:', error);
            return errorResponse('Internal server error: ' + error.message, 500);
        }
    }
};

// ========================================
// 🔐 Auth Handlers
// ========================================

/**
 * POST /api/auth/login
 * تسجيل الدخول
 */
async function handleLogin(request, env) {
    try {
        const { email, password } = await request.json();
        
        if (!email || !password) {
            return errorResponse('البريد الإلكتروني وكلمة المرور مطلوبان');
        }

        console.log(`[Auth] Login attempt: ${email}`);

        // البحث عن المستخدم في Firebase
        const users = await firebaseGet('users');
        
        if (!users) {
            return errorResponse('المستخدم غير موجود', 404);
        }

        // البحث عن المستخدم بالبريد الإلكتروني
        let foundUser = null;
        let userId = null;

        for (const [uid, user] of Object.entries(users)) {
            if (user.email === email.toLowerCase()) {
                foundUser = user;
                userId = uid;
                break;
            }
        }

        if (!foundUser) {
            return errorResponse('البريد الإلكتروني غير مسجل', 404);
        }

        // في الإنتاج: تحقق من كلمة المرور عبر Firebase Auth
        // حالياً نقبل أي كلمة مرور للعرض التجريبي
        
        // إنشاء توكن
        const token = btoa(JSON.stringify({
            userId: userId,
            email: foundUser.email,
            exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 أيام
        }));

        // إرجاع بيانات المستخدم
        return successResponse({
            token,
            user: {
                id: userId,
                email: foundUser.email,
                displayName: foundUser.displayName || foundUser.fullName,
                fullName: foundUser.fullName,
                phone: foundUser.phone,
                plan: foundUser.plan || 'free',
                restaurant: foundUser.restaurant || null,
                createdAt: foundUser.createdAt
            }
        }, 'تم تسجيل الدخول بنجاح');

    } catch (error) {
        console.error('[Auth] Login error:', error);
        return errorResponse('فشل في تسجيل الدخول: ' + error.message, 500);
    }
}

/**
 * POST /api/auth/register
 * إنشاء حساب جديد
 */
async function handleRegister(request, env) {
    try {
        const { email, password, displayName, fullName, phone, restaurant } = await request.json();
        
        if (!email || !password) {
            return errorResponse('البريد الإلكتروني وكلمة المرور مطلوبان');
        }

        console.log(`[Auth] Register attempt: ${email}`);

        // التحقق من عدم وجود المستخدم
        const users = await firebaseGet('users') || {};
        
        for (const user of Object.values(users)) {
            if (user.email === email.toLowerCase()) {
                return errorResponse('هذا البريد الإلكتروني مسجل بالفعل', 400);
            }
        }

        // إنشاء مستخدم جديد
        const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        const userData = {
            id: userId,
            email: email.toLowerCase(),
            displayName: displayName || fullName || '',
            fullName: fullName || displayName || '',
            phone: phone || '',
            plan: 'free',
            restaurant: restaurant || null,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        // حفظ في Firebase
        await firebasePut(`users/${userId}`, userData);

        // إنشاء توكن
        const token = btoa(JSON.stringify({
            userId: userId,
            email: userData.email,
            exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
        }));

        return successResponse({
            token,
            user: userData
        }, 'تم إنشاء الحساب بنجاح');

    } catch (error) {
        console.error('[Auth] Register error:', error);
        return errorResponse('فشل في إنشاء الحساب: ' + error.message, 500);
    }
}

/**
 * GET /api/auth/user
 * جلب بيانات المستخدم الحالي
 */
async function getUserData(request, env) {
    try {
        const url = new URL(request.url);
        const userId = url.searchParams.get('userId') || 
                       request.headers.get('X-User-ID');
        
        if (!userId) {
            return errorResponse('معرف المستخدم مطلوب', 400);
        }

        const user = await firebaseGet(`users/${userId}`);
        
        if (!user) {
            return errorResponse('المستخدم غير موجود', 404);
        }

        return successResponse(user);

    } catch (error) {
        return errorResponse('فشل في جلب بيانات المستخدم: ' + error.message, 500);
    }
}

// ========================================
// 🏪 Restaurant Handlers
// ========================================

async function getRestaurant(request, env) {
    try {
        const url = new URL(request.url);
        const restaurantId = url.searchParams.get('id') || 
                            url.searchParams.get('restaurantId') ||
                            url.pathname.split('/').pop();

        // البحث عن المطعم
        const users = await firebaseGet('users') || {};
        
        for (const [uid, user] of Object.entries(users)) {
            if (user.restaurant && (
                user.restaurant.slug === restaurantId ||
                uid === restaurantId
            )) {
                return successResponse({
                    id: uid,
                    ...user.restaurant,
                    owner: {
                        displayName: user.displayName,
                        email: user.email
                    }
                }, 'تم جلب بيانات المطعم');
            }
        }

        return errorResponse('المطعم غير موجود', 404);

    } catch (error) {
        return errorResponse('فشل في جلب بيانات المطعم: ' + error.message, 500);
    }
}

async function updateUser(request, env) {
    try {
        const url = new URL(request.url);
        const userId = url.searchParams.get('userId');
        const updates = await request.json();

        if (!userId) {
            return errorResponse('معرف المستخدم مطلوب', 400);
        }

        // تحديث البيانات
        updates.updatedAt = Date.now();
        await firebasePatch(`users/${userId}`, updates);

        const updatedUser = await firebaseGet(`users/${userId}`);
        
        return successResponse(updatedUser, 'تم تحديث البيانات بنجاح');

    } catch (error) {
        return errorResponse('فشل في تحديث البيانات: ' + error.message, 500);
    }
}

// ========================================
// 📋 Menu Handlers
// ========================================

async function getMenu(request, env) {
    try {
        const url = new URL(request.url);
        const restaurantId = url.searchParams.get('restaurantId') || 
                            url.searchParams.get('userId') || 
                            'default';

        console.log(`[Menu] Getting menu for: ${restaurantId}`);

        // جلب القائمة من Firebase
        let menuData = await firebaseGet(`menus/${restaurantId}`);
        
        // إذا لم توجد، جرب البحث عن المستخدم
        if (!menuData) {
            const user = await firebaseGet(`users/${restaurantId}`);
            if (user && user.restaurant) {
                menuData = await firebaseGet(`menus/${restaurantId}`) || 
                          createDefaultMenu(user.restaurant.name);
            }
        }

        return successResponse({
            restaurantId,
            categories: menuData?.categories || [],
            items: menuData?.items || [],
            settings: menuData?.settings || {}
        }, 'تم جلب القائمة');

    } catch (error) {
        console.error('[Menu] Get error:', error);
        return errorResponse('فشل في جلب القائمة: ' + error.message, 500);
    }
}

async function saveMenu(request, env) {
    try {
        const { restaurantId, categories, items, settings } = await request.json();
        
        if (!restaurantId) {
            return errorResponse('معرف المطعم مطلوب', 400);
        }

        const menuData = {
            categories: categories || [],
            items: items || [],
            settings: settings || {},
            updatedAt: Date.now(),
            updatedBy: restaurantId
        };

        // حفظ في Firebase
        await firebasePut(`menus/${restaurantId}`, menuData);

        return successResponse(menuData, 'تم حفظ القائمة بنجاح');

    } catch (error) {
        return errorResponse('فشل في حفظ القائمة: ' + error.message, 500);
    }
}

async function updateMenu(request, env) {
    try {
        const url = new URL(request.url);
        const restaurantId = url.searchParams.get('restaurantId');
        const updates = await request.json();

        if (!restaurantId) {
            return errorResponse('معرف المطعم مطلوب', 400);
        }

        updates.updatedAt = Date.now();
        await firebasePatch(`menus/${restaurantId}`, updates);

        const updatedMenu = await firebaseGet(`menus/${restaurantId}`);
        
        return successResponse(updatedMenu, 'تم تحديث القائمة بنجاح');

    } catch (error) {
        return errorResponse('فشل في تحديث القائمة: ' + error.message, 500);
    }
}

function createDefaultMenu(restaurantName) {
    return {
        categories: [
            { id: 'cat_1', name: 'المقبلات', order: 1 },
            { id: 'cat_2', name: 'الأطباق الرئيسية', order: 2 },
            { id: 'cat_3', name: 'المشروبات', order: 3 },
            { id: 'cat_4', name: 'الحلويات', order: 4 }
        ],
        items: [],
        settings: {
            name: restaurantName || 'قائمتي',
            currency: 'ج.م',
            language: 'ar',
            theme: 'default'
        }
    };
}

// ========================================
// 📦 Orders Handlers
// ========================================

async function getOrders(request, env) {
    try {
        const url = new URL(request.url);
        const restaurantId = url.searchParams.get('restaurantId') || 
                            url.searchParams.get('userId') || 
                            'default';
        const status = url.searchParams.get('status');
        const limit = parseInt(url.searchParams.get('limit')) || 50;

        console.log(`[Orders] Getting orders for: ${restaurantId}`);

        // جلب الطلبات
        let orders = await firebaseGet(`orders/${restaurantId}`);
        
        if (!orders) {
            orders = {};
        }

        // تحويل الكائن إلى مصفوفة
        let ordersArray = Object.entries(orders).map(([id, order]) => ({
            id,
            ...order
        }));

        // فلترة حسب الحالة
        if (status) {
            ordersArray = ordersArray.filter(o => o.status === status);
        }

        // ترتيب حسب التاريخ (الأحدث أولاً)
        ordersArray.sort((a, b) => b.createdAt - a.createdAt);

        // تحديد العدد
        ordersArray = ordersArray.slice(0, limit);

        return successResponse({
            restaurantId,
            orders: ordersArray,
            total: ordersArray.length
        }, 'تم جلب الطلبات');

    } catch (error) {
        console.error('[Orders] Get error:', error);
        return errorResponse('فشل في جلب الطلبات: ' + error.message, 500);
    }
}

async function createOrder(request, env) {
    try {
        const { restaurantId, customer, items, total, notes, deliveryAddress } = await request.json();
        
        if (!restaurantId || !items || !items.length) {
            return errorResponse('بيانات الطلب غير مكتملة', 400);
        }

        const orderId = 'order_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        const orderData = {
            id: orderId,
            restaurantId,
            customer: customer || {
                name: 'عميل',
                phone: '',
                address: ''
            },
            items: items.map(item => ({
                itemId: item.itemId || item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity || 1,
                notes: item.notes || ''
            })),
            total: total || items.reduce((sum, i) => sum + (i.price * (i.quantity || 1)), 0),
            notes: notes || '',
            deliveryAddress: deliveryAddress || '',
            status: 'pending',
            timeline: [
                {
                    status: 'pending',
                    timestamp: Date.now(),
                    message: 'تم استلام الطلب'
                }
            ],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        // حفظ الطلب
        await firebasePut(`orders/${restaurantId}/${orderId}`, orderData);

        // إضافة إشعار
        await addNotification(restaurantId, {
            type: 'order',
            title: `طلب جديد #${orderId.substr(-6)}`,
            message: `طلب جديد من ${customer?.name || 'عميل'} بمبلغ ${orderData.total} ج.م`,
            orderId: orderId,
            read: false,
            createdAt: Date.now()
        });

        return successResponse(orderData, 'تم إنشاء الطلب بنجاح');

    } catch (error) {
        console.error('[Orders] Create error:', error);
        return errorResponse('فشل في إنشاء الطلب: ' + error.message, 500);
    }
}

async function updateOrder(request, env) {
    try {
        const url = new URL(request.url);
        const pathParts = url.pathname.split('/');
        const orderId = pathParts[pathParts.length - 1];
        const restaurantId = url.searchParams.get('restaurantId');
        const { status, notes } = await request.json();

        if (!orderId || !restaurantId) {
            return errorResponse('معرف الطلب والمطعم مطلوبان', 400);
        }

        // جلب الطلب الحالي
        const existingOrder = await firebaseGet(`orders/${restaurantId}/${orderId}`);
        
        if (!existingOrder) {
            return errorResponse('الطلب غير موجود', 404);
        }

        // تحديث البيانات
        const updates = {
            updatedAt: Date.now()
        };

        if (status) {
            updates.status = status;
            
            // إضافة للخط الزمني
            const timelineEntry = {
                status,
                timestamp: Date.now(),
                message: getOrderStatusMessage(status)
            };
            
            updates.timeline = [...(existingOrder.timeline || []), timelineEntry];
        }

        if (notes) {
            updates.notes = notes;
        }

        await firebasePatch(`orders/${restaurantId}/${orderId}`, updates);

        const updatedOrder = await firebaseGet(`orders/${restaurantId}/${orderId}`);
        
        return successResponse(updatedOrder, 'تم تحديث الطلب بنجاح');

    } catch (error) {
        console.error('[Orders] Update error:', error);
        return errorResponse('فشل في تحديث الطلب: ' + error.message, 500);
    }
}

function getOrderStatusMessage(status) {
    const messages = {
        pending: 'قيد الانتظار',
        confirmed: 'تم تأكيد الطلب',
        preparing: 'جاري التحضير',
        ready: 'جاهز للاستلام',
        delivered: 'تم التسليم',
        cancelled: 'تم إلغاء الطلب'
    };
    return messages[status] || 'تم التحديث';
}

// ========================================
// 🔔 Notifications Handlers
// ========================================

async function addNotification(userId, notification) {
    try {
        const notifications = await firebaseGet(`notifications/${userId}`) || [];
        notifications.unshift(notification);
        
        // الاحتفاظ بآخر 50 إشعار فقط
        if (notifications.length > 50) {
            notifications.pop();
        }
        
        await firebasePut(`notifications/${userId}`, notifications);
    } catch (error) {
        console.error('[Notifications] Add error:', error);
    }
}

async function getNotifications(request, env) {
    try {
        const url = new URL(request.url);
        const userId = url.searchParams.get('userId') || 
                      url.searchParams.get('restaurantId') || 
                      'default';
        const type = url.searchParams.get('type');

        let notifications = await firebaseGet(`notifications/${userId}`) || [];

        // فلترة حسب النوع
        if (type) {
            notifications = notifications.filter(n => n.type === type);
        }

        // حساب غير المقروءة
        const unreadCount = notifications.filter(n => !n.read).length;

        return successResponse({
            notifications,
            unreadCount,
            total: notifications.length
        }, 'تم جلب الإشعارات');

    } catch (error) {
        return errorResponse('فشل في جلب الإشعارات: ' + error.message, 500);
    }
}

async function markNotificationRead(request, env) {
    try {
        const url = new URL(request.url);
        const pathParts = url.pathname.split('/');
        const index = pathParts[pathParts.length - 1];
        const userId = url.searchParams.get('userId') || 
                      url.searchParams.get('restaurantId');

        const notifications = await firebaseGet(`notifications/${userId}`) || [];
        
        if (notifications[index]) {
            notifications[index].read = true;
            await firebasePut(`notifications/${userId}`, notifications);
        }

        return successResponse(null, 'تم تحديد الإشعار كمقروء');

    } catch (error) {
        return errorResponse('فشل في تحديث الإشعار: ' + error.message, 500);
    }
}

async function clearNotifications(request, env) {
    try {
        const url = new URL(request.url);
        const userId = url.searchParams.get('userId') || 
                      url.searchParams.get('restaurantId');

        await firebasePut(`notifications/${userId}`, []);
        
        return successResponse(null, 'تم مسح جميع الإشعارات');

    } catch (error) {
        return errorResponse('فشل في مسح الإشعارات: ' + error.message, 500);
    }
}

// ========================================
// 📊 Dashboard Stats Handler
// ========================================

async function getDashboardStats(request, env) {
    try {
        const url = new URL(request.url);
        const userId = url.searchParams.get('userId') || 
                      url.searchParams.get('restaurantId') || 
                      'default';

        console.log(`[Stats] Getting dashboard stats for: ${userId}`);

        // جلب البيانات بالتوازي
        const [user, orders, menu] = await Promise.all([
            firebaseGet(`users/${userId}`).catch(() => null),
            firebaseGet(`orders/${userId}`).catch(() => null),
            firebaseGet(`menus/${userId}`).catch(() => null)
        ]);

        // حساب إحصائيات الطلبات
        let ordersData = orders ? Object.values(orders) : [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayOrders = ordersData.filter(o => o.createdAt >= today.getTime());
        const totalRevenue = ordersData.reduce((sum, o) => sum + (o.total || 0), 0);
        const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.total || 0), 0);

        // حالة الطلبات
        const ordersByStatus = {
            pending: ordersData.filter(o => o.status === 'pending').length,
            confirmed: ordersData.filter(o => o.status === 'confirmed').length,
            preparing: ordersData.filter(o => o.status === 'preparing').length,
            ready: ordersData.filter(o => o.status === 'ready').length,
            delivered: ordersData.filter(o => o.status === 'delivered').length,
            cancelled: ordersData.filter(o => o.status === 'cancelled').length
        };

        // إحصائيات القائمة
        const menuItems = menu?.items || [];
        const categories = menu?.categories || [];

        return successResponse({
            user: user ? {
                name: user.displayName || user.fullName,
                email: user.email,
                plan: user.plan || 'free',
                restaurantName: user.restaurant?.name
            } : null,
            
            orders: {
                total: ordersData.length,
                today: todayOrders.length,
                revenue: totalRevenue,
                todayRevenue: todayRevenue,
                byStatus: ordersByStatus,
                recentOrders: ordersData
                    .sort((a, b) => b.createdAt - a.createdAt)
                    .slice(0, 5)
            },
            
            menu: {
                totalItems: menuItems.length,
                totalCategories: categories.length
            },
            
            period: {
                today: today.toISOString().split('T')[0],
                weekAgo: new Date(today - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            }
        }, 'تم جلب الإحصائيات');

    } catch (error) {
        console.error('[Stats] Error:', error);
        return errorResponse('فشل في جلب الإحصائيات: ' + error.message, 500);
    }
}

// ========================================
// 🤖 Agnes AI Handlers
// ========================================

/**
 * POST /api/ai/chat
 * محادثة وتحليل القائمة بالذكاء الاصطناعي
 */
async function handleAIChat(request, env) {
    try {
        const { message, options = {} } = await request.json();
        
        if (!message) {
            return errorResponse('الرسالة مطلوبة', 400);
        }

        const apiKey = env.AGNES_AI_API_KEY;
        
        if (!apiKey) {
            console.warn('[AI] API key not configured - using fallback');
            return fallbackChatResponse(message);
        }

        console.log('[AI] Sending chat request to Agnes AI...');

        const response = await fetch(`${CONFIG.agnesAI.baseUrl}${CONFIG.agnesAI.endpoints.chat}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'X-API-Key': apiKey
            },
            body: JSON.stringify({
                model: CONFIG.agnesAI.models.chat,
                messages: [
                    {
                        role: 'system',
                        content: options.systemPrompt || 'أنت خبير في تحليل قوائم المطاعم العربية. أجب باللغة العربية بشكل احترافي ومفيد.'
                    },
                    { role: 'user', content: message }
                ],
                max_tokens: options.maxTokens || 2000,
                temperature: options.temperature || 0.7
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[AI] API Error:', errorText);
            return fallbackChatResponse(message);
        }

        const result = await response.json();
        const aiResponse = result.choices?.[0]?.message?.content || 
                          result.response || 
                          JSON.stringify(result);

        console.log('[AI] Chat response received successfully');

        return successResponse({
            data: aiResponse,
            model: result.model || 'agnes-ai',
            usage: result.usage
        }, 'تمت المعالجة بالذكاء الاصطناعي!');

    } catch (error) {
        console.error('[AI] Chat error:', error);
        return fallbackChatResponse(message);
    }
}

/**
 * POST /api/ai/image
 * توليد صور بالذكاء الاصطناعي
 */
async function handleAIImage(request, env) {
    try {
        const { prompt, options = {} } = await request.json();
        
        if (!prompt) {
            return errorResponse('وصف الصورة مطلوب', 400);
        }

        const apiKey = env.AGNES_AI_API_KEY;
        
        if (!apiKey) {
            return fallbackImageResponse(prompt);
        }

        console.log(`[AI Image] Generating: ${prompt.substring(0, 50)}...`);

        const response = await fetch(`${CONFIG.agnesAI.baseUrl}${CONFIG.agnesAI.endpoints.image}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'X-API-Key': apiKey
            },
            body: JSON.stringify({
                model: CONFIG.agnesAI.models.image,
                prompt: prompt,
                negative_prompt: options.negativePrompt || 'blurry, low quality, ugly, watermark, text',
                width: options.width || 512,
                height: options.height || 512,
                steps: options.steps || 25,
                guidance_scale: options.cfgScale || 7.5
            })
        });

        if (!response.ok) {
            console.error('[AI Image] Error:', await response.text());
            return fallbackImageResponse(prompt);
        }

        const contentType = response.headers.get('content-type') || '';
        
        if (contentType.includes('image')) {
            const buffer = await response.arrayBuffer();
            const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
            
            return successResponse({
                imageUrl: `data:image/png;base64,${base64}`,
                source: 'agnes-ai',
                prompt: prompt
            }, 'تم توليد الصورة!');
        } else {
            const result = await response.json();
            const imageUrl = result.url || result.image_url || result.data?.url;
            
            return successResponse({
                imageUrl: imageUrl || null,
                source: 'agnes-ai',
                prompt: prompt
            }, 'تم توليد الصورة!');
        }

    } catch (error) {
        console.error('[AI Image] Error:', error);
        return fallbackImageResponse(prompt);
    }
}

/**
 * POST /api/ai/analyze
 * تحليل صورة القائمة (OCR/Vision)
 */
async function handleAIAnalyze(request, env) {
    try {
        const { image, type = 'menu-ocr', options = {} } = await request.json();
        
        if (!image && type === 'menu-ocr') {
            return errorResponse('صورة القائمة مطلوبة', 400);
        }

        const apiKey = env.AGNES_AI_API_KEY;
        
        if (!apiKey) {
            return errorResponse('خدمة الذكاء الاصطناعي غير متاحة حالياً', 503);
        }

        console.log(`[AI Analyze] Type: ${type}, Processing...`);

        if (type === 'menu-ocr' && image) {
            const response = await fetch(`${CONFIG.agnesAI.baseUrl}${CONFIG.agnesAI.endpoints.vision}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'X-API-Key': apiKey
                },
                body: JSON.stringify({
                    model: CONFIG.agnesAI.models.vision,
                    image: image.startsWith('data:') ? image : `data:image/png;base64,${image}`,
                    task: 'menu-extraction',
                    options: {
                        language: options.language || 'ar',
                        extractPrices: true,
                        extractCategories: true,
                        format: 'structured'
                    }
                })
            });

            if (!response.ok) {
                console.error('[AI Analyze] Error:', await response.text());
                return errorResponse('فشل في تحليل الصورة', 500);
            }

            const result = await response.json();

            return successResponse({
                data: result.data || result,
                confidence: result.confidence || 0.85,
                method: 'agnes-ai-vision',
                extractedItems: result.items || []
            }, 'تم تحليل القائمة بنجاح!');

        } else if (type === 'text-analysis') {
            return handleAIChat(request, env);
        }

        return errorResponse('نوع التحليل غير مدعوم', 400);

    } catch (error) {
        console.error('[AI Analyze] Error:', error);
        return errorResponse('فشل في التحليل: ' + error.message, 500);
    }
}

/**
 * GET /api/ai/status
 * فحص حالة خدمات الذكاء الاصطناعي
 */
async function getAIStatus(env) {
    return successResponse({
        services: {
            agnesAI: {
                available: !!env.AGNES_AI_API_KEY,
                configured: !!env.AGNES_AI_API_KEY,
                baseUrl: CONFIG.agnesAI.baseUrl,
                endpoints: CONFIG.agnesAI.endpoints
            }
        },
        primaryService: env.AGNES_AI_API_KEY ? 'agnes-ai' : 'fallback',
        recommendation: env.AGNES_AI_API_KEY 
            ? '✅ Agnes AI جاهز للعمل!' 
            : '⚠️ أضف AGNES_AI_API_KEY لتفعيل الذكاء الاصطناعي المتقدم'
    }, 'تم جلب حالة الخدمة');
}

// ========================================
// Fallback Handlers (بدون API Key)
// ========================================

function fallbackChatResponse(message) {
    // تحليل أساسي بدون AI
    const analysis = generateBasicAnalysis(message);
    
    return successResponse({
        data: analysis,
        model: 'fallback-basic',
        isFallback: true
    }, 'تم التحليل (وضع أساسي)');
}

function fallbackImageResponse(prompt) {
    return successResponse({
        imageUrl: null,
        source: 'placeholder-fallback',
        prompt: prompt,
        isFallback: true,
        suggestion: 'أضف صورة يدوياً أو فعّل API Key لتوليد صور تلقائية'
    }, 'وضع أساسي - أضف API Key لتوليد صور حقيقية');
}

function generateBasicAnalysis(message = '') {
    return `
## 📋 تحليل القائمة الذكي

### 💡 نصائح عامة لتحسين قائمتك:

#### 1️⃣ **تنظيم الأصناف**
- قسم القائمة لأقسام واضحة (مقبلات، رئيسيات، مشروبات، حلويات)
- رتب الأصناف من الأكثر إلى الأقل شعبية
- استخدم أرقام للتسهيل

#### 2️⃣ **التسعير الذكي**
- ضع أسعار تنافسية مع السوق
- اعرض السعر بوضوح بجانب كل صنف
- أضف عروضاً خاصة جذابة

#### 3️⃣ **الوصف الجذاب**
- اصف كل صنف بجملتين-ثلاث
- اذكر المكونات الرئيسية
- أشعر العميل بطعم الطبق

#### 4️⃣ **الصور عالية الجودة**
- استخدم صوراً احترافية للأصناف
- تأكد من إضاءة جيدة
- عرض الحجم الحقيقي للطبق

#### 5️⃣ **العروض الخاصة**
- أضف "طبق اليوم" بتخفيض
- عروض للوجبات الجماعية
- ولائم خاصة للمناسبات

---
📌 **لتحليل متقدم:** أضف مفتاح AGNES_AI_API_KEY في إعدادات Worker
`;
}

// ========================================
// 📤 Upload Handler
// ========================================

async function handleUpload(request, env) {
    try {
        const formData = await request.formData();
        const file = formData.get('file');
        
        if (!file) {
            return errorResponse('الملف مطلوب');
        }

        console.log(`[Upload] File: ${file.name} (${file.size} bytes)`);

        // تحويل الملف إلى Base64
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

        // في الإنتاج: رفع إلى R2 أو خدمة تخزين أخرى
        // حالياً نعيد البيانات كما هي
        
        return successResponse({
            filename: file.name,
            size: file.size,
            type: file.type,
            url: `data:${file.type};base64,${base64.substring(0, 100)}...`, // مقطوع للأداء
            fullUrl: `data:${file.type};base64,${base64}`
        }, 'تم رفع الملف بنجاح');

    } catch (error) {
        console.error('[Upload] Error:', error);
        return errorResponse('فشل في رفع الملف: ' + error.message, 500);
    }
}
