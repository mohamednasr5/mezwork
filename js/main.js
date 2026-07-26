/* ===================================
   MezoMenu - Main JavaScript
   Core Utilities & Helpers
   =================================== */

// Configuration
const CONFIG = {
    API_BASE_URL: '/api',
    FIREBASE_CONFIG: {
        // Will be loaded from environment
    },
    R2_BUCKET: 'mezomenu-images'
};

// State Management (Simple Store)
const Store = {
    state: {},
    listeners: {},

    get(key) {
        return this.state[key];
    },

    set(key, value) {
        this.state[key] = value;
        if (this.listeners[key]) {
            this.listeners[key].forEach(fn => fn(value));
        }
        // Persist to localStorage
        if (typeof value !== 'function') {
            try {
                localStorage.setItem(`mezomenu_${key}`, JSON.stringify(value));
            } catch (e) {
                console.warn('localStorage not available');
            }
        }
    },

    subscribe(key, callback) {
        if (!this.listeners[key]) {
            this.listeners[key] = [];
        }
        this.listeners[key].push(callback);
        
        // Return unsubscribe function
        return () => {
            this.listeners[key] = this.listeners[key].filter(fn => fn !== callback);
        };
    },

    init() {
        // Restore from localStorage
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('mezomenu_')) {
                const storeKey = key.replace('mezomenu_', '');
                try {
                    this.state[storeKey] = JSON.parse(localStorage.getItem(key));
                } catch (e) {
                    // Ignore parse errors
                }
            }
        }
    }
};

// Initialize Store
Store.init();

// Auth Module
const Auth = {
    currentUser: null,

    async login(email, password) {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'فشل تسجيل الدخول');
            }
            
            const data = await response.json();
            this.currentUser = data.user;
            Store.set('user', data.user);
            Store.set('token', data.token);
            
            return data;
        } catch (error) {
            throw error;
        }
    },

    async register(userData) {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'فشل التسجيل');
            }
            
            const data = await response.json();
            this.currentUser = data.user;
            Store.set('user', data.user);
            Store.set('token', data.token);
            
            return data;
        } catch (error) {
            throw error;
        }
    },

    logout() {
        this.currentUser = null;
        localStorage.removeItem('mezomenu_user');
        localStorage.removeItem('mezomenu_token');
        window.location.href = '/login.html';
    },

    getToken() {
        return Store.get('token');
    },

    getUser() {
        return Store.get('user');
    },

    isAuthenticated() {
        return !!this.getToken();
    },

    requireAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = '/login.html';
            return false;
        }
        return true;
    }
};

// API Helper
const API = {
    async request(endpoint, options = {}) {
        const token = Auth.getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, {
                ...options,
                headers
            });

            if (response.status === 401) {
                Auth.logout();
                throw new Error('انتهت صلاحية الجلسة');
            }

            if (!response.ok) {
                const error = await response.json().catch(() => ({ message: 'حدث خطأ' }));
                throw new Error(error.message || 'حدث خطأ في الاتصال');
            }

            // Check if response is empty
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            return await response.text();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    },

    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    },

    // File upload
    async upload(file, type = 'image') {
        const token = Auth.getToken();
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);

        const response = await fetch(`${CONFIG.API_BASE_URL}/upload`, {
            method: 'POST',
            headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error('فشل رفع الملف');
        }

        return response.json();
    }
}

// Restaurant Module
const Restaurant = {
    async getCurrent() {
        const user = Auth.getUser();
        if (!user?.restaurantId) return null;
        return API.get(`/restaurants/${user.restaurantId}`);
    },

    async update(data) {
        const user = Auth.getUser();
        return API.put(`/restaurants/${user.restaurantId}`, data);
    },

    async getMenu() {
        const user = Auth.getUser();
        return API.get(`/restaurants/${user.restaurantId}/menu`);
    },

    async updateMenu(menuData) {
        const user = Auth.getUser();
        return API.put(`/restaurants/${user.restaurantId}/menu`, menuData);
    },

    async getOrders(filters = {}) {
        const user = Auth.getUser();
        const params = new URLSearchParams(filters).toString();
        return API.get(`/restaurants/${user.restaurantId}/orders?${params}`);
    },

    async updateOrderStatus(orderId, status) {
        const user = Auth.getUser();
        return API.put(`/restaurants/${user.restaurantId}/orders/${orderId}`, { status });
    },

    async getCustomers() {
        const user = Auth.getUser();
        return API.get(`/restaurants/${user.restaurantId}/customers`);
    },

    async getAnalytics(period = '30d') {
        const user = Auth.getUser();
        return API.get(`/restaurants/${user.restaurantId}/analytics?period=${period}`);
    }
}

// AI Module
const AI = {
    async analyzeMenu(imageFile) {
        const formData = new FormData();
        formData.append('image', imageFile);

        const response = await fetch(`${CONFIG.API_BASE_URL}/ai/analyze-menu`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${Auth.getToken()}`
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error('فشل تحليل القائمة');
        }

        return response.json();
    },

    async generateImage(prompt, itemName) {
        return API.post('/ai/generate-image', {
            prompt,
            itemName,
            style: 'food photography professional'
        });
    }
}

// Notification System
const Notifications = {
    async requestPermission() {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }
        return false;
    },

    show(title, options = {}) {
        if ('Notification' in window && Notification.permission === 'granted') {
            return new Notification(title, {
                icon: '/assets/icons/icon-192x192.png',
                badge: '/assets/icons/icon-72x72.png',
                ...options
            });
        }
    },

    async subscribeToPush() {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            try {
                const registration = await navigator.serviceWorker.ready;
                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: this.urlBase64ToUint8Array(CONFIG.VAPID_PUBLIC_KEY)
                });
                
                // Send subscription to server
                await API.post('/notifications/subscribe', subscription);
                return true;
            } catch (error) {
                console.error('Push subscription failed:', error);
                return false;
            }
        }
        return false;
    },

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }
}

// Utility Functions
const Utils = {
    formatPrice(price, currency = 'EGP') {
        return `${currency} ${Number(price).toLocaleString('ar-EG')}`;
    },

    formatDate(date, format = 'short') {
        const d = new Date(date);
        if (format === 'short') {
            return d.toLocaleDateString('ar-EG', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }
        return d.toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    throttle(func, limit = 300) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    generateSlug(text) {
        return text
            .toString()
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')
            .replace(/[^\w\-]+/g, '')
            .replace(/\-\-+/g, '-');
    },

    truncate(str, length = 100) {
        if (str.length <= length) return str;
        return str.substring(0, length) + '...';
    },

    copyToClipboard(text) {
        if (navigator.clipboard) {
            return navigator.clipboard.writeText(text);
        }
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        return Promise.resolve();
    },

    showLoading(element) {
        if (element) {
            element.innerHTML = '<div class="spinner"></div>';
            element.disabled = true;
        }
    },

    hideLoading(element, originalText) {
        if (element) {
            element.innerHTML = originalText;
            element.disabled = false;
        }
    },

    showAlert(message, type = 'info', container = document.body) {
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} animate-fade-in`;
        alert.innerHTML = `
            <span>${this.getAlertIcon(type)}</span>
            <span>${message}</span>
            <button onclick="this.parentElement.remove()" style="margin-right:auto;background:none;border:none;cursor:pointer;font-size:1.2rem;">&times;</button>
        `;
        container.prepend(alert);
        
        // Auto remove after 5 seconds
        setTimeout(() => alert.remove(), 5000);
    },

    getAlertIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    },

    validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    validatePhone(phone) {
        return /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/.test(phone);
    }
}

// QR Code Generator (Simple implementation using API)
const QRCode = {
    async generate(text, size = 200) {
        // Using a free QR code API
        const apiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;
        return apiUrl;
    },

    download(qrUrl, filename = 'qrcode.png') {
        const link = document.createElement('a');
        link.href = qrUrl;
        link.download = filename;
        link.target = '_blank';
        link.click();
    }
}

// WhatsApp Integration
const WhatsApp = {
    sendOrder(orderData, restaurantPhone) {
        const message = this.formatOrderMessage(orderData);
        const phone = restaurantPhone.replace(/[^0-9]/g, '');
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    },

    formatOrderMessage(order) {
        let message = `🆕 *طلب جديد من MezoMenu*\n\n`;
        message += `📋 رقم الطلب: #${order.id}\n`;
        message += `👤 الزبون: ${order.customerName}\n`;
        message += `📱 الهاتف: ${order.customerPhone}\n\n`;
        message += `*الطلبات:*\n`;
        
        order.items.forEach((item, index) => {
            message += `${index + 1}. ${item.name} ×${item.quantity} - ${Utils.formatPrice(item.price * item.quantity)}\n`;
            if (item.notes) message += `   📝 ملاحظة: ${item.notes}\n`;
        });
        
        message += `\n💰 *الإجمالي: ${Utils.formatPrice(order.total)}*\n\n`;
        message += `تم الطلب عبر MezoMenu 🍽️`;
        
        return message;
    }
}

// Export modules for use
window.MezoMenu = {
    CONFIG,
    Store,
    Auth,
    API,
    Restaurant,
    AI,
    Notifications,
    Utils,
    QRCode,
    WhatsApp
};
