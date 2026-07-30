/* ===================================
   MezoMenu - Firebase Authentication
   نظام المصادقة بتسجيل جوجل
   =================================== */

// Firebase Auth Module
const FirebaseAuth = {
    auth: null,
    user: null,
    db: null,
    isInitialized: false,
    
    // Initialize Firebase and Auth
    async init() {
        if (this.isInitialized) return;
        
        try {
            // Check if Firebase SDK is loaded
            if (typeof firebase === 'undefined') {
                console.warn('Firebase SDK not loaded. Loading from CDN...');
                await this.loadFirebaseSDK();
            }
            
            // Initialize Firebase App
            if (!firebase.apps.length) {
                firebase.initializeApp(FIREBASE_CONFIG);
            }
            
            // Initialize services
            this.auth = firebase.auth();
            this.db = firebase.database();
            
            // Set up auth state observer
            this.setupAuthObserver();
            
            // Initialize Google Auth Provider
            this.googleProvider = new firebase.auth.GoogleAuthProvider();
            this.googleProvider.setCustomParameters({
                prompt: 'select_account'
            });
            
            this.isInitialized = true;
            console.log('Firebase Auth initialized successfully');
            
        } catch (error) {
            console.error('Firebase Auth initialization error:', error);
            throw error;
        }
    },
    
    // Load Firebase SDK from CDN if not available
    loadFirebaseSDK() {
        return new Promise((resolve, reject) => {
            const scripts = [
                'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js',
                'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js',
                'https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js'
            ];
            
            let loaded = 0;
            scripts.forEach(src => {
                const script = document.createElement('script');
                script.src = src;
                script.onload = () => {
                    loaded++;
                    if (loaded === scripts.length) resolve();
                };
                script.onerror = () => reject(new Error(`Failed to load ${src}`));
                document.head.appendChild(script);
            });
        });
    },
    
    // Set up authentication state observer
    setupAuthObserver() {
        this.auth.onAuthStateChanged((user) => {
            if (user) {
                this.user = user;
                this.saveUserSession(user);
                
                // Dispatch custom event for other components
                window.dispatchEvent(new CustomEvent('authStateChanged', { 
                    detail: { user: user, isLoggedIn: true } 
                }));
            } else {
                this.user = null;
                this.clearUserSession();
                
                window.dispatchEvent(new CustomEvent('authStateChanged', { 
                    detail: { user: null, isLoggedIn: false } 
                }));
            }
        });
    },
    
    // Sign in with Google
    async signInWithGoogle() {
        try {
            await this.init();
            
            const result = await this.auth.signInWithPopup(this.googleProvider);
            const user = result.user;
            
            // Save or update user data in database
            await this.saveUserDataToDB(user);
            
            return {
                success: true,
                user: {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    emailVerified: user.emailVerified
                }
            };
            
        } catch (error) {
            console.error('Google Sign-In error:', error);
            
            // Handle specific errors
            if (error.code === 'auth/popup-closed-by-user') {
                return { success: false, error: 'تم إغلاق نافذة تسجيل الدخول' };
            } else if (error.code === 'auth/cancelled-popup-request') {
                return { success: false, error: 'تم إلغاء تسجيل الدخول' };
            } else if (error.code === 'auth/popup-blocked') {
                return { success: false, error: 'تم حظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة.' };
            }
            
            return { success: false, error: error.message || 'حدث خطأ في تسجيل الدخول' };
        }
    },
    
    // Sign in with Email/Password
    async signInWithEmail(email, password) {
        try {
            await this.init();
            
            const result = await this.auth.signInWithEmailAndPassword(email, password);
            const user = result.user;
            
            return {
                success: true,
                user: {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    emailVerified: user.emailVerified
                }
            };
            
        } catch (error) {
            console.error('Email Sign-In error:', error);
            
            const errorMessages = {
                'auth/user-not-found': 'لا يوجد حساب بهذا البريد الإلكتروني',
                'auth/wrong-password': 'كلمة المرور غير صحيحة',
                'auth/invalid-email': 'البريد الإلكتروني غير صحيح',
                'auth/too-many-requests': 'محاولات كثيرة جداً. يرجى المحاولة لاحقاً',
                'auth/user-disabled': 'تم تعطيل هذا الحساب'
            };
            
            return { 
                success: false, 
                error: errorMessages[error.code] || error.message || 'حدث خطأ في تسجيل الدخول' 
            };
        }
    },
    
    // Register with Email/Password
    async registerWithEmail(email, password, displayName) {
        try {
            await this.init();
            
            const result = await this.auth.createUserWithEmailAndPassword(email, password);
            const user = result.user;
            
            // Update profile with display name
            await user.updateProfile({ displayName: displayName });
            
            // Send email verification
            await user.sendEmailVerification();
            
            // Save user data to database
            await this.saveUserDataToDB(user);
            
            return {
                success: true,
                user: {
                    uid: user.uid,
                    email: user.email,
                    displayName: displayName,
                    photoURL: user.photoURL,
                    emailVerified: user.emailVerified
                },
                message: 'تم إنشاء الحساب بنجاح! يرجى تأكيد بريدك الإلكتروني.'
            };
            
        } catch (error) {
            console.error('Registration error:', error);
            
            const errorMessages = {
                'auth/email-already-in-use': 'هذا البريد الإلكتروني مسجل بالفعل',
                'auth/weak-password': 'كلمة المرور ضعيفة جداً (6 أحرف على الأقل)',
                'auth/invalid-email': 'البريد الإلكتروني غير صحيح',
                'auth/operation-not-allowed': 'التسجيل بالبريد غير مفعل'
            };
            
            return { 
                success: false, 
                error: errorMessages[error.code] || error.message || 'حدث خطأ في إنشاء الحساب' 
            };
        }
    },
    
    // Sign out
    async signOut() {
        try {
            await this.init();
            await this.auth.signOut();
            this.clearUserSession();
            return { success: true };
        } catch (error) {
            console.error('Sign out error:', error);
            return { success: false, error: error.message };
        }
    },
    
    // Get current user
    getCurrentUser() {
        return this.user || JSON.parse(localStorage.getItem('mezomenu_user') || 'null');
    },
    
    // Check if user is logged in
    isLoggedIn() {
        return !!this.getCurrentUser();
    },
    
    // Save user session to localStorage
    saveUserSession(user) {
        const userData = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            emailVerified: user.emailVerified,
            lastLogin: new Date().toISOString()
        };
        
        localStorage.setItem('mezomenu_user', JSON.stringify(userData));
        localStorage.setItem('mezomenu_auth_token', user.accessToken || '');
    },
    
    // Clear user session from localStorage
    clearUserSession() {
        localStorage.removeItem('mezomenu_user');
        localStorage.removeItem('mezomenu_auth_token');
    },
    
    // Save user data to Firebase Database
    async saveUserDataToDB(user) {
        if (!this.db) return;
        
        const userData = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || 'مستخدم MezoMenu',
            photoURL: user.photoURL || '',
            emailVerified: user.emailVerified,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            lastLogin: firebase.database.ServerValue.TIMESTAMP,
            role: 'customer', // default role
            preferences: {
                language: localStorage.getItem('mezolang') || 'ar',
                darkMode: localStorage.getItem('mezodark') === 'true',
                notifications: true
            }
        };
        
        try {
            await this.db.ref(`users/${user.uid}`).update(userData);
            console.log('User data saved to database');
        } catch (error) {
            console.error('Error saving user data:', error);
        }
    },
    
    // Get user data from database
    async getUserDataFromDB(uid) {
        if (!this.db) return null;
        
        try {
            const snapshot = await this.db.ref(`users/${uid}`).once('value');
            return snapshot.val();
        } catch (error) {
            console.error('Error getting user data:', error);
            return null;
        }
    },
    
    // Update user profile
    async updateUserProfile(updates) {
        if (!this.user || !this.db) return { success: false, error: 'Not authenticated' };
        
        try {
            await this.db.ref(`users/${this.user.uid}`).update({
                ...updates,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            });
            
            // Also update Firebase Auth profile if display name or photo
            if (updates.displayName || updates.photoURL) {
                await this.user.updateProfile({
                    displayName: updates.displayName || this.user.displayName,
                    photoURL: updates.photoURL || this.user.photoURL
                });
            }
            
            return { success: true };
        } catch (error) {
            console.error('Error updating profile:', error);
            return { success: false, error: error.message };
        }
    },
    
    // Reset password
    async resetPassword(email) {
        try {
            await this.init();
            await this.auth.sendPasswordResetEmail(email);
            return { 
                success: true, 
                message: 'تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني' 
            };
        } catch (error) {
            console.error('Reset password error:', error);
            return { success: false, error: error.message };
        }
    },
    
    // Check admin role
    async isAdmin() {
        const userData = await this.getUserDataFromDB(this.user?.uid);
        return userData?.role === 'admin';
    },
    
    // Protect page - redirect if not logged in
    requireAuth(redirectUrl = 'login.html') {
        if (!this.isLoggedIn()) {
            window.location.href = `${redirectUrl}?redirect=${encodeURIComponent(window.location.href)}`;
            return false;
        }
        return true;
    },
    
    // Protect admin pages
    requireAdmin(redirectUrl = 'login.html') {
        if (!this.isLoggedIn()) {
            window.location.href = `${redirectUrl}?redirect=${encodeURIComponent(window.location.href)}`;
            return false;
        }
        // Note: Admin check should also be done server-side
        return true;
    }
};

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    FirebaseAuth.init().catch(console.error);
});

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FirebaseAuth;
}
