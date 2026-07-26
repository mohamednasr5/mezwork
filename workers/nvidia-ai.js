/**
 * ===================================
 * MezoMenu - NVIDIA AI Integration
 * Menu analysis and image generation using NVIDIA AI APIs
 * ===================================
 */

// NVIDIA API Configuration
const NVIDIA_CONFIG = {
    baseUrl: 'https://ai.api.nvidia.com',
    // Vision/OCR endpoint for menu analysis
    visionEndpoint: '/v1/vision',
    // Image generation endpoint (Stable Diffusion XL)
    imageEndpoint: '/v1/stable-diffusion-xl/image-to-image',
    textToImageEndpoint: '/v1/stable-diffusion-xl/text2img',
    // LLM endpoint for text processing
    llmEndpoint: '/v1/chat/completions'
};

// Supported models
const MODELS = {
    vision: {
        menuAnalysis: 'nvidia/deplot',           // Chart/table extraction
        ocr: 'microsoft/deberta-v3-large-mnli'   // Text extraction
    },
    imageGeneration: {
        sdxl: 'stabilityai/stable-diffusion-xl',
        sdxlTurbo: 'stabilityai/sdxl-turbo'
    },
    llm: {
        chat: 'meta/llama-3.1-70b-instruct',
        small: 'meta/llama-3.1-8b-instruct'
    }
};

/**
 * Analyze menu image using NVIDIA Vision AI
 * Extracts categories, items, prices, and descriptions
 */
export async function analyzeMenuImage(imageData, apiKey) {
    try {
        const response = await fetch(`${NVIDIA_CONFIG.baseUrl}${NVIDIA_CONFIG.visionEndpoint}/predict`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: MODELS.vision.menuAnalysis,
                image: imageData,
                prompt: `Analyze this restaurant menu image and extract:
1. All food/drink categories (sections)
2. Each item name under each category
3. Price for each item
4. Any descriptions or notes

Return the data in this JSON format:
{
  "categories": [
    {
      "name": "Category Name",
      "items": [
        {
          "name": "Item Name",
          "price": 0,
          "description": "",
          "category": "Category Name"
        }
      ]
    }
  ],
  "confidence": 0.95,
  "rawText": "extracted text from image"
}`
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Vision analysis failed');
        }

        const result = await response.json();
        
        // Process and structure the result
        return processMenuAnalysisResult(result);
        
    } catch (error) {
        console.error('Menu analysis error:', error);
        throw new Error(`Failed to analyze menu: ${error.message}`);
    }
}

/**
 * Process raw AI result into structured menu format
 */
function processMenuAnalysisResult(rawResult) {
    let menuData = {
        categories: [],
        items: [],
        confidence: 0,
        rawText: ''
    };

    try {
        // Try to parse as JSON first
        if (typeof rawResult === 'string') {
            const parsed = JSON.parse(rawResult);
            if (parsed.categories) {
                return parsed;
            }
        } else if (rawResult.data) {
            // Handle different response formats
            const content = rawResult.data[0]?.content || rawResult.output;
            if (typeof content === 'string') {
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[0]);
                }
            }
        }

        // Fallback: use raw result structure
        if (rawResult.categories) {
            menuData = { ...menuData, ...rawResult };
        }

    } catch (parseError) {
        console.error('Error parsing AI result:', parseError);
        // Return basic structure with raw text
        menuData.rawText = typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult);
    }

    return menuData;
}

/**
 * Generate food image using Stable Diffusion XL
 */
export async function generateFoodImage(prompt, options = {}, apiKey) {
    const {
        itemName = '',
        style = 'professional food photography',
        width = 512,
        height = 512,
        steps = 30,
        cfgScale = 7.5,
        seed = -1
    } = options;

    // Build enhanced prompt for food photography
    const enhancedPrompt = buildFoodPrompt(itemName, prompt, style);

    try {
        const response = await fetch(`${NVIDIA_CONFIG.baseUrl}${NVIDIA_CONFIG.textToImageEndpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text_prompts: [{
                    text: enhancedPrompt,
                    weight: 1
                }],
                negative_prompt: 'blurry, low quality, distorted, ugly, bad lighting, watermark, text, logo',
                cfg_scale: cfgScale,
                height: height,
                width: width,
                samples: 1,
                steps: steps,
                seed: seed === -1 ? Math.floor(Math.random() * 1000000) : seed
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Image generation failed');
        }

        const result = await response.json();
        
        // Extract base64 image from response
        const imageBase64 = result.artifacts?.[0]?.base64;
        
        if (!imageBase64) {
            throw new Error('No image in response');
        }

        return {
            success: true,
            image: imageBase64,
            prompt: enhancedPrompt,
            seed: result.seed || seed,
            metadata: {
                model: MODELS.imageGeneration.sdxl,
                dimensions: `${width}x${height}`,
                steps
            }
        };

    } catch (error) {
        console.error('Image generation error:', error);
        throw new Error(`Failed to generate image: ${error.message}`);
    }
}

/**
 * Build optimized prompt for food photography
 */
function buildFoodPrompt(itemName, userPrompt, style) {
    const basePrompt = userPrompt || `Delicious ${itemName}`;
    
    const styleModifiers = {
        'professional': 'professional food photography, studio lighting, high detail, appetizing presentation',
        'restaurant': 'restaurant menu photo, warm ambient lighting, rustic table setting',
        'minimal': 'minimalist food photography, clean white background, modern aesthetic',
        'gourmet': 'gourmet fine dining photography, elegant plating, artistic composition',
        'casual': 'casual dining photo, natural lighting, home-style comfort food look'
    };

    const selectedStyle = styleModifiers[style] || styleModifiers['professional'];
    
    const fullPrompt = `${basePrompt}, ${selectedStyle}, 
    mouth-watering, fresh ingredients, vibrant colors, 
    sharp focus, 8k quality, award-winning food photography`;

    return fullPrompt.replace(/\s+/g, ' ').trim();
}

/**
 * Generate images for entire menu items batch
 */
export async function generateMenuImages(items, options = {}, apiKey, onProgress) {
    const results = [];
    const total = items.length;
    
    for (let i = 0; i < total; i++) {
        const item = items[i];
        
        try {
            const result = await generateFoodImage(
                item.description || item.name,
                {
                    ...options,
                    itemName: item.name
                },
                apiKey
            );
            
            results.push({
                itemId: item.id || item.name,
                success: true,
                imageUrl: result.image,
                metadata: result.metadata
            });
            
        } catch (error) {
            results.push({
                itemId: item.id || item.name,
                success: false,
                error: error.message
            });
        }
        
        // Report progress
        if (onProgress) {
            onProgress({
                current: i + 1,
                total,
                percentage: Math.round(((i + 1) / total) * 100),
                lastItem: item.name
            });
        }
        
        // Small delay to avoid rate limiting
        if (i < total - 1) {
            await sleep(500);
        }
    }
    
    return {
        success: true,
        totalProcessed: total,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
    };
}

/**
 * Use LLM to enhance or translate menu items
 */
export async function enhanceMenuItemWithLLM(item, action = 'enhance', apiKey) {
    const prompts = {
        enhance: `Enhance this menu item description to make it more appealing:
Name: ${item.name}
Current Description: ${item.description || 'No description'}
Price: ${item.price || 'Not specified'}

Return a JSON object with:
{
  "name": "enhanced name",
  "description": "appealing description",
  "tags": ["tag1", "tag2"],
  "allergens": ["if any"]
}`,
        
        translate: `Translate this menu item to Arabic:
Name: ${item.name}
Description: ${item.description || ''}

Return:
{
  "nameArabic": "translated name",
  "descriptionArabic": "translated description"
}`,
        
        categorize: `Categorize this menu item into the best category:
Item Name: ${item.name}
Description: ${item.description || ''}
Price: ${item.price || ''}

Choose from common restaurant categories or suggest a new one.
Return:
{
  "category": "best category name",
  "subcategories": ["optional sub"],
  "cuisineType": "type of cuisine"
}`
    };

    try {
        const response = await fetch(`${NVIDIA_CONFIG.baseUrl}${NVIDIA_CONFIG.llmEndpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: MODELS.llm.chat,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a professional menu consultant helping restaurants create appealing menus.'
                    },
                    {
                        role: 'user',
                        content: prompts[action] || prompts.enhance
                    }
                ],
                max_tokens: 500,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error('LLM request failed');
        }

        const result = await response.json();
        const content = result.choices?.[0]?.message?.content;
        
        if (content) {
            // Try to extract JSON from response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        }
        
        return { rawResponse: content };

    } catch (error) {
        console.error('LLM enhancement error:', error);
        throw new Error(`Failed to enhance item: ${error.message}`);
    }
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Sleep utility for delays
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Convert file to base64
 */
export async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Convert base64 to blob for upload
 */
export function base64ToBlob(base64, mimeType = 'image/png') {
    const byteCharacters = atob(base64);
    const byteArrays = [];
    
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }
    
    return new Blob(byteArrays, { type: mimeType });
}

// Export all functions
export default {
    analyzeMenuImage,
    generateFoodImage,
    generateMenuImages,
    enhanceMenuItemWithLLM,
    fileToBase64,
    base64ToBlob,
    MODELS,
    NVIDIA_CONFIG
};
