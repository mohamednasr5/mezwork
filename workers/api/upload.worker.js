/**
 * MezoMenu - File Upload Worker
 * Handles image uploads to Cloudflare R2 storage
 */

import { handlePreflight, errorResponse, successResponse } from '../shared/cors.js';
import firebase from '../shared/firebase.js';
import R2Helper from '../shared/r2.js';

export default {
    async fetch(request, env) {
        firebase.configure(env); // ⚠️ لازم قبل أي استخدام لـ firebase.read/write (يقرأ من env بدل process.env)
        const url = new URL(request.url);
        
        if (request.method === 'OPTIONS') {
            return handlePreflight(request);
        }

        const routes = {
            // Image upload
            'POST /api/upload': uploadImage,
            
            // Get uploaded image info
            'GET /api/upload/:key': getImageInfo,
            
            // Delete image
            'DELETE /api/upload/:key': deleteImage,
            
            // Batch upload
            'POST /api/upload/batch': batchUpload,
            
            // Generate presigned URL (if needed)
            'POST /api/upload/presigned': generatePresignedUrl
        };

        const routeKey = `${request.method} ${url.pathname}`;
        
        let handler = routes[routeKey];
        
        if (!handler) {
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

        return errorResponse('Upload endpoint not found', 404, request);
    }
};

// ========================================
// Authentication Middleware
// ========================================

async function authenticateRequest(request) {
    const authToken = request.headers.get('Authorization')?.replace('Bearer ', '');
    
    if (!authToken) {
        return { error: 'Authentication required', status: 401 };
    }

    try {
        const tokenData = JSON.parse(atob(authToken));
        
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
// Upload Handler
// ========================================

async function uploadImage(request, env) {
    try {
        const auth = await authenticateRequest(request);
        if (auth.error) return errorResponse(auth.error, auth.status, request);

        const contentType = request.headers.get('Content-Type') || '';

        let fileData;
        let filename;

        // Handle different content types
        if (contentType.includes('multipart/form-data')) {
            // Form data upload
            const formData = await request.formData();
            const file = formData.get('file');
            
            if (!file) {
                return errorResponse('الملف مطلوب', 400, request);
            }

            filename = file.name || 'upload.jpg';
            fileData = await file.arrayBuffer();

        } else if (contentType.includes('application/json')) {
            // JSON with base64 data
            const body = await request.json();
            
            if (!body.image) {
                return errorResponse('بيانات الصورة مطلوبة', 400, request);
            }

            filename = body.filename || 'upload.jpg';
            fileData = body.image; // Base64 string

        } else {
            // Raw binary data
            filename = url.searchParams.get('filename') || 'upload.jpg';
            fileData = await request.arrayBuffer();
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        const detectedType = detectFileType(fileData, filename);

        if (!allowedTypes.includes(detectedType)) {
            return errorResponse(
                `نوع الملف غير مدعوم: ${detectedType}. الأنواع المسموحة: JPEG, PNG, WebP, GIF`,
                400,
                request
            );
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        const fileSize = typeof fileData === 'string' 
            ? Math.ceil(fileData.length * 0.75) // Approximate base64 size
            : fileData.byteLength;

        if (fileSize > maxSize) {
            return errorResponse(
                `حجم الملف كبير جداً (${(fileSize / 1024 / 1024).toFixed(2)}MB). الحد الأقصى 10MB`,
                400,
                request
            );
        }

        console.log(`[Upload] Uploading image for restaurant ${auth.restaurantId}: ${filename}`);

        // Initialize R2 helper
        const r2 = new R2Helper(env.IMAGES_BUCKET, env);

        // Determine folder based on upload type
        const folder = url.searchParams.get('folder') || 'general';
        const validFolders = ['menu-items', 'logos', 'covers', 'avatars', 'general', 'ai-generated'];
        const targetFolder = validFolders.includes(folder) ? folder : 'general';

        // Upload to R2
        const result = await r2.upload(fileData, {
            filename,
            folder: targetFolder,
            restaurantId: auth.restaurantId,
            contentType: detectedType,
            metadata: {
                uploadedBy: auth.userId,
                source: 'web'
            }
        });

        if (!result.success) {
            throw new Error(result.error || 'فشل في رفع الملف');
        }

        // Record upload in database for tracking
        await recordUpload(auth.restaurantId, result.key, {
            originalName: filename,
            size: result.size,
            contentType: detectedType,
            folder: targetFolder,
            uploadedBy: auth.userId
        });

        return successResponse({
            url: result.url,
            key: result.key,
            filename: result.filename,
            size: result.size,
            contentType: result.contentType
        }, 'تم رفع الصورة بنجاح!', request);

    } catch (error) {
        console.error('[Upload] Error:', error);
        return errorResponse('فشل في رفع الصورة: ' + error.message, 500, request);
    }
}

// ========================================
// Get Image Info Handler
// ========================================

async function getImageInfo(request, env, url) {
    try {
        const auth = await authenticateRequest(request);
        if (auth.error) return errorResponse(auth.error, auth.status, request);

        const key = extractParam(url.pathname, '/api/upload/');
        
        if (!key) {
            return errorResponse('مفتاح الصورة مطلوب', 400, request);
        }

        // Verify ownership (restaurant isolation)
        if (!key.startsWith(`${auth.restaurantId}/`)) {
            return errorResponse('غير مصرح بالوصول لهذه الصورة', 403, request);
        }

        const r2 = new R2Helper(env.IMAGES_BUCKET, env);
        const object = await r2.get(key);

        if (!object || !object.exists) {
            return errorResponse('الصورة غير موجودة', 404, request);
        }

        return successResponse({
            key: object.customMetadata?.originalName || key.split('/').pop(),
            size: object.size,
            contentType: object.contentType,
            lastModified: object.lastModified,
            url: `${env.R2_PUBLIC_URL || 'https://images.mezomenu.com'}/${key}`
        }, null, request);

    } catch (error) {
        console.error('[Get Image] Error:', error);
        return errorResponse('فشل في جلب معلومات الصورة', 500, request);
    }
}

// ========================================
// Delete Image Handler
// ========================================

async function deleteImage(request, env, url) {
    try {
        const auth = await authenticateRequest(request);
        if (auth.error) return errorResponse(auth.error, auth.status, request);

        const key = extractParam(url.pathname, '/api/upload/');

        if (!key) {
            return errorResponse('مفتاح الصورة مطلوب', 400, request);
        }

        // Verify ownership
        if (!key.startsWith(`${auth.restaurantId}/`)) {
            return errorResponse('غير مصرح بحذف هذه الصورة', 403, request);
        }

        const r2 = new R2Helper(env.IMAGES_BUCKET, env);
        const deleted = await r2.delete(key);

        if (!deleted) {
            return errorResponse('فشل في حذف الصورة أو غير موجودة', 404, request);
        }

        // Remove from database records
        await removeUploadRecord(auth.restaurantId, key);

        return successResponse(null, 'تم حذف الصورة بنجاح', request);

    } catch (error) {
        console.error('[Delete] Error:', error);
        return errorResponse('فشل في حذف الصورة', 500, request);
    }
}

// ========================================
// Batch Upload Handler
// ========================================

async function batchUpload(request, env) {
    try {
        const auth = await authenticateRequest(request);
        if (auth.error) return errorResponse(auth.error, auth.status, request);

        const body = await request.json();
        const { images } = body;

        if (!images || !Array.isArray(images)) {
            return errorResponse('قائمة الصور مطلوبة', 400, request);
        }

        if (images.length > 10) {
            return errorResponse('الحد الأقصى 10 صور في المرة الواحدة', 400, request);
        }

        const r2 = new R2Helper(env.IMAGES_BUCKET, env);
        const results = [];

        for (let i = 0; i < images.length; i++) {
            const imageData = images[i];
            
            try {
                const result = await r2.upload(imageData.data || imageData.base64 || imageData, {
                    filename: imageData.filename || `batch-image-${i + 1}.jpg`,
                    folder: imageData.folder || 'batch',
                    restaurantId: auth.restaurantId,
                    contentType: imageData.contentType || 'image/jpeg'
                });

                results.push({
                    index: i,
                    success: true,
                    url: result.url,
                    key: result.key
                });

                // Record upload
                await recordUpload(auth.restaurantId, result.key, {
                    originalName: result.filename,
                    size: result.size,
                    folder: 'batch',
                    uploadedBy: auth.userId
                });

            } catch (error) {
                results.push({
                    index: i,
                    success: false,
                    error: error.message
                });
            }
        }

        const successful = results.filter(r => r.success).length;

        return successResponse({
            results,
            totalProcessed: images.length,
            successful,
            failed: images.length - successful
        }, `تم رفع ${successful} من ${images.length} صورة بنجاح`, request);

    } catch (error) {
        console.error('[Batch Upload] Error:', error);
        return errorResponse('فشل في الرفع المجمّع', 500, request);
    }
}

// ========================================
// Presigned URL Handler
// ========================================

async function generatePresignedUrl(request, env) {
    try {
        const auth = await authenticateRequest(request);
        if (auth.error) return errorResponse(auth.error, auth.status, request);

        const body = await request.json();
        const { filename, contentType, expiresIn = 3600 } = body;

        if (!filename) {
            return errorResponse('اسم الملف مطلوب', 400, request);
        }

        const r2 = new R2Helper(env.IMAGES_BUCKET, env);
        
        // Generate unique key
        const key = `${auth.restaurantId}/presigned/${Date.now()}-${r2.sanitizeFilename(filename)}`;

        // Generate upload URL
        const uploadUrl = await r2.getUploadUrl(key, expiresIn);

        return successResponse({
            uploadUrl,
            key,
            method: 'PUT',
            headers: {
                'Content-Type': contentType || 'image/jpeg'
            },
            expiresAt: Date.now() + (expiresIn * 1000)
        }, 'تم إنشاء رابط الرفع المؤقت', request);

    } catch (error) {
        console.error('[Presigned URL] Error:', error);
        return errorResponse('فشل في إنشاء رابط الرفع', 500, request);
    }
}

// ========================================
// Database Recording Functions
// ========================================

async function recordUpload(restaurantId, key, metadata) {
    try {
        await firebase.write(`restaurants/${restaurantId}/uploads/${key}`, {
            ...metadata,
            key,
            restaurantId,
            createdAt: Date.now()
        });
    } catch (error) {
        console.error('Error recording upload:', error);
    }
}

async function removeUploadRecord(restaurantId, key) {
    try {
        await firebase.remove(`restaurants/${restaurantId}/uploads/${key}`);
    } catch (error) {
        console.error('Error removing upload record:', error);
    }
}

// ========================================
// Utility Functions
// ========================================

function matchRoute(pattern, pathname) {
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

/**
 * Detect file type from magic bytes or extension
 */
function detectFileType(data, filename) {
    // Check from base64 or buffer
    let headerBytes;
    
    if (typeof data === 'string') {
        // Extract first few bytes from base64
        const binary = atob(data.substring(0, 50));
        headerBytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            headerBytes[i] = binary.charCodeAt(i);
        }
    } else if (data instanceof ArrayBuffer) {
        headerBytes = new Uint8Array(data.slice(0, 4));
    } else {
        headerBytes = new Uint8Array([0]);
    }

    // Check magic bytes
    if (headerBytes[0] === 0xFF && headerBytes[1] === 0xD8) {
        return 'image/jpeg';
    }
    if (headerBytes[0] === 0x89 && headerBytes[1] === 0x50) {
        return 'image/png';
    }
    if (headerBytes[0] === 0x47 && headerBytes[1] === 0x49) {
        return 'image/gif';
    }
    if (headerBytes[0] === 0x52 && headerBytes[1] === 0x49) {
        return 'image/webp';
    }

    // Fallback to extension
    const ext = filename?.split('.').pop()?.toLowerCase() || '';
    const extMap = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp'
    };

    return extMap[ext] || 'application/octet-stream';
}
