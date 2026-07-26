/**
 * ===================================
 * MezoMenu - Cloudflare R2 Storage Client
 * Image and file storage using R2
 * ===================================
 */

// R2 Configuration
const R2_CONFIG = {
    bucket: 'mezomenu-images',
    publicUrl: 'https://cdn.mezomenu.com',
    allowedTypes: {
        image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'],
        document: ['application/pdf']
    },
    maxSize: {
        image: 5 * 1024 * 1024, // 5MB
        document: 10 * 1024 * 1024 // 10MB
    }
};

/**
 * R2 Storage Class for file operations
 */
export class R2Storage {
    constructor(r2Binding) {
        this.bucket = r2Binding;
        this.publicUrl = R2_CONFIG.publicUrl;
    }

    /**
     * Upload a file to R2
     * @param {Buffer|ArrayBuffer|ReadableStream} data - File data
     * @param {string} key - Storage key (path)
     * @param {Object} options - Upload options
     * @returns {Promise<Object>} Upload result with URL
     */
    async upload(data, key, options = {}) {
        const {
            contentType = 'application/octet-stream',
            metadata = {},
            cacheControl = 'public, max-age=31536000', // Cache for 1 year
            customHeaders = {}
        } = options;

        try {
            // Validate key format
            if (!this.isValidKey(key)) {
                throw new Error('Invalid storage key format');
            }

            // Build headers
            const headers = new Headers({
                'Content-Type': contentType,
                'Cache-Control': cacheControl,
                ...customHeaders
            });

            // Add metadata
            Object.entries(metadata).forEach(([k, v]) => {
                headers.set(`x-amz-meta-${k}`, String(v));
            });

            // Convert data to appropriate format
            let body = data;
            if (data instanceof ArrayBuffer) {
                body = data;
            } else if (data instanceof Uint8Array) {
                body = data.buffer;
            } else if (typeof data === 'string') {
                body = new TextEncoder().encode(data);
            }

            // Put object to R2
            await this.bucket.put(key, body, {
                httpMetadata: { contentType },
                customMetadata: metadata
            });

            // Generate public URL
            const url = this.getPublicUrl(key);

            return {
                success: true,
                key,
                url,
                size: typeof data === 'string' ? data.length : data.byteLength || data.size,
                contentType,
                uploadedAt: Date.now()
            };

        } catch (error) {
            console.error('R2 upload error:', error);
            throw new Error(`Upload failed: ${error.message}`);
        }
    }

    /**
     * Upload from a fetch response (e.g., AI generated image)
     */
    async uploadFromResponse(response, key, options = {}) {
        if (!response.ok) {
            throw new Error(`Source response error: ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        return this.upload(buffer, key, options);
    }

    /**
     * Get file from R2
     * @param {string} key - Storage key
     * @returns {Promise<Object|null>} File object or null
     */
    async get(key) {
        try {
            const object = await this.bucket.get(key);

            if (!object) {
                return null;
            }

            return {
                exists: true,
                key,
                size: object.size,
                uploaded: object.uploaded,
                httpMetadata: object.httpMetadata,
                customMetadata: object.customMetadata,
                body: object.body,
                url: this.getPublicUrl(key)
            };
        } catch (error) {
            console.error('R2 get error:', error);
            throw new Error(`Get failed: ${error.message}`);
        }
    }

    /**
     * Delete file from R2
     * @param {string} key - Storage key
     * @returns {Promise<boolean>} Success status
     */
    async delete(key) {
        try {
            await this.bucket.delete(key);
            return true;
        } catch (error) {
            console.error('R2 delete error:', error);
            throw new Error(`Delete failed: ${error.message}`);
        }
    }

    /**
     * List files with prefix
     * @param {string} prefix - Key prefix to list
     * @param {Object} options - List options
     * @returns {Promise<Array>} List of objects
     */
    async list(prefix = '', options = {}) {
        const {
            limit = 100,
            cursor = undefined,
            delimiter = '/'
        } = options;

        try {
            const listed = await this.bucket.list({
                prefix,
                limit,
                cursor,
                delimiter
            });

            return {
                objects: listed.objects.map(obj => ({
                    key: obj.key,
                    size: obj.size,
                    uploaded: obj.uploaded,
                    etag: obj.etag
                })),
                truncated: listed.truncated,
                cursor: listed.cursor,
                prefixes: listed.prefixes || []
            };
        } catch (error) {
            console.error('R2 list error:', error);
            throw new Error(`List failed: ${error.message}`);
        }
    }

    /**
     * Check if file exists
     * @param {string} key - Storage key
     * @returns {Promise<boolean>}
     */
    async exists(key) {
        const object = await this.bucket.head(key);
        return !!object;
    }

    /**
     * Get public URL for a key
     * @param {string} key - Storage key
     * @returns {string} Public URL
     */
    getPublicUrl(key) {
        return `${this.publicUrl}/${key}`;
    }

    /**
     * Generate signed URL for private access (if needed)
     * Note: R2 doesn't natively support signed URLs like S3,
     * but you can use Workers to implement this
     */
    async getSignedUrl(key, expiresIn = 3600) {
        // For now, return public URL
        // Implement signed URL logic if needed
        return this.getPublicUrl(key);
    }

    /**
     * Copy file within bucket
     * @param {string} sourceKey - Source key
     * @param {string} destKey - Destination key
     * @returns {Promise<Object>}
     */
    async copy(sourceKey, destKey) {
        try {
            const sourceObject = await this.get(sourceKey);
            if (!sourceObject) {
                throw new Error('Source file not found');
            }

            return this.upload(
                await sourceObject.arrayBuffer(),
                destKey,
                {
                    contentType: sourceObject.httpMetadata.contentType,
                    metadata: sourceObject.customMetadata
                }
            );
        } catch (error) {
            console.error('R2 copy error:', error);
            throw new Error(`Copy failed: ${error.message}`);
        }
    }

    /**
     * Validate storage key format
     */
    isValidKey(key) {
        // Keys should be path-like, no leading slash, no special chars
        const validPattern = /^[a-zA-Z0-9_\-./]+$/;
        return validPattern.test(key) && !key.startsWith('/') && !key.startsWith('//');
    }

    /**
     * Generate unique filename
     * @param {string} originalName - Original filename
     * @param {string} prefix - Path prefix (e.g., 'restaurantId/items')
     * @returns {string} Unique key
     */
    generateUniqueKey(originalName, prefix = '') {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        
        // Extract extension
        const ext = originalName.includes('.') 
            ? '.' + originalName.split('.').pop().toLowerCase()
            : '';
        
        // Clean the original name
        const cleanName = originalName
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .substring(0, 50);
        
        const parts = [prefix, timestamp, random];
        if (cleanName) parts.push(cleanName + ext);
        
        return parts.filter(Boolean).join('/');
    }
}

// ==================== IMAGE PROCESSING HELPERS ====================

/**
 * Process and optimize images before upload
 */
export class ImageProcessor {
    
    /**
     * Resize image dimensions
     * Note: In Workers, you might use WASM-based image processing
     */
    static async resize(imageData, maxWidth, maxHeight, quality = 85) {
        // For now, just return as-is
        // In production, use sharp (Node.js) or WASM-based libraries
        return imageData;
    }

    /**
     * Convert image to WebP format for better compression
     */
    static async convertToWebP(imageData) {
        // Placeholder - would need image processing library
        return imageData;
    }

    /**
     * Generate thumbnails
     */
    static async generateThumbnail(imageData, width = 200, height = 200) {
        // Placeholder
        return imageData;
    }

    /**
     * Get image dimensions
     */
    static async getDimensions(imageData) {
        // Basic PNG/JPEG dimension detection
        if (imageData instanceof ArrayBuffer || imageData instanceof Uint8Array) {
            const bytes = new Uint8Array(
                imageData instanceof ArrayBuffer ? imageData : imageData.buffer
            );
            
            // PNG
            if (bytes[0] === 0x89 && bytes[1] === 0x50) {
                return {
                    width: (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19],
                    height: (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]
                };
            }
            
            // JPEG
            if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
                // Simplified JPEG dimension extraction
                return { width: 0, height: 0 }; // Would need full parser
            }
        }
        
        return null;
    }
}

// ==================== FILE VALIDATION ====================

/**
 * Validate uploaded file
 */
export function validateFile(file, type = 'image') {
    const errors = [];
    const config = R2_CONFIG.allowedTypes[type];
    const maxSize = R2_CONFIG.maxSize[type];

    if (!file) {
        errors.push('No file provided');
        return { valid: false, errors };
    }

    // Check type
    if (!config.includes(file.type)) {
        errors.push(`File type not allowed. Accepted: ${config.join(', ')}`);
    }

    // Check size
    if (file.size > maxSize) {
        errors.push(`File too large. Maximum: ${formatBytes(maxSize)}`);
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Export default instance factory
export default function createR2Storage(r2Binding) {
    return new R2Storage(r2Binding);
}
