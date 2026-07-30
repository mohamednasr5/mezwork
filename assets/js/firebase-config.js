/* ===================================
   MezoMenu - Firebase Configuration
   إعدادات Firebase للمشروع
   =================================== */

// Firebase Configuration
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyB9SyGG0MNGWU-bmMVZVJITW0bxDbbkB94",
    authDomain: "menu-b41e6.firebaseapp.com",
    databaseURL: "https://menu-b41e6-default-rtdb.firebaseio.com",
    projectId: "menu-b41e6",
    storageBucket: "menu-b41e6.firebasestorage.app",
    messagingSenderId: "912801475897",
    appId: "1:912801475897:web:4b35f7a144b7c2cc3b4ce8",
    measurementId: "G-D8DCQJ2GWJ"
};

// Google OAuth Client ID
const GOOGLE_CLIENT_ID = '912801475897-7utqokjfrl90grl1gbvlveqoi82vl8fm.apps.googleusercontent.com';

// Application Configuration
const APP_CONFIG = {
    API_URL: 'https://menu.nonm1724.workers.dev',
    DEFAULT_CURRENCY: 'EGP',
    DEFAULT_LANGUAGE: 'ar',
    APP_NAME: 'MezoMenu',
    APP_VERSION: '3.0.0'
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FIREBASE_CONFIG, GOOGLE_CLIENT_ID, APP_CONFIG };
}
