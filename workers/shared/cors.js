/**
 * MezoMenu - CORS Middleware for Cloudflare Workers
 * Handles Cross-Origin Resource Sharing headers
 */

/**
 * Apply CORS headers to response
 * @param {Response} response - The response to modify
 * @param {Request} request - The incoming request
 * @returns {Response} - Response with CORS headers
 */
function corsHeaders(response, request) {
    const origin = request.headers.get('Origin') || '*';
    
    // Allowed origins (configure based on your domains)
    const allowedOrigins = [
        'https://mezomenu.com',
        'https://www.mezomenu.com',
        'http://localhost:3000',
        'http://localhost:8080'
    ];
    
    const isAllowed = allowedOrigins.includes(origin) || origin === 'null';
    const allowOrigin = isAllowed ? origin : allowedOrigins[0];
    
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', allowOrigin);
    newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    newHeaders.set('Access-Control-Allow-Headers', 
        'Content-Type, Authorization, X-Requested-With, X-Restaurant-ID, X-Auth-Token');
    newHeaders.set('Access-Control-Max-Age', '86400'); // 24 hours
    newHeaders.set('Access-Control-Allow-Credentials', 'true');
    
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
    });
}

/**
 * Handle preflight OPTIONS requests
 * @param {Request} request - The incoming request
 * @returns {Response} - Preflight response with CORS headers
 */
function handlePreflight(request) {
    return corsHeaders(new Response(null, { status: 204 }), request);
}

/**
 * Create a JSON response with CORS headers
 * @param {object} data - Data to include in response
 * @param {number} status - HTTP status code
 * @param {Request} request - The incoming request
 * @returns {Response} - JSON response with CORS headers
 */
function jsonResponse(data, status = 200, request) {
    const body = JSON.stringify(data);
    // ⚠️ Buffer غير متاح في Cloudflare Workers runtime (Node.js global فقط).
    // بنستخدم TextEncoder اللي متاح فعلياً في بيئة الـ Workers لحساب طول البايتات.
    const byteLength = new TextEncoder().encode(body).length;
    const response = new Response(body, {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Length': byteLength.toString()
        }
    });

    return corsHeaders(response, request);
}

/**
 * Create an error response with CORS headers
 * @param {string} message - Error message
 * @param {number} status - HTTP error code
 * @param {Request} request - The incoming request
 * @returns {Response} - Error response with CORS headers
 */
function errorResponse(message, status = 400, request, details = null) {
    return jsonResponse({
        success: false,
        error: message,
        timestamp: Date.now(),
        ...(details ? { details } : {})
    }, status, request);
}

/**
 * Create a success response with CORS headers
 * @param {object} data - Success data
 * @param {string} message - Success message
 * @param {Request} request - The incoming request
 * @returns {Response} - Success response with CORS headers
 */
function successResponse(data, message = 'Success', request) {
    return jsonResponse({
        success: true,
        message,
        data,
        timestamp: Date.now()
    }, 200, request);
}

// Export for use in workers
export {
    corsHeaders,
    handlePreflight,
    jsonResponse,
    errorResponse,
    successResponse
};
