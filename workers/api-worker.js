/**
 * ===================================
 * MezoMenu - Main API Worker
 * Cloudflare Worker for handling all API requests
 * ===================================
 * 
 * Features:
 * - Authentication (JWT)
 * - Restaurant CRUD
 * - Menu Management
 * - Orders System
 * - Multi-tenancy isolation
 */

// Import dependencies
import { Router } from 'itty-router';
import { verifyJWT, generateJWT } from './auth';
import { firebase } from './firebase-client';

// Create router
const router = Router();

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle OPTIONS requests for CORS
router.options('*', () => new Response(null, { status: 200, headers: corsHeaders }));

// ==================== AUTH ROUTES ====================

/**
 * POST /api/auth/login
 * Login user and return JWT token
 */
router.post('/api/auth/login', async (request) => {
    try {
        const { email, password } = await request.json();
        
        // Validate input
        if (!email || !password) {
            return jsonResponse({ error: 'البريد الإلكتروني وكلمة المرور مطلوبان' }, 400);
        }
        
        // Get user from Firebase
        const userSnapshot = await firebase
            .ref(`users`)
            .orderByChild('email')
            .equalTo(email)
            .once('value');
        
        const users = userSnapshot.val();
        if (!users) {
            return jsonResponse({ error: 'المستخدم غير موجود' }, 404);
        }
        
        const userId = Object.keys(users)[0];
        const user = users[userId];
        
        // Verify password (in production, use proper hashing)
        // For demo, we'll accept demo credentials
        const isValidPassword = await verifyPassword(password, user.passwordHash);
        
        if (!isValidPassword) {
            return jsonResponse({ error: 'كلمة المرور غير صحيحة' }, 401);
        }
        
        // Generate JWT token
        const token = generateJWT({
            uid: userId,
            email: user.email,
            restaurantId: user.restaurantId,
            role: user.role
        });
        
        // Return user data and token
        return jsonResponse({
            success: true,
            token,
            user: {
                id: userId,
                name: user.name,
                email: user.email,
                restaurantId: user.restaurantId,
                role: user.role
            }
        }, 200);
        
    } catch (error) {
        console.error('Login error:', error);
        return jsonResponse({ error: 'فشل تسجيل الدخول' }, 500);
    }
});

/**
 * POST /api/auth/register
 * Register new restaurant owner
 */
router.post('/api/auth/register', async (request) => {
    try {
        const { name, email, password, phone, restaurantName, plan } = await request.json();
        
        // Validate required fields
        if (!name || !email || !password || !restaurantName) {
            return jsonResponse({ error: 'جميع الحقول المطلوبة يجب ملؤها' }, 400);
        }
        
        // Check if user already exists
        const existingUser = await firebase
            .ref('users')
            .orderByChild('email')
            .equalTo(email)
            .once('value');
        
        if (existingUser.exists()) {
            return jsonResponse({ error: 'هذا البريد الإلكتروني مسجل بالفعل' }, 409);
        }
        
        // Hash password
        const passwordHash = await hashPassword(password);
        
        // Create restaurant first
        const restaurantRef = firebase.ref('restaurants').push();
        const restaurantId = restaurantRef.key;
        
        const restaurantData = {
            id: restaurantId,
            name: restaurantName,
            slug: generateSlug(restaurantName),
            ownerId: null, // Will be set after user creation
            plan: plan || 'starter',
            status: 'active',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        
        await restaurantRef.set(restaurantData);
        
        // Create user
        const userRef = firebase.ref('users').push();
        const userId = userRef.key;
        
        const userData = {
            id: userId,
            name,
            email,
            passwordHash,
            phone: phone || '',
            restaurantId,
            role: 'owner',
            status: 'active',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        
        await userRef.set(userData);
        
        // Update restaurant with owner ID
        await firebase.ref(`restaurants/${restaurantId}/ownerId`).set(userId);
        
        // Generate JWT token
        const token = generateJWT({
            uid: userId,
            email,
            restaurantId,
            role: 'owner'
        });
        
        return jsonResponse({
            success: true,
            token,
            user: {
                id: userId,
                name,
                email,
                restaurantId,
                role: 'owner'
            },
            restaurant: restaurantData
        }, 201);
        
    } catch (error) {
        console.error('Registration error:', error);
        return jsonResponse({ error: 'فشل إنشاء الحساب' }, 500);
    }
});

// ==================== RESTAURANT ROUTES ====================

/**
 * GET /api/restaurants/:restaurantId
 * Get restaurant data (with tenant isolation)
 */
router.get('/api/restaurants/:restaurantId', async (request, { params }) => {
    try {
        // Verify authentication
        const authResult = await authenticateRequest(request);
        if (authResult.error) return authResult;
        
        const { restaurantId } = params;
        const { user } = authResult;
        
        // Tenant isolation: User can only access their own restaurant
        if (user.restaurantId !== restaurantId && user.role !== 'admin') {
            return jsonResponse({ error: 'غير مصرح بالوصول' }, 403);
        }
        
        // Get restaurant data
        const snapshot = await firebase.ref(`restaurants/${restaurantId}`).once('value');
        const restaurant = snapshot.val();
        
        if (!restaurant) {
            return jsonResponse({ error: 'المطعم غير موجود' }, 404);
        }
        
        return jsonResponse({ restaurant }, 200);
        
    } catch (error) {
        console.error('Get restaurant error:', error);
        return jsonResponse({ error: 'حدث خطأ في جلب بيانات المطعم' }, 500);
    }
});

/**
 * PUT /api/restaurants/:restaurantId
 * Update restaurant data
 */
router.put('/api/restaurants/:restaurantId', async (request, { params }) => {
    try {
        const authResult = await authenticateRequest(request);
        if (authResult.error) return authResult;
        
        const { restaurantId } = params;
        const { user } = authResult;
        const updateData = await request.json();
        
        // Tenant isolation check
        if (user.restaurantId !== restaurantId && user.role !== 'admin') {
            return jsonResponse({ error: 'غير مصرح بالوصول' }, 403);
        }
        
        // Remove sensitive fields from update data
        delete updateData.id;
        delete updateData.ownerId;
        delete updateData.createdAt;
        
        // Add updated timestamp
        updateData.updatedAt = Date.now();
        
        // Update in Firebase
        await firebase.ref(`restaurants/${restaurantId}`).update(updateData);
        
        // Return updated data
        const snapshot = await firebase.ref(`restaurants/${restaurantId}`).once('value');
        
        return jsonResponse({ 
            success: true, 
            restaurant: snapshot.val() 
        }, 200);
        
    } catch (error) {
        console.error('Update restaurant error:', error);
        return jsonResponse({ error: 'فشل تحديث بيانات المطعم' }, 500);
    }
});

// ==================== MENU ROUTES ====================

/**
 * GET /api/restaurants/:restaurantId/menu
 * Get restaurant menu
 */
router.get('/api/restaurants/:restaurantId/menu', async (request, { params }) => {
    try {
        const authResult = await authenticateRequest(request);
        if (authResult.error) return authResult;
        
        const { restaurantId } = params;
        const { user } = authResult;
        
        // Tenant isolation
        if (user.restaurantId !== restaurantId && user.role !== 'admin') {
            return jsonResponse({ error: 'غير مصرح بالوصول' }, 403);
        }
        
        // Get menu data
        const snapshot = await firebase.ref(`menus/${restaurantId}`).once('value');
        const menu = snapshot.val() || { categories: [], items: [] };
        
        return jsonResponse({ menu }, 200);
        
    } catch (error) {
        console.error('Get menu error:', error);
        return jsonResponse({ error: 'حدث خطأ في جلب القائمة' }, 500);
    }
});

/**
 * PUT /api/restaurants/:restaurantId/menu
 * Update entire menu
 */
router.put('/api/restaurants/:restaurantId/menu', async (request, { params }) => {
    try {
        const authResult = await authenticateRequest(request);
        if (authResult.error) return authResult;
        
        const { restaurantId } = params;
        const { user } = authResult;
        const menuData = await request.json();
        
        // Tenant isolation
        if (user.restaurantId !== restaurantId && user.role !== 'admin') {
            return jsonResponse({ error: 'غير مصرح بالوصول' }, 403);
        }
        
        // Validate menu structure
        if (!menuData.categories || !Array.isArray(menuData.categories)) {
            return jsonResponse({ error: 'هيكل القائمة غير صالح' }, 400);
        }
        
        // Save to Firebase
        await firebase.ref(`menus/${restaurantId}`).set({
            ...menuData,
            updatedAt: Date.now(),
            updatedBy: user.uid
        });
        
        return jsonResponse({ 
            success: true, 
            message: 'تم تحديث القائمة بنجاح',
            menu: menuData
        }, 200);
        
    } catch (error) {
        console.error('Update menu error:', error);
        return jsonResponse({ error: 'فشل تحديث القائمة' }, 500);
    }
});

// ==================== ORDERS ROUTES ====================

/**
 * GET /api/restaurants/:restaurantId/orders
 * Get orders for a restaurant
 */
router.get('/api/restaurants/:restaurantId/orders', async (request, { params, query }) => {
    try {
        const authResult = await authenticateRequest(request);
        if (authResult.error) return authResult;
        
        const { restaurantId } = params;
        const { user } = authResult;
        
        // Tenant isolation
        if (user.restaurantId !== restaurantId && user.role !== 'admin') {
            return jsonResponse({ error: 'غير مصرح بالوصول' }, 403);
        }
        
        // Parse query parameters
        const { status, limit = 50, offset = 0 } = query;
        
        let ordersRef = firebase.ref(`orders`).orderByChild('restaurantId').equalTo(restaurantId);
        
        // Apply filters
        if (status) {
            ordersRef = ordersRef.equalTo(status); // This would need restructuring for Firebase
        }
        
        const snapshot = await ordersRef.once('value');
        const ordersRaw = snapshot.val() || {};
        
        // Convert to array and apply pagination
        let orders = Object.entries(ordersRaw).map(([id, order]) => ({ id, ...order }));
        
        // Filter by status if provided
        if (status) {
            orders = orders.filter(order => order.status === status);
        }
        
        // Sort by date (newest first)
        orders.sort((a, b) => b.createdAt - a.createdAt);
        
        // Paginate
        const paginatedOrders = orders.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
        
        return jsonResponse({
            orders: paginatedOrders,
            total: orders.length,
            hasMore: offset + limit < orders.length
        }, 200);
        
    } catch (error) {
        console.error('Get orders error:', error);
        return jsonResponse({ error: 'حدث خطأ في جلب الطلبات' }, 500);
    }
});

/**
 * POST /api/orders
 * Create new order (public endpoint for customers)
 */
router.post('/api/orders', async (request) => {
    try {
        const orderData = await request.json();
        
        // Validate required fields
        const requiredFields = ['restaurantId', 'customerName', 'customerPhone', 'items'];
        for (const field of requiredFields) {
            if (!orderData[field]) {
                return jsonResponse({ error: `الحقل ${field} مطلوب` }, 400);
            }
        }
        
        // Calculate total
        const total = orderData.items.reduce((sum, item) => {
            return sum + (item.price * item.quantity);
        }, 0);
        
        // Generate order ID
        const orderId = `ORD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Create order object
        const order = {
            id: orderId,
            ...orderData,
            total,
            status: 'new',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        
        // Save to Firebase
        await firebase.ref(`orders/${orderId}`).set(order);
        
        // TODO: Send notification to restaurant
        // TODO: Send WhatsApp message if configured
        
        return jsonResponse({
            success: true,
            order,
            message: 'تم إنشاء الطلب بنجاح'
        }, 201);
        
    } catch (error) {
        console.error('Create order error:', error);
        return jsonResponse({ error: 'فشل إنشاء الطلب' }, 500);
    }
});

/**
 * PUT /api/restaurants/:restaurantId/orders/:orderId
 * Update order status
 */
router.put('/api/restaurants/:restaurantId/orders/:orderId', async (request, { params }) => {
    try {
        const authResult = await authenticateRequest(request);
        if (authResult.error) return authResult;
        
        const { restaurantId, orderId } = params;
        const { user } = authResult;
        const { status } = await request.json();
        
        // Tenant isolation
        if (user.restaurantId !== restaurantId && user.role !== 'admin') {
            return jsonResponse({ error: 'غير مصرح بالوصول' }, 403);
        }
        
        // Valid statuses
        const validStatuses = ['new', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return jsonResponse({ error: 'حالة الطلب غير صالحة' }, 400);
        }
        
        // Check if order exists and belongs to this restaurant
        const orderSnapshot = await firebase.ref(`orders/${orderId}`).once('value');
        const order = orderSnapshot.val();
        
        if (!order) {
            return jsonResponse({ error: 'الطلب غير موجود' }, 404);
        }
        
        if (order.restaurantId !== restaurantId) {
            return jsonResponse({ error: 'غير مصرح بالوصول لهذا الطلب' }, 403);
        }
        
        // Update order status
        await firebase.ref(`orders/${orderId}`).update({
            status,
            updatedAt: Date.now(),
            updatedBy: user.uid
        });
        
        // TODO: Send push notification about status change
        // TODO: Send WhatsApp notification
        
        return jsonResponse({
            success: true,
            message: 'تم تحديث حالة الطلب بنجاح',
            order: { ...order, status }
        }, 200);
        
    } catch (error) {
        console.error('Update order error:', error);
        return jsonResponse({ error: 'فشل تحديث حالة الطلب' }, 500);
    }
});

// ==================== AI ROUTES ====================

/**
 * POST /api/ai/analyze-menu
 * Analyze menu image using NVIDIA AI
 */
router.post('/api/ai/analyze-menu', async (request) => {
    try {
        const authResult = await authenticateRequest(request);
        if (authResult.error) return authResult;
        
        // Get form data with image
        const formData = await request.formData();
        const imageFile = formData.get('image');
        
        if (!imageFile) {
            return jsonResponse({ error: 'صورة القائمة مطلوبة' }, 400);
        }
        
        // Convert image to base64
        const imageBuffer = await imageFile.arrayBuffer();
        const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
        
        // Call NVIDIA AI API for OCR/Vision analysis
        const nvidiaResponse = await fetch(`${NVIDIA_API_URL}/vision/analyze`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${NVIDIA_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image: base64Image,
                task: 'menu_analysis'
            })
        });
        
        if (!nvidiaResponse.ok) {
            throw new Error('NVIDIA API error');
        }
        
        const aiResult = await nvidiaResponse.json();
        
        // Structure the analyzed menu
        const analyzedMenu = {
            categories: aiResult.categories || [],
            items: aiResult.items || [],
            confidence: aiResult.confidence || 0,
            rawText: aiResult.rawText || ''
        };
        
        return jsonResponse({
            success: true,
            menu: analyzedMenu,
            message: 'تم تحليل القائمة بنجاح'
        }, 200);
        
    } catch (error) {
        console.error('AI Analysis error:', error);
        return jsonResponse({ error: 'فشل تحليل القائمة بالذكاء الاصطناعي' }, 500);
    }
});

/**
 * POST /api/ai/generate-image
 * Generate food image using NVIDIA AI (Stable Diffusion XL)
 */
router.post('/api/ai/generate-image', async (request) => {
    try {
        const authResult = await authenticateRequest(request);
        if (authResult.error) return authResult;
        
        const { prompt, itemName, style } = await request.json();
        
        if (!prompt && !itemName) {
            return jsonResponse({ error: 'اسم الصنف أو الوصف مطلوب' }, 400);
        }
        
        // Build prompt for food photography
        const fullPrompt = prompt || `Professional food photography of ${itemName}, restaurant menu style, high quality, appetizing lighting, clean background`;
        
        // Call NVIDIA AI for image generation
        const response = await fetch(`${NVIDIA_API_URL}/image/generate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${NVIDIA_API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                prompt: fullPrompt,
                model: 'stable-diffusion-xl',
                width: 512,
                height: 512,
                steps: 30,
                cfg_scale: 7.5
            })
        });
        
        if (!response.ok) {
            throw new Error('Image generation failed');
        }
        
        const result = await response.json();
        
        // Upload generated image to R2
        const imageBase64 = result.image;
        const imageUrl = await uploadToR2(imageBase64, `${authResult.user.restaurantId}/items/${Date.now()}.png`);
        
        return jsonResponse({
            success: true,
            imageUrl,
            prompt: fullPrompt,
            message: 'تم توليد الصورة بنجاح'
        }, 200);
        
    } catch (error) {
        console.error('Image generation error:', error);
        return jsonResponse({ error: 'فشل توليد الصورة' }, 500);
    }
});

// ==================== UPLOAD ROUTE ====================

/**
 * POST /api/upload
 * Upload file to R2 storage
 */
router.post('/api/upload', async (request) => {
    try {
        const authResult = await authenticateRequest(request);
        if (authResult.error) return authResult;
        
        const formData = await request.formData();
        const file = formData.get('file');
        const type = formData.get('type') || 'general';
        
        if (!file) {
            return jsonResponse({ error: 'الملف مطلوب' }, 400);
        }
        
        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            return jsonResponse({ error: 'نوع الملف غير مدعوم' }, 400);
        }
        
        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            return jsonResponse({ error: 'حجم الملف كبير جداً (الحد الأقصى 5MB)' }, 400);
        }
        
        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Generate unique filename
        const extension = file.name.split('.').pop();
        const fileName = `${authResult.user.restaurantId}/${type}/${Date.now()}.${extension}`;
        
        // Upload to R2
        const imageUrl = await uploadToR2(buffer, fileName, file.type);
        
        return jsonResponse({
            success: true,
            url: imageUrl,
            fileName,
            message: 'تم رفع الملف بنجاح'
        }, 201);
        
    } catch (error) {
        console.error('Upload error:', error);
        return jsonResponse({ error: 'فشل رفع الملف' }, 500);
    }
});

// ==================== PUBLIC MENU ROUTES ====================

/**
 * GET /api/public/menu/:slug
 * Public endpoint to get menu by restaurant slug
 */
router.get('/api/public/menu/:slug', async (request, { params }) => {
    try {
        const { slug } = params;
        
        // Find restaurant by slug
        const restaurantsSnapshot = await firebase
            .ref('restaurants')
            .orderByChild('slug')
            .equalTo(slug)
            .once('value');
        
        const restaurants = restaurantsSnapshot.val();
        if (!restaurants) {
            return jsonResponse({ error: 'المطعم غير موجود' }, 404);
        }
        
        const restaurantId = Object.keys(restaurants)[0];
        const restaurant = restaurants[restaurantId];
        
        // Get menu
        const menuSnapshot = await firebase.ref(`menus/${restaurantId}`).once('value');
        const menu = menuSnapshot.val() || { categories: [], items: [] };
        
        return jsonResponse({
            restaurant: {
                id: restaurantId,
                name: restaurant.name,
                logo: restaurant.logo,
                coverImage: restaurant.coverImage,
                description: restaurant.description
            },
            menu
        }, 200);
        
    } catch (error) {
        console.error('Public menu error:', error);
        return jsonResponse({ error: 'حدث خطأ في جلب القائمة' }, 500);
    }
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Authenticate request using JWT
 */
async function authenticateRequest(request) {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { error: jsonResponse({ error: 'مطلوب توثيق' }, 401) };
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
        const payload = await verifyJWT(token);
        return { user: payload };
    } catch (error) {
        return { error: jsonResponse({ error: 'توثيق غير صالح أو منتهي الصلاحية' }, 401) };
    }
}

/**
 * JSON response helper
 */
function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
        }
    });
}

/**
 * Simple password hashing (use bcrypt in production)
 */
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + PASSWORD_SALT);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Password verification
 */
async function verifyPassword(password, hash) {
    const hashedPassword = await hashPassword(password);
    return hashedPassword === hash;
}

/**
 * Generate URL-friendly slug
 */
function generateSlug(text) {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-');
}

/**
 * Upload to Cloudflare R2
 */
async function uploadToR2(data, key, contentType = 'image/png') {
    const r2Bucket = R2_BUCKET;
    
    // In actual implementation, use R2 API
    // For now, return a placeholder URL
    const baseUrl = `https://cdn.mezomenu.com`;
    return `${baseUrl}/${key}`;
}

// ==================== MAIN HANDLER ====================

export default {
    async fetch(request, env, ctx) {
        // Bind environment variables globally
        if (env.NVIDIA_API_KEY) NVIDIA_API_KEY = env.NVIDIA_API_KEY;
        if (env.NVIDIA_API_URL) NVIDIA_API_URL = env.NVIDIA_API_URL;
        if (env.PASSWORD_SALT) PASSWORD_SALT = env.PASSWORD_SALT;
        if (env.R2_BUCKET) R2_BUCKET = env.R2_BUCKET;
        if (env.JWT_SECRET) JWT_SECRET = env.JWT_SECRET;
        
        // Initialize Firebase with env config
        if (env.FIREBASE_CONFIG) {
            // Firebase initialization would go here
        }
        
        // Route the request
        return router.handle(request);
    }
};

// Global variables (will be bound from env)
let NVIDIA_API_KEY = '';
let NVIDIA_API_URL = '';
let PASSWORD_SALT = 'mezomenu_default_salt_2024';
let R2_BUCKET = 'mezomenu-images';
let JWT_SECRET = 'mezomenu_jwt_secret_key_change_in_production';
