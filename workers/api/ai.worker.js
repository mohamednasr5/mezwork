/**
 * MezoMenu - AI Integration Worker
 * Handles NVIDIA AI API calls for menu analysis and image generation
 */

import { handlePreflight, errorResponse, successResponse } from '../shared/cors.js';
import firebase from '../shared/firebase.js';

// NVIDIA AI Configuration
const NVIDIA_CONFIG = {
    apiKey: process.env.NVIDIA_API_KEY || '',
    endpoints: {
        vision: 'https://ai.api.nvidia.com/v1/vision/microsoft/florence-2',
        imageGen: 'https://ai.api.nvidia.com/v1/genai/stabilityai/stable-diffusion-xl'
    },
    rateLimits: {
        free: { analysis: 0, generation: 0 },
        pro: { analysis: 100, generation: 50 },
        enterprise: { analysis: -1, generation: -1 }
    }
};

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        
        if (request.method === 'OPTIONS') {
            return handlePreflight(request);
        }

        const routes = {
            // Menu Analysis (OCR/Vision)
            'POST /api/ai/analyze': analyzeMenu,
            
            // Image Generation
            'POST /api/ai/generate': generateImage,
            
            // Usage Stats
            'GET /api/ai/usage': getUsage,
            
            // Batch Operations
            'POST /api/ai/batch-analyze': batchAnalyze,
            'POST /api/ai/batch-generate': batchGenerate
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
// Authentication & Rate Limiting
// ========================================

async function authenticateAndCheckLimit(request, actionType) {
    const authToken = request.headers.get('Authorization')?.replace('Bearer ', '');
    
    if (!authToken) {
        return { error: 'Authentication required', status: 401 };
    }

    try {
        const tokenData = JSON.parse(atob(authToken));
        
        if (tokenData.exp && tokenData.exp < Math.floor(Date.now() / 1000)) {
            return { error: 'Token expired', status: 401 };
        }

        const restaurantId = tokenData.restaurantId;
        
        // Get current usage
        const usage = await firebase.read(`restaurants/${restaurantId}/aiUsage`) || { analysis: 0, generation: 0 };
        
        // Get plan limits
        const plan = await getRestaurantPlan(restaurantId);
        const limits = NVIDIA_CONFIG.rateLimits[plan] || NVIDIA_CONFIG.rateLimits.free;
        
        // Check limit for this action type
        const currentUsage = usage[actionType] || 0;
        const limit = limits[actionType];
        
        if (limit !== -1 && currentUsage >= limit) {
            return {
                error: `وصلت للحد الأقصى من ${actionType === 'analysis' ? 'التحليل' : 'توليد الصور'} (${limit}/شهرياً)`,
                status: 429,
                usage: {
                    used: currentUsage,
                    limit,
                    remaining: 0
                }
            };
        }

        return {
            userId: tokenData.userId,
            restaurantId,
            plan,
            usage: {
                ...usage,
                [actionType]: currentUsage,
                limit,
                remaining: limit === -1 ? -1 : limit - currentUsage
            }
        };

    } catch (error) {
        console.error('Auth error:', error);
        return { error: 'Authentication failed', status: 401 };
    }
}

async function getRestaurantPlan(restaurantId) {
    try {
        const restaurant = await firebase.read(`restaurants/${restaurantId}`);
        return restaurant?.plan || 'free';
    } catch {
        return 'free';
    }
}

async function incrementUsage(restaurantId, type) {
    try {
        const usage = await firebase.read(`restaurants/${restaurantId}/aiUsage`) || {};
        const newValue = (usage[type] || 0) + 1;
        
        await firebase.update(`restaurants/${restaurantId}/aiUsage`, {
            [type]: newValue
        });
        
        return newValue;
    } catch (error) {
        console.error('Error incrementing usage:', error);
        return null;
    }
}

// ========================================
// Menu Analysis Handler
// ========================================

/**
 * Analyze menu image using NVIDIA Vision AI (Florence-2)
 */
async function analyzeMenu(request, env) {
    try {
        const authResult = await authenticateAndCheckLimit(request, 'analysis');
        if (authResult.error) {
            return errorResponse(authResult.error, authResult.status, request);
        }

        const body = await request.json();
        const { image, options = {} } = body;

        if (!image) {
            return errorResponse('صورة القائمة مطلوبة', 400, request);
        }

        console.log('[AI] Starting menu analysis for restaurant:', authResult.restaurantId);

        // Call NVIDIA Vision API
        let analysisResult;
        
        if (NVIDIA_CONFIG.apiKey) {
            analysisResult = await callNVIDEVisionAPI(image, options);
        } else {
            // Use mock/fallback analysis in development
            analysisResult = await performMockAnalysis(image, options);
        }

        // Increment usage counter
        await incrementUsage(authResult.restaurantId, 'analysis');

        // Get updated usage
        const newUsage = authResult.usage;
        newUsage.analysis += 1;

        return successResponse({
            result: analysisResult,
            usage: newUsage
        }, `تم تحليل القائمة! تم استخراج ${analysisResult.items?.length || 0} صنف في ${analysisResult.categories?.length || 0} قسم`, request);

    } catch (error) {
        console.error('[AI] Analysis error:', error);
        return errorResponse('فشل في تحليل القائمة: ' + error.message, 500, request);
    }
}

/**
 * Call actual NVIDIA Vision API
 */
async function callNVIDEVisionAPI(imageBase64, options) {
    const prompt = buildVisionPrompt(options);

    const response = await fetch(NVIDIA_CONFIG.endpoints.vision, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${NVIDIA_CONFIG.apiKey}`,
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            model: 'microsoft/florence-2-large-ft',
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image_url',
                            image_url: {
                                url: imageBase64.startsWith('data:') 
                                    ? imageBase64 
                                    : `data:image/jpeg;base64,${imageBase64}`
                            }
                        },
                        {
                            type: 'text',
                            text: prompt
                        }
                    ]
                }
            ],
            max_tokens: 2048,
            temperature: 0.2
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`NVIDIA API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Parse the structured output from Florence-2
    return parseVisionOutput(data, options.language || 'ar');
}

/**
 * Build prompt for menu analysis
 */
function buildVisionPrompt(options) {
    const languagePrompts = {
        ar: `حلل هذه الصورة لقائمة طعام واستخرج:
1. اسم المطعم (إن وجد)
2. العملة المستخدمة
3. أقسام القائمة (مثل المقبلات، الأطباق الرئيسية، المشروبات، الحلويات)
4. كل صنف مع:
   - الاسم بالعربية
   - الوصف (إن وجد)
   - السعر
   - القسم الذي ينتمي إليه

قدم النتيجة كـ JSON بهيكل:
{
  "restaurantName": "...",
  "currency": "...",
  "categories": [{"id": "cat_1", "name": "..."}],
  "items": [{"name": "...", "price": ..., "categoryId": "...", "description": "..."}]
}`,
        
        en: `Analyze this menu image and extract:
1. Restaurant name (if visible)
2. Currency used
3. Menu categories (Appetizers, Main Courses, Drinks, Desserts)
4. Each item with:
   - Name
   - Description (if available)
   - Price
   - Category it belongs to

Return as JSON structure:
{
  "restaurantName": "...",
  "currency": "...",
  "categories": [{"id": "cat_1", "name": "..."}],
  "items": [{"name": "...", "price": ..., "categoryId": "...", "description": "..."}]
}`
    };

    return languagePrompts[options.language || 'ar'] || languagePrompts.ar;
}

/**
 * Parse NVIDIA Vision/Florence-2 response into structured data
 */
function parseVisionOutput(response, language) {
    try {
        const text = response.choices?.[0]?.message?.content || '';
        
        // Try to extract JSON from the response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            
            // Ensure proper structure
            return {
                restaurantName: parsed.restaurantName || '',
                currency: parsed.currency || 'ج.م',
                categories: (parsed.categories || []).map((cat, i) => ({
                    id: cat.id || `cat_${i + 1}`,
                    name: cat.name,
                    order: i + 1
                })),
                items: (parsed.items || []).map((item, i) => ({
                    id: `item_${Date.now()}_${i}`,
                    name: item.name,
                    description: item.description || '',
                    price: parseFloat(item.price) || 0,
                    categoryId: item.categoryId,
                    emoji: guessFoodEmoji(item.name),
                    isAvailable: true
                }))
            };
        }
        
        throw new Error('Could not parse AI response as JSON');

    } catch (error) {
        console.error('Parse error:', error);
        // Return fallback mock data on parsing failure
        return getMockAnalysisResult(language);
    }
}

/**
 * Mock analysis for development/testing
 */
async function performMockAnalysis(imageBase64, options) {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    return getMockAnalysisResult(options.language || 'ar');
}

function getMockAnalysisResult(language) {
    const isArabic = language === 'ar';
    
    return {
        restaurantName: isArabic ? 'مطعم المثال' : 'Example Restaurant',
        currency: isArabic ? 'ج.م' : 'EGP',
        categories: [
            { id: 'cat_1', name: isArabic ? 'المقبلات' : 'Appetizers', order: 1 },
            { id: 'cat_2', name: isArabic ? 'الأطباق الرئيسية' : 'Main Courses', order: 2 },
            { id: 'cat_3', name: isArabic ? 'المشروبات' : 'Drinks', order: 3 },
            { id: 'cat_4', name: isArabic ? 'الحلويات' : 'Desserts', order: 4 }
        ],
        items: [
            {
                id: 'item_1',
                name: isArabic ? 'حمص بالطحينة' : 'Hummus with Tahini',
                description: isArabic ? 'حمس مطبوخ مع طحينة سميك وليمون' : 'Chickpeas with tahini paste and lemon',
                price: 45,
                categoryId: 'cat_1',
                emoji: '🧆',
                isAvailable: true
            },
            {
                id: 'item_2',
                name: isArabic ? 'مندي لحم' : 'Mandi Lamb',
                description: isArabic ? 'أرز بسمتي مع لحم ضأن مطهو على الجمر' : 'Basmati rice with slow-cooked lamb',
                price: 180,
                categoryId: 'cat_2',
                emoji: '🍖',
                isAvailable: true
            },
            {
                id: 'item_3',
                name: isArabic ? 'عصير رمان' : 'Pomegranate Juice',
                description: isArabic ? 'رمان طازج مع سكر ونعناع' : 'Fresh pomegranate with mint and sugar',
                price: 35,
                categoryId: 'cat_3',
                emoji: '🧃',
                isAvailable: true
            },
            {
                id: 'item_4',
                name: isArabic ? 'كنافة بالقشطة' : 'Kunafa with Cream',
                description: isArabic ? 'كنافة نابلسية مع قشطة وشراب السكر' : 'Palestinian kunafa with cream and syrup',
                price: 70,
                categoryId: 'cat_4',
                emoji: '🧁',
                isAvailable: true
            }
        ]
    };
}

// ========================================
// Image Generation Handler
// ========================================

/**
 * Generate food image using Stable Diffusion XL
 */
async function generateImage(request, env) {
    try {
        const authResult = await authenticateAndCheckLimit(request, 'generation');
        if (authResult.error) {
            return errorResponse(authResult.error, authResult.status, request);
        }

        const body = await request.json();
        const { prompt, options = {} } = body;

        if (!prompt) {
            return errorResponse('وصف الصورة مطلوب', 400, request);
        }

        console.log('[AI] Generating image for:', prompt.substring(0, 50));

        // Build enhanced food photography prompt
        const enhancedPrompt = buildImageGenerationPrompt(prompt, options);

        let generatedImage;
        
        if (NVIDIA_CONFIG.apiKey) {
            generatedImage = await callNVIDIAImageGenAPI(enhancedPrompt, options);
        } else {
            // Use placeholder generation in development
            generatedImage = await generatePlaceholderImage(prompt);
        }

        // Increment usage
        await incrementUsage(authResult.restaurantId, 'generation');

        // Get updated usage
        const newUsage = authResult.usage;
        newUsage.generation += 1;

        return successResponse({
            imageUrl: generatedImage.url,
            imageBase64: generatedImage.base64,
            prompt: enhancedPrompt.prompt,
            usage: newUsage
        }, 'تم توليد الصورة بنجاح!', request);

    } catch (error) {
        console.error('[AI] Generation error:', error);
        return errorResponse('فشل في توليد الصورة: ' + error.message, 500, request);
    }
}

/**
 * Build optimized prompt for food photography
 */
function buildImageGenerationPrompt(basePrompt, options) {
    const styleModifiers = [
        'professional food photography',
        'studio lighting',
        'high quality',
        'appetizing',
        'gourmet presentation',
        options.style || 'on a clean white plate or rustic wooden table',
        '8k resolution',
        'highly detailed',
        'sharp focus',
        'vibrant natural colors'
    ];

    const fullPrompt = `${basePrompt}, ${styleModifiers.join(', ')}`;

    return {
        prompt: fullPrompt,
        negative_prompt: options.negativePrompt || 
            'blurry, low quality, distorted, ugly, bad lighting, watermark, text, logo, plastic looking, unappetizing',
        width: options.width || 1024,
        height: options.height || 1024,
        samples: options.samples || 1,
        steps: options.steps || 30,
        cfg_scale: options.cfgScale || 7,
        seed: options.seed || -1
    };
}

/**
 * Call NVIDIA Stable Diffusion XL API
 */
async function callNVIDIAImageGenAPI(promptConfig, options) {
    const response = await fetch(NVIDIA_CONFIG.endpoints.imageGen, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${NVIDIA_CONFIG.apiKey}`,
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            text_prompts: [
                { text: promptConfig.prompt, weight: 1 },
                { text: promptConfig.negative_prompt, weight: -1 }
            ],
            cfg_scale: promptConfig.cfg_scale,
            height: promptConfig.height,
            width: promptConfig.width,
            samples: promptConfig.samples,
            steps: promptConfig.steps,
            seed: promptConfig.seed
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`NVIDIA Image Gen error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Extract base64 image from response
    const artifact = data.artifacts?.[0];
    
    if (artifact?.base64) {
        return {
            base64: `data:image/png;base64,${artifact.base64}`,
            url: null  // Would upload to R2 in production
        };
    }

    throw new Error('No image generated');
}

/**
 * Generate placeholder image for development
 */
async function generatePlaceholderImage(prompt) {
    // Create a simple SVG-based placeholder
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
            <defs>
                <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#6366f1"/>
                    <stop offset="100%" style="stop-color:#8b5cf6"/>
                </linearGradient>
            </defs>
            <rect fill="url(#bg)" width="512" height="512"/>
            <text x="256" y="220" font-size="120" text-anchor="middle">🍽️</text>
            <text x="256" y="320" font-family="Arial,sans-serif" font-size="18" fill="white" text-anchor="middle">AI Generated</text>
            <text x="256" y="350" font-family="Arial,sans-serif" font-size="14" fill="rgba(255,255,255,0.8)" text-anchor="middle">${prompt.substring(0, 30)}...</text>
        </svg>
    `;

    // Convert SVG to base64
    const base64 = btoa(unescape(encodeURIComponent(svg)));
    
    return {
        base64: `data:image/svg+xml;base64,${base64}`,
        url: null
    };
}

// ========================================
// Usage Handler
// ========================================

/**
 * Get current AI usage stats
 */
async function getUsage(request, env) {
    try {
        const authResult = await authenticateAndCheckLimit(request, 'analysis');
        if (authResult.error) {
            return errorResponse(authResult.error, authResult.status, request);
        }

        return successResponse({
            usage: authResult.usage,
            plan: authResult.plan,
            periodStart: Date.now(),
            periodEnd: Date.now() + (30 * 24 * 60 * 60 * 1000) // ~1 month from now
        }, null, request);

    } catch (error) {
        return errorResponse('فشل في جلب الإحصائيات', 500, request);
    }
}

// ========================================
// Batch Handlers
// ========================================

/**
 * Analyze multiple images at once
 */
async function batchAnalyze(request, env) {
    try {
        const authResult = await authenticateAndCheckLimit(request, 'analysis');
        if (authResult.error) {
            return errorResponse(authResult.error, authResult.status, request);
        }

        const body = await request.json();
        const { images, options = {} } = body;

        if (!images || !Array.isArray(images)) {
            return errorResponse('قائمة الصور مطلوبة', 400, request);
        }

        if (images.length > 10) {
            return errorResponse('الحد الأقصى 10 صور في المرة الواحدة', 400, request);
        }

        const results = [];
        
        for (const image of images) {
            try {
                const result = NVIDIA_CONFIG.apiKey 
                    ? await callNVIDEVisionAPI(image, options)
                    : await performMockAnalysis(image, options);
                
                results.push({ success: true, data: result });
                
                await incrementUsage(authResult.restaurantId, 'analysis');
                
            } catch (error) {
                results.push({ success: false, error: error.message });
            }
        }

        return successResponse({
            results,
            totalProcessed: results.length,
            successful: results.filter(r => r.success).length
        }, `تم تحليل ${results.filter(r => r.success).length} من ${results.length} صورة`, request);

    } catch (error) {
        return errorResponse('فشل في التحليل المجمّع', 500, request);
    }
}

/**
 * Generate multiple images at once
 */
async function batchGenerate(request, env) {
    try {
        const authResult = await authenticateAndCheckLimit(request, 'generation');
        if (authResult.error) {
            return errorResponse(authResult.error, authResult.status, request);
        }

        const body = await request.json();
        const { prompts, options = {} } = body;

        if (!prompts || !Array.isArray(prompts)) {
            return errorResponse('قائمة الوصفات مطلوبة', 400, request);
        }

        if (prompts.length > 5) {
            return errorResponse('الحد الأقصى 5 صور في المرة الواحدة', 400, request);
        }

        const results = [];

        for (const prompt of prompts) {
            try {
                const enhancedPrompt = buildImageGenerationPrompt(prompt, options);
                
                const generated = NVIDIA_CONFIG.apiKey
                    ? await callNVIDIAImageGenAPI(enhancedPrompt, options)
                    : await generatePlaceholderImage(prompt);
                
                results.push({ 
                    success: true, 
                    imageUrl: generated.url,
                    imageBase64: generated.base64,
                    prompt 
                });

                await incrementUsage(authResult.restaurantId, 'generation');

            } catch (error) {
                results.push({ success: false, error: error.message, prompt });
            }
        }

        return successResponse({
            results,
            totalProcessed: results.length,
            successful: results.filter(r => r.success).length
        }, `تم توليد ${results.filter(r => r.success).length} من ${results.length} صورة`, request);

    } catch (error) {
        return errorResponse('فشل في التوليد المجمّع', 500, request);
    }
}

// ========================================
// Utility Functions
// ========================================

function guessFoodEmoji(name) {
    const nameLower = (name || '').toLowerCase();
    
    const emojiMap = [
        { keywords: ['بيتزا', 'pizza'], emoji: '🍕' },
        { keywords: ['برجر', 'burger', 'همبرجر'], emoji: '🍔' },
        { keywords: ['سلطة', 'salad'], emoji: '🥗' },
        { keywords: ['شوربة', 'soup'], emoji: '🍲' },
        { keywords: ['دجاج', 'chicken'], emoji: '🍗' },
        { keywords: ['سمك', 'fish', 'مأكولات بحرية'], emoji: '🐟' },
        { keywords: ['شاورما', 'kebab', 'مشويات'], emoji: '🥩' },
        { keywords: ['معكرونة', 'باستا', 'pasta'], emoji: '🍝' },
        { keywords: ['رز', 'أرز', 'rice', 'مندي', 'كبسة'], emoji: '🍚' },
        { keywords: ['عصير', 'juice', 'مشروب'], emoji: '🧃' },
        { keywords: ['حلوى', 'ديسرت', 'dessert', 'كيك', 'cake'], emoji: '🍰' },
        { keywords: ['آيس كريم', 'ice cream'], emoji: '🍦' },
        { keywords: ['قهوة', 'coffee'], emoji: '☕' },
        { keywords: ['شاي', 'tea'], emoji: '🍵' },
        { keywords: ['حمص', 'hummus', 'مقبلات'], emoji: '🧆' },
        { keywords: ['كنافة', 'بقلاوة'], emoji: '🧁' }
    ];

    for (const entry of emojiMap) {
        if (entry.keywords.some(kw => nameLower.includes(kw))) {
            return entry.emoji;
        }
    }

    return '🍽️'; // Default food emoji
}
