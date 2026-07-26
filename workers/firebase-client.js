/**
 * ===================================
 * MezoMenu - Firebase Realtime Database Client
 * Client-side Firebase integration for Workers
 * ===================================
 */

// Firebase configuration (will be set from environment)
let firebaseConfig = {
    databaseURL: '',
    apiKey: '',
    projectId: '',
    storageBucket: ''
};

// Cache for data
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Initialize Firebase client
 */
export function initFirebase(config) {
    firebaseConfig = { ...firebaseConfig, ...config };
}

/**
 * Firebase Reference class for database operations
 */
export class DatabaseReference {
    constructor(path) {
        this.path = path;
        this.fullUrl = `${firebaseConfig.databaseURL}/${path}.json`;
    }
    
    /**
     * Get data at this path
     * @param {Object} options - Query options
     * @returns {Promise<any>} Data snapshot value
     */
    async once(options = {}) {
        const cacheKey = `${this.path}_${JSON.stringify(options)}`;
        
        // Check cache first
        if (cache.has(cacheKey)) {
            const cached = cache.get(cacheKey);
            if (Date.now() - cached.timestamp < CACHE_TTL) {
                return {
                    val: () => cached.data,
                    exists: () => cached.data !== null && cached.data !== undefined,
                    key: this.path.split('/').pop()
                };
            }
        }
        
        try {
            let url = this.fullUrl;
            
            // Add query parameters
            const params = new URLSearchParams();
            
            if (options.orderByChild) {
                params.set('orderBy', `"${options.orderByChild}"`);
            }
            
            if (options.equalTo !== undefined) {
                params.set('equalTo', typeof options.equalTo === 'string' 
                    ? `"${options.equalTo}"` 
                    : options.equalTo);
            }
            
            if (options.limitToFirst) {
                params.set('limitToFirst', options.limitToFirst);
            }
            
            if (options.limitToLast) {
                params.set('limitToLast', options.limitToLast);
            }
            
            if (options.startAt !== undefined) {
                params.set('startAt', typeof options.startAt === 'string'
                    ? `"${options.startAt}"`
                    : options.startAt);
            }
            
            if (options.endAt !== undefined) {
                params.set('endAt', typeof options.endAt === 'string'
                    ? `"${options.endAt}"`
                    : options.endAt);
            }
            
            const queryString = params.toString();
            if (queryString) {
                url += `?${queryString}`;
            }
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${firebaseConfig.apiKey}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Firebase error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Cache the result
            cache.set(cacheKey, {
                data,
                timestamp: Date.now()
            });
            
            return {
                val: () => data,
                exists: () => data !== null && data !== undefined,
                key: this.path.split('/').pop(),
                forEach: (callback) => {
                    if (data && typeof data === 'object') {
                        Object.keys(data).forEach(key => {
                            callback({
                                val: () => data[key],
                                key,
                                exists: () => true,
                                ref: () => new DatabaseReference(`${this.path}/${key}`)
                            });
                        });
                    }
                }
            };
            
        } catch (error) {
            console.error('Firebase GET error:', error);
            throw error;
        }
    }
    
    /**
     * Set data at this path
     * @param {*} data - Data to set
     * @returns {Promise<void>}
     */
    async set(data) {
        try {
            const response = await fetch(this.fullUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${firebaseConfig.apiKey}`
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                throw new Error(`Firebase error: ${response.status}`);
            }
            
            // Invalidate cache for this path
            this.invalidateCache();
            
            return await response.json();
            
        } catch (error) {
            console.error('Firebase SET error:', error);
            throw error;
        }
    }
    
    /**
     * Update partial data at this path
     * @param {Object} data - Data to update
     * @returns {Promise<void>}
     */
    async update(data) {
        try {
            const response = await fetch(this.fullUrl, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${firebaseConfig.apiKey}`
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                throw new Error(`Firebase error: ${response.status}`);
            }
            
            // Invalidate cache
            this.invalidateCache();
            
            return await response.json();
            
        } catch (error) {
            console.error('Firebase UPDATE error:', error);
            throw error;
        }
    }
    
    /**
     * Push new child with unique key
     * @param {*} data - Data to push
     * @returns {Promise<string>} New key
     */
    async push(data) {
        try {
            // Generate unique key
            const key = generatePushKey();
            const childRef = new DatabaseReference(`${this.path}/${key}`);
            await childRef.set(data);
            return childRef;
            
        } catch (error) {
            console.error('Firebase PUSH error:', error);
            throw error;
        }
    }
    
    /**
     * Remove data at this path
     * @returns {Promise<void>}
     */
    async remove() {
        try {
            const response = await fetch(this.fullUrl, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${firebaseConfig.apiKey}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Firebase error: ${response.status}`);
            }
            
            // Invalidate cache
            this.invalidateCache();
            
        } catch (error) {
            console.error('Firebase REMOVE error:', error);
            throw error;
        }
    }
    
    /**
     * Get a child reference
     * @param {string} childPath - Child path
     * @returns {DatabaseReference}
     */
    child(childPath) {
        return new DatabaseReference(`${this.path}/${childPath}`);
    }
    
    /**
     * Invalidate cache for this path
     */
    invalidateCache() {
        for (const [key] of cache.entries()) {
            if (key.startsWith(this.path)) {
                cache.delete(key);
            }
        }
    }
}

/**
 * Main Firebase class
 */
export class FirebaseClient {
    constructor(config) {
        if (config) {
            initFirebase(config);
        }
    }
    
    /**
     * Get reference to database path
     * @param {string} path - Database path
     * @returns {DatabaseReference}
     */
    ref(path) {
        return new DatabaseReference(path);
    }
    
    /**
     * Initialize with auth token
     * @param {string} authToken - Auth token
     */
    async authWithCustomToken(authToken) {
        // Store auth token for requests
        this.authToken = authToken;
    }
    
    /**
     * Clear all caches
     */
    clearCache() {
        cache.clear();
    }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Generate Firebase-style push ID
 * Based on Firebase's push ID generation algorithm
 */
function generatePushKey() {
    // Firebase push IDs are 20 characters long
    const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
    let id = '';
    let lastPushTime = 0;
    
    const now = Date.now();
    const duplicateTime = (now === lastPushTime);
    lastPushTime = now;
    
    const timeStampChars = new Array(8);
    
    for (let i = 7; i >= 0; i--) {
        timeStampChars[i] = PUSH_CHARS.charAt(now % 64);
        now = Math.floor(now / 64);
    }
    
    id += timeStampChars.join('');
    
    if (!duplicateTime) {
        for (let i = 0; i < 12; i++) {
            id += PUSH_CHARS.charAt(Math.floor(Math.random() * 64));
        }
    } else {
        // Handle duplicate timestamps
        let lastRandChars = [];
        for (let i = 11; i >= 0 && lastRandChars[i] === 63; i--) {
            lastRandChars[i] = 0;
        }
        lastRandChars[0]++;
        
        for (let i = 0; i < 12; i++) {
            id += PUSH_CHARS.charAt(lastRandChars[i]);
        }
    }
    
    return id;
}

/**
 * Create singleton instance
 */
let instance = null;

export default function getFirebase(config) {
    if (!instance) {
        instance = new FirebaseClient(config);
    }
    return instance;
}

// Export for global use in workers
export const firebase = new DatabaseReference('');
