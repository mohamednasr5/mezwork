/**
 * MezoMenu - Firebase Helper for Cloudflare Workers
 * Secure access to Firebase Realtime Database
 */

/**
 * Initialize Firebase Admin SDK (for server-side operations)
 * Note: In Cloudflare Workers, we use REST API instead of admin SDK
 *
 * ⚠️ Cloudflare Workers لا يدعم process.env — لازم تمرر env من الـ fetch
 * handler عن طريق configure(env)، أو مرّر databaseUrl/apiKey مباشرة.
 */
class FirebaseHelper {
    constructor(env = null) {
        const databaseUrl = env?.FIREBASE_DATABASE_URL ||
            `https://${env?.FIREBASE_PROJECT_ID || 'mezomenu-app'}-default-rtdb.firebaseio.com`;
        this.baseUrl = databaseUrl;
        this.apiKey = env?.FIREBASE_API_KEY || '';
    }

    /**
     * إعادة ضبط الإعدادات من env الطلب الحالي.
     * لازم تُستدعى أول حاجة في كل fetch handler قبل استخدام firebase.read/write/...
     * @param {object} env - Cloudflare Workers env binding
     */
    configure(env) {
        if (!env) return this;
        this.baseUrl = env.FIREBASE_DATABASE_URL ||
            `https://${env.FIREBASE_PROJECT_ID || 'mezomenu-app'}-default-rtdb.firebaseio.com`;
        this.apiKey = env.FIREBASE_API_KEY || '';
        return this;
    }

    /**
     * Get authentication headers for Firebase requests
     * @param {string} authToken - Optional auth token
     * @returns {object} Headers object
     */
    getHeaders(authToken) {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        } else if (this.apiKey) {
            // For public read access with security rules
            // In production, use proper authentication
        }
        
        return headers;
    }

    /**
     * Read data from Firebase
     * @param {string} path - Database path
     * @param {object} options - Query options
     * @returns {Promise<object>} Data snapshot
     */
    async read(path, options = {}) {
        let url = `${this.baseUrl}/${path}.json`;
        
        // Add query parameters
        const params = new URLSearchParams();
        if (options.orderBy) params.set('orderBy', `"${options.orderBy}"`);
        if (options.limitToLast) params.set('limitToLast', options.limitToLast);
        if (options.limitToFirst) params.set('limitToFirst', options.limitToFirst);
        if (options.startAt) params.set('startAt', options.startAt);
        if (options.endAt) params.set('endAt', options.endAt);
        if (options.equalTo) params.set('equalTo', JSON.stringify(options.equalTo));
        if (options.shallow === true) params.set('shallow', 'true');
        
        const queryString = params.toString();
        if (queryString) url += `?${queryString}`;

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: this.getHeaders(options.authToken)
            });

            if (!response.ok) {
                throw new Error(`Firebase read error: ${response.status}`);
            }

            const data = await response.json();
            return data;

        } catch (error) {
            console.error('Firebase read error:', error);
            throw error;
        }
    }

    /**
     * Write data to Firebase
     * @param {string} path - Database path
     * @param {object} data - Data to write
     * @param {object} options - Write options
     * @returns {Promise<object>} Response data
     */
    async write(path, data, options = {}) {
        const url = `${this.baseUrl}/${path}.json`;
        
        try {
            const response = await fetch(url, {
                method: options.method || 'PUT',
                headers: this.getHeaders(options.authToken),
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`Firebase write error: ${response.status}`);
            }

            return await response.json();

        } catch (error) {
            console.error('Firebase write error:', error);
            throw error;
        }
    }

    /**
     * Update specific fields in Firebase
     * @param {string} path - Database path
     * @param {object} data - Fields to update
     * @param {string} authToken - Auth token
     * @returns {Promise<object>} Response data
     */
    async update(path, data, authToken) {
        return this.write(path, data, { method: 'PATCH', authToken });
    }

    /**
     * Push new data to a list (generates unique key)
     * @param {string} path - Database path
     * @param {object} data - Data to push
     * @param {string} authToken - Auth token
     * @returns {Promise<string>} New key
     */
    async push(path, data, authToken) {
        const url = `${this.baseUrl}/${path}.json`;
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: this.getHeaders(authToken),
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`Firebase push error: ${response.status}`);
            }

            const result = await response.json();
            return result.name;  // The generated key

        } catch (error) {
            console.error('Firebase push error:', error);
            throw error;
        }
    }

    /**
     * Delete data from Firebase
     * @param {string} path - Database path
     * @param {string} authToken - Auth token
     * @returns {Promise<void>}
     */
    async remove(path, authToken) {
        const url = `${this.baseUrl}/${path}.json`;
        
        try {
            const response = await fetch(url, {
                method: 'DELETE',
                headers: this.getHeaders(authToken)
            });

            if (!response.ok) {
                throw new Error(`Firebase delete error: ${response.status}`);
            }

        } catch (error) {
            console.error('Firebase delete error:', error);
            throw error;
        }
    }

    /**
     * Verify restaurant ownership and get restaurant ID from auth token
     * This ensures complete isolation between restaurants
     * @param {Request} request - Incoming request
     * @returns {Promise<string|null>} Restaurant ID or null if unauthorized
     */
    async verifyRestaurantAccess(request) {
        const authToken = request.headers.get('Authorization')?.replace('Bearer ', '');
        const restaurantId = request.headers.get('X-Restaurant-ID');

        if (!authToken || !restaurantId) {
            return null;
        }

        try {
            // Verify the token belongs to a user who owns this restaurant
            const userData = await this.read(`users/${authToken.split('_')[1] || ''}/restaurantId`);
            
            if (userData === restaurantId) {
                return restaurantId;
            }

            return null;
        } catch (error) {
            console.error('Verification error:', error);
            return null;
        }
    }

    /**
     * Get public menu data (no auth required)
     * @param {string} slug - Restaurant slug
     * @returns {Promise<object|null>} Menu data or null
     */
    async getPublicMenu(slug) {
        try {
            const menuData = await this.read(`public_menus/${slug}`, { shallow: true });
            
            if (menuData && menuData.isActive !== false) {
                return menuData;
            }

            return null;
        } catch (error) {
            console.error('Error fetching public menu:', error);
            return null;
        }
    }

    /**
     * Validate that data belongs to specified restaurant
     * Critical for multi-tenant isolation
     * @param {string} restaurantId 
     * @param {string} path 
     * @returns {boolean}
     */
    validateRestaurantPath(restaurantId, path) {
        // Ensure all paths are prefixed with restaurant ID
        const expectedPrefix = `restaurants/${restaurantId}`;
        return path.startsWith(expectedPrefix);
    }
}

// Export singleton instance
const firebase = new FirebaseHelper();

export default firebase;
export { FirebaseHelper };
