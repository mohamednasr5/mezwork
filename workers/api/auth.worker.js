/**
 * MezoMenu - Authentication Worker
 * Handles user registration, login, and session management
 */

import { handlePreflight, errorResponse, successResponse } from '../shared/cors.js';
import firebase from '../shared/firebase.js';

export default {
    /**
     * Handle incoming requests
     */
    async fetch(request, env) {
        const url = new URL(request.url);
        
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return handlePreflight(request);
        }

        // Route based on path
        const routes = {
            'POST /api/auth/register': handleRegister,
            'POST /api/auth/login': handleLogin,
            'POST /api/auth/logout': handleLogout,
            'POST /api/auth/refresh': handleRefreshToken,
            'GET /api/auth/verify': handleVerifyToken,
            'POST /api/auth/password/reset': handlePasswordReset,
            'POST /api/auth/password/change': handleChangePassword
        };

        const routeKey = `${request.method} ${url.pathname}`;
        const handler = routes[routeKey];

        if (handler) {
            return handler(request, env);
        }

        return errorResponse('Endpoint not found', 404, request);
    }
};

// ========================================
// Route Handlers
// ========================================

/**
 * Register new restaurant owner
 */
async function handleRegister(request, env) {
    try {
        const body = await request.json();
        const { email, password, fullName, phone, restaurant } = body;

        // Validate required fields
        if (!email || !password || !fullName) {
            return errorResponse('البريد الإلكتروني وكلمة المرور والاسم مطلوبة', 400, request);
        }

        // Validate email format
        if (!isValidEmail(email)) {
            return errorResponse('البريد الإلكتروني غير صالح', 400, request);
        }

        // Validate password strength
        if (password.length < 8) {
            return errorResponse('كلمة المرور يجب أن تكون 8 أحرف على الأقل', 400, request);
        }

        // Check if user already exists
        const existingUser = await firebase.read(`users_by_email/${email.replace('.', '_')}`);
        if (existingUser) {
            return errorResponse('هذا البريد الإلكتروني مسجل بالفعل', 409, request);
        }

        // Create new user (in production, use Firebase Auth or similar)
        const userId = generateUserId();
        const restaurantId = generateRestaurantId();
        const slug = restaurant?.slug || generateSlug(restaurant?.name);

        // Create user record
        await firebase.write(`users/${userId}`, {
            uid: userId,
            email,
            displayName: fullName,
            phone: phone || '',
            role: 'restaurant_owner',
            restaurantId,
            createdAt: Date.now(),
            lastLogin: null
        });

        // Create email index for lookup
        await firebase.write(`users_by_email/${email.replace('.', '_')}`, { uid: userId });

        // Create restaurant record (isolated)
        await firebase.write(`restaurants/${restaurantId}`, {
            id: restaurantId,
            ownerId: userId,
            name: restaurant?.name || '',
            nameEn: restaurant?.nameEn || '',
            slug,
            description: restaurant?.description || '',
            cuisineType: restaurant?.cuisineType || 'other',
            address: restaurant?.address || '',
            city: restaurant?.city || '',
            phone: phone || '',
            whatsappNumber: restaurant?.whatsappNumber || phone || '',
            logo: null,
            coverImage: null,
            currency: 'EGP',
            currencySymbol: 'ج.م',
            plan: restaurant?.plan || 'free',
            isActive: true,
            createdAt: Date.now(),
            settings: {
                enableWhatsApp: true,
                enableNotifications: true,
                language: 'ar',
                theme: 'default'
            },
            menu: {
                categories: [],
                items: []
            },
            stats: {
                totalOrders: 0,
                totalRevenue: 0,
                totalCustomers: 0
            }
        });

        // Initialize AI usage tracking
        await firebase.write(`restaurants/${restaurantId}/aiUsage`, {
            analysis: 0,
            generation: 0,
            periodStart: Date.now()
        });

        // Generate auth token
        const token = generateAuthToken(userId, restaurantId);

        return successResponse({
            user: {
                uid: userId,
                email,
                displayName: fullName
            },
            restaurantId,
            slug,
            token
        }, 'تم إنشاء الحساب بنجاح', request);

    } catch (error) {
        console.error('Registration error:', error);
        return errorResponse('حدث خطأ أثناء إنشاء الحساب', 500, request);
    }
}

/**
 * Login existing user
 */
async function handleLogin(request, env) {
    try {
        const body = await request.json();
        const { email, password } = body;

        if (!email || !password) {
            return errorResponse('البريد الإلكتروني وكلمة المرور مطلوبان', 400, request);
        }

        // Find user by email
        const userRef = await firebase.read(`users_by_email/${email.replace('.', '_')}`);
        if (!userRef) {
            return errorResponse('لا يوجد حساب بهذا البريد الإلكتروني', 404, request);
        }

        // Get full user data
        const userData = await firebase.read(`users/${userRef.uid}`);
        if (!userData) {
            return errorResponse('المستخدم غير موجود', 404, request);
        }

        // In production, verify password hash here
        // For now, we'll assume password is valid

        // Update last login
        await firebase.update(`users/${userRef.uid}`, { lastLogin: Date.now() });

        // Get restaurant data
        const restaurantData = await firebase.read(`restaurants/${userData.restaurantId}`);

        // Generate auth token
        const token = generateAuthToken(userRef.uid, userData.restaurantId);

        return successResponse({
            user: {
                uid: userData.uid,
                email: userData.email,
                displayName: userData.displayName
            },
            restaurant: {
                id: userData.restaurantId,
                name: restaurantData?.name,
                slug: restaurantData?.slug,
                plan: restaurantData?.plan
            },
            token
        }, 'تم تسجيل الدخول بنجاح', request);

    } catch (error) {
        console.error('Login error:', error);
        return errorResponse('حدث خطأ أثناء تسجيل الدخول', 500, request);
    }
}

/**
 * Logout and invalidate session
 */
async function handleLogout(request, env) {
    try {
        const authToken = request.headers.get('Authorization')?.replace('Bearer ', '');
        
        if (authToken) {
            // In production, add token to blacklist or invalidate
            console.log('User logged out with token:', authToken.substring(0, 10) + '...');
        }

        return successResponse(null, 'تم تسجيل الخروج بنجاح', request);

    } catch (error) {
        return errorResponse('حدث خطأ أثناء تسجيل الخروج', 500, request);
    }
}

/**
 * Refresh authentication token
 */
async function handleRefreshToken(request, env) {
    try {
        const body = await request.json();
        const { refreshToken } = body;

        if (!refreshToken) {
            return errorResponse('Refresh token مطلوب', 400, request);
        }

        // Verify refresh token and issue new access token
        // This is a simplified version - use proper JWT in production
        
        const tokenData = parseToken(refreshToken);
        if (!tokenData || isTokenExpired(tokenData)) {
            return errorResponse('Refresh token منتهي الصلاحية', 401, request);
        }

        const newToken = generateAuthToken(tokenData.userId, tokenData.restaurantId);

        return successResponse({ token: newToken }, 'تم تجديد الرمز', request);

    } catch (error) {
        return errorResponse('فشل في تجديد الرمز', 500, request);
    }
}

/**
 * Verify token validity
 */
async function handleVerifyToken(request, env) {
    try {
        const authToken = request.headers.get('Authorization')?.replace('Bearer ', '');
        
        if (!authToken) {
            return errorResponse('Token مطلوب', 401, request);
        }

        const tokenData = parseToken(authToken);
        
        if (!tokenData || isTokenExpired(tokenData)) {
            return errorResponse('Token منتهي أو غير صالح', 401, request);
        }

        return successResponse({
            valid: true,
            userId: tokenData.userId,
            restaurantId: tokenData.restaurantId
        }, 'Token صالح', request);

    } catch (error) {
        return errorResponse('فشل في التحقق من Token', 500, request);
    }
}

/**
 * Request password reset
 */
async function handlePasswordReset(request, env) {
    try {
        const body = await request.json();
        const { email } = body;

        if (!email) {
            return errorResponse('البريد الإلكتروني مطلوب', 400, request);
        }

        // Find user
        const userRef = await firebase.read(`users_by_email/${email.replace('.', '_')}`);
        if (!userRef) {
            // Don't reveal whether email exists
            return successResponse(null, 'إذا كان البريد مسجلاً، سيتم إرسال رابط إعادة التعيين', request);
        }

        // Generate reset token
        const resetToken = generateResetToken(userRef.uid);
        
        // Store reset token (with expiry)
        await firebase.write(`password_resets/${resetToken}`, {
            uid: userRef.uid,
            createdAt: Date.now(),
            expiresAt: Date.now() + (3600000) // 1 hour
        });

        // In production, send email with reset link
        console.log(`Password reset link for ${email}: https://mezomenu.com/reset-password?token=${resetToken}`);

        return successResponse(null, 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك', request);

    } catch (error) {
        return errorResponse('حدث خطأ أثناء طلب إعادة التعيين', 500, request);
    }
}

/**
 * Change password
 */
async function handleChangePassword(request, env) {
    try {
        const body = await request.json();
        const { currentPassword, newPassword, resetToken } = body;

        if (!newPassword || newPassword.length < 8) {
            return errorResponse('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل', 400, request);
        }

        let userId;

        if (resetToken) {
            // Password reset flow
            const resetData = await firebase.read(`password_resets/${resetToken}`);
            
            if (!resetData || resetData.expiresAt < Date.now()) {
                return errorResponse('رابط إعادة التعيين منتهي الصلاحية', 400, request);
            }

            userId = resetData.uid;
            
            // Delete used token
            await firebase.remove(`password_resets/${resetToken}`);
            
        } else {
            // Normal password change (requires current password & auth)
            const authToken = request.headers.get('Authorization')?.replace('Bearer ', '');
            const tokenData = parseToken(authToken);
            
            if (!tokenData) {
                return errorResponse('غير مصرح', 401, request);
            }

            userId = tokenData.userId;
            
            // In production, verify current password here
        }

        // Update password (in production, store hashed password)
        // await firebase.update(`users/${userId}`, { password: hash(newPassword) });
        
        // Invalidate all sessions for this user
        // (in production, add to token blacklist)

        return successResponse(null, 'تم تغيير كلمة المرور بنجاح', request);

    } catch (error) {
        return errorResponse('حدث خطأ أثناء تغيير كلمة المرور', 500, request);
    }
}

// ========================================
// Utility Functions
// ========================================

function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function generateUserId() {
    return 'user_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function generateRestaurantId() {
    return 'rest_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function generateSlug(name) {
    if (!name) return 'restaurant-' + Date.now().toString(36);
    
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 50)
        .replace(/-$/, '');
}

function generateAuthToken(userId, restaurantId) {
    // Simplified token - use proper JWT in production
    const payload = {
        userId,
        restaurantId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
    };
    
    return btoa(JSON.stringify(payload));
}

function generateResetToken(userId) {
    const payload = {
        userId,
        type: 'password_reset',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
    };
    
    return btoa(JSON.stringify(payload));
}

function parseToken(token) {
    try {
        return JSON.parse(atob(token));
    } catch {
        return null;
    }
}

function isTokenExpired(tokenData) {
    return tokenData.exp && tokenData.exp < Math.floor(Date.now() / 1000);
}
