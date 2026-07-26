/**
 * MezoMenu - Cloudflare R2 Storage Helper
 * Handles image uploads and retrieval from R2
 */

/**
 * R2 Storage Helper Class
 *
 * ⚠️ Cloudflare Workers لا يدعم process.env — الإعدادات لازم تجي من env
 * الطلب الحالي، مش من متغير Node غير موجود في هذه البيئة.
 */
class R2Helper {
    /**
     * @param {R2Bucket} binding - R2 binding (env.IMAGES_BUCKET من wrangler.toml)
     * @param {object} env - Cloudflare Workers env binding (لقراءة R2_BUCKET_NAME/R2_PUBLIC_URL)
     */
    constructor(binding, env = null) {
        this.bucket = binding;  // R2 binding from worker environment
        this.bucketName = env?.R2_BUCKET_NAME || 'mezomenu-images';
        this.publicUrl = env?.R2_PUBLIC_URL || 'https://images.mezomenu.com';
    }

    /**
     * Upload a file to R2
     * @param {File|Buffer|string} file - File to upload (can be base64 string)
     * @param {object} options - Upload options
     * @returns {Promise<object>} Upload result with URL
     */
    async upload(file, options = {}) {
        const {
            filename = `upload-${Date.now()}.jpg`,
            folder = 'uploads',
            restaurantId = 'default',
            contentType = 'image/jpeg',
            metadata = {}
        } = options;

        try {
            // Convert file to buffer if needed
            let body = file;
            
            if (typeof file === 'string' && file.startsWith('data:')) {
                // Handle base64 data URL
                const [header, data] = file.split(',');
                body = Uint8Array.from(atob(data), c => c.charCodeAt(0));
                
                // Extract content type from data URL if available
                if (header.includes('image/')) {
                    contentType = header.split(';')[0].split(':')[1];
                    // Update filename extension based on type
                    const ext = contentType.split('/')[1] || 'jpg';
                    filename = filename.replace(/\.[^.]+$/, '.' + ext);
                }
            } else if (typeof file === 'string') {
                // Handle plain base64
                body = Uint8Array.from(atob(file), c => c.charCodeAt(0));
            }

            // Generate unique key with restaurant isolation
            const key = `${restaurantId}/${folder}/${Date.now()}-${this.sanitizeFilename(filename)}`;

            // Set metadata for the object
            const customMetadata = {
                ...metadata,
                uploadedAt: new Date().toISOString(),
                restaurantId,
                originalName: filename
            };

            // Upload to R2
            await this.bucket.put(key, body, {
                httpMetadata: {
                    contentType,
                    cacheControl: 'public, max-age=31536000', // Cache for 1 year
                    contentDisposition: `inline; filename="${filename}"`
                },
                customMetadata
            });

            // Return public URL and key
            return {
                success: true,
                url: `${this.publicUrl}/${key}`,
                key,
                filename,
                contentType,
                size: body.length || body.byteLength || 0
            };

        } catch (error) {
            console.error('R2 upload error:', error);
            
            return {
                success: false,
                error: error.message,
                url: null,
                key: null
            };
        }
    }

    /**
     * Get a file from R2
     * @param {string} key - Object key in R2
     * @returns {Promise<object|null>} File object or null
     */
    async get(key) {
        try {
            const object = await this.bucket.get(key);
            
            if (!object) {
                return null;
            }

            return {
                exists: true,
                body: object.body,
                size: object.size,
                contentType: object.httpMetadata?.contentType,
                lastModified: object.uploaded?.getTime(),
                customMetadata: object.customMetadata
            };

        } catch (error) {
            console.error('R2 get error:', error);
            return null;
        }
    }

    /**
     * Delete a file from R2
     * @param {string} key - Object key to delete
     * @returns {Promise<boolean>} Success status
     */
    async delete(key) {
        try {
            await this.bucket.delete(key);
            return true;
        } catch (error) {
            console.error('R2 delete error:', error);
            return false;
        }
    }

    /**
     * List files in a path (with optional prefix)
     * @param {object} options - Listing options
     * @returns {Promise<Array>} List of objects
     */
    async list(options = {}) {
        const {
            prefix = '',
            restaurantId,
            limit = 100,
            cursor
        } = options;

        try {
            let fullPrefix = prefix;
            if (restaurantId) {
                fullPrefix = `${restaurantId}/${prefix}`;
            }

            const listed = await this.bucket.list({
                prefix: fullPrefix,
                limit,
                cursor
            });

            return {
                objects: listed.objects.map(obj => ({
                    key: obj.key,
                    size: obj.size,
                    lastModified: obj.uploaded?.getTime(),
                    httpMetadata: obj.httpMetadata
                })),
                truncated: listed.truncated,
                cursor: listed.cursor,
                count: listed.objects.length
            };

        } catch (error) {
            console.error('R2 list error:', error);
            return { objects: [], truncated: false };
        }
    }

    /**
     * Generate a presigned URL for direct upload (if needed)
     * Note: R2 doesn't support presigned URLs like S3, but we can use 
     * authenticated endpoints through workers
     * @param {string} key - Target object key
     * @param {number} expiresIn - Expiration time in seconds
     * @returns {Promise<string>} Upload URL
     */
    async getUploadUrl(key, expiresIn = 3600) {
        // For R2, we typically handle uploads through the worker itself
        // This would generate a one-time token for upload authorization
        const token = await this.generateUploadToken(key, expiresIn);
        
        return `${this.publicUrl}/api/upload?token=${token}&key=${encodeURIComponent(key)}`;
    }

    /**
     * Process and optimize image before upload
     * @param {Buffer|Uint8Array} imageBuffer - Image data
     * @param {object} options - Processing options
     * @returns {Promise<ProcessedImage>} Processed image data
     */
    async processImage(imageBuffer, options = {}) {
        const {
            maxWidth = 1920,
            maxHeight = 1920,
            quality = 85,
            format = 'jpeg'
        } = options;

        // In production, you'd use an image processing library
        // For now, return the original buffer with metadata
        
        return {
            buffer: imageBuffer,
            width: maxWidth,
            height: maxHeight,
            quality,
            format,
            processedAt: Date.now()
        };
    }

    /**
     * Validate image file type and size
     * @param {File|Buffer} file - File to validate
     * @param {object} constraints - Validation constraints
         * @returns {object} Validation result
     */
    validateImage(file, constraints = {}) {
        const {
            maxSizeMB = 10,           // Max file size in MB
            allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
            minWidth = 100,
            minHeight = 100
        } = constraints;

        const result = {
            valid: true,
            errors: [],
            warnings: []
        };

        // Check file size
        const fileSizeMB = file.size / (1024 * 1024);
        if (fileSizeMB > maxSizeMB) {
            result.valid = false;
            result.errors.push(`حجم الملف كبير جداً (${fileSizeMB.toFixed(2)}MB). الحد الأقصى ${maxSizeMB}MB`);
        }

        // Check file type
        if (file.type && !allowedTypes.includes(file.type)) {
            result.valid = false;
            result.errors.push(`نوع الملف غير مدعوم. الأنواع المسموحة: ${allowedTypes.join(', ')}`);
        }

        // Add warning for large files
        if (fileSizeMB > 5) {
            result.warnings.push('الملف كبير، قد يستغرق الرفع وقتاً أطول');
        }

        return result;
    }

    /**
     * Sanitize filename to prevent path traversal attacks
     * @param {string} filename - Original filename
     * @returns {string} Sanitized filename
     */
    sanitizeFilename(filename) {
        return filename
            .replace(/[^a-zA-Z0-9._-]/g, '_')  // Replace special chars
            .replace(/_{2,}/g, '_')              // Replace multiple underscores
            .replace(/^_|_$/g, '')               // Remove leading/trailing underscores
            .substring(0, 255);                  // Limit length
    }

    /**
     * Generate unique upload token
     * @private
     */
    async generateUploadToken(key, expiresIn) {
        // In production, use proper JWT or signed tokens
        const payload = {
            key,
            exp: Math.floor(Date.now() / 1000) + expiresIn,
            iat: Math.floor(Date.now() / 1000)
        };

        // Simple base64 encoding (use JWT in production)
        return btoa(JSON.stringify(payload));
    }

    /**
     * Delete all files for a specific restaurant
     * Used when deleting a restaurant account
     * @param {string} restaurantId - Restaurant ID
     * @returns {Promise<number>} Number of deleted files
     */
    async deleteRestaurantFiles(restaurantId) {
        let deletedCount = 0;
        let cursor = undefined;

        do {
            const result = await this.list({ restaurantId, limit: 500, cursor });
            
            for (const obj of result.objects) {
                await this.delete(obj.key);
                deletedCount++;
            }

            cursor = result.cursor;
        } while (result.truncated);

        return deletedCount;
    }
}

// Export class
export { R2Helper };
export default R2Helper;
