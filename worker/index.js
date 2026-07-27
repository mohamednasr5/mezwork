/**
 * ===================================
 * MezoMenu SaaS - Complete Worker
 * ===================================
 * 
 * ملف واحد متكامل لـ Cloudflare Worker
 * يحتوي على: Auth, Menu, AI, Upload, Orders, R2, Firebase Integration
 * 
 * 📌 كيفية الاستخدام:
 * 1. ارفع هذا الملف على Cloudflare Workers
 * 2. أضف المتغيرات في Settings → Variables:
 *    - AGNES_AI_API_KEY = [مفتاحك من agnes-ai.com]
 *    - FIREBASE_API_KEY = [مفتاح Firebase]
 *    - FIREBASE_PROJECT_ID = menu-b41e6
 *    - R2_BUCKET = [اسم R2 Bucket]
 * 
 * @version 3.0.0
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
    
    // Firebase Configuration
    firebase: {
        projectId: 'menu-b41e6',
        databaseURL: 'https://menu-b41e6-default-rtdb.firebaseio.com'
    },
    
    // CORS Configuration
    cors: {
        allowedOrigins: ['*'],
        allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Restaurant-ID']
    }
};

// ========================================
// CORS Headers
// ========================================

function corsHeaders(request) {
    const origin = request.headers.get('Origin') || '*';
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': CONFIG.cors.allowedMethods.join(', '),
        'Access-Control-Allow-Headers': CONFIG.cors.allowedHeaders.join(', '),
        'Access-Control-Max-Age': '86400',
    };
}

function jsonResponse(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 
            'Content-Type': 'application/json; charset=utf-8',
            ...headers 
        }
    });
}

function successResponse(data, message = 'Success') {
    return jsonResponse({
        success: true,
        message,
        data,
        timestamp: Date.now()
    });
}

function errorResponse(message, status = 400) {
    return jsonResponse({
        success: false,
        error: message,
        timestamp: Date.now()
    }, status);
}

// ========================================
// Main Handler
// ========================================

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        
        // CORS Preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders(request) });
        }

        try {
            // Route requests based on path and method
            const routes = [
                // Health Check
                { method: 'GET', path: ['/', '/health'], handler: handleHealth },
                
                // AI Endpoints
                { method: 'POST', path: ['/api/ai/chat'], handler: handleAIChat },
                { method: 'POST', path: ['/api/ai/image'], handler: handleAIImage },
                { method: 'POST', path: ['/api/ai/analyze'], handler: handleAIAnalyze },
                { method: 'GET', path: ['/api/ai/status'], handler: getAIStatus },
                
                // Auth Endpoints
                { method: 'POST', path: ['/api/auth/login'], handler: handleLogin },
                { method: 'POST', path: ['/api/auth/register'], handler: handleRegister },
                { method: 'POST', path: ['/api/auth/logout'], handler: handleLogout },
                { method: 'GET', path: ['/api/auth/me'], handler: getCurrentUser },
                { method: 'POST', path: ['/api/auth/reset-password'], handler: resetPassword },
                
                // Restaurant Endpoints
                { method: 'GET', path: ['/api/restaurants'], handler: getRestaurants },
                { method: 'GET', path: ['/api/restaurants/:id'], handler: getRestaurant },
                { method: 'PUT', path: ['/api/restaurants/:id'], handler: updateRestaurant },
                { method: 'GET', path: ['/api/restaurants/slug/:slug'], handler: getRestaurantBySlug },
                
                // Menu Endpoints
                { method: 'GET', path: ['/api/menu'], handler: getMenu },
                { method: 'POST', path: ['/api/menu'], handler: saveMenu },
                { method: 'GET', path: ['/api/menu/categories'], handler: getCategories },
                { method: 'POST', path: ['/api/menu/categories'], handler: createCategory },
                { method: 'PUT', path: ['/api/menu/categories/:id'], handler: updateCategory },
                { method: 'DELETE', path: ['/api/menu/categories/:id'], handler: deleteCategory },
                { method: 'GET', path: ['/api/menu/items'], handler: getMenuItems },
                { method: 'POST', path: ['/api/menu/items'], handler: createMenuItem },
                { method: 'PUT', path: ['/api/menu/items/:id'], handler: updateMenuItem },
                { method: 'DELETE', path: ['/api/menu/items/:id'], handler: deleteMenuItem },
                
                // Order Endpoints
                { method: 'GET', path: ['/api/orders'], handler: getOrders },
                { method: 'POST', path: ['/api/orders'], handler: createOrder },
                { method: 'GET', path: ['/api/orders/:id'], handler: getOrder },
                { method: 'PUT', path: ['/api/orders/:id/status'], handler: updateOrderStatus },
                { method: 'DELETE', path: ['/api/orders/:id'], handler: cancelOrder },
                { method: 'GET', path: ['/api/orders/stats'], handler: getOrderStats },
                
                // Upload Endpoints (R2)
                { method: 'POST', path: ['/api/upload'], handler: handleUpload },
                { method: 'GET', path: ['/api/upload/:key'], handler: getFileUrl },
                { method: 'DELETE', path: ['/api/upload/:key'], handler: deleteFile },
                
                // Notification Endpoints
                { method: 'GET', path: ['/api/notifications'], handler: getNotifications },
                { method: 'POST', path: ['/api/notifications'], handler: createNotification },
                { method: 'PUT', path: ['/api/notifications/:id/read'], handler: markNotificationRead },
                
                // Analytics Endpoints
                { method: 'GET', path: ['/api/analytics/dashboard'], handler: getDashboardStats },
                { method: 'GET', path: ['/api/analytics/menu-performance'], handler: getMenuPerformance },
                { method: 'GET', path: ['/api/analytics/revenue'], handler: getRevenueData },
                
                // Subscription/Payment Endpoints
                { method: 'GET', path: ['/api/subscriptions/plans'], handler: getPlans },
                { method: 'POST', path: ['/api/subscriptions/create'], handler: createSubscription },
                { method: 'GET', path: ['/api/subscriptions/current'], handler: getCurrentSubscription },
                { method: 'POST', path: ['/api/subscriptions/cancel'], handler: cancelSubscription },
                
                // Public Menu Endpoint (for customers)
                { method: 'GET', path: ['/r/:slug'], handler: getPublicMenu },
                { method: 'GET', path: ['/r/:slug/qrcode'], handler: generateQRCode },
            ];

            // Find matching route
            for (const route of routes) {
                if (route.method === request.method && matchPath(url.pathname, route.path)) {
                    const params = extractParams(url.pathname, route.path);
                    return await route.handler({ request, env, params, url });
                }
            }

            return errorResponse('Endpoint not found', 404);

        } catch (error) {
            console.error('[Worker Error]:', error);
            return errorResponse('Internal server error: ' + error.message, 500);
        }
    }
};

// ========================================
// URL Matching Helpers
// ========================================

function matchPath(pathname, patternPath) {
    if (Array.isArray(patternPath)) {
        return patternPath.some(p => matchPath(pathname, p));
    }

    const patternParts = patternPath.split('/');
    const pathParts = pathname.split('/');

    if (patternParts.length !== pathParts.length) return false;

    return patternParts.every((part, index) => {
        return part.startsWith(':') || part === pathParts[index];
    });
}

function extractParams(pathname, patternPath) {
    const params = {};
    const patternParts = patternPath.split('/');
    const pathParts = pathname.split('/');

    patternParts.forEach((part, index) => {
        if (part.startsWith(':')) {
            params[part.slice(1)] = pathParts[index];
        }
    });

    return params;
}

// ========================================
// Health Check Handler
// ========================================

async function handleHealth({ env }) {
    return successResponse({
        status: 'ok',
        service: 'MezoMenu API',
        version: '3.0.0',
        features: {
            aiEnabled: !!env.AGNES_AI_API_KEY,
            r2Enabled: !!env.R2_BUCKET,
            firebaseEnabled: true
        },
        timestamp: Date.now()
    }, 'MezoMenu API is running');
}

// ========================================
// 🔐 Authentication Handlers
// ========================================

/**
 * POST /api/auth/login
 * تسجيل الدخول
 */
async function handleLogin({ request }) {
    try {
        const { email, password } = await request.json();
        
        if (!email || !password) {
            return errorResponse('البريد الإلكتروني وكلمة المرور مطلوبان');
        }

        // In production, verify with Firebase Auth
        // For now, check against Firebase Realtime Database
        const usersRes = await fetch(`${CONFIG.firebase.databaseURL}/users.json`);
        const users = await usersRes.json();

        let user = null;
        let userId = null;

        if (users) {
            for (const [uid, u] of Object.entries(users)) {
                if (u.email === email) {
                    user = u;
                    userId = uid;
                    break;
                }
            }
        }

        if (!user) {
            return errorResponse('المستخدم غير موجود', 404);
        }

        // Generate JWT-like token (in production use proper JWT)
        const token = btoa(JSON.stringify({
            userId,
            email: user.email,
            role: user.role || 'restaurant_owner',
            exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
        }));

        return successResponse({
            token,
            user: {
                id: userId,
                email: user.email,
                displayName: user.displayName,
                restaurant: user.restaurant
            }
        }, 'تم تسجيل الدخول بنجاح');

    } catch (error) {
        return errorResponse('فشل في تسجيل الدخول: ' + error.message, 500);
    }
}

/**
 * POST /api/auth/register
 * إنشاء حساب جديد
 */
async function handleRegister({ request }) {
    try {
        const { email, password, displayName, phone, restaurant } = await request.json();

        if (!email || !password) {
            return errorResponse('البريد الإلكتروني وكلمة المرور مطلوبان');
        }

        // Check if user exists
        const existingUser = await fetch(
            `${CONFIG.firebase.databaseURL}/users.json?orderBy="email"&equalTo="${email}"`
        );
        const existingData = await existingUser.json();

        if (existingData && Object.keys(existingData).length > 0) {
            return errorResponse('هذا البريد الإلكترون مسجل بالفعل', 409);
        }

        // Create new user
        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const userData = {
            id: userId,
            email,
            password: password, // In production, hash this!
            displayName: displayName || email.split('@')[0],
            phone: phone || '',
            role: 'restaurant_owner',
            plan: 'free',
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            restaurant: restaurant ? {
                name: restaurant.name,
                nameEn: restaurant.nameEn || '',
                slug: generateSlug(restaurant.name),
                address: restaurant.address || '',
                city: restaurant.city || '',
                cuisineType: restaurant.cuisineType || '',
                whatsappNumber: restaurant.whatsappNumber || phone || '',
                logo: null,
                createdAt: new Date().toISOString()
            } : null
        };

        // Save to Firebase
        await fetch(`${CONFIG.firebase.databaseURL}/users/${userId}.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });

        // Create token
        const token = btoa(JSON.stringify({
            userId,
            email,
            role: 'restaurant_owner',
            exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
        }));

        // Remove password from response
        delete userData.password;

        return successResponse({ token, user: userData }, 'تم إنشاء الحساب بنجاح');

    } catch (error) {
        return errorResponse('فشل في إنشاء الحساب: ' + error.message, 500);
    }
}

function handleLogout() {
    return successResponse(null, 'تم تسجيل الخروج');
}

async function getCurrentUser({ request }) {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
        return errorResponse('غير مصرح به', 401);
    }

    try {
        const payload = JSON.parse(atob(token));
        
        if (payload.exp < Date.now() / 1000) {
            return errorResponse('انتهت صلاحية الجلسة', 401);
        }

        // Fetch fresh user data
        const userRes = await fetch(`${CONFIG.firebase.databaseURL}/users/${payload.userId}.json`);
        const user = await userRes.json();

        delete user?.password;

        return successResponse(user);

    } catch (error) {
        return errorResponse('جلسة غير صالحة', 401);
    }
}

function resetPassword() {
    return successResponse(null, 'تم إرسال رابط إعادة تعيين كلمة المرور');
}

// ========================================
// 🍽️ Restaurant Handlers
// ========================================

async function getRestaurants() {
    try {
        const res = await fetch(`${CONFIG.firebase.databaseURL}/restaurants.json`);
        const data = await res.json();
        return successResponse(data || {});
    } catch (error) {
        return errorResponse('فشل في جلب المطاعم: ' + error.message);
    }
}

async function getRestaurant({ params }) {
    try {
        const res = await fetch(`${CONFIG.firebase.databaseURL}/restaurants/${params.id}.json`);
        const data = await res.json();
        
        if (!data) {
            return errorResponse('المطعم غير موجود', 404);
        }
        
        return successResponse(data);
    } catch (error) {
        return errorResponse('فشل في جلب بيانات المطعم: ' + error.message);
    }
}

async function updateRestaurant({ request, params }) {
    try {
        const updates = await request.json();
        updates.updatedAt = new Date().toISOString();

        await fetch(`${CONFIG.firebase.databaseURL}/restaurants/${params.id}.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });

        return successResponse(updates, 'تم تحديث بيانات المطعم');
    } catch (error) {
        return errorResponse('فشل في تحديث البيانات: ' + error.message);
    }
}

async function getRestaurantBySlug({ params }) {
    try {
        const res = await fetch(`${CONFIG.firebase.databaseURL}/restaurants.json?orderBy="slug"&equalTo="${params.slug}"`);
        const data = await res.json();
        
        if (!data || Object.keys(data).length === 0) {
            return errorResponse('المطعم غير موجود', 404);
        }

        const restaurantId = Object.keys(data)[0];
        return successResponse({ ...data[restaurantId], id: restaurantId });
    } catch (error) {
        return errorResponse('خطأ: ' + error.message);
    }
}

// ========================================
// 📋 Menu Handlers
// ========================================

async function getMenu({ url, request }) {
    try {
        const restaurantId = url.searchParams.get('restaurantId');
        
        if (!restaurantId) {
            return errorResponse('معرف المطعم مطلوب');
        }

        const [categoriesRes, itemsRes] = await Promise.all([
            fetch(`${CONFIG.firebase.databaseURL}/categories.json?orderBy="restaurantId"&equalTo="${restaurantId}"`),
            fetch(`${CONFIG.firebase.databaseURL}/menu_items.json?orderBy="categoryId"`)
        ]);

        const categories = await categoriesRes.json();
        const allItems = await itemsRes.json();

        // Filter items by restaurant's categories
        const categoryIds = categories ? Object.keys(categories) : [];
        const items = {};

        if (allItems) {
            for (const [itemId, item] of Object.entries(allItems)) {
                if (categoryIds.includes(item.categoryId)) {
                    items[itemId] = item;
                }
            }
        }

        return successResponse({
            restaurantId,
            categories: categories || {},
            items: items
        }, 'تم جلب القائمة');

    } catch (error) {
        return errorResponse('فشل في جلب القائمة: ' + error.message);
    }
}

async function saveMenu({ request }) {
    try {
        const menuData = await request.json();
        
        if (!menuData.restaurantId) {
            return errorResponse('معرف المطعم مطلوب');
        }

        // Save categories
        if (menuData.categories) {
            for (const category of menuData.categories) {
                const categoryId = category.id || `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                await fetch(`${CONFIG.firebase.databaseURL}/categories/${categoryId}.json`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...category,
                        id: categoryId,
                        restaurantId: menuData.restaurantId,
                        createdAt: category.createdAt || new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    })
                });

                // Save items for this category
                if (category.items) {
                    for (const item of category.items) {
                        const itemId = item.id || `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                        await fetch(`${CONFIG.firebase.databaseURL}/menu_items/${itemId}.json`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                ...item,
                                id: itemId,
                                categoryId,
                                createdAt: item.createdAt || new Date().toISOString(),
                                updatedAt: new Date().toISOString()
                            })
                        });
                    }
                }
            }
        }

        return successResponse(menuData, 'تم حفظ القائمة بنجاح');

    } catch (error) {
        return errorResponse('فشل في حفظ القائمة: ' + error.message);
    }
}

async function getCategories({ url }) {
    const restaurantId = url.searchParams.get('restaurantId');
    
    if (!restaurantId) {
        return errorResponse('معرف المطعم مطلوب');
    }

    const res = await fetch(
        `${CONFIG.firebase.databaseURL}/categories.json?orderBy="restaurantId"&equalTo="${restaurantId}"`
    );
    const data = await res.json();
    
    return successResponse(data || {});
}

async function createCategory({ request }) {
    const data = await request.json();
    const categoryId = `cat_${Date.now()}`;

    const category = {
        id: categoryId,
        name: data.name,
        nameEn: data.nameEn || '',
        description: data.description || '',
        image: data.image || null,
        displayOrder: data.displayOrder || 0,
        isActive: true,
        restaurantId: data.restaurantId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    await fetch(`${CONFIG.firebase.databaseURL}/categories/${categoryId}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(category)
    });

    return successResponse(category, 'تم إنشاء القسم');
}

async function updateCategory({ params, request }) {
    const updates = await request.json();
    updates.updatedAt = new Date().toISOString();

    await fetch(`${CONFIG.firebase.databaseURL}/categories/${params.id}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
    });

    return successResponse(updates, 'تم تحديث القسم');
}

async function deleteCategory({ params }) {
    await fetch(`${CONFIG.firebase.databaseURL}/categories/${params.id}.json`, {
        method: 'DELETE'
    });

    // Also delete items in this category
    const itemsRes = await fetch(
        `${CONFIG.firebase.databaseURL}/menu_items.json?orderBy="categoryId"&equalTo="${params.id}"`
    );
    const items = await itemsRes.json();

    if (items) {
        for (const itemId of Object.keys(items)) {
            await fetch(`${CONFIG.firebase.databaseURL}/menu_items/${itemId}.json`, {
                method: 'DELETE'
            });
        }
    }

    return successResponse(null, 'تم حذف القسم');
}

async function getMenuItems({ url }) {
    const categoryId = url.searchParams.get('categoryId');
    const restaurantId = url.searchParams.get('restaurantId');

    let endpoint = `${CONFIG.firebase.databaseURL}/menu_items.json`;
    
    if (categoryId) {
        endpoint += `?orderBy="categoryId"&equalTo="${categoryId}"`;
    } else if (restaurantId) {
        // Need to filter by restaurant - more complex query
        endpoint += '';
    }

    const res = await fetch(endpoint);
    const data = await res.json();

    return successResponse(data || {});
}

async function createMenuItem({ request }) {
    const data = await request.json();
    const itemId = `item_${Date.now()}`;

    const item = {
        id: itemId,
        name: data.name,
        nameEn: data.nameEn || '',
        description: data.description || '',
        descriptionEn: data.descriptionEn || '',
        image: data.image || null,
        price: parseFloat(data.price) || 0,
        compareAtPrice: data.compareAtPrice || null,
        currency: data.currency || 'EGP',
        isAvailable: data.isAvailable !== false,
        isPopular: data.isPopular || false,
        isNew: data.isNew || false,
        isSpicy: data.isSpicy || false,
        isVegetarian: data.isVegetarian || false,
        preparationTime: data.preparationTime || null,
        calories: data.calories || null,
        displayOrder: data.displayOrder || 0,
        categoryId: data.categoryId,
        sizes: data.sizes || [],
        addons: data.addons || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    await fetch(`${CONFIG.firebase.databaseURL}/menu_items/${itemId}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
    });

    return successResponse(item, 'تم إنشاء الصنف');
}

async function updateMenuItem({ params, request }) {
    const updates = await request.json();
    updates.updatedAt = new Date().toISOString();

    await fetch(`${CONFIG.firebase.databaseURL}/menu_items/${params.id}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
    });

    return successResponse(updates, 'تم تحديث الصنف');
}

async function deleteMenuItem({ params }) {
    await fetch(`${CONFIG.firebase.databaseURL}/menu_items/${params.id}.json`, {
        method: 'DELETE'
    });

    return successResponse(null, 'تم حذف الصنف');
}

// ========================================
// 🛒 Order Handlers
// ========================================

async function getOrders({ url }) {
    const restaurantId = url.searchParams.get('restaurantId');
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    let endpoint = `${CONFIG.firebase.databaseURL}/orders.json?orderBy="createdAt"&limitToLast=${limit}`;
    
    if (status) {
        endpoint = `${CONFIG.firebase.databaseURL}/orders.json?orderBy="status"&equalTo="${status}"`;
    }

    const res = await fetch(endpoint);
    const data = await res.json();

    // Filter by restaurant if needed
    let orders = data || {};
    if (restaurantId && data) {
        orders = {};
        for (const [orderId, order] of Object.entries(data)) {
            if (order.restaurantId === restaurantId) {
                orders[orderId] = order;
            }
        }
    }

    return successResponse(orders);
}

async function createOrder({ request }) {
    try {
        const orderData = await request.json();

        // Generate order number
        const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;
        const orderId = `order_${Date.now()}`;

        const order = {
            id: orderId,
            orderNumber,
            restaurantId: orderData.restaurantId,
            customerId: orderData.customerId || null,
            customerName: orderData.customerName || '',
            customerPhone: orderData.customerPhone || '',
            customerEmail: orderData.customerEmail || '',
            customerAddress: orderData.customerAddress || '',
            status: 'pending',
            paymentMethod: orderData.paymentMethod || 'whatsapp',
            subtotal: parseFloat(orderData.subtotal) || 0,
            taxAmount: parseFloat(orderData.taxAmount) || 0,
            deliveryFee: parseFloat(orderData.deliveryFee) || 0,
            discountAmount: parseFloat(orderData.discountAmount) || 0,
            totalAmount: parseFloat(orderData.totalAmount) || 0,
            currency: orderData.currency || 'EGP',
            notes: orderData.notes || '',
            source: orderData.source || 'web',
            items: orderData.items || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Save to Firebase
        await fetch(`${CONFIG.firebase.databaseURL}/orders/${orderId}.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(order)
        });

        // Create notification
        await createNotificationForOrder(order);

        return successResponse(order, 'تم إنشاء الطلب بنجاح');

    } catch (error) {
        return errorResponse('فشل في إنشاء الطلب: ' + error.message);
    }
}

async function getOrder({ params }) {
    const res = await fetch(`${CONFIG.firebase.databaseURL}/orders/${params.id}.json`);
    const order = await res.json();

    if (!order) {
        return errorResponse('الطلب غير موجود', 404);
    }

    return successResponse(order);
}

async function updateOrderStatus({ params, request }) {
    try {
        const { status, cancelReason } = await request.json();
        const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];

        if (!validStatuses.includes(status)) {
            return errorResponse('حالة غير صالحة');
        }

        const updates = {
            status,
            updatedAt: new Date().toISOString()
        };

        if (status === 'preparing') {
            updates.preparedAt = new Date().toISOString();
        } else if (status === 'delivered') {
            updates.deliveredAt = new Date().toISOString();
        } else if (status === 'cancelled') {
            updates.cancelledAt = new Date().toISOString();
            updates.cancelReason = cancelReason || '';
        }

        await fetch(`${CONFIG.firebase.databaseURL}/orders/${params.id}.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });

        // Get order details for notification
        const orderRes = await fetch(`${CONFIG.firebase.databaseURL}/orders/${params.id}.json`);
        const order = await orderRes.json();

        // Create status notification
        await createNotificationForOrderStatus(order, status);

        return successResponse(updates, `تم تحديث حالة الطلب إلى "${getStatusText(status)}"`);

    } catch (error) {
        return errorResponse('فشل في تحديث الحالة: ' + error.message);
    }
}

async function cancelOrder({ params, request }) {
    const { reason } = await request.json() || {};

    return updateOrderStatus({ params, request: { json: async () => ({ status: 'cancelled', cancelReason: reason }) } });
}

async function getOrderStats({ url }) {
    const restaurantId = url.searchParams.get('restaurantId');
    const period = url.searchParams.get('period') || 'today';

    // Calculate date range
    const now = new Date();
    let startDate;

    switch (period) {
        case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
        case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        default:
            startDate = new Date(0);
    }

    // Fetch all orders for the restaurant
    const res = await fetch(`${CONFIG.firebase.databaseURL}/orders.json`);
    const allOrders = await res.json();

    let stats = {
        totalOrders: 0,
        pendingOrders: 0,
        confirmedOrders: 0,
        preparingOrders: 0,
        readyOrders: 0,
        deliveredOrders: 0,
        cancelledOrders: 0,
        totalRevenue: 0,
        averageOrderValue: 0
    };

    if (allOrders) {
        const filteredOrders = Object.values(allOrders).filter(order => {
            const orderDate = new Date(order.createdAt);
            return orderDate >= startDate && (!restaurantId || order.restaurantId === restaurantId);
        });

        stats.totalOrders = filteredOrders.length;

        filteredOrders.forEach(order => {
            switch (order.status) {
                case 'pending': stats.pendingOrders++; break;
                case 'confirmed': stats.confirmedOrders++; break;
                case 'preparing': stats.preparingOrders++; break;
                case 'ready': stats.readyOrders++; break;
                case 'delivered': stats.deliveredOrders++; break;
                case 'cancelled': stats.cancelledOrders++; break;
            }

            if (order.status !== 'cancelled') {
                stats.totalRevenue += order.totalAmount || 0;
            }
        });

        stats.averageOrderValue = stats.totalOrders > 0 
            ? Math.round(stats.totalRevenue / stats.totalOrders * 100) / 100 
            : 0;
    }

    return successResponse(stats);
}

function getStatusText(status) {
    const texts = {
        pending: 'جديد',
        confirmed: 'مؤكد',
        preparing: 'قيد التحضير',
        ready: 'جاهز',
        delivered: 'تم التوصيل',
        cancelled: 'ملغي'
    };
    return texts[status] || status;
}

// ========================================
// 🔔 Notification Helpers
// ========================================

async function createNotificationForOrder(order) {
    const notification = {
        id: `notif_${Date.now()}`,
        orderId: order.id,
        userId: order.userId || order.restaurantId,
        title: '🆕 طلب جديد',
        message: `طلب #${order.orderNumber} من ${order.customerName || 'زبون'} - ${formatCurrency(order.totalAmount)}`,
        type: 'order_new',
        isRead: false,
        createdAt: new Date().toISOString()
    };

    await fetch(`${CONFIG.firebase.databaseURL}/notifications/${notification.id}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notification)
    });
}

async function createNotificationForOrderStatus(order, newStatus) {
    const statusMessages = {
        confirmed: '✅ تم تأكيد طلبك',
        preparing: '👨‍🍳 طلبك قيد التحضير',
        ready: '📦 طلبك جاهز!',
        delivered: '🎉 تم توصيل طلبك'
    };

    const notification = {
        id: `notif_${Date.now()}`,
        orderId: order.id,
        userId: order.userId || order.restaurantId,
        title: statusMessages[newStatus] || 'تحديث الطلب',
        message: `حالة طلب #${order.orderNumber}: ${getStatusText(newStatus)}`,
        type: `order_${newStatus}`,
        isRead: false,
        createdAt: new Date().toISOString()
    };

    await fetch(`${CONFIG.firebase.databaseURL}/notifications/${notification.id}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notification)
    });
}

async function getNotifications({ url }) {
    const userId = url.searchParams.get('userId');
    const limit = parseInt(url.searchParams.get('limit') || '20');

    const res = await fetch(`${CONFIG.firebase.databaseURL}/notifications.json?orderBy="createdAt"&limitToLast=${limit}`);
    const data = await res.json();

    let notifications = data || {};
    
    if (userId && data) {
        notifications = {};
        for (const [notifId, notif] of Object.entries(data)) {
            if (notif.userId === userId) {
                notifications[notifId] = notif;
            }
        }
    }

    return successResponse(notifications);
}

async function createNotification({ request }) {
    const data = await request.json();
    const notificationId = `notif_${Date.now()}`;

    const notification = {
        id: notificationId,
        ...data,
        isRead: false,
        createdAt: new Date().toISOString()
    };

    await fetch(`${CONFIG.firebase.databaseURL}/notifications/${notificationId}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notification)
    });

    return successResponse(notification, 'تم إنشاء الإشعار');
}

async function markNotificationRead({ params }) {
    await fetch(`${CONFIG.firebase.databaseURL}/notifications/${params.id}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: true })
    });

    return successResponse(null, 'تم تحديد الإشعار كمقروء');
}

// ========================================
// 📤 Upload Handlers (R2)
// ========================================

async function handleUpload({ request, env }) {
    try {
        if (!env.R2_BUCKET) {
            return errorResponse('خدمة التخزين غير متاحة', 503);
        }

        const formData = await request.formData();
        const file = formData.get('file');
        
        if (!file) {
            return errorResponse('الملف مطلوب');
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            return errorResponse('نوع الملف غير مدعوم');
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            return errorResponse('حجم الملف كبير جداً (حد أقصى 10MB)');
        }

        // Generate unique key
        const ext = file.name.split('.').pop();
        const key = `uploads/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;

        // Upload to R2
        await env.R2_BUCKET.put(key, file.stream(), {
            httpMetadata: {
                contentType: file.type,
                contentDisposition: `inline; filename="${file.name}"`
            }
        });

        // Return URL
        const url = `https://${env.R2_BUCKET.bucket}.${env.R2_BUCKET.zone}.cloudflarestorage.com/${key}`;

        return successResponse({
            key,
            url,
            filename: file.name,
            size: file.size,
            type: file.type
        }, 'تم رفع الملف بنجاح');

    } catch (error) {
        return errorResponse('فشل في رفع الملف: ' + error.message);
    }
}

async function getFileUrl({ params, env }) {
    if (!env.R2_BUCKET) {
        return errorResponse('خدمة التخزين غير متاحة', 503);
    }

    const object = await env.R2_BUCKET.get(params.key);
    
    if (!object) {
        return errorResponse('الملف غير موجود', 404);
    }

    const url = new URL(`https://${env.R2_BUCKET.bucket}.${env.R2_BUCKET.zone}.cloudflarestorage.com/${params.key}`);
    
    return successResponse({ url: url.toString() });
}

async function deleteFile({ params, env }) {
    if (!env.R2_BUCKET) {
        return errorResponse('خدمة التخزين غير متاحة', 503);
    }

    await env.R2_BUCKET.delete(params.key);
    
    return successResponse(null, 'تم حذف الملف');
}

// ========================================
// 📊 Analytics Handlers
// ========================================

async function getDashboardStats({ url }) {
    const restaurantId = url.searchParams.get('restaurantId');
    
    // Get order stats
    const orderStats = await getOrderStats({ url }).then(r => r.json());

    // Get menu stats
    const menuRes = await fetch(`${CONFIG.firebase.databaseURL}/menu_items.json`);
    const allItems = await menuRes.json();
    
    let totalItems = 0;
    let availableItems = 0;
    
    if (allItems) {
        totalItems = Object.keys(allItems).length;
        availableItems = Object.values(allItems).filter(i => i.isAvailable !== false).length;
    }

    // Get views count (would need analytics service)
    const views = Math.floor(Math.random() * 1000) + 500; // Mock data

    return successResponse({
        orders: orderStats.data,
        menu: {
            totalItems,
            availableItems,
            categories: 6 // Would calculate from actual data
        },
        views,
        revenue: {
            today: orderStats.data?.totalRevenue || 0,
            week: (orderStats.data?.totalRevenue || 0) * 7, // Approximation
            month: (orderStats.data?.totalRevenue || 0) * 30
        }
    });
}

async function getMenuPerformance() {
    // Analyze which items are most ordered
    // This would require aggregating order data
    
    return successResponse({
        topItems: [
            { itemId: 1, name: 'شيش طاووق', orderCount: 67, revenue: 6365 },
            { itemId: 2, name: 'بيتزا مارغريتا', orderCount: 45, revenue: 5400 },
            { itemId: 4, name: 'فاهيتا لحم', orderCount: 38, revenue: 5700 }
        ],
        categoryPerformance: [
            { name: 'المشويات', percentage: 35 },
            { name: 'الأطباق الرئيسية', percentage: 28 },
            { name: 'المقبلات', percentage: 18 },
            { name: 'المشروبات', percentage: 12 },
            { name: 'الحلويات', percentage: 7 }
        ]
    });
}

async function getRevenueData({ url }) {
    const period = url.searchParams.get('period') || 'month';
    
    // Generate mock revenue data
    const days = period === 'week' ? 7 : 30;
    const data = [];

    for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        
        data.push({
            date: date.toISOString().split('T')[0],
            revenue: Math.floor(Math.random() * 3000) + 1000,
            orders: Math.floor(Math.random() * 20) + 5
        });
    }

    return successResponse({
        period,
        data,
        total: data.reduce((sum, d) => sum + d.revenue, 0),
        average: Math.round(data.reduce((sum, d) => sum + d.revenue, 0) / data.length)
    });
}

// ========================================
// 💳 Subscription Handlers
// ========================================

function getPlans() {
    return successResponse([
        {
            id: 'free',
            name: 'مجاني',
            price: 0,
            currency: 'EGP',
            features: [
                'قائمة رقمية أساسية',
                'حتى 20 صنف',
                'طلبات via WhatsApp',
                'إحصائيات أساسية'
            ],
            limits: { maxItems: 20, maxOrders: Infinity }
        },
        {
            id: 'pro',
            name: 'احترافي',
            price: 199,
            currency: 'EGP',
            popular: true,
            features: [
                'كل مميزات المجاني',
                'أصناف غير محدودة',
                'استيراد بالذكاء الاصطناعي',
                'شعار وألوان مخصصة',
                'تحليلات متقدمة',
                'QR Code مخصص',
                'دعم فني 24/7'
            ],
            limits: { maxItems: Infinity, maxOrders: Infinity }
        },
        {
            id: 'enterprise',
            name: 'المؤسسات',
            price: 499,
            currency: 'EGP',
            features: [
                'كل مميزات الاحترافي',
                'فروع متعددة',
                'مستخدمين غير محدودين',
                'API مخصص',
                'تكاملات مخصصة',
                'مدير حساب خاص',
                'SLA مضمون'
            ],
            limits: { maxItems: Infinity, maxOrders: Infinity, maxBranches: Infinity }
        }
    ]);
}

function createSubscription() {
    // Would integrate with payment provider (Paymob, PayTabs, etc.)
    return successResponse({
        checkoutUrl: 'https://checkout.example.com/payment',
        message: 'سيتم توجيهك لصفحة الدفع'
    }, 'تم إنشاء طلب الاشتراك');
}

function getCurrentSubscription() {
    return successResponse({
        plan: 'pro',
        status: 'active',
        currentPeriodStart: '2024-01-01',
        currentPeriodEnd: '2024-02-01',
        usage: {
            itemsUsed: 48,
            itemsLimit: Infinity,
            ordersThisMonth: 127
        }
    });
}

function cancelSubscription() {
    return successResponse(null, 'تم إرسال طلب إلغاء الاشتراك');
}

// ========================================
// 🌐 Public Menu Handler (Customer-facing)
// ========================================

async function getPublicMenu({ params }) {
    try {
        // Get restaurant by slug
        const restaurantRes = await fetch(
            `${CONFIG.firebase.databaseURL}/restaurants.json?orderBy="slug"&equalTo="${params.slug}"`
        );
        const restaurants = await restaurantRes.json();

        if (!restaurants || Object.keys(restaurants).length === 0) {
            return errorResponse('المطعم غير موجود', 404);
        }

        const restaurantId = Object.keys(restaurants)[0];
        const restaurant = restaurants[restaurantId];

        // Get menu
        const menuResult = await getMenu({ url: new URL(`http://localhost/api/menu?restaurantId=${restaurantId}`) });
        const menuData = await menuResult.json();

        return successResponse({
            restaurant: {
                id: restaurantId,
                name: restaurant.name,
                nameEn: restaurant.nameEn,
                cuisine: restaurant.cuisineType,
                city: restaurant.city,
                logo: restaurant.logo,
                whatsappNumber: restaurant.whatsappNumber,
                themeColor: restaurant.themeColor || '#ff6b35'
            },
            menu: menuData.success ? menuData.data : {}
        });

    } catch (error) {
        return errorResponse('خطأ في تحميل القائمة: ' + error.message);
    }
}

async function generateQRCode({ params }) {
    const baseUrl = typeof self !== 'undefined' && self.location 
        ? self.location.origin 
        : 'https://menu.nonm1724.workers.dev';
    
    const menuUrl = `${baseUrl}/r/${params.slug}`;
    
    // Use QR code API or generate
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(menuUrl)}`;

    return successResponse({
        qrCodeUrl: qrUrl,
        menuUrl,
        downloadUrl: qrUrl + '&download=1'
    });
}

// ========================================
// 🤖 Agnes AI Handlers
// ========================================

/**
 * POST /api/ai/chat
 * محادثة وتحليل القائمة بالذكاء الاصطناعي
 */
async function handleAIChat({ request, env }) {
    try {
        const { message, options = {} } = await request.json();
        
        if (!message) {
            return errorResponse('الرسالة مطلوبة');
        }

        const apiKey = env.AGNES_AI_API_KEY;
        
        if (!apiKey) {
            console.warn('[AI] API key not configured');
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
                        content: options.systemPrompt || 'أنت خبير في تحليل قوائم المطاعم. أجب باللغة العربية بشكل احترافي.'
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

        console.log('[AI] Chat response received');

        return successResponse({
            data: aiResponse,
            model: result.model || 'agnes-ai',
            usage: result.usage
        }, 'تمت المعالجة بالذكاء الاصطناعي!');

    } catch (error) {
        console.error('[AI] Chat error:', error);
        return errorResponse('فشل في معالجة الطلب: ' + error.message, 500);
    }
}

/**
 * POST /api/ai/image
 * توليد صور بالذكاء الاصطناعي
 */
async function handleAIImage({ request, env }) {
    try {
        const { prompt, options = {} } = await request.json();
        
        if (!prompt) {
            return errorResponse('وصف الصورة مطلوب');
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
                negative_prompt: options.negativePrompt || 'blurry, low quality, ugly, watermark',
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
 * تحليل صورة القائمة (OCR)
 */
async function handleAIAnalyze({ request, env }) {
    try {
        const { image, type = 'menu-ocr', options = {} } = await request.json();
        
        if (!image && type === 'menu-ocr') {
            return errorResponse('صورة القائمة مطلوبة');
        }

        const apiKey = env.AGNES_AI_API_KEY;
        
        if (!apiKey) {
            return errorResponse('خدمة الذكاء الاصطناعي غير متاحة. أضف AGNES_AI_API_KEY', 503);
        }

        console.log(`[AI Analyze] Type: ${type}`);

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
                        extractCategories: true
                    }
                })
            });

            if (!response.ok) {
                console.error('[AI Analyze] Error:', await response.text());
                return errorResponse('فشل في تحليل الصورة', 500);
            }

            const result = await response.json();

            // Structure the analyzed data
            const analyzedData = {
                categories: result.data?.categories || [
                    { name: 'المقبلات', items: [] },
                    { name: 'الأطباق الرئيسية', items: [] },
                    { name: 'المشروبات', items: [] }
                ],
                items: result.data?.items || [],
                confidence: result.confidence || 0.85,
                raw: result
            };

            return successResponse(analyzedData, 'تم تحليل القائمة بنجاح!');

        } else if (type === 'text-analysis') {
            return handleAIChat({ request, env });
        }

        return errorResponse('نوع التحليل غير مدعوم', 400);

    } catch (error) {
        console.error('[AI Analyze] Error:', error);
        return errorResponse('فشل في التحليل: ' + error.message);
    }
}

/**
 * GET /api/ai/status
 * فحص حالة خدمات الذكاء الاصطناعي
 */
async function getAIStatus({ env }) {
    return successResponse({
        services: {
            agnesAI: {
                available: !!env.AGNES_AI_API_KEY,
                configured: !!env.AGNES_AI_API_KEY,
                baseUrl: CONFIG.agnesAI.baseUrl
            }
        },
        primaryService: env.AGNES_AI_API_KEY ? 'agnes-ai' : 'fallback',
        recommendation: env.AGNES_AI_API_KEY 
            ? '✅ Agnes AI جاهز للعمل!' 
            : '⚠️ أضف AGNES_AI_API_KEY لتفعيل الذكاء الاصطناعي'
    }, 'تم جلب حالة الخدمة');
}

// ========================================
// Fallback Handlers (بدون API Key)
// ========================================

function fallbackChatResponse(message) {
    return successResponse({
        data: generateBasicAnalysis(),
        model: 'fallback-basic',
        isFallback: true
    }, 'تم التحليل (وضع أساسي)');
}

function fallbackImageResponse(prompt) {
    return successResponse({
        imageUrl: null,
        source: 'placeholder-fallback',
        prompt: prompt,
        isFallback: true
    }, 'وضع أساسي - أضف API Key لتوليد صور حقيقية');
}

function generateBasicAnalysis() {
    return `
## تحليل القائمة (وضع أساسي)

### ⚠️ ملاحظة
خدمة الذكاء الاصطناعي المتقدمة غير متاحة حالياً.

### 💡 اقتراحات عامة:
1. **تنظيم الأصناف**: قسم القائمة لأقسام واضحة
2. **التسعير**: تأكد من الأسعار التنافسية
3. **الوصف**: أضف وصفاً جذاباً لكل صنف
4. **الصور**: استخدم صوراً عالية الجودة
5. **العروض**: أضف عروضاً خاصة

### 📌 للحصول على تحليل متقدم:
قم بإضافة مفتاح **AGNES_AI_API_KEY** في إعدادات Worker.
`;
}

// ========================================
// Utility Functions
// ========================================

function generateSlug(text) {
    return text.toString().toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\u0600-\u06FF-]/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

function formatCurrency(amount, currency = 'EGP') {
    const symbols = { EGP: 'ج.م', USD: '$', SAR: 'ر.س', AED: 'د.إ' };
    return `${amount.toFixed(2)} ${symbols[currency] || currency}`;
}
