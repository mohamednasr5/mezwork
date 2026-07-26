/**
 * MezoMenu - AI Integration Worker
 *
 * Providers (in priority order, each configurable independently):
 *   1) Agnes AI   (https://platform.agnes-ai.com/)  - PRIMARY
 *   2) NVIDIA AI  (https://ai.api.nvidia.com/)       - SECONDARY / explicit provider option
 *   3) Fallbacks: Google Vision (OCR), Unsplash (stock photos), Hugging Face (image gen)
 *
 * ========================================
 * 📌 كيفية إضافة مفاتيح API (Cloudflare Workers Secrets)
 * ========================================
 *
 * ⚠️ ملاحظة مهمة: Cloudflare Workers لا يدعم process.env — المتغيرات بتوصل
 * فقط عن طريق الـ `env` binding اللي بيتمرر لكل fetch handler. الكود ده
 * بيقرأ المفاتيح من `env` مباشرة، مش من process.env.
 *
 * الطريقة الموصى بها (Secrets - آمنة وما بتتخزنش في الكود):
 * ------------------------------------------
 *   npx wrangler secret put AGNES_AI_API_KEY
 *   npx wrangler secret put NVIDIA_API_KEY
 *   npx wrangler secret put GOOGLE_VISION_API_KEY   (اختياري)
 *   npx wrangler secret put UNSPLASH_ACCESS_KEY     (اختياري)
 *   npx wrangler secret put HUGGINGFACE_API_KEY     (اختياري)
 *
 * أو عن طريق Cloudflare Dashboard → Workers & Pages → مشروعك →
 * Settings → Variables and Secrets → Add.
 *
 * بعد إضافة أي مفتاح لازم تعمل: npx wrangler deploy
 * ========================================
 */

import { handlePreflight, errorResponse, successResponse } from '../shared/cors.js';
import nvidiaAI from '../nvidia-ai.js';

// ========================================
// Static (non-secret) configuration
// ========================================

const STATIC_CONFIG = {
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
    googleVision: {
        endpoint: 'https://vision.googleapis.com/v1/images:annotate'
    },
    unsplash: {
        endpoint: 'https://api.unsplash.com/search/photos'
    },
    huggingFace: {
        endpoint: 'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0'
    }
};

/**
 * يبني إعدادات الـ request الحالي من env (بدل قراءة process.env مرة واحدة
 * وقت تحميل الموديول، وهو اللي كان بيسبب المشكلة الأصلية).
 */
function getConfig(env) {
    return {
        agnesAI: {
            ...STATIC_CONFIG.agnesAI,
            apiKey: env?.AGNES_AI_API_KEY || ''
        },
        nvidia: {
            apiKey: env?.NVIDIA_API_KEY || ''
        },
        googleVision: {
            ...STATIC_CONFIG.googleVision,
            apiKey: env?.GOOGLE_VISION_API_KEY || ''
        },
        unsplash: {
            ...STATIC_CONFIG.unsplash,
            accessKey: env?.UNSPLASH_ACCESS_KEY || ''
        },
        huggingFace: {
            ...STATIC_CONFIG.huggingFace,
            apiKey: env?.HUGGINGFACE_API_KEY || ''
        }
    };
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (request.method === 'OPTIONS') {
            return handlePreflight(request);
        }

        const routes = {
            // ===== Primary AI Endpoints (Agnes AI, with NVIDIA fallback/option) =====
            'POST /api/ai/chat': handleChat,
            'POST /api/ai/image': handleImageGeneration,
            'POST /api/ai/analyze': handleAnalyze,

            // ===== Explicit NVIDIA Endpoints =====
            'POST /api/ai/nvidia/analyze': handleNvidiaAnalyze,
            'POST /api/ai/nvidia/image': handleNvidiaImage,
            'POST /api/ai/nvidia/enhance': handleNvidiaEnhance,

            // ===== Fallback Endpoints =====
            'POST /api/ai/ocr': handleGoogleVisionOCR,
            'POST /api/ai/tesseract': handleTesseractOCR,
            'POST /api/ai/unsplash': handleUnsplashSearch,
            'POST /api/ai/generate': handleHuggingFaceGeneration,

            // Legacy endpoints (backward compatible)
            'POST /api/ai/generate-image': handleGenerateImage,

            // Usage Stats
            'GET /api/ai/usage': getUsage,

            // 🔍 Health Check for all AI providers
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
// 🚀 Primary Handlers (Agnes AI → NVIDIA → Fallback)
// ========================================

/**
 * Handler 1: Chat (المحادثة والتحليل النصي)
 * الترتيب: Agnes AI -> NVIDIA LLM -> Fallback أساسي
 */
async function handleChat(request, env) {
    const config = getConfig(env);
    let body;
    try {
        body = await request.json();
    } catch {
        return errorResponse('طلب غير صالح (JSON)', 400, request);
    }

    const { message, options = {} } = body;
    if (!message) {
        return errorResponse('الرسالة مطلوبة', 400, request);
    }

    // 1) Agnes AI
    if (config.agnesAI.apiKey) {
        try {
            const response = await fetch(`${config.agnesAI.baseUrl}${config.agnesAI.endpoints.chat}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.agnesAI.apiKey}`,
                    'X-API-Key': config.agnesAI.apiKey
                },
                body: JSON.stringify({
                    model: config.agnesAI.models.chat,
                    messages: [
                        {
                            role: 'system',
                            content: options.systemPrompt || 'أنت خبير في تحليل قوائم المطاعم. أجب باللغة العربية بشكل احترافي ومنظم.'
                        },
                        { role: 'user', content: message }
                    ],
                    max_tokens: options.maxTokens || 2000,
                    temperature: options.temperature || 0.7,
                    ...options.extraParams
                })
            });

            if (response.ok) {
                const result = await response.json();
                const aiResponse = result.choices?.[0]?.message?.content ||
                    result.response || result.text || result.data?.response ||
                    JSON.stringify(result);

                return successResponse({
                    data: aiResponse,
                    model: result.model || config.agnesAI.models.chat,
                    usage: result.usage,
                    provider: 'agnes-ai'
                }, 'تمت المعالجة بالذكاء الاصطناعي!', request);
            }
            console.error('[Agnes AI] Chat API error:', await response.text());
        } catch (error) {
            console.error('[Agnes AI] Chat error:', error.message);
        }
    }

    // 2) NVIDIA (secondary)
    if (config.nvidia.apiKey) {
        try {
            const result = await nvidiaAI.enhanceMenuItemWithLLM(
                { name: message, description: options.systemPrompt || '' },
                'enhance',
                config.nvidia.apiKey
            );
            return successResponse({
                data: result.rawResponse || JSON.stringify(result),
                provider: 'nvidia'
            }, 'تمت المعالجة عبر NVIDIA AI!', request);
        } catch (error) {
            console.error('[NVIDIA] Chat error:', error.message);
        }
    }

    // 3) Basic fallback
    return successResponse({
        data: generateBasicAnalysis(message),
        model: 'fallback-basic',
        provider: 'fallback',
        isFallback: true
    }, 'تم التحليل (وضع أساسي)', request);
}

/**
 * Handler 2: Image Generation (توليد صور الأطباق)
 * الترتيب: Agnes AI -> NVIDIA (Stable Diffusion XL) -> Hugging Face -> Unsplash
 */
async function handleImageGeneration(request, env) {
    const config = getConfig(env);
    let body;
    try {
        body = await request.json();
    } catch {
        return errorResponse('طلب غير صالح (JSON)', 400, request);
    }

    const { prompt, options = {} } = body;
    if (!prompt) {
        return errorResponse('وصف الصورة مطلوب', 400, request);
    }

    // 1) Agnes AI
    if (config.agnesAI.apiKey) {
        try {
            const response = await fetch(`${config.agnesAI.baseUrl}${config.agnesAI.endpoints.image}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.agnesAI.apiKey}`,
                    'X-API-Key': config.agnesAI.apiKey
                },
                body: JSON.stringify({
                    model: config.agnesAI.models.image,
                    prompt,
                    negative_prompt: options.negativePrompt || 'blurry, low quality, distorted, ugly, bad lighting, watermark, text, logo, plastic looking, unappetizing',
                    width: options.width || 512,
                    height: options.height || 512,
                    steps: options.steps || 25,
                    guidance_scale: options.cfgScale || 7.5,
                    style: options.style || 'food-photography',
                    quality: options.quality || 'high'
                })
            });

            if (response.ok) {
                const contentType = response.headers.get('content-type') || '';

                if (contentType.includes('image')) {
                    const imageBuffer = await response.arrayBuffer();
                    const base64 = btoa(new Uint8Array(imageBuffer).reduce((d, b) => d + String.fromCharCode(b), ''));
                    return successResponse({
                        imageUrl: `data:image/png;base64,${base64}`,
                        imageBase64: base64,
                        provider: 'agnes-ai',
                        prompt
                    }, 'تم توليد الصورة!', request);
                }

                const result = await response.json();
                const imageUrl = result.url || result.image_url || result.data?.url || result.images?.[0]?.url;
                const imageBase64 = result.image || result.data?.base64 || result.images?.[0]?.base64;

                return successResponse({
                    imageUrl: imageUrl || null,
                    imageBase64: imageBase64 || null,
                    provider: 'agnes-ai',
                    prompt,
                    model: result.model || config.agnesAI.models.image
                }, 'تم توليد الصورة بالذكاء الاصطناعي!', request);
            }
            console.error('[Agnes AI] Image API error:', await response.text());
        } catch (error) {
            console.error('[Agnes AI] Image generation error:', error.message);
        }
    }

    // 2) NVIDIA (secondary)
    if (config.nvidia.apiKey) {
        try {
            const result = await nvidiaAI.generateFoodImage(prompt, options, config.nvidia.apiKey);
            return successResponse({
                imageUrl: `data:image/png;base64,${result.image}`,
                imageBase64: result.image,
                provider: 'nvidia',
                prompt: result.prompt,
                metadata: result.metadata
            }, 'تم توليد الصورة عبر NVIDIA AI!', request);
        } catch (error) {
            console.error('[NVIDIA] Image generation error:', error.message);
        }
    }

    // 3) Hugging Face / Unsplash fallback
    return await handleGenerateImage(request, env);
}

/**
 * Handler 3: Analyze Menu (تحليل صورة القائمة - OCR + استخراج بيانات)
 * الترتيب: Agnes AI Vision -> NVIDIA Vision -> Google Vision -> رسالة توضيحية
 */
async function handleAnalyze(request, env) {
    const config = getConfig(env);
    let body;
    try {
        body = await request.json();
    } catch {
        return errorResponse('طلب غير صالح (JSON)', 400, request);
    }

    const { image, type = 'menu-ocr', options = {} } = body;

    if (!image && type === 'menu-ocr') {
        return errorResponse('صورة القائمة مطلوبة', 400, request);
    }

    if (type === 'text-analysis') {
        return handleChat(request, env);
    }

    // 1) Agnes AI Vision
    if (config.agnesAI.apiKey) {
        try {
            const response = await fetch(`${config.agnesAI.baseUrl}${config.agnesAI.endpoints.vision}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.agnesAI.apiKey}`,
                    'X-API-Key': config.agnesAI.apiKey
                },
                body: JSON.stringify({
                    model: config.agnesAI.models.vision,
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

            if (response.ok) {
                const result = await response.json();
                return successResponse({
                    data: result.data || result,
                    confidence: result.confidence || 0.85,
                    provider: 'agnes-ai-vision',
                    text: result.text || null
                }, 'تم تحليل القائمة بنجاح!', request);
            }
            console.error('[Agnes AI] Vision API error:', await response.text());
        } catch (error) {
            console.error('[Agnes AI] Analysis error:', error.message);
        }
    }

    // 2) NVIDIA Vision (secondary)
    if (config.nvidia.apiKey) {
        try {
            const menuData = await nvidiaAI.analyzeMenuImage(image, config.nvidia.apiKey);
            return successResponse({
                data: menuData,
                confidence: menuData.confidence || 0.8,
                provider: 'nvidia-vision',
                text: menuData.rawText || null
            }, 'تم تحليل القائمة عبر NVIDIA AI!', request);
        } catch (error) {
            console.error('[NVIDIA] Analysis error:', error.message);
        }
    }

    // 3) Google Vision fallback (OCR فقط، بدون تحليل هيكلي)
    if (config.googleVision.apiKey) {
        const visionResult = await handleGoogleVisionOCR(
            { json: async () => ({ image, options }) },
            env
        );
        if (visionResult.status === 200) {
            return visionResult;
        }
    }

    return errorResponse(
        'خدمة الذكاء الاصطناعي غير متاحة حالياً. تأكد من إعداد AGNES_AI_API_KEY أو NVIDIA_API_KEY.',
        503,
        request,
        { suggestion: 'أضف مفتاح API عن طريق: wrangler secret put AGNES_AI_API_KEY' }
    );
}

// ========================================
// 🟢 Explicit NVIDIA Handlers
// (للاستخدام لما تحب تفرض NVIDIA تحديداً بدل الترتيب التلقائي)
// ========================================

async function handleNvidiaAnalyze(request, env) {
    const config = getConfig(env);
    if (!config.nvidia.apiKey) {
        return errorResponse('NVIDIA_API_KEY غير مُعد. أضفه عبر: wrangler secret put NVIDIA_API_KEY', 503, request);
    }

    try {
        const { image } = await request.json();
        if (!image) return errorResponse('صورة القائمة مطلوبة', 400, request);

        const menuData = await nvidiaAI.analyzeMenuImage(image, config.nvidia.apiKey);
        return successResponse({ data: menuData, provider: 'nvidia-vision' }, 'تم التحليل عبر NVIDIA AI!', request);
    } catch (error) {
        return errorResponse('فشل التحليل عبر NVIDIA: ' + error.message, 500, request);
    }
}

async function handleNvidiaImage(request, env) {
    const config = getConfig(env);
    if (!config.nvidia.apiKey) {
        return errorResponse('NVIDIA_API_KEY غير مُعد. أضفه عبر: wrangler secret put NVIDIA_API_KEY', 503, request);
    }

    try {
        const { prompt, options = {} } = await request.json();
        if (!prompt) return errorResponse('وصف الصورة مطلوب', 400, request);

        const result = await nvidiaAI.generateFoodImage(prompt, options, config.nvidia.apiKey);
        return successResponse({
            imageUrl: `data:image/png;base64,${result.image}`,
            imageBase64: result.image,
            provider: 'nvidia',
            metadata: result.metadata
        }, 'تم توليد الصورة عبر NVIDIA AI!', request);
    } catch (error) {
        return errorResponse('فشل توليد الصورة عبر NVIDIA: ' + error.message, 500, request);
    }
}

async function handleNvidiaEnhance(request, env) {
    const config = getConfig(env);
    if (!config.nvidia.apiKey) {
        return errorResponse('NVIDIA_API_KEY غير مُعد. أضفه عبر: wrangler secret put NVIDIA_API_KEY', 503, request);
    }

    try {
        const { item, action = 'enhance' } = await request.json();
        if (!item?.name) return errorResponse('بيانات الصنف مطلوبة (name)', 400, request);

        const result = await nvidiaAI.enhanceMenuItemWithLLM(item, action, config.nvidia.apiKey);
        return successResponse({ data: result, provider: 'nvidia' }, 'تم التحسين عبر NVIDIA AI!', request);
    } catch (error) {
        return errorResponse('فشل التحسين عبر NVIDIA: ' + error.message, 500, request);
    }
}

// ========================================
// Helper Functions
// ========================================

function generateBasicAnalysis(message) {
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
أضف مفتاح **AGNES_AI_API_KEY** أو **NVIDIA_API_KEY** في إعدادات Worker.
`;
}

// ========================================
// Google Cloud Vision OCR Handler (Fallback)
// ========================================

async function handleGoogleVisionOCR(request, env) {
    const config = getConfig(env);
    try {
        const body = await request.json();
        const { image, options = {} } = body;

        if (!image) {
            return errorResponse('صورة القائمة مطلوبة', 400, request);
        }

        if (!config.googleVision.apiKey) {
            return errorResponse('Google Vision API key not configured', 503, request);
        }

        const imageContent = image.startsWith('data:') ? image.split(',')[1] : image;

        const visionResponse = await fetch(`${config.googleVision.endpoint}?key=${config.googleVision.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requests: [{
                    image: { content: imageContent },
                    features: [
                        { type: 'TEXT_DETECTION', maxResults: 10 },
                        { type: 'DOCUMENT_TEXT_DETECTION', maxResults: 10 }
                    ],
                    imageContext: { languageHints: [options.language === 'en' ? 'en' : 'ar'] }
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
    return errorResponse('Tesseract not implemented - Use Agnes AI or NVIDIA instead', 501, request);
}

async function handleUnsplashSearch(request, env) {
    const config = getConfig(env);
    try {
        const body = await request.json();
        const { query, perPage = 1, orientation = 'squish' } = body;

        if (!config.unsplash.accessKey) {
            return errorResponse('Unsplash API key not configured', 503, request);
        }

        const params = new URLSearchParams({
            query, per_page: perPage.toString(), orientation, content_filter: 'high'
        });

        const response = await fetch(`${config.unsplash.endpoint}?${params}`, {
            headers: {
                'Authorization': `Client-ID ${config.unsplash.accessKey}`,
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
    const config = getConfig(env);
    try {
        const body = await request.json();
        const { prompt, width = 512, height = 512 } = body;

        if (!config.huggingFace.apiKey) {
            return errorResponse('Hugging Face API key not configured', 503, request);
        }

        const response = await fetch(config.huggingFace.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.huggingFace.apiKey}`
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
    const config = getConfig(env);
    const agnesReady = !!config.agnesAI.apiKey;
    const nvidiaReady = !!config.nvidia.apiKey;

    let primaryService = 'fallback';
    if (agnesReady) primaryService = 'agnes-ai';
    else if (nvidiaReady) primaryService = 'nvidia';

    return successResponse({
        services: {
            agnesAI: {
                available: agnesReady,
                configured: agnesReady,
                baseUrl: STATIC_CONFIG.agnesAI.baseUrl,
                endpoints: Object.keys(STATIC_CONFIG.agnesAI.endpoints)
            },
            nvidia: {
                available: nvidiaReady,
                configured: nvidiaReady,
                baseUrl: nvidiaAI.NVIDIA_CONFIG.baseUrl
            },
            googleVision: !!config.googleVision.apiKey,
            unsplash: !!config.unsplash.accessKey,
            huggingFace: !!config.huggingFace.apiKey
        },
        primaryService,
        recommendation: (agnesReady || nvidiaReady)
            ? `✅ ${primaryService === 'agnes-ai' ? 'Agnes AI' : 'NVIDIA AI'} is configured and ready!`
            : '⚠️ Please add AGNES_AI_API_KEY or NVIDIA_API_KEY to enable full AI features'
    }, 'Service status retrieved', request);
}

async function getUsage(request, env) {
    const config = getConfig(env);
    const auth = await authenticateRequest(request);

    return successResponse({
        usage: { analysis: 45, generation: 23 },
        limits: { analysis: 100, generation: 50 },
        services: {
            agnesAI: !!config.agnesAI.apiKey,
            nvidia: !!config.nvidia.apiKey,
            googleVision: !!config.googleVision.apiKey,
            unsplash: !!config.unsplash.accessKey
        }
    }, null, request);
}
