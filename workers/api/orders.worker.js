/**
 * MezoMenu - Orders Management Worker
 * Handles order creation, updates, and WhatsApp integration
 */

import { handlePreflight, errorResponse, successResponse } from '../shared/cors.js';
import firebase from '../shared/firebase.js';

export default {
    async fetch(request, env) {
        firebase.configure(env); // ⚠️ لازم قبل أي استخدام لـ firebase.read/write (يقرأ من env بدل process.env)
        const url = new URL(request.url);
        
        if (request.method === 'OPTIONS') {
            return handlePreflight(request);
        }

        const routes = {
            // Order CRUD
            'GET /api/orders': getOrders,
            'POST /api/orders': createOrder,
            'PUT /api/orders/:id': updateOrder,
            'DELETE /api/orders/:id': deleteOrder,
            
            // Order Status
            'POST /api/orders/:id/status': updateStatus,
            
            // Public order creation (for customer PWA)
            'POST /api/public/orders': createPublicOrder
        };

        const routeKey = `${request.method} ${url.pathname}`;
        
        // Handle dynamic routes with parameters
        let handler = routes[routeKey];
        
        if (!handler) {
            for (const [pattern, routeHandler] of Object.entries(routes)) {
                if (matchRoute(pattern, url.pathname)) {
                    handler = routeHandler;
                    break;
                }
            }
        }

        if (handler) {
            return handler(request, env, url);
        }

        return errorResponse('Orders endpoint not found', 404, request);
    }
};

// ========================================
// Authentication Middleware
// ========================================

async function authenticateRequest(request) {
    const authToken = request.headers.get('Authorization')?.replace('Bearer ', '');
    
    if (!authToken) {
        return { error: 'Authentication required', status: 401 };
    }

    try {
        const tokenData = JSON.parse(atob(authToken));
        
        if (tokenData.exp && tokenData.exp < Math.floor(Date.now() / 1000)) {
            return { error: 'Token expired', status: 401 };
        }

        return {
            userId: tokenData.userId,
            restaurantId: tokenData.restaurantId
        };
    } catch (error) {
        return { error: 'Invalid token', status: 401 };
    }
}

// ========================================
// Get Orders Handler
// ========================================

async function getOrders(request, env, url) {
    try {
        const auth = await authenticateRequest(request);
        if (auth.error) return errorResponse(auth.error, auth.status, request);

        const { restaurantId } = auth;
        
        // Query parameters
        const status = url.searchParams.get('status');
        const limit = parseInt(url.searchParams.get('limit')) || 50;
        const offset = parseInt(url.searchParams.get('offset')) || 0;
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');

        let ordersRef = `restaurants/${restaurantId}/orders`;
        let orders = await firebase.read(ordersRef) || {};

        // Convert to array
        let orderList = Object.entries(orders).map(([id, data]) => ({
            id,
            orderId: data.orderId || `#${id.slice(-4)}`,
            ...data
        }));

        // Filter by status
        if (status) {
            orderList = orderList.filter(order => order.status === status);
        }

        // Filter by date range
        if (startDate) {
            orderList = orderList.filter(order => order.createdAt >= new Date(startDate).getTime());
        }
        if (endDate) {
            orderList = orderList.filter(order => order.createdAt <= new Date(endDate).getTime());
        }

        // Sort by date (newest first)
        orderList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        // Pagination
        const total = orderList.length;
        const paginatedOrders = orderList.slice(offset, offset + limit);

        // Calculate stats
        const stats = calculateOrderStats(orderList);

        return successResponse({
            orders: paginatedOrders,
            pagination: {
                total,
                limit,
                offset,
                hasMore: offset + limit < total
            },
            stats
        }, null, request);

    } catch (error) {
        console.error('Get orders error:', error);
        return errorResponse('فشل في جلب الطلبات', 500, request);
    }
}

// ========================================
// Create Order Handler
// ========================================

async function createOrder(request, env) {
    try {
        const auth = await authenticateRequest(request);
        if (auth.error) return errorResponse(auth.error, auth.status, request);

        const body = await request.json();
        const { restaurantId } = auth;

        // Validate required fields
        if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
            return errorResponse('قائمة الأصناف مطلوبة', 400, request);
        }

        if (!body.customerName) {
            return errorResponse('اسم العميل مطلوب', 400, request);
        }

        if (!body.customerPhone) {
            return errorResponse('رقم هاتف العميل مطلوب', 400, request);
        }

        // Generate order ID
        const orderId = generateOrderId();
        const orderKey = `order_${Date.now().toString(36)}${Math.random().toString(36).substr(2, 4)}`;

        // Calculate totals
        let subtotal = 0;
        const processedItems = [];

        for (const item of body.items) {
            const itemTotal = (item.price || 0) * (item.quantity || 1);
            subtotal += itemTotal;

            processedItems.push({
                itemId: item.itemId,
                name: item.name,
                price: item.price,
                quantity: item.quantity || 1,
                notes: item.notes || '',
                variants: item.variants || [],
                addons: item.addons || [],
                total: itemTotal
            });
        }

        const deliveryFee = body.deliveryFee || 0;
        const discount = body.discount || 0;
        const tax = Math.round(subtotal * (body.taxRate || 0.14)); // 14% VAT in Egypt
        const total = subtotal + deliveryFee - discount + tax;

        // Create order object
        const order = {
            id: orderKey,
            orderId,
            restaurantId,
            
            // Customer info
            customerName: body.customerName.trim(),
            customerPhone: body.customerPhone.trim(),
            customerEmail: body.customerEmail || null,
            deliveryAddress: body.deliveryAddress || null,
            
            // Items
            items: processedItems,
            itemCount: processedItems.reduce((sum, item) => sum + item.quantity, 0),
            
            // Pricing
            subtotal,
            deliveryFee,
            discount,
            tax,
            total,
            currency: 'EGP',
            currencySymbol: 'ج.م',
            
            // Payment & Delivery
            paymentMethod: body.paymentMethod || 'cash',
            deliveryType: body.deliveryType || 'pickup', // pickup, delivery
            
            // Status
            status: 'new',
            statusHistory: [
                {
                    status: 'new',
                    timestamp: Date.now(),
                    note: 'تم إنشاء الطلب'
                }
            ],
            
            // Notes
            notes: body.notes || '',
            
            // Timestamps
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        // Save to Firebase
        await firebase.write(`restaurants/${restaurantId}/orders/${orderKey}`, order);

        // Update restaurant stats
        await updateRestaurantStats(restaurantId, total);

        // Send notifications
        await sendOrderNotifications(restaurantId, order);

        // If WhatsApp enabled, send to WhatsApp
        const restaurantData = await firebase.read(`restaurants/${restaurantId}`);
        if (restaurantData?.settings?.enableWhatsApp && restaurantData?.whatsappNumber) {
            await sendWhatsAppMessage(restaurantData.whatsappNumber, formatWhatsAppMessage(order), env);
        }

        return successResponse({
            order,
            whatsappSent: !!restaurantData?.settings?.enableWhatsApp
        }, `تم إنشاء الطلب ${orderId} بنجاح!`, request);

    } catch (error) {
        console.error('Create order error:', error);
        return errorResponse('فشل في إنشاء الطلب', 500, request);
    }
}

// ========================================
// Update Order Handler
// ========================================

async function updateOrder(request, env, url) {
    try {
        const auth = await authenticateRequest(request);
        if (auth.error) return errorResponse(auth.error, auth.status, request);

        const { restaurantId } = auth;
        const orderId = extractParam(url.pathname, '/api/orders/');

        if (!orderId) {
            return errorResponse('معرف الطلب مطلوب', 400, request);
        }

        // Check if order exists and belongs to this restaurant
        const existingOrder = await firebase.read(`restaurants/${restaurantId}/orders/${orderId}`);
        if (!existingOrder) {
            return errorResponse('الطلب غير موجود', 404, request);
        }

        const body = await request.json();

        // Allowed fields to update
        const allowedUpdates = [
            'customerName', 'customerPhone', 'customerEmail',
            'deliveryAddress', 'notes', 'paymentMethod'
        ];

        const updates = {};
        for (const field of allowedUpdates) {
            if (body[field] !== undefined) {
                updates[field] = body[field];
            }
        }

        updates.updatedAt = Date.now();

        // Merge and save
        const updatedOrder = { ...existingOrder, ...updates };
        await firebase.write(`restaurants/${restaurantId}/orders/${orderId}`, updatedOrder);

        return successResponse(updatedOrder, 'تم تحديث الطلب بنجاح', request);

    } catch (error) {
        console.error('Update order error:', error);
        return errorResponse('فشل في تحديث الطلب', 500, request);
    }
}

// ========================================
// Delete Order Handler
// ========================================

async function deleteOrder(request, env, url) {
    try {
        const auth = await authenticateRequest(request);
        if (auth.error) return errorResponse(auth.error, auth.status, request);

        const { restaurantId } = auth;
        const orderId = extractParam(url.pathname, '/api/orders/');

        if (!orderId) {
            return errorResponse('معرف الطلب مطلوب', 400, request);
        }

        const existingOrder = await firebase.read(`restaurants/${restaurantId}/orders/${orderId}`);
        if (!existingOrder) {
            return errorResponse('الطلب غير موجود', 404, request);
        }

        // Only allow deleting new or cancelled orders
        if (!['new', 'cancelled'].includes(existingOrder.status)) {
            return errorResponse('لا يمكن حذف هذا الطلب لأنه قيد المعالجة', 400, request);
        }

        await firebase.remove(`restaurants/${restaurantId}/orders/${orderId}`);

        return successResponse(null, 'تم حذف الطلب بنجاح', request);

    } catch (error) {
        console.error('Delete order error:', error);
        return errorResponse('فشل في حذف الطلب', 500, request);
    }
}

// ========================================
// Update Status Handler
// ========================================

async function updateStatus(request, env, url) {
    try {
        const auth = await authenticateRequest(request);
        if (auth.error) return errorResponse(auth.error, auth.status, request);

        const { restaurantId } = auth;
        const orderId = extractParam(url.pathname, '/api/orders/status').replace('/status', '');

        if (!orderId) {
            return errorResponse('معرف الطلب مطلوب', 400, request);
        }

        const body = await request.json();
        const { status, note } = body;

        if (!status) {
            return errorResponse('الحالة الجديدة مطلوبة', 400, request);
        }

        // Validate status transition
        const validStatuses = ['new', 'pending', 'preparing', 'ready', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return errorResponse('حالة غير صالحة', 400, request);
        }

        const existingOrder = await firebase.read(`restaurants/${restaurantId}/orders/${orderId}`);
        if (!existingOrder) {
            return errorResponse('الطلب غير موجود', 404, request);
        }

        // Add to status history
        const statusEntry = {
            status,
            timestamp: Date.now(),
            note: note || ''
        };

        const statusHistory = [...(existingOrder.statusHistory || []), statusEntry];

        // Update order
        const updates = {
            status,
            statusHistory,
            updatedAt: Date.now()
        };

        // Set completion time if completed
        if (status === 'completed' && !existingOrder.completedAt) {
            updates.completedAt = Date.now();
        }

        await firebase.update(`restaurants/${restaurantId}/orders/${orderId}`, updates);

        // Send notification about status change
        await sendStatusChangeNotification(restaurantId, existingOrder, status);

        const statusTexts = {
            new: 'جديد',
            pending: 'قيد الانتظار',
            preparing: 'قيد التحضير',
            ready: 'جاهز للاستلام',
            completed: 'تم التسليم',
            cancelled: 'ملغي'
        };

        return successResponse({
            orderId,
            status,
            statusText: statusTexts[status],
            updatedAt: Date.now()
        }, `تم تحديث حالة الطلب إلى "${statusTexts[status]}"`, request);

    } catch (error) {
        console.error('Update status error:', error);
        return errorResponse('فشل في تحديث الحالة', 500, request);
    }
}

// ========================================
// Public Order Creation (Customer PWA)
// ========================================

async function createPublicOrder(request, env) {
    try {
        const body = await request.json();
        const { slug, items, customerName, customerPhone, ...rest } = body;

        if (!slug) {
            return errorResponse('رابط المطعم مطلوب', 400, request);
        }

        // Find restaurant by slug
        const allRestaurants = await firebase.read('restaurants', { shallow: true });
        let restaurantId = null;

        if (allRestaurants) {
            for (const [id, data] of Object.entries(allRestaurants)) {
                if (data.slug === slug && data.isActive !== false) {
                    restaurantId = id;
                    break;
                }
            }
        }

        if (!restaurantId) {
            return errorResponse('المطعم غير موجود', 404, request);
        }

        // Create order without authentication (public)
        const orderData = {
            ...rest,
            restaurantId,
            items,
            customerName,
            customerPhone,
            source: 'public_menu' // Mark as coming from public menu
        };

        // Simulate authenticated request
        const mockRequest = new Request(request, {
            headers: {
                ...Object.fromEntries(request.headers),
                'Authorization': `Bearer ${btoa(JSON.stringify({ userId: 'public', restaurantId }))}`
            }
        });

        // Reuse createOrder logic
        return createOrder(mockRequest, env);

    } catch (error) {
        console.error('Public create order error:', error);
        return errorResponse('فشل في إنشاء الطلب', 500, request);
    }
}

// ========================================
// Notification Functions
// ========================================

async function sendOrderNotifications(restaurantId, order) {
    try {
        // In production, this would:
        // 1. Send push notification via FCM/Web Push
        // 2. Send email notification
        // 3. Trigger webhook
        
        console.log(`🔔 New order ${order.orderId} for restaurant ${restaurantId}`);

        // Store notification in database for real-time sync
        await firebase.push(`restaurants/${restaurantId}/notifications`, {
            type: 'new_order',
            title: 'طلب جديد!',
            message: `طلب #${order.orderId} من ${order.customerName} - ${order.total} ج.م`,
            orderId: order.id,
            read: false,
            createdAt: Date.now()
        });

    } catch (error) {
        console.error('Error sending notification:', error);
    }
}

async function sendStatusChangeNotification(restaurantId, order, newStatus) {
    try {
        const statusTexts = {
            preparing: '👨‍🍳 طلبك قيد التحضير',
            ready: '✅ طلبك جاهز للاستلام!',
            completed: '🚚 تم تسليم طلبك',
            cancelled: '❌ تم إلغاء طلبك'
        };

        const message = statusTexts[newStatus];
        if (message) {
            // Would send SMS/WhatsApp/Push to customer here
            console.log(`📱 Notifying customer ${order.customerPhone}: ${message}`);
        }

    } catch (error) {
        console.error('Error sending status notification:', error);
    }
}

async function sendWhatsAppMessage(toNumber, message, env = {}) {
    try {
        // Integrate with WhatsApp Business API
        // This is a placeholder - actual implementation depends on your WhatsApp provider

        const whatsappApiUrl = env.WHATSAPP_API_URL;

        if (whatsappApiUrl) {
            await fetch(whatsappApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${env.WHATSAPP_API_TOKEN}`
                },
                body: JSON.stringify({
                    to: toNumber.replace('+', ''),
                    text: message
                })
            });
        } else {
            console.log(`📱 WhatsApp message to ${toNumber}:`);
            console.log(message);
        }

    } catch (error) {
        console.error('WhatsApp send error:', error);
    }
}

function formatWhatsAppMessage(order) {
    const itemsText = order.items.map(item => 
        `• ${item.name} x${item.quantity} = ${item.total} ج.م`
    ).join('\n');

    return `🍽️ *طلب جديد - MezoMenu*
━━━━━━━━━━━━━━━
📋 *رقم الطلب:* ${order.orderId}
👤 *العميل:* ${order.customerName}
📱 *الهاتف:* ${order.customerPhone}
${order.deliveryAddress ? `📍 *العنوان:* ${order.deliveryAddress}` : ''}
━━━━━━━━━━━━━━━
🛒 *الأصناف:*
${itemsText}
━━━━━━━━━━━━━━━
💰 *المجموع:* ${order.total} ج.م
💳 *الدفع:* ${order.paymentMethod === 'cash' ? 'نقدي' : 'بطاقة'}
⏰ *التاريخ:* ${new Date(order.createdAt).toLocaleString('ar-EG')}
━━━━━━━━━━━━━━━
_تم الإرسال عبر MezoMenu_`;
}

// ========================================
// Stats Helper
// ========================================

async function updateRestaurantStats(restaurantId, orderAmount) {
    try {
        const stats = await firebase.read(`restaurants/${restaurantId}/stats`) || {};
        
        await firebase.update(`restaurants/${restaurantId}/stats`, {
            totalOrders: (stats.totalOrders || 0) + 1,
            totalRevenue: (stats.totalRevenue || 0) + orderAmount,
            lastOrderAt: Date.now()
        });

    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

function calculateOrderStats(orders) {
    const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;
    
    const statusCounts = orders.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
    }, {});

    return {
        totalOrders: orders.length,
        totalRevenue,
        avgOrderValue: Math.round(avgOrderValue),
        statusBreakdown: statusCounts
    };
}

// ========================================
// Utility Functions
// ========================================

function matchRoute(pattern, pathname) {
    const patternParts = pattern.split('/');
    const pathParts = pathname.split('/');
    
    if (patternParts.length !== pathParts.length) return false;
    
    return patternParts.every((part, i) => 
        part.startsWith(':') || part === pathParts[i]
    );
}

function extractParam(pathname, prefix) {
    return pathname.replace(prefix, '') || null;
}

function generateOrderId() {
    const prefix = 'ORD';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `${prefix}-${timestamp}${random}`;
}
