/**
 * MezoMenu - AI Integration Service
 * Using Agnes AI API (https://platform.agnes-ai.com/)
 * 
 * Features:
 * - Menu Analysis with REAL data from Firebase
 * - AI Image Generation for food items
 * - Smart menu suggestions
 */

// ========================================
// Configuration
// ========================================

const AI_CONFIG = {
    // Worker URL for secure API calls (API key is stored in Worker)
    workerURL: 'https://menu.nonm1724.workers.dev',
    
    // Agnes AI API Configuration
    agnesAI: {
        // Endpoints - all calls go through Worker for security
        chatEndpoint: '/api/ai/chat',
        imageEndpoint: '/api/ai/image',
        analyzeEndpoint: '/api/ai/analyze'
    },
    
    // Default settings
    defaults: {
        language: 'ar',
        maxTokens: 2000,
        temperature: 0.7,
        imageWidth: 512,
        imageHeight: 512
    }
};

// ========================================
// Core AI Functions
// ========================================

/**
 * Main AI Chat Function - uses Agnes AI
 * @param {string} message - User message/prompt
 * @param {object} options - Options
 * @returns {Promise<object>} - AI response
 */
async function aiChat(message, options = {}) {
    const restaurantId = getRestaurantId();
    
    try {
        console.log('🤖 Sending request to Agnes AI...');
        
        const response = await fetch(`${AI_CONFIG.workerURL}${AI_CONFIG.agnesAI.chatEndpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({
                message: message,
                options: {
                    language: options.language || AI_CONFIG.defaults.language,
                    maxTokens: options.maxTokens || AI_CONFIG.defaults.maxTokens,
                    temperature: options.temperature || AI_CONFIG.defaults.temperature,
                    context: options.context || 'menu-assistant'
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Agnes AI error: ${response.status}`);
        }

        const result = await response.json();
        
        return {
            success: true,
            data: result.data || result.response || result,
            message: result.message || 'تم بنجاح'
        };

    } catch (error) {
        console.error('❌ Agnes AI Error:', error);
        return {
            success: false,
            error: error.message || 'فشل في الاتصال بالذكاء الاصطناعي'
        };
    }
}

/**
 * Generate Image using Agnes AI
 * @param {string} prompt - Image description
 * @param {object} options - Generation options
 * @returns {Promise<object>} - Generated image data
 */
async function aiGenerateImage(prompt, options = {}) {
    const restaurantId = getRestaurantId();
    
    try {
        console.log('🎨 Generating image with Agnes AI...');
        
        // Build detailed prompt for food photography
        const enhancedPrompt = buildFoodImagePrompt(prompt, options);
        
        const response = await fetch(`${AI_CONFIG.workerURL}${AI_CONFIG.agnesAI.imageEndpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({
                prompt: enhancedPrompt,
                options: {
                    width: options.width || AI_CONFIG.defaults.imageWidth,
                    height: options.height || AI_CONFIG.defaults.imageHeight,
                    style: options.style || 'food-photography',
                    quality: options.quality || 'high'
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Image generation error: ${response.status}`);
        }

        const result = await response.json();
        
        return {
            success: true,
            imageUrl: result.imageUrl || result.url || result.image,
            imageBase64: result.imageBase64 || result.base64,
            source: 'agnes-ai',
            prompt: enhancedPrompt,
            message: 'تم توليد الصورة بنجاح!'
        };

    } catch (error) {
        console.error('❌ Image generation error:', error);
        
        // Fallback to styled placeholder
        return createStyledPlaceholder(prompt, options);
    }
}

// ========================================
// Menu Analysis Functions (WITH REAL DATA)
// ========================================

/**
 * Analyze menu using AI with REAL Firebase data
 * This function fetches actual menu data and sends it to AI for analysis
 * 
 * @param {object} options - Analysis options
 * @returns {Promise<object>} - Analysis results based on REAL data
 */
async function analyzeMenuWithAI(options = {}) {
    const restaurantId = getRestaurantId();
    
    try {
        console.log('🔍 Starting AI Menu Analysis with REAL data...');
        
        // STEP 1: Fetch REAL menu data from Firebase
        const realMenuData = await fetchRealMenuData(restaurantId);
        
        console.log(`📊 Fetched REAL data: ${realMenuData.items.length} items, ${realMenuData.categories.length} categories`);
        
        // STEP 2: Send REAL data to AI for analysis
        const analysisResult = await sendMenuToAnalysis(realMenuData, options);
        
        if (analysisResult.success) {
            // Log usage
            await incrementAIUsage(restaurantId, 'analysis');
            
            return {
                success: true,
                data: analysisResult.data,
                realData: {
                    itemsCount: realMenuData.items.length,
                    categoriesCount: realMenuData.categories.length,
                    source: 'firebase-real-data'
                },
                message: `تم تحليل القائمة الحقيقية! (${realMenuData.items.length} صنف في ${realMenuData.categories.length} قسم)`
            };
        } else {
            throw new Error(analysisResult.error);
        }

    } catch (error) {
        console.error('❌ Menu analysis error:', error);
        
        return {
            success: false,
            error: error.message || 'فشل في تحليل القائمة',
            suggestion: 'تأكد من اتصال الإنترنت وحاول مرة أخرى'
        };
    }
}

/**
 * Analyze menu IMAGE using OCR + AI
 * Extracts text from image then analyzes it
 * 
 * @param {File|string} imageFile - Menu image
 * @param {object} options - Options
 * @returns {Promise<object>} - Extracted menu data
 */
async function analyzeMenuImage(imageFile, options = {}) {
    const restaurantId = getRestaurantId();
    
    try {
        console.log('📷 Starting menu image analysis...');
        
        // Convert file to base64 if needed
        let imageBase64;
        if (imageFile instanceof File) {
            imageBase64 = await fileToBase64(imageFile);
        } else {
            imageBase64 = imageFile;
        }

        // Send to Worker for OCR processing + AI analysis
        const response = await fetch(`${AI_CONFIG.workerURL}${AI_CONFIG.agnesAI.analyzeEndpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({
                image: imageBase64,
                type: 'menu-ocr',
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
            throw new Error(errorData.message || `OCR analysis error: ${response.status}`);
        }

        const result = await response.json();
        
        // Parse and structure the extracted data
        const structuredData = parseOCRResult(result.data || result);
        
        if (structuredData.items.length > 0) {
            await incrementAIUsage(restaurantId, 'analysis');
            
            return {
                success: true,
                data: structuredData,
                confidence: result.confidence || 0.8,
                method: 'agnes-ai-ocr',
                rawText: result.text || null,
                message: `تم استخراج ${structuredData.items.length} صنف من الصورة!`
            };
        } else {
            throw new Error('لم يتمكن AI من استخراج أصناف من الصورة');
        }

    } catch (error) {
        console.error('❌ Image analysis error:', error);
        
        return {
            success: false,
            error: error.message || 'فشل في تحليل الصورة',
            suggestion: 'تأكد من أن الصورة واضحة وقابلة للقراءة'
        };
    }
}

/**
 * Get AI-powered suggestions for menu improvement
 * Uses REAL menu data from Firebase
 * 
 * @param {object} options - Options
 * @returns {Promise<object>} - Suggestions based on real data
 */
async function getMenuSuggestions(options = {}) {
    const restaurantId = getRestaurantId();
    
    try {
        // Fetch real data first
        const realMenuData = await fetchRealMenuData(restaurantId);
        
        // Build analysis prompt with real data
        const prompt = buildSuggestionsPrompt(realMenuData, options);
        
        // Get AI suggestions
        const result = await aiChat(prompt, {
            context: 'menu-expert',
            maxTokens: 1500
        });
        
        if (result.success) {
            return {
                success: true,
                suggestions: result.data,
                basedOn: {
                    itemsCount: realMenuData.items.length,
                    categoriesCount: realMenuData.categories.length
                }
            };
        }
        
        return result;

    } catch (error) {
        console.error('❌ Suggestions error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// ========================================
// Data Fetching Functions (Firebase)
// ========================================

/**
 * Fetch REAL menu data from Firebase
 * This is the KEY function that gets actual data
 */
async function fetchRealMenuData(restaurantId) {
    try {
        // Check if Firebase is available
        if (typeof firebase === 'undefined' || !firebase.database) {
            console.warn('⚠️ Firebase not available, returning empty data');
            return { categories: [], items: [], restaurantName: '' };
        }
        
        const db = firebase.database();
        const ref = db.ref(`restaurants/${restaurantId}/menu`);
        
        return new Promise((resolve, reject) => {
            ref.once('value', (snapshot) => {
                const data = snapshot.val() || {};
                
                // Extract categories
                const categories = data.categories ? Object.entries(data.categories).map(([id, cat]) => ({
                    id: id,
                    name: cat.name || 'بدون اسم',
                    order: cat.order || 0,
                    ...cat
                })) : [];
                
                // Extract items
                let items = [];
                if (data.items) {
                    Object.entries(data.items).forEach(([id, item]) => {
                        items.push({
                            id: id,
                            name: item.name || 'صنف بدون اسم',
                            description: item.description || '',
                            price: parseFloat(item.price) || 0,
                            categoryId: item.categoryId || null,
                            emoji: item.emoji || guessFoodEmoji(item.name),
                            isAvailable: item.isAvailable !== false,
                            image: item.image || null,
                            ...item
                        });
                    });
                }
                
                // Get restaurant name
                let restaurantName = '';
                db.ref(`restaurants/${restaurantId}/info/name`).once('value', (snap) => {
                    restaurantName = snap.val() || '';
                    
                    resolve({
                        restaurantName,
                        categories,
                        items
                    });
                });
                
            }, (error) => {
                console.error('Firebase read error:', error);
                reject(error);
            });
        });
        
    } catch (error) {
        console.error('Error fetching menu data:', error);
        return { categories: [], items: [], restaurantName: '' };
    }
}

/**
 * Send menu data to AI for analysis
 */
async function sendMenuToAnalysis(menuData, options) {
    try {
        // Build comprehensive prompt with REAL data
        const analysisPrompt = `
أنت خبير في تحليل قوائم المطاعم. قم بتحليل البيانات التالية لقائمة حقيقية并提供 تحليلك:

=== بيانات المطعم ===
اسم المطعم: ${menuData.restaurantName || 'غير محدد'}

=== الأقسام (${menuData.categories.length}) ===
${menuData.categories.map(cat => `- ${cat.name} (رقم: ${cat.id})`).join('\n')}

=== الأصناف (${menuData.items.length}) ===
${menuData.items.map(item => {
    const catName = menuData.categories.find(c => c.id === item.categoryId)?.name || 'غير مصنف';
    return `- ${item.name}: ${item.price} ج.م (القسم: ${catName})${item.description ? `\n  الوصف: ${item.description}` : ''}`;
}).join('\n\n')}

=== المطلوب ===
1. تقييم شامل للقائمة (الأسعار، التنوع، التنظيم)
2. مقترحات لتحسين القائمة
3. أصناف مقترحة جديدة بناءً على الأصناف الحالية
4. نصائح للتسعير

قدم التحليل باللغة العربية بشكل منظم وواضح.
`;

        const result = await aiChat(analysisPrompt, {
            context: 'menu-analysis',
            maxTokens: 2500,
            temperature: 0.6
        });
        
        if (result.success) {
            return {
                success: true,
                data: {
                    ...menuData,
                    analysis: result.data,
                    analyzedAt: new Date().toISOString()
                }
            };
        }
        
        return result;

    } catch (error) {
        console.error('Error in sendMenuToAnalysis:', error);
        return { success: false, error: error.message };
    }
}

// ========================================
// Image Generation Helpers
// ========================================

/**
 * Build detailed prompt for food image generation
 */
function buildFoodImagePrompt(itemName, options = {}) {
    const styleModifiers = [
        'professional food photography',
        'studio lighting',
        'high quality',
        'appetizing',
        'gourmet presentation',
        'on a clean white plate or rustic wooden table',
        'mouth-watering',
        'fresh ingredients',
        'vibrant natural colors',
        'sharp focus',
        '8k resolution',
        'award-winning food photography style'
    ];
    
    // Add specific food-type modifiers
    const nameLower = (itemName || '').toLowerCase();
    let foodTypeModifiers = [];
    
    if (/بيتزا|pizza/i.test(nameLower)) {
        foodTypeModifiers = ['melting cheese', 'golden crust', 'tomato sauce', 'Italian cuisine'];
    } else if (/برجر|burger/i.test(nameLower)) {
        foodTypeModifiers = ['juicy patty', 'fresh vegetables', 'brioche bun', 'gourmet burger'];
    } else if (/دجاج|chicken/i.test(nameLower)) {
        foodTypeModifiers = ['grilled chicken', 'golden brown', 'herbs garnish', 'roasted'];
    } else if (/سمك|fish/i.test(nameLower)) {
        foodTypeModifiers = ['fresh fish', 'lemon slices', 'herbs', 'grilled seafood'];
    } else if (/سلطة|salad/i.test(nameLower)) {
        foodTypeModifiers = ['fresh vegetables', 'colorful', 'healthy', 'dressing drizzle'];
    } else if (/معكرونة|pasta/i.test(nameLower)) {
        foodTypeModifiers = ['pasta', 'sauce', 'parmesan cheese', 'Italian'];
    } else if (/حلوى|dessert|كيك|cake/i.test(nameLower)) {
        foodTypeModifiers = ['sweet', 'beautiful presentation', 'chocolate or cream', 'delicious dessert'];
    } else if (/عصير|juice|مشروب/i.test(nameLower)) {
        foodTypeModifiers = ['refreshing drink', 'ice cubes', 'glass', 'beverage photography'];
    }
    
    const allModifiers = [...styleModifiers, ...foodTypeModifiers];
    
    return `${itemName}, ${allModifiers.join(', ')}`;
}

/**
 * Create styled placeholder as fallback
 */
async function createStyledPlaceholder(itemName, options = {}) {
    try {
        const emoji = guessFoodEmoji(itemName);
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        // Beautiful gradient background
        const gradients = {
            warm: ['#ff6b6b', '#ee5a5a'],
            fresh: ['#51cf66', '#40c057'],
            cool: ['#339af0', '#228be6'],
            sweet: ['#cc5de8', '#be4bdb'],
            neutral: ['#6366f1', '#8b5cf6']
        };
        
        const gradientType = getGradientType(itemName);
        const [color1, color2] = gradients[gradientType] || gradients.neutral;
        
        const gradient = ctx.createLinearGradient(0, 0, 512, 512);
        gradient.addColorStop(0, color1);
        gradient.addColorStop(1, color2);
        ctx.fillStyle = gradient;
        
        // Rounded rectangle
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
        
        // Hint
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

function getGradientType(itemName) {
    const nameLower = (itemName || '').toLowerCase();
    
    if (/سلطة|خضروات|طازج|صحي/i.test(nameLower)) return 'fresh';
    if (/حلوى|كيك|شوكولاتة|حلو/i.test(nameLower)) return 'sweet';
    if (/مثلجات|بارد|عصير|مشروب/i.test(nameLower)) return 'cool';
    if (/لحم|دجاج|مشوي|ساخن/i.test(nameLower)) return 'warm';
    
    return 'neutral';
}

// ========================================
// OCR Result Parsing
// ========================================

/**
 * Parse OCR result into structured menu data
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
 * Parse raw OCR text into structured menu data
 */
function parseRawTextToMenu(rawText, language = 'ar') {
    const lines = rawText.split('\n').filter(line => line.trim().length > 0);
    
    const categories = [];
    const items = [];
    let currentCategory = null;
    let categoryCounter = 0;
    
    // Common category keywords
    const categoryPatterns = [
        /مقبلات|أطباق جانبية|سلطات|شوربات/i,
        /أطباق رئيسية|وجبات رئيسية/i,
        /مشروبات|عصائر|مشروبات باردة|ساخنة/i,
        /حلويات|تحلية/i,
        /سمك ومأكولات بحرية/i,
        /سندويشات|برجر/i,
        /بيتزا|معجنات/i,
        /رز|أرز|معكرونة|باستا/i,
        /appetizers|starters|sides/i,
        /main.?course|entrees?|mains?/i,
        /drinks?|beverages?|juices?/i,
        /desserts?|sweets?/i,
        /seafood|fish/i,
        /sandwiches?|burgers?/i,
        /pizza|pasta/i,
        /salads?|soups?/i
    ];
    
    // Price pattern
    const pricePattern = /(?:(?:ج\.م|EGP|\$|€|£|ريال|درهم)\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:ج\.م|EGP|\$|€|£)?/;
    
    for (const line of lines) {
        const trimmedLine = line.trim();
        
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
        
        // Try to extract item + price
        const priceMatch = trimmedLine.match(pricePattern);
        
        if (priceMatch && currentCategory) {
            const priceStr = priceMatch[1].replace(',', '.');
            const price = parseFloat(priceStr);
            
            let name = trimmedLine.substring(0, trimmedLine.indexOf(priceMatch[0])).trim();
            
            name = name.replace(/^[.\-–—]+/, '')
                       .replace(/[.\-–—]+$/, '')
                       .replace(/\d+/g, '')
                       .replace(/\s+/g, ' ')
                       .trim();
            
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
            items.push({
                id: `item_${Date.now()}_${items.length}`,
                name: trimmedLine,
                description: '',
                price: null,
                categoryId: currentCategory.id,
                emoji: guessFoodEmoji(trimmedLine),
                isAvailable: true,
                needsPriceConfirmation: true,
                extractedFromImage: true
            });
        }
    }
    
    // Default category if none found
    if (categories.length === 0 && items.length > 0) {
        categories.push({
            id: 'cat_1',
            name: language === 'ar' ? 'الأصناف' : 'Items',
            order: 1
        });
        
        items.forEach(item => {
            item.categoryId = 'cat_1';
        });
    }
    
    return {
        restaurantName: '',
        currency: detectCurrency(rawText),
        categories: categories,
        items: items
    };
}

function detectCurrency(text) {
    if (/ج\.م|جنيه|مصري/i.test(text)) return 'ج.م';
    if (/EGP/i.test(text)) return 'ج.م';
    if (/\$|دولار/i.test(text)) return '$';
    if (/€|يورو/i.test(text)) return '€';
    if (/£|جنيه.*إستريليني/i.test(text)) return '£';
    if (/ريال|SAR/i.test(text)) return 'ر.س';
    if (/درهم|AED/i.test(text)) return 'د.إ';
    return 'ج.م';
}

// ========================================
// Suggestion Prompt Builder
// ========================================

function buildSuggestionsPrompt(menuData, options) {
    return `
بناءً على بيانات القائمة الحالية التالية، قدم اقتراحات محددة وعملية:

=== القائمة الحالية ===
الأقسام: ${menuData.categories.map(c => c.name).join(', ')}
عدد الأصناف: ${menuData.items.length}
أسعار الأصناف: ${menuData.items.map(i => `${i.name}: ${i.price}`).join(', ')}

=== المطلوب ===
1. 3-5 اقتراحات لأصناف جديدة تناسب القائمة
2. اقترحات لتحسين الأسعار
3. أفكار لعروض خاصة

قدم الإجابة باللغة العربية بشكل منظم.
`;
}

// ========================================
// Usage Tracking
// ========================================

async function incrementAIUsage(restaurantId, type) {
    console.log(`📊 Incremented ${type} usage for restaurant: ${restaurantId}`);
    // Server-side tracking happens in Worker
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
        { keywords: ['شاي', 'tea'], emoji: '🍵' },
        { keywords: ['حليب', 'milk', 'لاتيه', 'كابتشينو'], emoji: '🥛' },
        { keywords: ['حمص', 'hummus', 'مقبلات', 'متبل'], emoji: '🧆' },
        { keywords: ['فواكه', 'fruit', 'fruits'], emoji: '🍎' },
        { keywords: ['خضروات', 'vegetable', 'خضراوات'], emoji: '🥬' },
        { keywords: ['بيض', 'egg', 'أومليت'], emoji: '🍳' },
        { keywords: ['جبن', 'cheese', 'جبنة'], emoji: '🧀' },
        { keywords: ['فشار', 'popcorn'], emoji: '🍿' },
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
        { keywords: ['بان كيك', 'pancake', 'وفل'], emoji: '🥞' },
        { keywords: ['توست', 'toast', 'ساندويتش'], emoji: '🥪' }
    ];

    for (const entry of emojiMap) {
        if (entry.keywords.some(kw => nameLower.includes(kw))) {
            return entry.emoji;
        }
    }

    return '🍽️';
}

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

function truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
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
            <p class="progress-subtitle">نقرأ البيانات الحقيقية من قائمتك</p>
            <div class="progress-steps">
                <div class="progress-step active" data-step="1">
                    <span class="step-icon">📊</span>
                    <span>جلب البيانات الحقيقية</span>
                </div>
                <div class="progress-step" data-step="2">
                    <span class="step-icon">🔍</span>
                    <span>تحليل البيانات بالذكاء الاصطناعي</span>
                </div>
                <div class="progress-step" data-step="3">
                    <span class="step-icon">💡</span>
                    <span>إنشاء الاقتراحات</span>
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
    }, 1200);
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
                <p>${results.suggestion || 'يرجى المحاولة مرة أخرى'}</p>
                <button onclick="retryAnalysis()" class="btn btn-primary">إعادة المحاولة</button>
            </div>
        `;
        return;
    }

    const data = results.data;
    const isRealData = results.realData && results.realData.source === 'firebase-real-data';
    
    container.innerHTML = `
        <div class="analysis-results">
            <div class="results-header">
                <span class="success-badge">✅ ${results.message}</span>
                ${isRealData ? '<span class="real-data-badge">📊 تحليل مبني على بيانات حقيقية</span>' : ''}
                ${data.extractedFromImage ? '<span class="real-data-badge">📸 بيانات مستخرجة من الصورة</span>' : ''}
            </div>
            
            ${data.analysis ? `
            <div class="analysis-content">
                <h4>تحليل الذكاء الاصطناعي</h4>
                <div class="analysis-text">${formatAIResponse(data.analysis)}</div>
            </div>
            ` : ''}
            
            ${data.categories && data.categories.length > 0 ? `
            <div class="results-sections">
                <div class="results-categories">
                    <h4>الأقسام (${data.categories.length})</h4>
                    <ul>
                        ${data.categories.map(cat => `
                            <li>
                                <span class="category-name">${cat.name}</span>
                                <span class="items-count">${data.items.filter(i => i.categoryId === cat.id).length} صنف</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
                
                ${data.items && data.items.length > 0 ? `
                <div class="results-items">
                    <h4>الأصناف (${data.items.length})</h4>
                    <div class="items-grid">
                        ${data.items.map(item => `
                            <div class="result-item-card ${item.needsPriceConfirmation ? 'needs-price' : ''}">
                                <span class="item-emoji">${item.emoji || '🍽️'}</span>
                                <h5>${item.name}</h5>
                                <p>${item.description || ''}</p>
                                <span class="item-price">
                                    ${item.price ? `${item.price} ${data.currency || 'ج.م'}` : '❓ السعر غير واضح'}
                                </span>
                                ${item.needsPriceConfirmation ? '<small class="price-hint">يرجى تأكيد السعر</small>' : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
            ` : ''}
            
            <div class="results-actions">
                <button onclick="exportAnalysis()" class="btn btn-primary btn-lg">
                    📥 تصدير التحليل
                </button>
                <button onclick="retryAnalysis()" class="btn btn-outline">
                    🔄 إعادة التحليل
                </button>
            </div>
        </div>
    `;
}

/**
 * Format AI response with proper line breaks
 */
function formatAIResponse(text) {
    if (!text) return '';
    return text
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/- (.*?)/g, '<li>$1</li>');
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        aiChat,
        aiGenerateImage,
        analyzeMenuWithAI,
        analyzeMenuImage,
        getMenuSuggestions,
        showAnalysisProgress,
        showAnalysisResults,
        guessFoodEmoji,
        fetchRealMenuData
    };
}
