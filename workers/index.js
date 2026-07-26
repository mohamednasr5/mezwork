/**
 * MezoMenu - Main Worker Entry Point
 * Routes requests to appropriate API handlers
 */

import { handlePreflight, errorResponse } from './shared/cors.js';

// Import route handlers
import authWorker from './api/auth.worker.js';
import menuWorker from './api/menu.worker.js';
import ordersWorker from './api/orders.worker.js';
import uploadWorker from './api/upload.worker.js';
import aiWorker from './api/ai.worker.js';

export default {
    /**
     * Main fetch handler - routes to appropriate worker
     */
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const startTime = Date.now();

        // Handle CORS preflight for all routes
        if (request.method === 'OPTIONS') {
            return handlePreflight(request);
        }

        // Health check endpoint
        if (url.pathname === '/health') {
            return new Response(JSON.stringify({
                status: 'ok',
                service: 'MezoMenu API',
                version: '1.0.0',
                timestamp: Date.now(),
                environment: env.ENVIRONMENT || 'development'
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Route based on path prefix
        try {
            let response;

            if (url.pathname.startsWith('/api/auth')) {
                response = await authWorker.fetch(request, env, ctx);
            } else if (url.pathname.startsWith('/api/menu') || url.pathname.startsWith('/api/public/menu')) {
                response = await menuWorker.fetch(request, env, ctx);
            } else if (url.pathname.startsWith('/api/orders') || url.pathname.startsWith('/api/public/orders')) {
                response = await ordersWorker.fetch(request, env, ctx);
            } else if (url.pathname.startsWith('/api/upload')) {
                response = await uploadWorker.fetch(request, env, ctx);
            } else if (url.pathname.startsWith('/api/ai')) {
                response = await aiWorker.fetch(request, env, ctx);
            } else {
                // Serve static files (html/css/js/images) via the Assets binding
                response = await serveStaticFile(request, env) ||
                    errorResponse('Endpoint not found', 404, request);
            }

            // Add timing header
            const duration = Date.now() - startTime;
            response.headers.set('X-Response-Time', `${duration}ms`);
            response.headers.set('X-Powered-By', 'MezoMenu/Cloudflare-Workers');

            return response;

        } catch (error) {
            console.error('[Main Worker] Unhandled error:', error);
            
            return new Response(JSON.stringify({
                success: false,
                error: 'Internal server error',
                message: process.env.NODE_ENV === 'development' ? error.message : undefined,
                timestamp: Date.now()
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    },

    /**
     * Scheduled handler (for cron jobs)
     */
    async scheduled(event, env, ctx) {
        console.log('[Cron] Running scheduled task:', event.cron);

        switch (event.cron) {
            case '0 * * * *':
                // Hourly cleanup tasks
                await cleanupExpiredTokens(env);
                break;
            
            case '0 0 * * *':
                // Daily stats aggregation
                await aggregateDailyStats(env);
                break;
            
            default:
                console.log('[Cron] Unknown schedule:', event.cron);
        }
    }
};

// ========================================
// Static File Serving (for frontend)
// ========================================

async function serveStaticFile(request, env) {
    // Requires the [assets] binding configured in wrangler.toml (binding = "ASSETS")
    if (!env.ASSETS) return null;

    try {
        const asset = await env.ASSETS.fetch(request);

        // env.ASSETS.fetch returns a 404 Response (not null) when nothing matches
        if (!asset || asset.status === 404) return null;

        // Ensure correct content-type even if the asset store guesses wrong
        const url = new URL(request.url);
        const contentType = getContentType(url.pathname);
        if (contentType && !asset.headers.get('Content-Type')) {
            const headers = new Headers(asset.headers);
            headers.set('Content-Type', contentType);
            return new Response(asset.body, { status: asset.status, headers });
        }

        return asset;
    } catch (err) {
        console.error('[Static] Failed to serve asset:', err);
        return null;
    }
}

function getContentType(pathname) {
    const ext = pathname.split('.').pop();
    const types = {
        html: 'text/html; charset=utf-8',
        css: 'text/css; charset=utf-8',
        js: 'application/javascript; charset=utf-8',
        json: 'application/json; charset=utf-8',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        svg: 'image/svg+xml',
        ico: 'image/x-icon',
        webp: 'image/webp',
        woff2: 'font/woff2',
        woff: 'font/woff'
    };
    
    return types[ext] || 'application/octet-stream';
}

// ========================================
// Scheduled Tasks
// ========================================

async function cleanupExpiredTokens(env) {
    console.log('[Cleanup] Removing expired tokens...');
    // Implementation would go here
}

async function aggregateDailyStats(env) {
    console.log('[Stats] Aggregating daily statistics...');
    // Implementation would go here
}
