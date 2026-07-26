/**
 * MezoMenu - Menu Management Worker
 * Handles CRUD operations for restaurant menus with full isolation
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

        // Route based on path and method
        const routes = {
            // Menu Items
            'GET /api/menu/items': getMenuItems,
            'POST /api/menu/items': createMenuItem,
            'PUT /api/menu/items/:id': updateMenuItem,
            'DELETE /api/menu/items/:id': deleteMenuItem,
            
            // Categories
            'GET /api/menu/categories': getCategories,
            'POST /api/menu/categories': createCategory,
            'PUT /api/menu/categories/:id': updateCategory,
            'DELETE /api/menu/categories/:id': deleteCategory,
            
            // Bulk Operations
            'POST /api/menu/import': importMenu,
            'GET /api/menu/export': exportMenu,
            
            // Public Menu (for customer PWA)
            'GET /api/public/menu/:slug': getPublicMenu
        };

        const routeKey = `${request.method} ${url.pathname}`;
        
        // Handle dynamic routes
        let handler = routes[routeKey];
        
        if (!handler) {
            // Check for dynamic routes
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

        return errorResponse('Endpoint not found', 404, request);
    }
};

// ========================================
// Authentication Middleware
// ========================================

/**
 * Verify request is authenticated and extract restaurant ID
 */
async function authenticateRequest(request) {
    const authToken = request.headers.get('Authorization')?.replace('Bearer ', '');
    
    if (!authToken) {
        return { error: 'Authentication required', status: 401 };
    }

    try {
        const tokenData = JSON.parse(atob(authToken));
        
        // Check token expiration
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
// Menu Item Handlers
// ========================================

/**
 * Get all menu items for a restaurant
 */
async function getMenuItems(request, env, url) {
    try {
        const auth = await authenticateRequest(request);
        if (auth.error) return errorResponse(auth.error, auth.status, request);

        const { restaurantId } = auth;
        const categoryId = url.searchParams.get('category');
        const search = url.searchParams.get('search');
        const includeInactive = url.searchParams.get('includeInactive') === 'true';

        let items = await firebase.read(`restaurants/${restaurantId}/menu/items`);
        items = items || {};

        // Convert to array and filter
        let itemList = Object.entries(items).map(([id, data]) => ({
            id,
            ...data
        }));

        // Filter by category
        if (categoryId) {
            itemList = itemList.filter(item => item.categoryId === categoryId);
        }

        // Filter by search term
        if (search) {
            const searchLower = search.toLowerCase();
            itemList = itemList.filter(item => 
                item.name?.toLowerCase().includes(searchLower) ||
                item.description?.toLowerCase().includes(searchLower)
            );
        }

        // Filter inactive items unless requested
        if (!includeInactive) {
            itemList = itemList.filter(item => item.isAvailable !== false);
        }

        // Sort by order field or name
        itemList.sort((a, b) => (a.order || 0) - (b.order || 0));

        return successResponse({
            items: itemList,
            count: itemList.length
        }, null, request);

    } catch (error) {
        console.error('Get menu items error:', error);
        return errorResponse('فشل في جلب القائمة', 500, request);
    }
}

/**
 * Create a new menu item
 */
async function createMenuItem(request, env) {
    try {
        const auth = await authenticateRequest(request);
        if (auth.error) return errorResponse(auth.error, auth.status, request);

        const body = await request.json();
        const { restaurantId } = auth;

        // Validate required fields
        if (!body.name || !body.price || !body.categoryId) {
            return errorResponse('الاسم والسعر والقسم مطلوبة', 400, request);
        }

        // Generate unique ID
        const itemId = 'item_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);

        // Prepare item data
        const itemData = {
            id: itemId,
            name: body.name.trim(),
            description: body.description?.trim() || '',
            price: parseFloat(body.price),
            originalPrice: body.originalPrice ? parseFloat(body.originalPrice) : null,
            categoryId: body.categoryId,
            image: body.image || null,
            emoji: body.emoji || '🍽️',
            isAvailable: body.isAvailable !== false,
            isPopular: body.isPopular || false,
            isFeatured: body.isFeatured || false,
            preparationTime: body.preparationTime || null,
            calories: body.calories || null,
            allergens: body.allergens || [],
            variants: body.variants || [],
            addons: body.addons || [],
            order: body.order || Date.now(),
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        // Save to Firebase (restaurant-isolated path)
        await firebase.write(`restaurants/${restaurantId}/menu/items/${itemId}`, itemData);

        // Update public menu cache
        await updatePublicMenuCache(restaurantId);

        return successResponse(itemData, 'تم إضافة الصنف بنجاح', request);

    } catch (error) {
        console.error('Create menu item error:', error);
        return errorResponse('فشل في إضافة الصنف', 500, request);
    }
}

/**
 * Update an existing menu item
 */
async function updateMenuItem(request, env, url) {
    try {
        const auth = await authenticateRequest(request);
        if (auth.error) return errorResponse(auth.error, auth.status, request);

        const { restaurantId } = auth;
        const itemId = extractParam(url.pathname, '/api/menu/items/');
        
        if (!itemId) {
            return errorResponse('معرف الصنف مطلوب', 400, request);
        }

        // Check if item exists and belongs to this restaurant
        const existingItem = await firebase.read(`restaurants/${restaurantId}/menu/items/${itemId}`);
        if (!existingItem) {
            return errorResponse('الصنف غير موجود', 404, request);
        }

        const body = await request.json();

        // Prepare updated data (only allow specific fields)
        const allowedFields = [
            'name', 'description', 'price', 'originalPrice',
            'categoryId', 'image', 'emoji', 'isAvailable',
            'isPopular', 'isFeatured', 'preparationTime',
            'calories', 'allergens', 'variants', 'addons', 'order'
        ];

        const updates = {};
        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updates[field] = body[field];
            }
        }

        updates.updatedAt = Date.now();

        // Merge with existing data
        const updatedItem = { ...existingItem, ...updates };

        // Save to Firebase
        await firebase.write(
            `restaurants/${restaurantId}/menu/items/${itemId}`, 
            updatedItem
        );

        // Update public menu cache
        await updatePublicMenuCache(restaurantId);

        return successResponse(updatedItem, 'تم تحديث الصنف بنجاح', request);

    } catch (error) {
        console.error('Update menu item error:', error);
        return errorResponse('فشل في تحديث الصنف', 500, request);
    }
}

/**
 * Delete a menu item
 */
async function deleteMenuItem(request, env, url) {
    try {
        const auth = await authenticateRequest(request);
        if (auth.error) return errorResponse(auth.error, auth.status, request);

        const { restaurantId } = auth;
        const itemId = extractParam(url.pathname, '/api/menu/items/');

        if (!itemId) {
            return errorResponse('معرف الصنف مطلوب', 400, request);
        }

        // Check if item exists
        const existingItem = await firebase.read(`restaurants/${restaurantId}/menu/items/${itemId}`);
        if (!existingItem) {
            return errorResponse('الصنف غير موجود', 404, request);
        }

        // Delete from R2 if has custom image
        if (existingItem.image && existingImage.includes('r2.cloudflarestorage.com')) {
            // Would delete from R2 in production
            console.log('Would delete image:', existingItem.image);
        }

        // Delete from Firebase
        await firebase.remove(`restaurants/${restaurantId}/menu/items/${itemId}`);

        // Update public menu cache
        await updatePublicMenuCache(restaurantId);

        return successResponse(null, 'تم حذف الصنف بنجاح', request);

    } catch (error) {
        console.error('Delete menu item error:', error);
        return errorResponse('فشل في حذف الصنف', 500, request);
    }
}

// ========================================
// Category Handlers
// ========================================

/**
 * Get all categories for a restaurant
 */
async function getCategories(request, env) {
    try {
        const auth = await authenticateRequest(request);
        if (auth.error) return errorResponse(auth.error, auth.status, request);

        const { restaurantId } = auth;

        let categories = await firebase.read(`restaurants/${restaurantId}/menu/categories`);
        categories = categories || {};

        // Convert to array and sort
        const categoryList = Object.entries(categories).map(([id, data]) => ({
            id,
            ...data
        })).sort((a, b) => (a.order || 0) - (b.order || 0));

        // Count items in each category
        const items = await firebase.read(`restaurants/${restaurantId}/menu/items`) || {};
        
        const categoryListWithCounts = categoryList.map(cat => ({
            ...cat,
            itemCount: Object.values(items).filter(item => 
                item.categoryId === cat.id && item.isAvailable !== false
            ).length
        }));

        return successResponse({
            categories: categoryListWithCounts,
            count: categoryListWithCounts.length
        }, null, request);

    } catch (error) {
        console.error('Get categories error:', error);
        return errorResponse('فشل في جلب الأقسام', 500, request);
    }
}

/**
 * Create a new category
 */
async function createCategory(request, env) {
    try {
        const auth = await authenticateRequest(request);
        if (auth.error) return errorResponse(auth.error, auth.status, request);

        const body = await request.json();
        const { restaurantId } = auth;

        if (!body.name) {
            return errorResponse('اسم القسم مطلوب', 400, request);
        }

        const categoryId = 'cat_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);

        const categoryData = {
            id: categoryId,
            name: body.name.trim(),
            description: body.description?.trim() || '',
            icon: body.icon || '📁',
            image: body.image || null,
            color: body.color || '#6366f1',
            order: body.order || Date.now(),
            isActive: true,
            createdAt: Date.now()
        };

        await firebase.write(
            `restaurants/${restaurantId}/menu/categories/${categoryId}`,
            categoryData
        );

        return successResponse(categoryData, 'تم إضافة القسم بنجاح', request);

    } catch (error) {
        console.error('Create category error:', error);
        return errorResponse('فشل في إضافة القسم', 500, request);
    }
}

/**
 * Update a category
 */
async function updateCategory(request, env, url) {
    try {
        const auth = await authenticateRequest(request);
        if (auth.error) return errorResponse(auth.error, auth.status, request);

        const { restaurantId } = auth;
        const categoryId = extractParam(url.pathname, '/api/menu/categories/');

        if (!categoryId) {
            return errorResponse('معرف القسم مطلوب', 400, request);
        }

        const existingCategory = await firebase.read(
            `restaurants/${restaurantId}/menu/categories/${categoryId}`
        );
        
        if (!existingCategory) {
            return errorResponse('القسم غير موجود', 404, request);
        }

        const body = await request.json();
        const allowedFields = ['name', 'description', 'icon', 'image', 'color', 'order', 'isActive'];

        const updates = {};
        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updates[field] = body[field];
            }
        }

        const updatedCategory = { ...existingCategory, ...updates };
        
        await firebase.write(
            `restaurants/${restaurantId}/menu/categories/${categoryId}`,
            updatedCategory
        );

        return successResponse(updatedCategory, 'تم تحديث القسم بنجاح', request);

    } catch (error) {
        console.error('Update category error:', error);
        return errorResponse('فشل في تحديث القسم', 500, request);
    }
}

/**
 * Delete a category
 */
async function deleteCategory(request, env, url) {
    try {
        const auth = await authenticateRequest(request);
        if (auth.error) return errorResponse(auth.error, auth.status, request);

        const { restaurantId } = auth;
        const categoryId = extractParam(url.pathname, '/api/menu/categories/');

        if (!categoryId) {
            return errorResponse('معرف القسم مطلوب', 400, request);
        }

        // Check if category has items
        const items = await firebase.read(`restaurants/${restaurantId}/menu/items`) || {};
        const itemsInCategory = Object.values(items).filter(
            item => item.categoryId === categoryId
        );

        if (itemsInCategory.length > 0) {
            return errorResponse(
                `لا يمكن حذف هذا القسم لأنه يحتوي على ${itemsInCategory.length} صنف`,
                400,
                request
            );
        }

        await firebase.remove(`restaurants/${restaurantId}/menu/categories/${categoryId}`);

        return successResponse(null, 'تم حذف القسم بنجاح', request);

    } catch (error) {
        console.error('Delete category error:', error);
        return errorResponse('فشل في حذف القسم', 500, request);
    }
}

// ========================================
// Import/Export Handlers
// ========================================

/**
 * Import menu data (from AI analysis or manual entry)
 */
async function importMenu(request, env) {
    try {
        const auth = await authenticateRequest(request);
        if (auth.error) return errorResponse(auth.error, auth.status, request);

        const { restaurantId } = auth;
        const body = await request.json();
        const { categories, items, mode = 'merge' } = body;

        if (!categories || !items) {
            return errorResponse('بيانات الأقسام والأصناف مطلوبة', 400, request);
        }

        let importedCategories = 0;
        let importedItems = 0;

        // Import categories
        for (const cat of categories) {
            const catId = 'cat_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
            
            await firebase.write(`restaurants/${restaurantId}/menu/categories/${catId}`, {
                id: catId,
                name: cat.name,
                icon: cat.icon || '📁',
                order: cat.order || importedCategories + 1,
                isActive: true,
                createdAt: Date.now()
            });

            // Map old ID to new ID for items
            cat._newId = catId;
            importedCategories++;
        }

        // Import items
        for (const item of items) {
            const itemId = 'item_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
            
            // Find the new category ID
            const category = categories.find(c => c.id === item.categoryId);
            const newCategoryId = category?._newId || item.categoryId;

            await firebase.write(`restaurants/${restaurantId}/menu/items/${itemId}`, {
                id: itemId,
                name: item.name,
                description: item.description || '',
                price: item.price,
                categoryId: newCategoryId,
                image: item.image || null,
                emoji: item.emoji || '🍽️',
                isAvailable: true,
                order: importedItems + 1,
                createdAt: Date.now(),
                updatedAt: Date.now()
            });

            importedItems++;
        }

        // Update public menu cache
        await updatePublicMenuCache(restaurantId);

        return successResponse({
            importedCategories,
            importedItems,
            message: `تم استيراد ${importedCategories} قسم و ${importedItems} صنف`
        }, 'تم استيراد القائمة بنجاح', request);

    } catch (error) {
        console.error('Import menu error:', error);
        return errorResponse('فشل في استيراد القائمة', 500, request);
    }
}

/**
 * Export menu data as JSON
 */
async function exportMenu(request, env) {
    try {
        const auth = await authenticateRequest(request);
        if (auth.error) return errorResponse(auth.error, auth.status, request);

        const { restaurantId } = auth;

        const [categories, items] = await Promise.all([
            firebase.read(`restaurants/${restaurantId}/menu/categories`),
            firebase.read(`restaurants/${restaurantId}/menu/items`)
        ]);

        const exportData = {
            version: '1.0',
            exportedAt: Date.now(),
            restaurantId,
            categories: categories || {},
            items: items || {}
        };

        return successResponse(exportData, null, request);

    } catch (error) {
        console.error('Export menu error:', error);
        return errorResponse('فشل في تصدير القائمة', 500, request);
    }
}

// ========================================
// Public Menu Handler (for Customer PWA)
// ========================================

/**
 * Get public menu by slug (no authentication required)
 */
async function getPublicMenu(request, env, url) {
    try {
        const slug = extractParam(url.pathname, '/api/public/menu/');
        
        if (!slug) {
            return errorResponse('رابط المطعم مطلوب', 400, request);
        }

        // Find restaurant by slug
        const allRestaurants = await firebase.read('restaurants', { shallow: true });
        let restaurantId = null;
        let restaurantData = null;

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

        // Get full restaurant data
        restaurantData = await firebase.read(`restaurants/${restaurantId}`);
        
        // Get menu data
        const [categories, items] = await Promise.all([
            firebase.read(`restaurants/${restaurantId}/menu/categories`),
            firebase.read(`restaurants/${restaurantId}/menu/items`)
        ]);

        // Format response (only public-safe data)
        const publicMenu = {
            id: restaurantId,
            name: restaurantData.name,
            nameEn: restaurantData.nameEn,
            description: restaurantData.description,
            logo: restaurantData.logo,
            coverImage: restaurantData.coverImage,
            cuisineType: restaurantData.cuisineType,
            currencySymbol: restaurantData.currencySymbol || 'ج.م',
            whatsappNumber: restaurantData.whatsappNumber,
            settings: {
                enableWhatsApp: restaurantData.settings?.enableWhatsApp,
                language: restaurantData.settings?.language || 'ar'
            },
            categories: Object.values(categories || {}).filter(c => c.isActive !== false)
                .sort((a, b) => (a.order || 0) - (b.order || 0)),
            items: Object.values(items || {})
                .filter(i => i.isAvailable !== false)
                .sort((a, b) => (a.order || 0) - (b.order || 0))
        };

        return successResponse(publicMenu, null, request);

    } catch (error) {
        console.error('Get public menu error:', error);
        return errorResponse('فشل في جلب القائمة العامة', 500, request);
    }
}

// ========================================
// Helper Functions
// ========================================

function matchRoute(pattern, pathname) {
    // Simple pattern matching for dynamic routes
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

async function updatePublicMenuCache(restaurantId) {
    try {
        // Get restaurant data to find slug
        const restaurantData = await firebase.read(`restaurants/${restaurantId}`);
        
        if (restaurantData?.slug) {
            // Cache public menu for faster access
            const [categories, items] = await Promise.all([
                firebase.read(`restaurants/${restaurantId}/menu/categories`),
                firebase.read(`restaurants/${restaurantId}/menu/items`)
            ]);

            await firebase.write(`public_menus/${restaurantData.slug}`, {
                restaurantId,
                name: restaurantData.name,
                logo: restaurantData.logo,
                currencySymbol: restaurantData.currencySymbol || 'ج.م',
                whatsappNumber: restaurantData.whatsappNumber,
                lastUpdated: Date.now(),
                categories: categories || {},
                items: items || {}
            });
        }
    } catch (error) {
        console.error('Error updating public menu cache:', error);
    }
}
