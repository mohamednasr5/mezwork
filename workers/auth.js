/**
 * ===================================
 * MezoMenu - Authentication Module
 * JWT-based authentication for Cloudflare Workers
 * ===================================
 */

// JWT Configuration
const JWT_CONFIG = {
    algorithm: 'HS256',
    issuer: 'mezomenu-saas',
    audience: 'mezomenu-api',
    accessTokenExpiry: 3600, // 1 hour
    refreshTokenExpiry: 604800 // 7 days
};

/**
 * Generate JWT token
 * @param {Object} payload - Token payload (user data)
 * @param {string} secret - JWT secret key
 * @param {string} type - 'access' or 'refresh'
 * @returns {Promise<string>} JWT token string
 */
export async function generateJWT(payload, secret, type = 'access') {
    const now = Math.floor(Date.now() / 1000);
    
    // Build JWT header
    const header = {
        alg: JWT_CONFIG.algorithm,
        typ: 'JWT'
    };
    
    // Build JWT payload
    const jwtPayload = {
        ...payload,
        iat: now,
        exp: now + (type === 'refresh' ? JWT_CONFIG.refreshTokenExpiry : JWT_CONFIG.accessTokenExpiry),
        iss: JWT_CONFIG.issuer,
        aud: JWT_CONFIG.audience,
        type
    };
    
    // Base64URL encode header and payload
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(jwtPayload));
    
    // Create signature
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const signature = await signHMAC(signatureInput, secret);
    
    // Combine to form JWT
    return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verify and decode JWT token
 * @param {string} token - JWT token string
 * @param {string} secret - JWT secret key
 * @returns {Promise<Object>} Decoded payload or throws error
 */
export async function verifyJWT(token, secret) {
    try {
        // Split token into parts
        const parts = token.split('.');
        if (parts.length !== 3) {
            throw new Error('Invalid token format');
        }
        
        const [encodedHeader, encodedPayload, signature] = parts;
        
        // Verify signature
        const signatureInput = `${encodedHeader}.${encodedPayload}`;
        const expectedSignature = await signHMAC(signatureInput, secret);
        
        if (signature !== expectedSignature) {
            throw new Error('Invalid signature');
        }
        
        // Decode payload
        const payload = JSON.parse(base64UrlDecode(encodedPayload));
        
        // Check expiration
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
            throw new Error('Token expired');
        }
        
        // Check issuer
        if (payload.iss !== JWT_CONFIG.issuer) {
            throw new Error('Invalid issuer');
        }
        
        // Check audience
        if (payload.aud !== JWT_CONFIG.audience) {
            throw new Error('Invalid audience');
        }
        
        return payload;
        
    } catch (error) {
        throw new Error(`Token verification failed: ${error.message}`);
    }
}

/**
 * Refresh access token using refresh token
 * @param {string} refreshToken - Refresh token
 * @param {string} secret - JWT secret key
 * @returns {Promise<Object>} New tokens object
 */
export async function refreshAccessToken(refreshToken, secret) {
    // Verify refresh token
    const payload = await verifyJWT(refreshToken, secret);
    
    if (payload.type !== 'refresh') {
        throw new Error('Invalid token type for refresh');
    }
    
    // Generate new access token
    const newAccessToken = await generateJWT({
        uid: payload.uid,
        email: payload.email,
        restaurantId: payload.restaurantId,
        role: payload.role
    }, secret, 'access');
    
    return {
        accessToken: newAccessToken,
        refreshToken: refreshToken // Keep same refresh token or generate new one
    };
}

/**
 * Extract token from Authorization header
 * @param {Request} request - HTTP request object
 * @returns {string|null} Token string or null
 */
function extractTokenFromHeader(request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.split(' ')[1];
}

/**
 * Authentication middleware for Cloudflare Workers
 * @param {Request} request - HTTP request
 * @param {Object} env - Worker environment
 * @returns {Promise<Object|null>} User object or null
 */
export async function authenticateMiddleware(request, env) {
    const token = extractTokenFromHeader(request);
    
    if (!token) {
        return null;
    }
    
    try {
        const payload = await verifyJWT(token, env.JWT_SECRET || JWT_SECRET);
        return payload;
    } catch (error) {
        console.error('Authentication error:', error.message);
        return null;
    }
}

/**
 * Role-based authorization check
 * @param {Object} user - User object from JWT
 * @param {Array<string>} allowedRoles - Array of allowed roles
 * @returns {boolean} Whether user is authorized
 */
export function authorizeRole(user, allowedRoles) {
    if (!user || !user.role) {
        return false;
    }
    return allowedRoles.includes(user.role);
}

/**
 * Restaurant ownership verification
 * @param {Object} user - User object from JWT
 * @param {string} restaurantId - Restaurant ID to check
 * @returns {boolean} Whether user owns the restaurant
 */
export function verifyRestaurantOwnership(user, restaurantId) {
    if (!user || !user.restaurantId) {
        return false;
    }
    
    // Admin can access any restaurant
    if (user.role === 'admin') {
        return true;
    }
    
    // Regular users can only access their own restaurant
    return user.restaurantId === restaurantId;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Base64URL encode a string
 * @param {string} str - String to encode
 * @returns {string} Base64URL encoded string
 */
function base64UrlEncode(str) {
    const base64 = btoa(str);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Base64URL decode a string
 * @param {string} str - Base64URL encoded string
 * @returns {string} Decoded string
 */
function base64UrlDecode(str) {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
        base64 += '=';
    }
    return atob(base64);
}

/**
 * Sign data with HMAC-SHA256
 * @param {string} data - Data to sign
 * @param {string} secret - Secret key
 * @returns {Promise<string>} Signature in Base64URL format
 */
async function signHMAC(data, secret) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const dataBuffer = encoder.encode(data);
    
    // Import key for HMAC
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    
    // Sign the data
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer);
    
    // Convert to Base64URL
    return base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * Generate secure random token
 * @param {number} length - Length of token in bytes
 * @returns {string} Hex-encoded random token
 */
export function generateSecureToken(length = 32) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Rate limiting helper (simple implementation)
 * Uses KV storage for rate limiting
 */
export class RateLimiter {
    constructor(kv, options = {}) {
        this.kv = kv;
        this.maxRequests = options.maxRequests || 100;
        this.windowMs = options.windowMs || 60000; // 1 minute default
    }
    
    /**
     * Check if request is allowed
     * @param {string} identifier - IP address or user ID
     * @returns {Promise<{allowed: boolean, remaining: number}>}
     */
    async check(identifier) {
        const key = `ratelimit:${identifier}`;
        const record = await this.kv.get(key, 'json');
        
        const now = Date.now();
        const windowStart = now - this.windowMs;
        
        if (!record || record.resetAt < windowStart) {
            // Reset counter
            await this.kv.put(key, JSON.stringify({
                count: 1,
                resetAt: now + this.windowMs
            }), { expirationTtl: Math.ceil(this.windowMs / 1000) });
            
            return { allowed: true, remaining: this.maxRequests - 1 };
        }
        
        if (record.count >= this.maxRequests) {
            return { 
                allowed: false, 
                remaining: 0,
                retryAfter: Math.ceil((record.resetAt - Date.now()) / 1000)
            };
        }
        
        // Increment counter
        const newCount = record.count + 1;
        await this.kv.put(key, JSON.stringify({
            count: newCount,
            resetAt: record.resetAt
        }));
        
        return { allowed: true, remaining: this.maxRequests - newCount };
    }
}

// Export utilities
export { extractTokenFromHeader };

// Default export for module usage
export default {
    generateJWT,
    verifyJWT,
    refreshAccessToken,
    authenticateMiddleware,
    authorizeRole,
    verifyRestaurantOwnership,
    generateSecureToken,
    RateLimiter
};
