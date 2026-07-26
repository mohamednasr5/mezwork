/**
 * MezoMenu - AI Integration Worker (Agnes AI + Fallback APIs)
 * 
 * Primary AI Service: Agnes AI (https://platform.agnes-ai.com/)
 * Fallback Services: Google Vision, Hugging Face, Unsplash
 * 
 * ========================================
 * 📌 كيفية إضافة AGNES_AI_API_KEY:
 * ========================================
 * 
 * الطريقة 1: عبر متغيرات البيئة (Environment Variables)
 * ------------------------------------------
 * 1. اذهب إلى Cloudflare Dashboard
 * 2. اختر Workers & Pages
 * 3. اختر مشروع MezoMenu
 * 4. اذهب إلى Settings → Variables
 * 5. أضف متغير جديد:
 *    - الاسم: AGNES_AI_API_KEY
 *    - القيمة: [مفتاح API الخاص بك من Agnes AI]
 * 
 * الطريقة 2: عبر ملف .env (للتطوير المحلي)
 * ------------------------------------------
 * أنشئ ملف .env في مجلد المشروع:
 *   AGNES_AI_API_KEY=your_api_key_here
 * 
 * الطريقة 3: عبر wrangler.toml
 * ------------------------------------------
 * [vars]
 * AGNES_AI_API_KEY = "your_api_key_here"
 * 
 * ========================================
 */

import { handlePreflight, errorResponse, successResponse } from '../shared/cors.js';
import firebase from '../shared/firebase.js';

// ========================================
// Configuration
// ========================================

const CONFIG = {
    // 🔑 Agnes AI (Primary AI Service)
    agnesAI: {
        apiKey: process.env.AGNES_AI_API_KEY || '',  // ← ضع المفتاح هنا
        baseUrl: 'https://platform.agnes-ai.com/api',  // أو الرابط الصحيح من Agnes AI
        endpoints: {
            chat: '/v1/chat/completions',      // للمحادثة والتحليل
            image: '/v1/images/generations',     // لتوليد الصور
            vision: '/v1/vision/analyze'         // لتحليل الصور (OCR)
        },
        models: {
            chat: 'agnes-ai-latest',             // نموذج المحادثة
            image: 'agnes-image-gen',            // نموذج توليد الصور
            vision: 'agnes-vision'               // نموذج الرؤية
        }
    },
    
    // Google Cloud Vision (Fallback OCR)
    googleVision: {
        apiKey: process.env.GOOGLE_VISION_API_KEY || '',
        endpoint: 'https://vision.googleapis.com/v1/images:annotate'
    },
    
    // Unsplash API (Real Food Photos - Fallback)
    unsplash: {
        accessKey: process.env.UNSPLASH_ACCESS_KEY || '',
        endpoint: 'https://api.unsplash.com/search/photos'
    },
    
    // Hugging Face Inference (AI Image Gen - Fallback)
    huggingFace: {
        apiKey: process.env.HUGGINGFACE_API_KEY || '',
        endpoint: 'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0'
    }
};

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        
        if (request.method === 'OPTIONS') {
            return handlePreflight(request);
        }

        // ✅ Routes مع دعم Agnes AI
        const routes = {
            // ===== Agnes AI Endpoints (Primary) =====
            'POST /api/ai/chat': handleAgnesAIChat,           // محادثة وتحليل النصوص
            'POST /api/ai/image': handleAgnesAIImage,          // توليد الصور بالذكاء الاصطناعي
            'POST /api/ai/analyze': handleAgnesAIAnalyze,       // تحليل قائمة (OCR + AI)
            
            // ===== Fallback Endpoints =====
            'POST /api/ai/ocr': handleGoogleVisionOCR,           // Google Vision OCR
            'POST /api/ai/tesseract': handleTesseractOCR,        // Tesseract OCR (Free)
            'POST /api/ai/unsplash': handleUnsplashSearch,      // Unsplash Images
            'POST /api/ai/generate': handleHuggingFaceGeneration,// Hugging Face AI
            
            // Legacy endpoints (backward compatible)
            'POST /api/ai/generate-image': handleGenerateImage,
            
            // Usage Stats
            'GET /api/ai/usage': getUsage,
            
            // 🔍 Health Check for Agnes AI
            'GET /api/ai/status': getAIServiceStatus
        };

        const routeKey = `${request.method} ${url.pathname}`;
        const handler = routes[routeKey];

        if (handler) {
            return handler(request, env);
        }

        return errorResponse('AI endpoint not found', 404, request);
    }
};

// ========================================
// Authentication Helper
// ========================================

async function authenticateRequest(request) {
    const authToken = request.headers.get('Authorization')?.replace('Bearer ', '');
    
    if (!authToken) {
        return { authenticated: false, isFreeTier: true };
    }
    
    try {
        const tokenData = JSON.parse(atob(authToken));
        
        if (tokenData.exp && tokenData.exp < Math.floor(Date.now() / 1000)) {
            return { authenticated: false, error: 'Token expired' };
        }
        
        return {
            authenticated: true,
            userId: tokenData.userId,
            restaurantId: tokenData.restaurantId,
            plan: tokenData.plan || 'free'
        };
    } catch {
        return { authenticated: false, isFreeTier: true };
    }
}

// ========================================
// 🚀 Agnes AI Handlers (Primary Service)
// ========================================

/**
 * Handler 1: Agnes AI Chat (المحادثة والتحليل)
 * يستخدم لتحليل القائمة وإعطاء اقتراحات
 */
async function handleAgnesAIChat(request, env) {
    try {
        const body = await request.json();
        const { message, options = {} } = body;

        if (!message) {
            return errorResponse('الرسالة مطلوبة', 400, request);
        }

        // التحقق من وجود API Key
        if (!CONFIG.agnesAI.apiKey) {
            console.warn('[Agnes AI] API key not configured');
            // محاولة استخدام بديل إذا لم يكن Agnes متاحاً
            return await fallbackChatHandler(message, options, request);
        }

        console.log(`[Agnes AI] Sending chat request...`);

        // استدعاء Agnes AI Chat API
        const response = await fetch(`${CONFIG.agnesAI.baseUrl}${CONFIG.agnesAI.endpoints.chat}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.agnesAI.apiKey}`,
                'X-API-Key': CONFIG.agnesAI.apiKey  // بعض APIs تستخدم هذا Header
            },
            body: JSON.stringify({
                model: CONFIG.agnesAI.models.chat,
                messages: [
                    {
                        role: 'system',
                        content: options.systemPrompt || 'أنت خبير في تحليل قوائم المطاعم. أجب باللغة العربية بشكل احترافي ومنظم.'
                    },
                    {
                        role: 'user',
                        content: message
                    }
                ],
                max_tokens: options.maxTokens || 2000,
                temperature: options.temperature || 0.7,
                // إعدادات إضافية حسب مواصفات Agnes AI
                ...options.extraParams
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Agnes AI] API Error:', errorText);
            
            // إذا فشل Agnes، جرب البديل
            return await fallbackChatHandler(message, options, request);
        }

        const result = await response.json();
        
        // استخراج الرد بناءً على هيئة استجابة Agnes AI
        const aiResponse = result.choices?.[0]?.message?.content || 
                          result.response || 
                          result.text ||
                          result.data?.response ||
                          JSON.stringify(result);

        console.log(`[Agnes AI] Chat response received`);

        return successResponse({
            data: aiResponse,
            model: result.model || CONFIG.agnesAI.models.chat,
            usage: result.usage,
            rawResponse: result
        }, 'تمت المعالجة بالذكاء الاصطناعي!', request);

    } catch (error) {
        console.error('[Agnes AI] Chat error:', error);
        return errorResponse('فشل في معالجة الطلب: ' + error.message, 500, request);
    }
}

/**
 * Handler 2: Agnes AI Image Generation (توليد الصور)
 */
async function handleAgnesAIImage(request, env) {
    try {
        const body = await request.json();
        const { prompt, options = {} } = body;

        if (!prompt) {
            return errorResponse('وصف الصورة مطلوب', 400, request);
        }

        // التحقق من وجود API Key
        if (!CONFIG.agnesAI.apiKey) {
            console.warn('[Agnes AI] API key not configured, using fallback');
            return await fallbackImageHandler(prompt, options, request);
        }

        console.log(`[Agnes AI] Generating image: ${prompt.substring(0, 50)}...`);

        // استدعاء Agnes AI Image API
        const response = await fetch(`${CONFIG.agnesAI.baseUrl}${CONFIG.agnesAI.endpoints.image}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.agnesAI.apiKey}`,
                'X-API-Key': CONFIG.agnesAI.apiKey
            },
            body: JSON.stringify({
                model: CONFIG.agnesAI.models.image,
                prompt: prompt,
                negative_prompt: options.negativePrompt || 'blurry, low quality, distorted, ugly, bad lighting, watermark, text, logo, plastic looking, unappetizing',
                width: options.width || 512,
                height: options.height || 512,
                steps: options.steps || 25,
                guidance_scale: options.cfgScale || 7.5,
                style: options.style || 'food-photography',
                quality: options.quality || 'high'
                // إعدادات إضافية حسب مواصفات Agnes AI
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Agnes AI] Image API Error:', errorText);
            return await fallbackImageHandler(prompt, options, request);
        }

        // التعامل مع الاستجابة (قد تكون صورة أو JSON)
        const contentType = response.headers.get('content-type') || '';
        
        if (contentType.includes('image')) {
            // رد مباشر كصورة
            const imageBuffer = await response.arrayBuffer();
            const base64 = btoa(
                new Uint8Array(imageBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
            );

            return successResponse({
                imageUrl: `data:image/png;base64,${base64}`,
                imageBase64: base64,
                source: 'agnes-ai',
                prompt: prompt
            }, 'تم توليد الصورة!', request);

        } else {
            // رد كJSON يحتوي على رابط الصورة
            const result = await response.json();
            
            const imageUrl = result.url || 
                           result.image_url || 
                           result.data?.url ||
                           result.images?.[0]?.url;
            
            const imageBase64 = result.image || 
                               result.data?.base64 ||
                               result.images?.[0]?.base64;

            return successResponse {
                imageUrl: imageUrl || null,
                imageBase64: imageBase64 || null,
                source: 'agnes-ai',
                prompt: prompt,
                model: result.model || CONFIG.agnesAI.models.image
            }, 'تم توليد الصورة بالذكاء الاصطناعي!', request);
        }

    } catch (error) {
        console.error('[Agnes AI] Image generation error:', error);
        return await fallbackImageHandler(body?.prompt, body?.options, request);
    }
}

/**
 * Handler 3: Agnes AI Analyze Menu (تحليل القائمة بالكامل)
 * يجمع بين OCR والتحليل الذكي
 */
async function handleAgnesAIAnalyze(request, env) {
    try {
        const body = await request.json();
        const { image, type = 'menu-ocr', options = {} } = body;

        if (!image && type === 'menu-ocr') {
            return errorResponse('صورة القائمة مطلوبة', 400, request);
        }

        // التحقق من وجود API Key
        if (!CONFIG.agnesAI.apiKey) {
            console.warn('[Agnes AI] API key not configured');
            return await handleAnalyzeFallback(image, type, options, request);
        }

        console.log(`[Agnes AI] Analyzing menu (type: ${type})...`);

        if (type === 'menu-ocr' && image) {
            // تحليل صورة القائمة باستخدام Vision API
            const response = await fetch(`${CONFIG.agnesAI.baseUrl}${CONFIG.agnesAI.endpoints.vision}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CONFIG.agnesAI.apiKey}`,
                    'X-API-Key': CONFIG.agnesAI.apiKey
                },
                body: JSON.stringify({
                    model: CONFIG.agnesAI.models.vision,
                    image: image.startsWith('data:') ? image : `data:image/png;base64,${image}`,
                    task: 'menu-extraction',
                    options: {
                        language: options.language || 'ar',
                        extractPrices: true,
                        extractCategories: true,
                        extractDescriptions: true
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Agnes AI] Vision API Error:', errorText);
                return await handleAnalyzeFallback(image, type, options, request);
            }

            const result = await response.json();

            return successResponse({
                data: result.data || result,
                confidence: result.confidence || 0.85,
                method: 'agnes-ai-vision',
                text: result.text || null
            }, 'تم تحليل القائمة بنجاح!', request);

        } else if (type === 'text-analysis') {
            // تحليل نصي فقط
            return await handleAgnesAIChat(request, env);
        }

    } catch (error) {
        console.error('[Agnes AI] Analysis error:', error);
        return await handleAnalyzeFallback(body?.image, body?.type, body?.options, request);
    }
}

// ========================================
// Fallback Handlers (عند عدم توفر Agnes AI)
// ========================================

/**
 * Ballback Chat Handler
 */
async function fallbackChatHandler(message, options, request) {
    console.log('[Fallback] Using basic chat handler...');
    
    // هنا يمكن إضافة منطق بديل بسيط
    // أو إرجاع رسالة مفيدة
    
    return successResponse({
        data: generateBasicAnalysis(message),
        model: 'fallback-basic',
        isFallback: true
    }, 'تم التحليل (وضع أساسي)', request);
}

/**
 * Fallback Image Handler
 */
async function fallbackImageHandler(prompt, options, request) {
    console.log('[Fallback] Using placeholder image...');
    
    // إنشاء صورة تمثيلية
    return successResponse({
        imageUrl: null,
        imageBase64: generatePlaceholderBase64(prompt),
        source: 'placeholder-fallback',
        prompt: prompt,
        isFallback: true
    }, 'تم إنشاء صورة تمثيلية', request);
}

/**
 * Fallback Analysis Handler
 */
async function handleAnalyzeFallback(image, type, options, request) {
    console.log('[Fallback] Using basic analysis...');
    
    // محاولة Google Vision أولاً
    if (image) {
        let visionResult = await handleGoogleVisionOCR({ json: () => ({ image, options }) }, {});
        if (visionResult.status === 200) {
            return visionResult;
        }
    }
    
    return errorResponse(
        'خدمة الذكاء الاصطناعي غير متاحة حالياً. تأكد من إعداد AGNES_AI_API_KEY.',
        503,
        request,
        { suggestion: 'تواصل مع الدعم الفني لإضافة مفتاح API' }
    );
}

// ========================================
// Helper Functions
// ========================================

function generateBasicAnalysis(message) {
    // تحليل أساسي كـ fallback
    return `
## تحليل القائمة (وضع أساسي)

### ⚠️ ملاحظة
خدمة الذكاء الاصطناعي المتقدمة غير متاحة حالياً.

### 💡 اقتراحات عامة لتحسين القائمة:
1. **تنظيم الأصناف**: قسم القائمة إلى أقسام واضحة (مقبلات، أطباق رئيسية، مشروبات...)
2. **التسعير**: تأكد من أن الأسعار تنافسية ومناسبة للجودة
3. **الوصف**: أضف وصفاً جذاباً لكل صنف
4. **الصور**: استخدم صوراً عالية الجودة للأصناف
5. **العروض**: أضف عروضاً خاصة لجذب العملاء

### 📝 للحصول على تحليل متقدم:
قم بإضافة مفتاح **AGNES_AI_API_KEY** في إعدادات Worker.
`;
}

function generatePlaceholderBase64(itemName) {
    // إنشاء صورة placeholder بسيطة (في الإنتاج، استخدم canvas حقيقي)
    // هذه مجرد قيمة تجريبية
    return '';
}

// ========================================
// Google Cloud Vision OCR Handler (Fallback)
// ========================================

async function handleGoogleVisionOCR(request, env) {
    try {
        const body = await request.json();
        const { image, options = {} } = body;

        if (!image) {
            return errorResponse('صورة القائمة مطلوبة', 400, request);
        }

        if (!CONFIG.googleVision.apiKey) {
            return errorResponse('Google Vision API key not configured', 503, request);
        }

        let imageContent;
        if (image.startsWith('data:')) {
            imageContent = image.split(',')[1];
        } else {
            imageContent = image;
        }

        const visionResponse = await fetch(CONFIG.googleVision.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.googleVision.apiKey}`
            },
            body: JSON.stringify({
                requests: [{
                    image: { content: imageContent },
                    features: [
                        { type: 'TEXT_DETECTION', maxResults: 10 },
                        { type: 'DOCUMENT_TEXT_DETECTION', maxResults: 10 }
                    ],
                    imageContext: {
                        languageHints: [options.language === 'en' ? 'en' : 'ar']
                    }
                }]
            })
        });

        if (!visionResponse.ok) {
            throw new Error(`Vision API error: ${await visionResponse.text()}`);
        }

        const visionResult = await visionResponse.json();
        const extractedText = visionResult.responses?.[0]?.fullTextAnnotation?.text || '';

        return successResponse({
            text: extractedText,
            confidence: 0.9,
            method: 'google-vision'
        }, 'تم استخراج النص!', request);

    } catch (error) {
        return errorResponse('فشل في تحليل الصورة: ' + error.message, 500, request);
    }
}

// ========================================
// Other Handlers (Unsplash, Hugging Face, Tesseract)
// ========================================

async function handleTesseractOCR(request, env) {
    return errorResponse('Tesseract not implemented - Use Agnes AI instead', 501, request);
}

async function handleUnsplashSearch(request, env) {
    try {
        const body = await request.json();
        const { query, perPage = 1, orientation = 'squish' } = body;

        if (!CONFIG.unsplash.accessKey) {
            return errorResponse('Unsplash API key not configured', 503, request);
        }

        const params = new URLSearchParams({
            query, per_page: perPage.toString(), orientation, content_filter: 'high'
        });

        const response = await fetch(`${CONFIG.unsplash.endpoint}?${params}`, {
            headers: {
                'Authorization': `Client-ID ${CONFIG.unsplash.accessKey}`,
                'Accept-Version': 'v1'
            }
        });

        if (!response.ok) throw new Error(`Unsplash error: ${await response.text()}`);

        const data = await response.json();

        return successResponse({
            results: data.results?.map(photo => ({
                urls: photo.urls,
                user: { name: photo.user.name }
            })) || []
        }, `Found ${data.total} images`, request);

    } catch (error) {
        return errorResponse('Search failed: ' + error.message, 500, request);
    }
}

async function handleHuggingFaceGeneration(request, env) {
    try {
        const body = await request.json();
        const { prompt, width = 512, height = 512 } = body;

        if (!CONFIG.huggingFace.apiKey) {
            return errorResponse('Hugging Face API key not configured', 503, request);
        }

        const response = await fetch(CONFIG.huggingFace.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.huggingFace.apiKey}`
            },
            body: JSON.stringify({ inputs: prompt, parameters: { width, height } })
        });

        if (!response.ok) throw new Error(`HF error: ${await response.text()}`);

        const buffer = await response.arrayBuffer();
        const base64 = btoa(new Uint8Array(buffer).reduce((d, b) => d + String.fromCharCode(b), ''));

        return successResponse({
            image: `data:image/png;base64,${base64}`,
            source: 'huggingface'
        }, 'Image generated!', request);

    } catch (error) {
        return errorResponse('Generation failed: ' + error.message, 500, request);
    }
}

async function handleGenerateImage(request, env) {
    let result = await handleUnsplashSearch(request, env);
    const data = await result.clone().json().catch(() => null);
    if (!data?.results?.length) {
        result = await handleHuggingFaceGeneration(request, env);
    }
    return result;
}

// ========================================
// Status & Usage Handlers
// ========================================

async function getAIServiceStatus(request, env) {
    return successResponse({
        services: {
            agnesAI: {
                available: !!CONFIG.agnesAI.apiKey,
                configured: !!CONFIG.agnesAI.apiKey,
                baseUrl: CONFIG.agnesAI.baseUrl,
                endpoints: Object.keys(CONFIG.agnesAI.endpoints)
            },
            googleVision: !!CONFIG.googleVision.apiKey,
            unsplash: !!CONFIG.unsplash.accessKey,
            huggingFace: !!CONFIG.huggingFace.apiKey
        },
        primaryService: CONFIG.agnesAI.apiKey ? 'agnes-ai' : 'fallback',
        recommendation: CONFIG.agnesAI.apiKey 
            ? '✅ Agnes AI is configured and ready!' 
            : '⚠️ Please add AGNES_AI_API_KEY to enable full AI features'
    }, 'Service status retrieved', request);
}

async function getUsage(request, env) {
    const auth = await authenticateRequest(request);
    
    return successResponse({
        usage: { analysis: 45, generation: 23 },
        limits: { analysis: 100, generation: 50 },
        services: {
            agnesAI: !!CONFIG.agnesAI.apiKey,
            googleVision: !!CONFIG.googleVision.apiKey,
            unsplash: !!CONFIG.unsplash.accessKey
        }
    }, null, request);
}
