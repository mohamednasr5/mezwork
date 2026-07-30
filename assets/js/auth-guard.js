/* ===================================
   MezoMenu - Authentication Guard
   حماية الصفحات والتحقق من تسجيل الدخول
   =================================== */

// Firebase Configuration (same as other files)
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyB9SyGG0MNGWU-bmMVZVJITW0bxDbbkB94",
    authDomain: "menu-b41e6.firebaseapp.com",
    databaseURL: "https://menu-b41e6-default-rtdb.firebaseio.com",
    projectId: "menu-b41e6",
    storageBucket: "menu-b41e6.firebasestorage.app",
    messagingSenderId: "912801475897",
    appId: "1:912801475897:web:4b35f7a144b7c2cc3b4ce8"
};

// Initialize Firebase if not already initialized
let auth, db;

function initFirebaseAuth() {
    if (typeof firebase === 'undefined') {
        console.warn('[Auth Guard] Firebase not loaded');
        return false;
    }
    
    if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
    }
    
    auth = firebase.auth();
    db = firebase.database();
    
    return true;
}

// Auth Guard Class
const AuthGuard = {
    currentUser: null,
    isInitialized: false,
    
    // Initialize the guard
    async init() {
        if (this.isInitialized) return this.currentUser;
        
        if (!initFirebaseAuth()) {
            // Fallback to localStorage check
            return this.checkLocalStorage();
        }
        
        return new Promise((resolve) => {
            const unsubscribe = auth.onAuthStateChanged((user) => {
                this.currentUser = user;
                this.isInitialized = true;
                unsubscribe();
                resolve(user);
            });
        });
    },
    
    // Check localStorage for session (fallback)
    checkLocalStorage() {
        try {
            const userData = JSON.parse(localStorage.getItem('mezomenu_user') || 'null') ||
                           JSON.parse(localStorage.getItem('user_data') || 'null');
            
            if (userData && userData.uid) {
                this.currentUser = userData;
                return userData;
            }
        } catch (e) {
            console.error('[Auth Guard] Error reading localStorage:', e);
        }
        
        return null;
    },
    
    // Check if user is logged in
    isLoggedIn() {
        return !!this.currentUser || !!this.checkLocalStorage();
    },
    
    // Get current user data
    getUser() {
        return this.currentUser || this.checkLocalStorage();
    },
    
    // Get user UID
    getUserUID() {
        const user = this.getUser();
        return user?.uid || null;
    },
    
    // Require authentication - redirect if not logged in
    requireAuth(redirectUrl = 'login.html') {
        const user = this.getUser();
        
        if (!user) {
            // Store current URL for redirect after login
            const currentUrl = window.location.href;
            window.location.href = `${redirectUrl}?redirect=${encodeURIComponent(currentUrl)}`;
            return null;
        }
        
        return user;
    },
    
    // Require admin role
    requireAdmin(redirectUrl = 'login.html') {
        const user = this.requireAuth(redirectUrl);
        
        if (!user) return null;
        
        // Check if user has admin role (should be verified server-side too)
        if (user.role !== 'admin') {
            console.warn('[Auth Guard] User is not admin');
            // Could redirect or show access denied message
            return null;
        }
        
        return user;
    },
    
    // Sign out
    async signOut() {
        try {
            if (auth) {
                await auth.signOut();
            }
            
            // Clear all session data
            localStorage.removeItem('mezomenu_user');
            localStorage.removeItem('user_data');
            localStorage.removeItem('auth_token');
            localStorage.removeItem('mezocart'); // Optional: clear cart on logout
            
            this.currentUser = null;
            
            return { success: true };
        } catch (error) {
            console.error('[Auth Guard] Sign out error:', error);
            return { success: false, error: error.message };
        }
    },
    
    // Update user display name in UI
    updateUIForUser(user) {
        if (!user) return;
        
        // Update all elements with class 'user-display-name'
        document.querySelectorAll('.user-display-name').forEach(el => {
            el.textContent = user.displayName || user.email?.split('@')[0] || 'مستخدم';
        });
        
        // Update all elements with class 'user-email'
        document.querySelectorAll('.user-email').forEach(el => {
            el.textContent = user.email || '';
        });
        
        // Update all elements with class 'user-avatar'
        document.querySelectorAll('.user-avatar').forEach(el => {
            if (user.photoURL) {
                el.src = user.photoURL;
                el.style.display = 'block';
            } else if (el.tagName === 'DIV' || el.tagName === 'SPAN') {
                el.textContent = (user.displayName || 'م')[0].toUpperCase();
            }
        });
        
        // Show elements that should be hidden when logged out
        document.querySelectorAll('.auth-hidden').forEach(el => {
            el.style.display = 'none';
        });
        
        // Show elements that should be visible when logged in
        document.querySelectorAll('.auth-visible').forEach(el => {
            el.style.display = '';
        });
    },
    
    // Show login required message
    showLoginRequired(message = 'يرجى تسجيل الدخول للوصول إلى هذه الصفحة') {
        // Create modal or alert
        const existingModal = document.getElementById('authRequiredModal');
        if (existingModal) existingModal.remove();
        
        const modal = document.createElement('div');
        modal.id = 'authRequiredModal';
        modal.innerHTML = `
            <div style="
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.5); z-index: 99999;
                display: flex; align-items: center; justify-content: center;
            ">
                <div style="
                    background: white; padding: 32px; border-radius: 16px;
                    max-width: 400px; width: 90%; text-align: center;
                    font-family: 'Cairo', sans-serif;
                ">
                    <div style="font-size: 48px; margin-bottom: 16px;">🔒</div>
                    <h3 style="margin-bottom: 12px; color: #1a1a2e;">مطلوب تسجيل الدخول</h3>
                    <p style="color: #6c757d; margin-bottom: 24px;">${message}</p>
                    <div style="display: flex; gap: 12px;">
                        <a href="login.html?redirect=${encodeURIComponent(window.location.href)}" 
                           style="
                               flex: 1; padding: 14px; background: linear-gradient(135deg, #ff6b35, #f7931e);
                               color: white; text-decoration: none; border-radius: 8px;
                               font-weight: 600; text-align: center;
                           ">تسجيل الدخول</a>
                        <button onclick="this.closest('#authRequiredModal').remove()" 
                           style="
                               padding: 14px 24px; background: #f8f9fa; border: 1px solid #dee2e6;
                               border-radius: 8px; font-weight: 600; cursor: pointer; font-family: inherit;
                           ">لاحقاً</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
};

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    AuthGuard.init().then(user => {
        if (user) {
            AuthGuard.updateUIForUser({
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL
            });
        }
    }).catch(console.error);
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthGuard;
}
