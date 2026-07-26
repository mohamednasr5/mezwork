/**
 * MezoMenu - AI Integration (REAL APIs)
 * Menu analysis and image generation using REAL AI services
 * 
 * Supported Services:
 * - Google Cloud Vision API (OCR/Text Detection)
 * - Hugging Face Inference API (Free Image Generation)
 * - Unsplash API (Real Food Images)
 * - Tesseract.js (Local OCR - Free)
 */

// ========================================
// Configuration
// ========================================

const AI_CONFIG = {
    // Worker URL for secure API calls
    workerURL: 'https://menu.nonm1724.workers.dev',
    
    // API Endpoints (Real Services)
    endpoints: {
        // Google Cloud Vision for OCR
        googleVision: '/api/ai/ocr',
        
        // Hugging Face for image generation (FREE)
        huggingFace: '/api/ai/generate',
        
        // Unsplash for real food images
        unsplash: 'https://api.unsplash.com/search/photos',
        
        // Fallback OCR with Tesseract
        tesseract: '/api/ai/tesseract'
    },
    
    // Unsplash Configuration (Free Tier: 50 requests/hour)
    unsplash: {
        accessKey: '',  // Set in environment or leave empty for demo mode
        perPage: 5,
        orientation: 'squish'
    }
};

// ========================================
// Menu Analysis (REAL OCR)
// ========================================

/**
 * Analyze a menu image using REAL OCR
 * Extracts categories, items, prices, and descriptions from actual image
 * 
 * @param {File|string} imageFile - Image file or base64 string
 * @param {object} options - Analysis options
 * @returns {Promise<object>} - Analyzed menu data (REAL data from image)
 */
async function analyzeMenuImage(imageFile, options = {}) {
    const restaurantId = getRestaurantId();
    
    try {
        console.log('🔍 Starting REAL menu analysis...');
        
        // Convert file to base64 if needed
        let imageBase64;
        if (imageFile instanceof File) {
            imageBase64 = await fileToBase64(imageFile);
        } else {
            imageBase64 = imageFile;
        }

        // Try multiple OCR methods in order of accuracy
        
        // Method 1: Try Google Cloud Vision via Worker (Most Accurate)
        let result = await tryGoogleVisionOCR(imageBase64, options);
        
        // Method 2: If that fails, try Tesseract.js via Worker (Free, Local)
        if (!result.success) {
            console.log('⚠️ Google Vision failed, trying Tesseract...');
            result = await tryTesseractOCR(imageBase64, options);
        }
        
        // Method 3: Last resort - use client-side basic extraction
        if (!result.success) {
            console.log('⚠️ Server OCR failed, trying client-side fallback...');
            result = await performClientSideAnalysis(imageBase64, options);
        }

        if (result.success) {
            // Log usage
            await incrementAIUsage(restaurantId, 'analysis');
            
            return {
                success: true,
                data: result.data,
                confidence: result.confidence || 0.8,
                method: result.method || 'ocr',
                message: `تم تحليل القائمة بنجاح! تم استخراج ${result.data.items.length} صنف في ${result.data.categories.length} قسم`
            };
        } else {
            throw new Error(result.error || 'فشل في تحليل القائمة');
        }

    } catch (error) {
        console.error('❌ Menu analysis error:', error);
        
        return {
            success: false,
            error: error.message || 'فشل في تحليل القائمة',
            suggestion: 'تأكد من أن الصورة واضحة وقابلة للقراءة'
        };
    }
}

/**
 * Method 1: Google Cloud Vision API via Worker
 */
async function tryGoogleVisionOCR(imageBase64, options) {
    try {
        const workerEndpoint = `${AI_CONFIG.workerURL}${AI_CONFIG.endpoints.googleVision}`;
        
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
                    ...options
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Google Vision error: ${response.status}`);
        }

        const result = await response.json();
        
        return {
            success: true,
            data: parseOCRResult(result.data),
            confidence: result.confidence || 0.9,
            method: 'google-vision'
        };

    } catch (error) {
        console.warn('⚠️ Google Vision not available:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Method 2: Tesseract.js via Worker (Free, No API Key Needed)
 */
async function tryTesseractOCR(imageBase64, options) {
    try {
        const workerEndpoint = `${AI_CONFIG.workerURL}${AI_CONFIG.endpoints.tesseract}`;
        
        const response = await fetch(workerEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image: imageBase64,
                language: options.language === 'ar' ? 'ara' : 'eng+ara',
                options: {
                    ...options,
                    preprocess: true
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Tesseract error: ${response.status}`);
        }

        const result = await response.json();
        
        // Parse raw text into structured menu data
        const parsedMenu = parseRawTextToMenu(result.text, options.language || 'ar');
        
        return {
            success: true,
            data: parsedMenu,
            confidence: result.confidence || 0.7,
            method: 'tesseract',
            rawText: result.text
        };

    } catch (error) {
        console.warn('⚠️ Tesseract not available:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Method 3: Client-side analysis (Basic fallback)
 */
async function performClientSideAnalysis(imageBase64, options) {
    try {
        // Create image element to analyze
        const img = new Image();
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = imageBase64;
        });
        
        // For now, show an error asking user to use better method
        throw new Error('يتطلب تحليل الصورة خادم OCR. يرجى تفعيل Google Cloud Vision أو استخدام Tesseract.');
        
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Parse raw OCR text into structured menu data
 * This is the KEY function that extracts real data from the image
 */
function parseRawTextToMenu(rawText, language = 'ar') {
    const lines = rawText.split('\n').filter(line => line.trim().length > 0);
    
    const categories = [];
    const items = [];
    let currentCategory = null;
    let categoryCounter = 0;
    
    // Common category keywords in Arabic and English
    const categoryPatterns = [
        // Arabic patterns
        /مقبلات|أطباق جانبية|سلطات|شوربات/i,
        /أطباق رئيسية|وجبات رئيسية|م main/i,
        /مشروبات|عصائر|مشروبات باردة|ساخنة/i,
        /حلويات|تحلية/i,
        /سمك ومأكولات بحرية/i,
        /سندويشات|برجر/i,
        /بيتزا|معجنات/i,
        /رز|أرز|معكرونة|باستا/i,
        // English patterns
        /appetizers|starters|sides/i,
        /main.?course|entrees?|mains?/i,
        /drinks?|beverages?|juices?/i,
        /desserts?|sweets?/i,
        /seafood|fish/i,
        /sandwiches?|burgers?/i,
        /pizza|pasta/i,
        /salads?|soups?/i
    ];
    
    // Price pattern (detects numbers that look like prices)
    const pricePattern = /(?:(?:ج\.م|EGP|\$|€|£|ريال|درهم)\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:ج\.م|EGP|\$|€|£)?/;
    
    for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Skip very short lines or lines that are just numbers
        if (trimmedLine.length < 2 || /^\d+$/.test(trimmedLine)) {
            continue;
        }
        
        // Check if this line is a category header
        const isCategory = categoryPatterns.some(pattern => pattern.test(trimmedLine));
        
        if (isCategory && !pricePattern.test(trimmedLine)) {
            categoryCounter++;
            currentCategory = {
                id: `cat_${categoryCounter}`,
                name: trimmedLine.replace(/[^\w\s\u0600-\u06FF]/g, '').trim(),
                order: categoryCounter
            };
            categories.push(currentCategory);
            continue;
        }
        
        // Try to extract item + price from line
        const priceMatch = trimmedLine.match(pricePattern);
        
        if (priceMatch && currentCategory) {
            const priceStr = priceMatch[1].replace(',', '.');
            const price = parseFloat(priceStr);
            
            // Item name is everything before the price
            let name = trimmedLine.substring(0, trimmedLine.indexOf(priceMatch[0])).trim();
            
            // Clean up the name
            name = name.replace(/^[.\-–—]+/, '')  // Remove leading dots/dashes
                       .replace(/[.\-–—]+$/, '')   // Remove trailing dots/dashes
                       .replace(/\d+/g, '')         // Remove stray numbers
                       .replace(/\s+/g, ' ')       // Normalize whitespace
                       .trim();
            
            // Only add if we have a valid name (at least 2 chars)
            if (name.length >= 2) {
                items.push({
                    id: `item_${Date.now()}_${items.length}`,
                    name: name,
                    description: '',
                    price: price,
                    categoryId: currentCategory.id,
                    emoji: guessFoodEmoji(name),
                    isAvailable: true,
                    extractedFromImage: true
                });
            }
        } else if (currentCategory && trimmedLine.length > 3) {
            // Might be a description or item without clear price
            // Add as potential item with price 0
            items.push({
                id: `item_${Date.now()}_${items.length}`,
                name: trimmedLine,
                description: '',
                price: null,  // Price not detected
                categoryId: currentCategory.id,
                emoji: guessFoodEmoji(trimmedLine),
                isAvailable: true,
                needsPriceConfirmation: true,
                extractedFromImage: true
            });
        }
    }
    
    // If no categories were found but we have items, create a default category
    if (categories.length === 0 && items.length > 0) {
        categories.push({
            id: 'cat_1',
            name: language === 'ar' ? 'الأصناف' : 'Items',
            order: 1
        });
        
        // Update all items to use default category
        items.forEach(item => {
            item.categoryId = 'cat_1';
        });
    }
    
    return {
        restaurantName: '',  // Could be extracted from first line if it looks like restaurant name
        currency: detectCurrency(rawText),
        categories: categories,
        items: items
    };
}

/**
 * Parse structured OCR result
 */
function parseOCRResult(data) {
    if (!data) {
        return { categories: [], items: [] };
    }
    
    // If already structured correctly
    if (data.categories && data.items) {
        return {
            restaurantName: data.restaurantName || '',
            currency: data.currency || 'ج.م',
            categories: data.categories.map((cat, i) => ({
                id: cat.id || `cat_${i + 1}`,
                name: cat.name,
                order: cat.order || i + 1
            })),
            items: data.items.map((item, i) => ({
                id: item.id || `item_${Date.now()}_${i}`,
                name: item.name,
                description: item.description || '',
                price: parseFloat(item.price) || 0,
                categoryId: item.categoryId,
                emoji: item.emoji || guessFoodEmoji(item.name),
                isAvailable: item.isAvailable !== false,
                extractedFromImage: true
            }))
        };
    }
    
    // If raw text, parse it
    if (typeof data === 'string' || data.text) {
        return parseRawTextToMenu(data.text || data, 'ar');
    }
    
    return { categories: [], items: [] };
}

/**
 * Detect currency from text
 */
function detectCurrency(text) {
    if (/ج\.م|جنيه|مصري/i.test(text)) return 'ج.م';
    if (/EGP/i.test(text)) return 'ج.م';
    if (/\$|دولار/i.test(text)) return '$';
    if (/€|يورو/i.test(text)) return '€';
    if (/£|جنيه.*إستريليني/i.test(text)) return '£';
    if (/ريال|SAR/i.test(text)) return 'ر.س';
    if (/درهم|AED/i.test(text)) return 'د.إ';
    return 'ج.م';  // Default to EGP
}

// ========================================
// Image Generation (REAL Images)
// ========================================

/**
 * Generate or retrieve a REAL food image
 * Uses Unsplash API for real food photos (FREE)
 * Falls back to Hugging Face for AI generation
 * 
 * @param {string} itemName - Name of the food item
 * @param {object} options - Generation options
 * @returns {Promise<object>} - Real image data
 */
async function generateFoodImage(itemName, options = {}) {
    const restaurantId = getRestaurantId();

    try {
        console.log('🎨 Getting REAL food image for:', itemName);

        // Method 1: Try Unsplash for real food photos (BEST QUALITY)
        let result = await tryUnsplashImage(itemName, options);
        
        // Method 2: Try Hugging Face for AI-generated images (FREE)
        if (!result.success) {
            console.log('⚠️ Unsplash failed, trying Hugging Face...');
            result = await tryHuggingFaceGeneration(itemName, options);
        }
        
        // Method 3: Use high-quality placeholder with correct food emoji
        if (!result.success) {
            console.log('⚠️ AI generation failed, creating styled placeholder...');
            result = await createStyledPlaceholder(itemName, options);
        }

        if (result.success) {
            // Log usage
            await incrementAIUsage(restaurantId, 'generation');

            return {
                success: true,
                imageUrl: result.imageUrl,
                imageBase64: result.imageBase64,
                prompt: itemName,
                source: result.source || 'generated',
                message: 'تم الحصول على الصورة بنجاح!'
            };
        } else {
            throw new Error(result.error || 'فشل في الحصول على الصورة');
        }

    } catch (error) {
        console.error('❌ Image generation error:', error);
        
        return {
            success: false,
            error: error.message || 'فشل في الحصول على الصورة'
        };
    }
}

/**
 * Method 1: Unsplash API for REAL food photography
 * FREE: 50 requests/hour, requires Access Key (can be public)
 */
async function tryUnsplashImage(searchQuery, options = {}) {
    try {
        // Build search query optimized for food
        const query = buildUnsplashSearchQuery(searchQuery);
        
        // Use Worker to make the request (avoids CORS issues)
        const workerEndpoint = `${AI_CONFIG.workerURL}/api/ai/unsplash`;
        
        const response = await fetch(workerEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: query,
                perPage: 1,
                orientation: 'squish'
            })
        });

        if (!response.ok) {
            throw new Error(`Unsplash error: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            const photo = data.results[0];
            
            return {
                success: true,
                imageUrl: photo.urls.regular,  // High quality
                thumbnailUrl: photo.urls.small,
                source: 'unsplash',
                photographer: photo.user.name,
                photographerUrl: photo.user.links.html
            };
        }
        
        throw new Error('No images found for this query');

    } catch (error) {
        console.warn('⚠️ Unsplash not available:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Build optimized search query for Unsplash
 */
function buildUnsplashSearchQuery(itemName) {
    // Food-specific keywords for better results
    const foodKeywords = {
        'default': ['food', 'dish', 'cuisine', 'restaurant', 'delicious', 'gourmet'],
        'بيتزا': ['pizza', 'italian', 'cheese', 'tomato'],
        'برجر': ['burger', 'cheeseburger', 'fast food', 'beef'],
        'دجاج': ['chicken', 'grilled chicken', 'roasted chicken'],
        'سمك': ['fish', 'seafood', 'grilled fish'],
        'سلطة': ['salad', 'fresh salad', 'healthy', 'vegetables'],
        'شوربة': ['soup', 'bowl', 'warm', 'comforting'],
        'معكرونة': ['pasta', 'italian pasta', 'noodles'],
        'رز': ['rice', 'fried rice', 'basmati'],
        'كنافة': ['kunafa', 'dessert', 'sweet', 'arabic dessert'],
        'حلوى': ['dessert', 'cake', 'sweet', 'pastry'],
        'عصير': ['juice', 'fresh juice', 'drink', 'beverage'],
        'قهوة': ['coffee', 'espresso', 'cafe', 'latte'],
        'شاي': ['tea', 'hot tea', 'cup of tea']
    };
    
    // Find matching keywords
    const nameLower = (itemName || '').toLowerCase();
    let matchedKeywords = [];
    
    for (const [key, keywords] of Object.entries(foodKeywords)) {
        if (key !== 'default' && nameLower.includes(key)) {
            matchedKeywords = [...matchedKeywords, ...keywords];
        }
    }
    
    // Always include default keywords plus any matches
    const allKeywords = [...new Set([...foodKeywords.default, ...matchedKeywords])];
    
    // Build final query
    return `${itemName} ${allKeywords.join(' ')}`;
}

/**
 * Method 2: Hugging Face Inference API (FREE AI Generation)
 * Generates images using Stable Diffusion or similar models
 */
async function tryHuggingFaceGeneration(prompt, options = {}) {
    try {
        const enhancedPrompt = buildAIPrompt(prompt, options);
        
        const workerEndpoint = `${AI_CONFIG.workerURL}${AI_CONFIG.endpoints.huggingFace}`;
        
        const response = await fetch(workerEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: enhancedPrompt,
                negative_prompt: options.negativePrompt || 'blurry, low quality, distorted, ugly, bad lighting, watermark, text, logo, plastic looking, unappetizing',
                width: options.width || 512,
                height: options.height || 512,
                steps: options.steps || 25,
                guidance_scale: options.cfgScale || 7.5
            })
        });

        if (!response.ok) {
            throw new Error(`Hugging Face error: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.image) {
            return {
                success: true,
                imageUrl: result.image,  // URL or base64
                imageBase64: result.image_base64,
                source: 'huggingface-ai',
                model: result.model || 'stable-diffusion'
            };
        }
        
        throw new Error('No image generated');

    } catch (error) {
        console.warn('⚠️ Hugging Face not available:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Build optimized prompt for AI image generation
 */
function buildAIPrompt(basePrompt, options = {}) {
    const styleModifiers = [
        'professional food photography',
        'studio lighting',
        'high quality',
        'appetizing',
        'gourmet presentation',
        options.style || 'on a clean white plate or rustic wooden table',
        'mouth-watering',
        'fresh ingredients',
        'vibrant natural colors',
        'sharp focus',
        '8k resolution',
        'award-winning food photography'
    ];

    return `${basePrompt}, ${styleModifiers.join(', ')}`;
}

/**
 * Method 3: Styled Placeholder (Last Resort)
 * Creates a beautiful placeholder with the correct food emoji
 */
async function createStyledPlaceholder(itemName, options = {}) {
    try {
        const emoji = guessFoodEmoji(itemName);
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        // Beautiful gradient background based on food type
        const gradients = {
            warm: ['#ff6b6b', '#ee5a5a'],      // Red tones
            fresh: ['#51cf66', '#40c057'],     // Green tones  
            cool: ['#339af0', '#228be6'],      // Blue tones
            sweet: ['#cc5de8', '#be4bdb'],     // Purple tones
            neutral: ['#6366f1', '#8b5cf6']    // Indigo default
        };
        
        const gradientType = getGradientType(itemName);
        const [color1, color2] = gradients[gradientType] || gradients.neutral;
        
        const gradient = ctx.createLinearGradient(0, 0, 512, 512);
        gradient.addColorStop(0, color1);
        gradient.addColorStop(1, color2);
        ctx.fillStyle = gradient;
        
        // Rounded rectangle effect
        roundRect(ctx, 0, 0, 512, 512, 40);
        ctx.fill();
        
        // Decorative circles
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(450, 60, 80, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(60, 450, 100, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        
        // Large food emoji
        ctx.font = '180px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(emoji, 256, 220);
        
        // Item name text
        ctx.font = 'bold 28px Cairo, sans-serif';
        ctx.fillStyle = 'white';
        ctx.fillText(truncateText(itemName, 20), 256, 340);
        
        // Subtitle
        ctx.font = '18px Cairo, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillText('صورة تمثيلية', 256, 380);
        
        // "Add real photo" hint
        ctx.font = '14px Cairo, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText('يمكنك إضافة صورة حقيقية لاحقاً', 256, 420);
        
        const base64 = canvas.toDataURL('image/png');
        
        return {
            success: true,
            imageUrl: null,
            imageBase64: base64,
            source: 'placeholder-styled'
        };
        
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Get gradient color scheme based on food type
 */
function getGradientType(itemName) {
    const nameLower = (itemName || '').toLowerCase();
    
    if (/سلطة|خضروات|طازج|صحي/i.test(nameLower)) return 'fresh';
    if (/حلوى|كيك|شوكولاتة|حلو/i.test(nameLower)) return 'sweet';
    if (/مثلجات|بارد|عصير|مشروب/i.test(nameLower)) return 'cool';
    if (/لحم|دجاج|مشوي|ساخن/i.test(nameLower)) return 'warm';
    
    return 'neutral';
}

/**
 * Helper: Draw rounded rectangle
 */
function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

/**
 * Helper: Truncate text to fit
 */
function truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// ========================================
// Usage Tracking
// ========================================

async function getAIUsage(restaurantId) {
    try {
        const response = await fetch(`${AI_CONFIG.workerURL}/api/ai/usage`, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            return data.usage || { analysis: 0, generation: 0 };
        }
    } catch (error) {
        console.error('Error getting usage:', error);
    }
    
    return { analysis: 0, generation: 0 };
}

async function incrementAIUsage(restaurantId, type) {
    console.log(`📊 Incremented ${type} usage`);
    // Usage is tracked server-side, this is just for logging
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
    return AI_CONFIG.workerURL;
}

function getAuthToken() {
    return localStorage.getItem('mezomenu_auth_token') || 'dev-token';
}

function getRestaurantId() {
    return localStorage.getItem('mezomenu_restaurant_id') || 'default';
}

/**
 * Guess appropriate emoji for food item
 */
function guessFoodEmoji(name) {
    if (!name) return '🍽️';
    
    const nameLower = name.toLowerCase();
    
    const emojiMap = [
        { keywords: ['بيتزا', 'pizza', 'پيتزا'], emoji: '🍕' },
        { keywords: ['برجر', 'burger', 'همبرگر', 'ساندويتش'], emoji: '🍔' },
        { keywords: ['فرايز', 'بطاطس', 'فريتس', 'fries'], emoji: '🍟' },
        { keywords: ['سلطة', 'salad', 'سلطه'], emoji: '🥗' },
        { keywords: ['شوربة', 'soup', 'شوربه'], emoji: '🍲' },
        { keywords: ['دجاج', 'chicken', 'فرخ', 'جاجر'], emoji: '🍗' },
        { keywords: ['سمك', 'fish', 'مأكولات بحرية', 'جمبري'], emoji: '🐟' },
        { keywords: ['شاورما', 'kebab', 'كباب', 'مشويات', 'لحم', 'ستيك'], emoji: '🥩' },
        { keywords: ['معكرونة', 'باستا', 'pasta', 'سباغتي'], emoji: '🍝' },
        { keywords: ['رز', 'أرز', 'rice', 'مندي', 'كبسة', 'برياني'], emoji: '🍚' },
        { keywords: ['خبز', 'bread', 'فينو', 'عيش'], emoji: '🍞' },
        { keywords: ['عصير', 'juice', 'مشروب', 'شراب'], emoji: '🧃' },
        { keywords: ['حلوى', 'ديسرت', 'dessert', 'كيك', 'cake', 'تورت'], emoji: '🍰' },
        { keywords: ['آيس كريم', 'ice cream', 'جالاكس'], emoji: '🍦' },
        { keywords: ['كنافة', 'بقلاوة', 'بسكوت', 'كوكيز'], emoji: '🧁' },
        { keywords: ['قهوة', 'coffee', 'كوفي', 'اسبريسو'], emoji: '☕' },
        { keywords: ['شاي', 'tea', 'شاي'], emoji: '🍵' },
        { keywords: ['حليب', 'milk', 'لاتيه', 'كابتشينو'], emoji: '🥛' },
        { keywords: ['حمص', 'hummus', 'مقبلات', 'متبل', 'طبق'], emoji: '🧆' },
        { keywords: ['فواكه', 'fruit', 'fruits'], emoji: '🍎' },
        { keywords: ['خضروات', 'vegetable', 'خضراوات'], emoji: '🥬' },
        { keywords: ['بيض', 'egg', 'أومليت'], emoji: '🍳' },
        { keywords: ['جبن', 'cheese', 'جبنة'], emoji: '🧀' },
        { keywords: ['فشار', 'popcorn'], emoji: '🍿' },
        { keywords: ['فطير', 'pie', 'بيتزا'], emoji: '🥧' },
        { keywords: ['شوكولاتة', 'chocolate'], emoji: '🍫' },
        { keywords: ['عسل', 'honey'], emoji: '🍯' },
        { keywords: ['فطر', 'mushroom'], emoji: '🍄' },
        { keywords: ['ليمون', 'lemon', 'برتقال'], emoji: '🍋' },
        { keywords: ['موز', 'banana'], emoji: '🍌' },
        { keywords: ['فراولة', 'strawberry', 'توت'], emoji: '🍓' },
        { keywords: ['تفاح', 'apple'], emoji: '🍏' },
        { keywords: ['عنب', 'grape'], emoji: '🍇' },
        { keywords: ['بطيخ', 'watermelon'], emoji: '🍉' },
        { keywords: ['مانجو', 'mango'], emoji: '🥭' },
        { keywords: ['تمر', 'date'], emoji: '🌰' },
        { keywords: ['فول', 'beans'], emoji: '🫘' },
        { keywords: ['فلفل', 'pepper'], emoji: '🌶️' },
        { keywords: ['أفوكادو', 'avocado'], emoji: '🥑' },
        { keywords: ['خيار', 'cucumber'], emoji: '🥒' },
        { keywords: ['جزر', 'carrot'], emoji: '🥕' },
        { keywords: ['خس', 'lettuce'], emoji: '🥬' },
        { keywords: ['ذرة', 'corn'], emoji: '🌽' },
        { keywords: ['بيتزا', 'pizza'], emoji: '🍕' },
        { keywords: ['بان كيك', 'pancake', 'وفل'], emoji: '🥞' },
        { keywords: ['توست', 'toast', 'ساندويتش'], emoji: '🥪' }
    ];

    for (const entry of emojiMap) {
        if (entry.keywords.some(kw => nameLower.includes(kw))) {
            return entry.emoji;
        }
    }

    return '🍽️'; // Default food plate emoji
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
            <h3>جاري تحليل القائمة بالذكاء الاصطناعي...</h3>
            <p class="progress-subtitle">نقرأ الصورة ونستخرج البيانات فعلياً</p>
            <div class="progress-steps">
                <div class="progress-step active" data-step="1">
                    <span class="step-icon">📷</span>
                    <span>قراءة الصورة</span>
                </div>
                <div class="progress-step" data-step="2">
                    <span class="step-icon">🔍</span>
                    <span>استخراج النصوص (OCR)</span>
                </div>
                <div class="progress-step" data-step="3">
                    <span class="step-icon">📋</span>
                    <span>تنظيم الأصناف والأسعار</span>
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
    }, 1200);  // Slightly slower to account for real processing time
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
                <p>${results.suggestion || 'يرجى التأكد من صورة القائمة والمحاولة مرة أخرى'}</p>
                <button onclick="retryAnalysis()" class="btn btn-primary">إعادة المحاولة</button>
            </div>
        `;
        return;
    }

    const data = results.data;
    const hasExtractedFromImage = data.items.some(item => item.extractedFromImage);
    
    container.innerHTML = `
        <div class="analysis-results">
            <div class="results-header">
                <span class="success-badge">✅ ${results.message}</span>
                ${hasExtractedFromImage ? '<span class="real-data-badge">📸 بيانات مستخرجة من الصورة</span>' : ''}
                ${results.method ? '<span class="method-badge">🔧 الطريقة: ' + results.method + '</span>' : ''}
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
                            <div class="result-item-card ${item.needsPriceConfirmation ? 'needs-price' : ''}">
                                <span class="item-emoji">${item.emoji || '🍽️'}</span>
                                <h5>${item.name}</h5>
                                <p>${item.description || ''}</p>
                                <span class="item-price">
                                    ${item.price ? `${item.price} ${data.currency}` : '❓ السعر غير واضح'}
                                </span>
                                ${item.needsPriceConfirmation ? '<small class="price-hint">يرجى تأكيد السعر</small>' : ''}
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

// Export functions for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        analyzeMenuImage,
        generateFoodImage,
        getAIUsage,
        showAnalysisProgress,
        showAnalysisResults,
        guessFoodEmoji,
        parseRawTextToMenu
    };
}
