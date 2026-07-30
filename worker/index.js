/**
 * MezoMenu - Cloudflare Worker
 * Complete API Server for Restaurant Management System
 * 
 * Features:
 * - Firebase Realtime Database Proxy
 * - R2 Image Storage
 * - AI Menu Analysis (Mistral OCR → Gemini 2.5 Flash → Qwen2.5-VL)
 * - CORS Support
 */

// ============================================
// Configuration
// ============================================

// Environment variables (set in Cloudflare Dashboard)
// FIREBASE_DB_URL - Firebase Realtime Database URL
// FIREBASE_API_KEY - Firebase API Key (for REST API)
// R2_BUCKET - R2 Bucket name
// MISTRAL_API_KEY - Mistral AI API Key
// GEMINI_API_KEY - Google Gemini API Key
// QWEN_API_KEY - Alibaba Qwen API Key

export default {
    async fetch(request, env) {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return handleCORS();
        }

        const url = new URL(request.url);
        const path = url.pathname;

        try {
            // Route requests
            if (path.startsWith('/api/firebase/')) {
                return handleFirebaseRequest(request, env, path.replace('/api/firebase/', ''));
            }
            
            if (path.startsWith('/api/upload')) {
                return handleUpload(request, env);
            }
            
            if (path.startsWith('/api/ai/analyze')) {
                return handleAIAnalysis(request, env);
            }
            
            if (path.startsWith('/api/dashboard')) {
                return handleDashboard(request, env);
            }
            
            if (path.startsWith('/api/menu')) {
                return handleMenuCRUD(request, env);
            }
            
            if (path.startsWith('/api/orders')) {
                return handleOrdersCRUD(request, env);
            }
            
            if (path.startsWith('/api/settings')) {
                return handleSettings(request, env);
            }
            
            if (path.startsWith('/api/promotions')) {
                return handlePromotionsCRUD(request, env);
            }
            
            if (path.startsWith('/api/reservations')) {
                return handleReservationsCRUD(request, env);
            }
            
            if (path.startsWith('/api/notifications')) {
                return handleNotificationsCRUD(request, env);
            }

            // Default: serve static files or return API info
            return new Response(JSON.stringify({
                name: 'MezoMenu API',
                version: '1.0.0',
                endpoints: [
                    '/api/firebase/* - Firebase Database Proxy',
                    '/api/upload - Image Upload to R2',
                    '/api/ai/analyze - AI Menu Analysis',
                    '/api/dashboard - Dashboard Statistics',
                    '/api/menu - Menu Items CRUD',
                    '/api/orders - Orders CRUD',
                    '/api/settings - Settings Management',
                    '/api/promotions - Promotions CRUD',
                    '/api/reservations - Reservations CRUD',
                    '/api/notifications - Notifications CRUD'
                ]
            }), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders() }
            });

        } catch (error) {
            console.error('Worker Error:', error);
            return jsonResponse({ error: error.message }, 500);
        }
    }
};

// ============================================
// CORS Handling
// ============================================

function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
    };
}

function handleCORS() {
    return new Response(null, { status: 204, headers: corsHeaders() });
}

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() }
    });
}

// ============================================
// Firebase Request Handler (Proxy)
// ============================================

async function handleFirebaseRequest(env, path) {
    const firebaseUrl = `${env.FIREBASE_DB_URL}/${path}.json`;
    
    const response = await fetch(firebaseUrl, {
        method: request.method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: request.method !== 'GET' ? await request.text() : undefined
    });
    
    const data = await response.json();
    return jsonResponse(data, response.status);
}

// ============================================
// Image Upload Handler (R2)
// ============================================

async function handleUpload(request, env) {
    if (!env.R2_BUCKET) {
        return jsonResponse({ error: 'R2 bucket not configured' }, 500);
    }

    if (request.method !== 'POST') {
        return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const customPath = formData.get('path') || 'uploads';

    if (!file) {
        return jsonResponse({ error: 'No file provided' }, 400);
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
        return jsonResponse({ error: 'File must be an image' }, 400);
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        return jsonResponse({ error: 'File too large (max 10MB)' }, 400);
    }

    try {
        // Generate unique filename
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 10);
        const extension = file.name.split('.').pop() || 'jpg';
        const filename = `${customPath}/${timestamp}-${randomId}.${extension}`;

        // Upload to R2
        await env.R2_BUCKET.put(filename, file.stream(), {
            httpMetadata: {
                contentType: file.type
            },
            customMetadata: {
                originalName: file.name,
                uploadedAt: new Date().toISOString()
            }
        });

        // Return public URL (configure your R2 public access)
        const publicUrl = `https://pub-${env.R2_BUCKET_NAME}.r2.dev/${filename}`;

        return jsonResponse({
            success: true,
            url: publicUrl,
            key: filename,
            metadata: {
                size: file.size,
                type: file.type,
                name: file.name
            }
        });

    } catch (error) {
        console.error('Upload error:', error);
        return jsonResponse({ error: 'Upload failed' }, 500);
    }
}

// ============================================
// AI Analysis Handler
// ============================================

async function handleAIAnalysis(request, env) {
    if (request.method !== 'POST') {
        return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const { image, category, currency } = await request.json();

    if (!image) {
        return jsonResponse({ error: 'Image is required' }, 400);
    }

    try {
        let result;
        
        // Try Mistral OCR first
        if (env.MISTRAL_API_KEY) {
            result = await analyzeWithMistral(image, env.MISTRAL_API_KEY, category, currency);
        }
        
        // Fallback to Gemini Vision
        if (!result && env.GEMINI_API_KEY) {
            result = await analyzeWithGemini(image, env.GEMINI_API_KEY, category, currency);
        }
        
        // Final fallback to Qwen2.5-VL
        if (!result && env.QWEN_API_KEY) {
            result = await analyzeWithQwen(image, env.QWEN_API_KEY, category, currency);
        }

        if (!result) {
            return jsonResponse({ 
                error: 'No AI provider available. Please configure at least one AI API key.' 
            }, 503);
        }

        return jsonResponse({
            success: true,
            provider: result.provider,
            items: result.items,
            confidence: result.confidence
        });

    } catch (error) {
        console.error('AI Analysis error:', error);
        return jsonResponse({ error: `Analysis failed: ${error.message}` }, 500);
    }
}

/**
 * Analyze menu using Mistral OCR + LLM
 */
async function analyzeWithMistral(imageBase64, apiKey, category, currency) {
    try {
        // Step 1: Extract text using Mistral OCR
        const ocrResponse = await fetch('https://api.mistral.ai/v1/ocr', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'mistral-ocr-latest',
                image: imageBase64,
                document_type: 'menu'
            })
        });

        if (!ocrResponse.ok) throw new Error('Mistral OCR failed');
        
        const ocrResult = await ocrResponse.json();
        const extractedText = ocrResult.text || ocrResult.pages?.[0]?.text || '';

        // Step 2: Parse text into structured menu items using Mistral LLM
        const parseResponse = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'mistral-small-latest',
                messages: [{
                    role: 'user',
                    content: `Extract all menu items from this text and format as JSON array.
                    
Text from menu image:
${extractedText}

Return ONLY a JSON array of items with this exact format:
[{"name": "Item Name", "description": "Brief description", "price": 0.00, "category": "${category || 'main'}", "ingredients": []}]

Currency: ${currency || 'EGP'}
If price is in another currency, convert to numbers only.`
                }],
                temperature: 0.1,
                max_tokens: 4000
            })
        });

        if (!parseResponse.ok) throw new Error('Mistral parsing failed');
        
        const parseResult = await parseResponse.json();
        const content = parseResult.choices?.[0]?.message?.content || '[]';
        
        // Extract JSON from response
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        const items = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

        return {
            provider: 'mistral',
            items,
            confidence: 0.92
        };

    } catch (error) {
        console.error('Mistral error:', error);
        return null;
    }
}

/**
 * Analyze menu using Google Gemini 2.5 Flash Vision
 */
async function analyzeWithGemini(imageBase64, apiKey, category, currency) {
    try {
        // Remove data URL prefix if present
        const base64Data = imageBase64.includes(',') 
            ? imageBase64.split(',')[1] 
            : imageBase64;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            {
                                inline_data: {
                                    mime_type: 'image/jpeg',
                                    data: base64Data
                                }
                            },
                            {
                                text: `Analyze this restaurant menu image and extract ALL menu items.

Return a JSON array of objects with EXACTLY this structure:
[
  {
    "name": "Item Name",
    "description": "Short description of the item",
    "price": 12.99,
    "category": "${category || 'main'}",
    "ingredients": ["ingredient1", "ingredient2"]
  }
]

Rules:
1. Extract EVERY visible menu item
2. Prices should be numbers only (no currency symbols)
3. If ingredients are mentioned, include them
4. Use "${category || 'main'}" as default category if not clear
5. Currency is ${currency || 'EGP'}
6. Return ONLY valid JSON array, no other text`
                            }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 8000,
                        responseMimeType: "application/json"
                    }
                })
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Gemini API error');
        }

        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
        const items = typeof text === 'string' ? JSON.parse(text) : text;

        return {
            provider: 'gemini',
            items: Array.isArray(items) ? items : [],
            confidence: 0.88
        };

    } catch (error) {
        console.error('Gemini error:', error);
        return null;
    }
}

/**
 * Analyze menu using Qwen2.5-VL (Alibaba)
 */
async function analyzeWithQwen(imageBase64, apiKey, category, currency) {
    try {
        // Remove data URL prefix if present
        const base64Data = imageBase64.includes(',') 
            ? imageBase64.split(',')[1] 
            : imageBase64;

        const response = await fetch(
            'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'qwen-vl-max-latest',
                    input: {
                        messages: [{
                            role: 'user',
                            content: [
                                {
                                    image_url: base64Data,
                                    type: 'image'
                                },
                                {
                                    text: `Extract all menu items from this restaurant menu image as JSON array.

Format:
[{"name": "...", "description": "...", "price": 0.00, "category": "${category || 'main'}", "ingredients": [...]}]

Currency: ${currency || 'EGP'}
Return only JSON.`,
                                    type: 'text'
                                }
                            ]
                        }]
                    },
                    parameters: {
                        result_format: 'message',
                        temperature: 0.1
                    }
                })
            }
        );

        if (!response.ok) throw new Error('Qwen API error');

        const result = await response.json();
        const content = result.output?.choices?.[0]?.message?.content || '[]';
        
        // Extract JSON from content
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        const items = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

        return {
            provider: 'qwen',
            items,
            confidence: 0.85
        };

    } catch (error) {
        console.error('Qwen error:', error);
        return null;
    }
}

// ============================================
// Dashboard Handler
// ============================================

async function handleDashboard(request, env) {
    const baseUrl = env.FIREBASE_DB_URL;
    
    // Fetch all necessary data in parallel
    const [ordersRes, menuItemsRes, reservationsRes, promotionsRes] = await Promise.all([
        fetch(`${baseUrl}/orders.json`),
        fetch(`${baseUrl}/menuItems.json`),
        fetch(`${baseUrl}/reservations.json`),
        fetch(`${baseUrl}/promotions.json`)
    ]);

    const [orders, menuItems, reservations, promotions] = await Promise.all([
        ordersRes.json(),
        menuItemsRes.json(),
        reservationsRes.json(),
        promotionsRes.json()
    ]);

    // Calculate statistics
    const ordersArray = orders ? Object.entries(orders).map(([id, o]) => ({ id, ...o })) : [];
    const menuItemsArray = menuItems ? Object.entries(menuItems).map(([id, i]) => ({ id, ...i })) : [];
    const today = new Date().toISOString().split('T')[0];
    const todayReservations = reservations 
        ? Object.values(reservations).filter(r => r.date === today).length 
        : 0;

    const stats = {
        orders: {
            total: ordersArray.length,
            today: ordersArray.filter(o => o.createdAt?.startsWith(today)).length,
            revenue: ordersArray
                .filter(o => o.status === 'delivered')
                .reduce((sum, o) => sum + (o.total || 0), 0),
            byStatus: {
                pending: ordersArray.filter(o => o.status === 'pending').length,
                preparing: ordersArray.filter(o => o.status === 'preparing').length,
                ready: ordersArray.filter(o => o.status === 'ready').length,
                delivered: ordersArray.filter(o => o.status === 'delivered').length,
                cancelled: ordersArray.filter(o => o.status === 'cancelled').length
            }
        },
        menuItems: {
            total: menuItemsArray.length,
            available: menuItemsArray.filter(i => i.available !== false).length
        },
        reservations: { today: todayReservations },
        promotions: {
            active: promotions 
                ? Object.values(promotions).filter(p => p.active && new Date(p.endDate) >= new Date()).length 
                : 0
        },
        recentOrders: ordersArray
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5),
        topItems: menuItemsArray
            .sort((a, b) => (b.orderCount || 0) - (a.orderCount || 0))
            .slice(0, 5)
    };

    return jsonResponse(stats);
}

// ============================================
// Generic CRUD Handlers
// ============================================

function getFirebaseUrl(env, path) {
    return `${env.FIREBASE_DB_URL}/${path}.json`;
}

async function handleMenuCRUD(request, env) {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
    switch (request.method) {
        case 'GET':
            if (id) {
                const item = await fetch(getFirebaseUrl(env, `menuItems/${id}`)).then(r => r.json());
                return jsonResponse(item);
            } else {
                const items = await fetch(getFirebaseUrl(env, 'menuItems')).then(r => r.json());
                const array = items ? Object.entries(items).map(([id, item]) => ({ id, ...item })) : [];
                return jsonResponse(array);
            }
            
        case 'POST':
            const newData = await request.json();
            const createRes = await fetch(getFirebaseUrl(env, 'menuItems'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...newData,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                })
            });
            const created = await createRes.json();
            return jsonResponse({ id: created.name, ...newData }, 201);
            
        case 'PUT':
            if (!id) return jsonResponse({ error: 'ID required' }, 400);
            const updateData = await request.json();
            await fetch(getFirebaseUrl(env, `menuItems/${id}`), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...updateData, updatedAt: new Date().toISOString() })
            });
            return jsonResponse({ id, ...updateData });
            
        case 'DELETE':
            if (!id) return jsonResponse({ error: 'ID required' }, 400);
            await fetch(getFirebaseUrl(env, `menuItems/${id}`), { method: 'DELETE' });
            return jsonResponse({ success: true });
            
        default:
            return jsonResponse({ error: 'Method not allowed' }, 405);
    }
}

async function handleOrdersCRUD(request, env) {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
    switch (request.method) {
        case 'GET':
            if (id) {
                const order = await fetch(getFirebaseUrl(env, `orders/${id}`)).then(r => r.json());
                return jsonResponse(order);
            } else {
                const orders = await fetch(getFirebaseUrl(env, 'orders')).then(r => r.json());
                const array = orders 
                    ? Object.entries(orders)
                        .map(([id, order]) => ({ id, ...order }))
                        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    : [];
                return jsonResponse(array);
            }
            
        case 'POST':
            const newOrder = await request.json();
            const createRes = await fetch(getFirebaseUrl(env, 'orders'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...newOrder,
                    status: 'pending',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                })
            });
            const created = await createRes.json();
            
            // Create notification
            await fetch(getFirebaseUrl(env, 'notifications'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: 'طلب جديد',
                    message: `طلب جديد #${created.name} من ${newOrder.customerName}`,
                    type: 'order',
                    read: false,
                    createdAt: new Date().toISOString()
                })
            });
            
            return jsonResponse({ id: created.name, ...newOrder }, 201);
            
        case 'PATCH':
            if (!id) return jsonResponse({ error: 'ID required' }, 400);
            const patchData = await request.json();
            await fetch(getFirebaseUrl(env, `orders/${id}`), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...patchData, updatedAt: new Date().toISOString() })
            });
            return jsonResponse({ id, ...patchData });
            
        case 'DELETE':
            if (!id) return jsonResponse({ error: 'ID required' }, 400);
            await fetch(getFirebaseUrl(env, `orders/${id}`), { method: 'DELETE' });
            return jsonResponse({ success: true });
            
        default:
            return jsonResponse({ error: 'Method not allowed' }, 405);
    }
}

async function handleSettings(request, env) {
    switch (request.method) {
        case 'GET':
            const settings = await fetch(getFirebaseUrl(env, 'settings')).then(r => r.json());
            return jsonResponse(settings || {});
            
        case 'PUT':
        case 'PATCH':
            const data = await request.json();
            await fetch(getFirebaseUrl(env, 'settings'), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return jsonResponse(data);
            
        default:
            return jsonResponse({ error: 'Method not allowed' }, 405);
    }
}

async function handlePromotionsCRUD(request, env) {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
    switch (request.method) {
        case 'GET':
            if (id) {
                const promo = await fetch(getFirebaseUrl(env, `promotions/${id}`)).then(r => r.json());
                return jsonResponse(promo);
            } else {
                const promos = await fetch(getFirebaseUrl(env, 'promotions')).then(r => r.json());
                const array = promos ? Object.entries(promos).map(([id, p]) => ({ id, ...p })) : [];
                return jsonResponse(array);
            }
            
        case 'POST':
            const newPromo = await request.json();
            const createRes = await fetch(getFirebaseUrl(env, 'promotions'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...newPromo, createdAt: new Date().toISOString(), usageCount: 0 })
            });
            const created = await createRes.json();
            return jsonResponse({ id: created.name, ...newPromo }, 201);
            
        case 'PUT':
            if (!id) return jsonResponse({ error: 'ID required' }, 400);
            const updateData = await request.json();
            await fetch(getFirebaseUrl(env, `promotions/${id}`), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });
            return jsonResponse({ id, ...updateData });
            
        case 'DELETE':
            if (!id) return jsonResponse({ error: 'ID required' }, 400);
            await fetch(getFirebaseUrl(env, `promotions/{id}`), { method: 'DELETE' });
            return jsonResponse({ success: true });
            
        default:
            return jsonResponse({ error: 'Method not allowed' }, 405);
    }
}

async function handleReservationsCRUD(request, env) {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
    switch (request.method) {
        case 'GET':
            if (id) {
                const res = await fetch(getFirebaseUrl(env, `reservations/${id}`)).then(r => r.json());
                return jsonResponse(res);
            } else {
                const reservations = await fetch(getFirebaseUrl(env, 'reservations')).then(r => r.json());
                const array = reservations 
                    ? Object.entries(reservations)
                        .map(([id, r]) => ({ id, ...r }))
                        .sort((a, b) => new Date(a.date) - new Date(b.date))
                    : [];
                return jsonResponse(array);
            }
            
        case 'POST':
            const newRes = await request.json();
            const createRes = await fetch(getFirebaseUrl(env, 'reservations'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...newRes, status: 'pending', createdAt: new Date().toISOString() })
            });
            const created = await createRes.json();
            
            // Create notification
            await fetch(getFirebaseUrl(env, 'notifications'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: 'حجز جديد',
                    message: `حجز جديد من ${newRes.customerName}`,
                    type: 'reservation',
                    read: false,
                    createdAt: new Date().toISOString()
                })
            });
            
            return jsonResponse({ id: created.name, ...newRes }, 201);
            
        case 'PATCH':
            if (!id) return jsonResponse({ error: 'ID required' }, 400);
            const patchData = await request.json();
            await fetch(getFirebaseUrl(env, `reservations/${id}`), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patchData)
            });
            return jsonResponse({ id, ...patchData });
            
        case 'DELETE':
            if (!id) return jsonResponse({ error: 'ID required' }, 400);
            await fetch(getFirebaseUrl(env, `reservations/{id}`), { method: 'DELETE' });
            return jsonResponse({ success: true });
            
        default:
            return jsonResponse({ error: 'Method not allowed' }, 405);
    }
}

async function handleNotificationsCRUD(request, env) {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
    switch (request.method) {
        case 'GET':
            if (id) {
                const notif = await fetch(getFirebaseUrl(env, `notifications/${id}`)).then(r => r.json());
                return jsonResponse(notif);
            } else {
                const notifications = await fetch(getFirebaseUrl(env, 'notifications')).then(r => r.json());
                const array = notifications 
                    ? Object.entries(notifications)
                        .map(([id, n]) => ({ id, ...n }))
                        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    : [];
                return jsonResponse(array);
            }
            
        case 'POST':
            const newNotif = await request.json();
            const createRes = await fetch(getFirebaseUrl(env, 'notifications'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...newNotif, read: false, createdAt: new Date().toISOString() })
            });
            const created = await createRes.json();
            return jsonResponse({ id: created.name, ...newNotif }, 201);
            
        case 'PATCH':
            if (!id) return jsonResponse({ error: 'ID required' }, 400);
            const patchData = await request.json();
            await fetch(getFirebaseUrl(env, `notifications/${id}`), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patchData)
            });
            return jsonResponse({ id, ...patchData });
            
        case 'DELETE':
            if (!id) return jsonResponse({ error: 'ID required' }, 400);
            await fetch(getFirebaseUrl(env, `notifications/{id}`), { method: 'DELETE' });
            return jsonResponse({ success: true });
            
        default:
            return jsonResponse({ error: 'Method not allowed' }, 405);
    }
}
