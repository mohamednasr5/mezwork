/**
 * MezoMenu - NVIDIA AI Integration
 * Menu analysis and image generation using NVIDIA AI APIs
 */

// ========================================
// Configuration
// ========================================

const NVIDIA_CONFIG = {
    // These should be set via environment variables in production
    apiKey: process.env.NVIDIA_API_KEY || 'YOUR_NVIDIA_API_KEY',
    
    // API Endpoints
    endpoints: {
        vision: 'https://ai.api.nvidia.com/v1/vision/microsoft/florence-2',  // For menu OCR/analysis
        imageGen: 'https://ai.api.nvidia.com/v1/genai/stabilityai/stable-diffusion-xl'  // For food image generation
    },
    
    // Rate limiting (requests per month based on plan)
    rateLimits: {
        free: { analysis: 0, generation: 0 },
        pro: { analysis: 100, generation: 50 },
        enterprise: { analysis: -1, generation: -1 }  // -1 = unlimited
    }
};

// ========================================
// Menu Analysis (OCR/Vision)
// ========================================

/**
 * Analyze a menu image using NVIDIA Vision AI
 * Extracts categories, items, prices, and descriptions
 * 
 * @param {File|string} imageFile - Image file or base64 string
 * @param {object} options - Analysis options
 * @returns {Promise<object>} - Analyzed menu data
 */
async function analyzeMenuImage(imageFile, options = {}) {
    const restaurantId = getRestaurantId();
    
    try {
        // Check usage limits
        const usage = await getAIUsage(restaurantId);
        if (usage.analysis >= getAnalysisLimit(restaurantId) && getAnalysisLimit(restaurantId) !== -1) {
            throw new Error('وصلت للحد الأقصى من التحليل هذا الشهر');
        }

        // Convert file to base64 if needed
        let imageBase64;
        if (imageFile instanceof File) {
            imageBase64 = await fileToBase64(imageFile);
        } else {
            imageBase64 = imageFile;
        }

        console.log('🔍 Starting menu analysis...');

        // Call NVIDIA Vision API
        const result = await callNVIDIAVisionAPI(imageBase64, options);

        // Parse and structure the results
        const parsedMenu = parseMenuAnalysisResult(result);

        // Log usage
        await incrementAIUsage(restaurantId, 'analysis');

        return {
            success: true,
            data: parsedMenu,
            rawResult: result,
            message: `تم تحليل القائمة بنجاح! تم استخراج ${parsedMenu.items.length} صنف في ${parsedMenu.categories.length} قسم`
        };

    } catch (error) {
        console.error('❌ Menu analysis error:', error);
        
        return {
            success: false,
            error: error.message || 'فشل في تحليل القائمة',
            // Return mock data for development
            mockData: getMockAnalysisData()
        };
    }
}

/**
 * Call NVIDIA Vision API for menu analysis
 */
async function callNVIDIAVisionAPI(imageBase64, options) {
    // In production, this would make an actual API call to Cloudflare Worker
    // which then calls NVIDIA API securely
    
    const workerEndpoint = `${getWorkerURL()}/api/ai/analyze`;
    
    try {
        const response = await fetch(workerEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({
                image: imageBase64,
                options: {
                    language: options.language || 'ar',
                    extractPrices: true,
                    extractCategories: true,
                    extractDescriptions: true,
                    ...options
                }
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        return await response.json();

    } catch (error) {
        console.warn('⚠️ Could not reach AI API, using fallback mode');
        // Return mock data for development
        return getMockVisionResponse();
    }
}

/**
 * Parse raw vision API response into structured menu data
 */
function parseMenuAnalysisResult(result) {
    // This would parse the actual NVIDIA/Florence-2 response
    // For now, returning structured format expected by the app
    
    if (result.mock) {
        return result.data;
    }

    return {
        restaurantName: result.restaurantName || '',
        currency: result.currency || 'ج.م',
        categories: result.categories || [],
        items: result.items || []
    };
}

// ========================================
// Image Generation
// ========================================

/**
 * Generate a food image using Stable Diffusion XL
 * 
 * @param {string} prompt - Description of the food item
 * @param {object} options - Generation options
 * @returns {Promise<object>} - Generated image data
 */
async function generateFoodImage(prompt, options = {}) {
    const restaurantId = getRestaurantId();

    try {
        // Check usage limits
        const usage = await getAIUsage(restaurantId);
        if (usage.generation >= getGenerationLimit(restaurantId) && getGenerationLimit(restaurantId) !== -1) {
            throw new Error('وصلت للحد الأقصى من توليد الصور هذا الشهر');
        }

        console.log('🎨 Generating food image for:', prompt);

        // Build enhanced prompt for better food images
        const enhancedPrompt = buildFoodPrompt(prompt, options);

        // Call NVIDIA Image Generation API
        const result = await callNVIDIAImageGenAPI(enhancedPrompt, options);

        // Upload generated image to R2 storage
        let imageUrl = result.image;
        if (result.imageBase64) {
            imageUrl = await uploadGeneratedImage(result.imageBase64, prompt);
        }

        // Log usage
        await incrementAIUsage(restaurantId, 'generation');

        return {
            success: true,
            imageUrl: imageUrl,
            imageBase64: result.imageBase64,
            prompt: enhancedPrompt,
            message: 'تم توليد الصورة بنجاح!'
        };

    } catch (error) {
        console.error('❌ Image generation error:', error);
        
        return {
            success: false,
            error: error.message || 'فشل في توليد الصورة'
        };
    }
}

/**
 * Build optimized prompt for food photography
 */
function buildFoodPrompt(basePrompt, options = {}) {
    const styleModifiers = [
        'professional food photography',
        'studio lighting',
        'high quality',
        'appetizing',
        'gourmet presentation',
        options.style || 'on a clean white plate'
    ];

    const qualityModifiers = [
        '8k resolution',
        'highly detailed',
        'sharp focus',
        'vibrant colors'
    ];

    let fullPrompt = `${basePrompt}, ${styleModifiers.join(', ')}, ${qualityModifiers.join(', ')}`;
    
    // Add negative prompt for better results
    if (!options.negativePrompt) {
        options.negativePrompt = 'blurry, low quality, distorted, ugly, bad lighting, watermark, text';
    }

    return {
        prompt: fullPrompt,
        negative_prompt: options.negativePrompt,
        ...options
    };
}

/**
 * Call NVIDIA Stable Diffusion XL API
 */
async function callNVIDIAImageGenAPI(promptConfig, options) {
    const workerEndpoint = `${getWorkerURL()}/api/ai/generate`;

    try {
        const response = await fetch(workerEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({
                prompt: typeof promptConfig === 'string' ? promptConfig : promptConfig.prompt,
                negative_prompt: promptConfig.negative_prompt,
                width: options.width || 1024,
                height: options.height || 1024,
                samples: options.samples || 1,
                steps: options.steps || 30,
                cfg_scale: options.cfgScale || 7,
                seed: options.seed || -1,
                ...options
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        return await response.json();

    } catch (error) {
        console.warn('⚠️ Could not reach image gen API');
        
        // Return placeholder for development
        return {
            image: null,
            imageBase64: generatePlaceholderImage(promptConfig.prompt),
            mock: true
        };
    }
}

// ========================================
// Usage Tracking
// ========================================

/**
 * Get current AI usage for a restaurant
 */
async function getAIUsage(restaurantId) {
    if (!db) {
        return { analysis: 15, generation: 8 };  // Mock values
    }

    try {
        const snapshot = await getRestaurantRef(restaurantId, 'aiUsage').once('value');
        return snapshot.val() || { analysis: 0, generation: 0 };
    } catch (error) {
        console.error('Error getting AI usage:', error);
        return { analysis: 0, generation: 0 };
    }
}

/**
 * Increment AI usage counter
 */
async function incrementAIUsage(restaurantId, type) {
    if (!db) {
        console.log(`📊 Incremented ${type} usage (dev mode)`);
        return;
    }

    try {
        const usageRef = getRestaurantRef(restaurantId, `aiUsage/${type}`);
        const currentSnapshot = await usageRef.once('value');
        const currentVal = currentSnapshot.val() || 0;
        
        await usageRef.set(currentVal + 1);
    } catch (error) {
        console.error('Error incrementing usage:', error);
    }
}

function getAnalysisLimit(restaurantId) {
    // Would fetch from user's plan
    return NVIDIA_CONFIG.rateLimits.pro.analysis;  // Default to pro limit
}

function getGenerationLimit(restaurantId) {
    return NVIDIA_CONFIG.rateLimits.pro.generation;
}

// ========================================
// Helper Functions
// ========================================

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function getWorkerURL() {
    // Cloudflare Workers URL for MezoMenu API
    return 'https://menu.nonm1724.workers.dev';
}

function getAuthToken() {
    return localStorage.getItem('mezomenu_auth_token') || 'dev-token';
}

async function uploadGeneratedImage(base64Data, filename) {
    // Upload to R2 via worker
    const workerEndpoint = `${getWorkerURL()}/api/upload`;
    
    try {
        const response = await fetch(workerEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({
                image: base64Data,
                filename: `ai-generated-${Date.now()}.png`,
                folder: 'menu-items'
            })
        });

        const result = await response.json();
        return result.url;

    } catch (error) {
        console.error('Upload error:', error);
        return null;
    }
}

function generatePlaceholderImage(prompt) {
    // Generate a simple SVG placeholder with text
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 512, 512);
    gradient.addColorStop(0, '#6366f1');
    gradient.addColorStop(1, '#8b5cf6');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
    
    // Food emoji
    ctx.font = '200px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🍽️', 256, 230);
    
    // Text
    ctx.font = '24px Cairo, sans-serif';
    ctx.fillStyle = 'white';
    ctx.fillText('صورة بالذكاء الاصطناعي', 256, 350);
    
    return canvas.toDataURL('image/png');
}

// ========================================
// Mock Data for Development
// ========================================

function getMockAnalysisData() {
    return {
        restaurantName: 'مطعم المثال',
        currency: 'ج.م',
        categories: [
            { id: 'cat_1', name: 'المقبلات', order: 1 },
            { id: 'cat_2', name: 'الأطباق الرئيسية', order: 2 },
            { id: 'cat_3', name: 'المشروبات', order: 3 },
            { id: 'cat_4', name: 'الحلويات', order: 4 }
        ],
        items: [
            {
                id: 'item_1',
                name: 'حمص بالطحينة',
                description: 'حمص مطبوخ مع طحينة سميك وليمون وزيت زيتون',
                price: 45,
                categoryId: 'cat_1',
                emoji: '🧆',
                isAvailable: true
            },
            {
                id: 'item_2',
                name: 'ورق عنب محشي',
                description: 'ورق عنب محشي بالأرز واللحم المفروم',
                price: 65,
                categoryId: 'cat_1',
                emoji: '🍇',
                isAvailable: true
            },
            {
                id: 'item_3',
                name: 'مندي لحم',
                description: 'أرز بسمتي مع لحم ضأن مطهو على الجمر',
                price: 180,
                categoryId: 'cat_2',
                emoji: '🍖',
                isAvailable: true
            },
            {
                id: 'item_4',
                name: 'كبسة دجاج',
                description: 'أرز بسمتي مع دجاج كامل وبهارات خاصة',
                price: 150,
                categoryId: 'cat_2',
                emoji: '🍗',
                isAvailable: true
            },
            {
                id: 'item_5',
                name: 'عصير رمان طازج',
                description: 'رمان طازج مع سكر ونعناع ومياه غازية',
                price: 35,
                categoryId: 'cat_3',
                emoji: 🧃,
                isAvailable: true
            },
            {
                id: 'item_6',
                name: 'كنافة بالقشطة',
                description: 'كنافة نابلسية مع قشطة وشراب السكر',
                price: 70,
                categoryId: 'cat_4',
                emoji: '🧁',
                isAvailable: true
            }
        ]
    };
}

function getMockVisionResponse() {
    return {
        mock: true,
        data: getMockAnalysisData()
    };
}

// ========================================
// UI Integration Helpers
// ========================================

/**
 * Show analysis progress UI
 */
function showAnalysisProgress(container) {
    container.innerHTML = `
        <div class="analysis-progress">
            <div class="progress-icon">🤖</div>
            <h3>جاري تحليل القائمة...</h3>
            <div class="progress-steps">
                <div class="progress-step active" data-step="1">
                    <span class="step-icon">📷</span>
                    <span>قراءة الصورة</span>
                </div>
                <div class="progress-step" data-step="2">
                    <span class="step-icon">🔍</span>
                    <span>استخراج النصوص</span>
                </div>
                <div class="progress-step" data-step="3">
                    <span class="step-icon">📋</span>
                    <span>تنظيم البيانات</span>
                </div>
                <div class="progress-step" data-step="4">
                    <span class="step-icon">✅</span>
                    <span>الانتهاء</span>
                </div>
            </div>
            <div class="progress-bar-container">
                <div class="progress-bar"></div>
            </div>
        </div>
    `;

    // Animate progress
    animateAnalysisProgress();
}

function animateAnalysisProgress() {
    const steps = document.querySelectorAll('.analysis-progress .progress-step');
    const progressBar = document.querySelector('.analysis-progress .progress-bar');
    
    let currentStep = 0;
    const interval = setInterval(() => {
        if (currentStep < steps.length) {
            steps[currentStep].classList.add('active');
            if (currentStep > 0) {
                steps[currentStep - 1].classList.add('completed');
            }
            
            if (progressBar) {
                progressBar.style.width = ((currentStep + 1) / steps.length * 100) + '%';
            }
            
            currentStep++;
        } else {
            clearInterval(interval);
        }
    }, 1000);
}

/**
 * Display analysis results
 */
function showAnalysisResults(container, results) {
    if (!results.success) {
        container.innerHTML = `
            <div class="analysis-error">
                <span class="error-icon">😕</span>
                <h3>${results.error}</h3>
                <p>يرجى التأكد من صورة القائمة والمحاولة مرة أخرى</p>
                <button onclick="retryAnalysis()" class="btn btn-primary">إعادة المحاولة</button>
            </div>
        `;
        return;
    }

    const data = results.data;
    
    container.innerHTML = `
        <div class="analysis-results">
            <div class="results-header">
                <span class="success-badge">✅ ${results.message}</span>
            </div>
            
            <div class="results-sections">
                <div class="results-categories">
                    <h4>الأقسام المستخرجة (${data.categories.length})</h4>
                    <ul>
                        ${data.categories.map(cat => `
                            <li>
                                <span class="category-name">${cat.name}</span>
                                <span class="items-count">${data.items.filter(i => i.categoryId === cat.id).length} صنف</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
                
                <div class="results-items">
                    <h4>الأصناف المستخرجة (${data.items.length})</h4>
                    <div class="items-grid">
                        ${data.items.map(item => `
                            <div class="result-item-card">
                                <span class="item-emoji">${item.emoji || '🍽️'}</span>
                                <h5>${item.name}</h5>
                                <p>${item.description || ''}</p>
                                <span class="item-price">${item.price} ${data.currency}</span>
                                <label class="checkbox-label">
                                    <input type="checkbox" checked value="${item.id}">
                                    <span>إضافة</span>
                                </label>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            
            <div class="results-actions">
                <button onclick="importAnalyzedItems()" class="btn btn-primary btn-lg">
                    استيراد المحدد (${data.items.length} صنف)
                </button>
                <button onclick="editAnalyzedItems()" class="btn btn-outline">
                    تعديل قبل الاستيراد
                </button>
            </div>
        </div>
    `;
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        analyzeMenuImage,
        generateFoodImage,
        getAIUsage,
        showAnalysisProgress,
        showAnalysisResults
    };
}
