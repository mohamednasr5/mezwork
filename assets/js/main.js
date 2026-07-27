/* ===================================
   MezoMenu SaaS - Main JavaScript
   Functions & Utilities
   =================================== */

// ==========================================
// Configuration
// ==========================================
const CONFIG = {
    API_URL: 'https://menu.nonm1724.workers.dev',
    FIREBASE_DB: 'https://menu-b41e6-default-rtdb.firebaseio.com',
    DEFAULT_CURRENCY: 'EGP',
    DEFAULT_LANGUAGE: 'ar'
};

// ==========================================
// State Management
// ==========================================
const AppState = {
    user: null,
    restaurant: null,
    menu: { categories: [], items: [] },
    cart: [],
    currentLanguage: 'ar',
    isLoading: false
};

// ==========================================
// Utility Functions
// ==========================================

/**
 * Format currency
 */
function formatCurrency(amount, currency = CONFIG.DEFAULT_CURRENCY) {
    const symbols = { EGP: 'ج.م', USD: '$', SAR: 'ر.س', AED: 'د.إ' };
    return `${amount.toFixed(2)} ${symbols[currency] || currency}`;
}

/**
 * Format date/time in Arabic
 */
function formatDateTime(dateString) {
    const date = new Date(dateString);
    const options = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return date.toLocaleDateString('ar-EG', options);
}

/**
 * Generate unique ID
 */
function generateId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Debounce function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Slugify text (for URLs)
 */
function slugify(text) {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w\u0600-\u06FF-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

/**
 * Validate email
 */
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * Validate phone number (Egyptian format)
 */
function isValidPhone(phone) {
    const re = /^(\+201|01)[0-9]{9}$/;
    return re.test(phone.replace(/\s/g, ''));
}

/**
 * Get URL parameters
 */
function getUrlParams() {
    const params = {};
    window.location.search.substring(1).split('&').forEach(pair => {
        const [key, value] = pair.split('=');
        if (key) params[decodeURIComponent(key)] = decodeURIComponent(value || '');
    });
    return params;
}

// ==========================================
// Local Storage Helpers
// ==========================================

const Storage = {
    set(key, value) {
        try {
            localStorage.setItem(`menomenu_${key}`, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Storage error:', e);
            return false;
        }
    },

    get(key) {
        try {
            const item = localStorage.getItem(`menomenu_${key}`);
            return item ? JSON.parse(item) : null;
        } catch (e) {
            console.error('Storage error:', e);
            return null;
        }
    },

    remove(key) {
        localStorage.removeItem(`menomenu_${key}`);
    },

    clear() {
        Object.keys(localStorage)
            .filter(key => key.startsWith('menomenu_'))
            .forEach(key => localStorage.removeItem(key));
    }
};

// ==========================================
// Toast Notifications
// ==========================================

const Toast = {
    container: null,

    init() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    },

    show(message, type = 'info', duration = 4000) {
        this.init();
        
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="${icons[type]}"></i>
            <span>${message}</span>
        `;

        this.container.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, duration);

        return toast;
    },

    success(message) { return this.show(message, 'success'); },
    error(message) { return this.show(message, 'error'); },
    warning(message) { return this.show(message, 'warning'); },
    info(message) { return this.show(message, 'info'); }
};

// ==========================================
// Loading States
// ==========================================

const Loading = {
    show(container, message = 'جاري التحميل...') {
        const loader = document.createElement('div');
        loader.className = 'loading-overlay';
        loader.innerHTML = `
            <div class="loading-content">
                <div class="spinner"></div>
                <p class="loading-text">${message}</p>
            </div>
        `;
        
        loader.style.cssText = `
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(255,255,255,0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            border-radius: inherit;
        `;

        if (typeof container === 'string') {
            container = document.querySelector(container);
        }
        
        if (container) {
            container.style.position = 'relative';
            container.appendChild(loader);
        }

        return loader;
    },

    hide(loader) {
        if (loader && loader.parentNode) {
            loader.remove();
        }
    }
};

// ==========================================
// Modal Management
// ==========================================

const Modal = {
    show(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    },

    hide(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    },

    init() {
        // Close on overlay click
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.classList.remove('active');
                    document.body.style.overflow = '';
                }
            });
        });

        // Close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                const overlay = btn.closest('.modal-overlay');
                if (overlay) {
                    overlay.classList.remove('active');
                    document.body.style.overflow = '';
                }
            });
        });
    }
};

// ==========================================
// API Service
// ==========================================

const API = {
    async request(endpoint, options = {}) {
        const url = `${CONFIG.API_URL}${endpoint}`;
        const token = Storage.get('auth_token');

        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        };

        try {
            const response = await fetch(url, { ...defaultOptions, ...options });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'حدث خطأ في الاتصال');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            Toast.error(error.message);
            throw error;
        }
    },

    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    },

    async post(endpoint, body) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    },

    async put(endpoint, body) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
    },

    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
};

// ==========================================
// Firebase Service
// ==========================================

const Firebase = {
    baseUrl: CONFIG.FIREBASE_DB,

    async get(path) {
        try {
            const response = await fetch(`${this.baseUrl}/${path}.json`);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Firebase Error:', error);
            throw error;
        }
    },

    async set(path, data) {
        try {
            const response = await fetch(`${this.baseUrl}/${path}.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return await response.json();
        } catch (error) {
            console.error('Firebase Error:', error);
            throw error;
        }
    },

    async update(path, data) {
        try {
            const response = await fetch(`${this.baseUrl}/${path}.json`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return await response.json();
        } catch (error) {
            console.error('Firebase Error:', error);
            throw error;
        }
    },

    async delete(path) {
        try {
            const response = await fetch(`${this.baseUrl}/${path}.json`, {
                method: 'DELETE'
            });
            return await response.json();
        } catch (error) {
            console.error('Firebase Error:', error);
            throw error;
        }
    },

    // Auth helpers
    async login(email, password) {
        // This would use Firebase Auth in production
        // For now, we'll simulate with our worker
        const users = await this.get('users');
        const user = Object.values(users || {}).find(u => u.email === email);
        
        if (user) {
            const token = btoa(JSON.stringify({
                uid: Object.keys(users).find(k => users[k].email === email),
                email: user.email,
                exp: Date.now() + 7 * 24 * 60 * 60 * 1000
            }));
            return { user, token };
        }
        
        throw new Error('بيانات الدخول غير صحيحة');
    },

    async register(userData) {
        const users = await this.get('users') || {};
        const userId = 'user_' + Date.now();
        
        users[userId] = {
            ...userData,
            createdAt: Date.now(),
            plan: 'free'
        };

        await this.set('users', users);
        
        return { id: userId, ...userData };
    }
};

// ==========================================
// Cart Management
// ==========================================

const Cart = {
    KEY: 'cart',

    getItems() {
        return Storage.get(this.KEY) || [];
    },

    saveItems(items) {
        Storage.set(this.KEY, items);
        this.updateUI();
    },

    addItem(item, quantity = 1, size = null, addons = []) {
        const items = this.getItems();
        
        // Check if same item with same options exists
        const existingIndex = items.findIndex(i => 
            i.id === item.id &&
            JSON.stringify(i.size) === JSON.stringify(size) &&
            JSON.stringify(i.addons) === JSON.stringify(addons)
        );

        if (existingIndex > -1) {
            items[existingIndex].quantity += quantity;
        } else {
            items.push({
                id: item.id,
                name: item.name,
                price: item.price,
                image: item.image,
                quantity,
                size,
                addons
            });
        }

        this.saveItems(items);
        Toast.success(`تمت إضافة "${item.name}" إلى السلة`);
    },

    removeItem(index) {
        const items = this.getItems();
        const removed = items.splice(index, 1)[0];
        this.saveItems(items);
        Toast.info(`تم حذف "${removed.name}" من السلة`);
    },

    updateQuantity(index, quantity) {
        const items = this.getItems();
        if (index >= 0 && index < items.length) {
            if (quantity <= 0) {
                this.removeItem(index);
            } else {
                items[index].quantity = quantity;
                this.saveItems(items);
            }
        }
    },

    clear() {
        this.saveItems([]);
        Toast.info('تم تفريغ السلة');
    },

    getTotal() {
        return this.getItems().reduce((total, item) => {
            let itemTotal = item.price * item.quantity;
            
            // Add size price difference
            if (item.size && item.size.priceDiff) {
                itemTotal += item.size.priceDiff * item.quantity;
            }
            
            // Add addons prices
            if (item.addons && item.addons.length > 0) {
                item.addons.forEach(addon => {
                    itemTotal += (addon.price || 0) * item.quantity;
                });
            }
            
            return total + itemTotal;
        }, 0);
    },

    getCount() {
        return this.getItems().reduce((count, item) => count + item.quantity, 0);
    },

    updateUI() {
        // Update cart count badges
        document.querySelectorAll('.cart-count').forEach(el => {
            el.textContent = this.getCount();
            el.style.display = this.getCount() > 0 ? 'flex' : 'none';
        });

        // Update cart total
        document.querySelectorAll('.cart-total-value').forEach(el => {
            el.textContent = formatCurrency(this.getTotal());
        });

        // Update cart items list
        this.renderCartItems();
    },

    renderCartItems() {
        const container = document.getElementById('cart-items-list');
        if (!container) return;

        const items = this.getItems();

        if (items.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 30px;">
                    <i class="fas fa-shopping-cart empty-state-icon"></i>
                    <p>السلة فارغة</p>
                </div>
            `;
            return;
        }

        container.innerHTML = items.map((item, index) => `
            <div class="cart-item">
                <img src="${item.image || 'assets/images/placeholder-food.jpg'}" 
                     alt="${item.name}" class="cart-item-image">
                <div class="cart-item-details">
                    <h4 class="cart-item-name">${item.name}</h4>
                    ${item.size ? `<p class="cart-item-options">المقاس: ${item.size.name}</p>` : ''}
                    ${item.addons && item.addons.length > 0 ? 
                        `<p class="cart-item-options">إضافات: ${item.addons.map(a => a.name).join(', ')}</p>` : ''}
                    <div class="cart-item-footer">
                        <span class="cart-item-price">${formatCurrency(item.price * item.quantity)}</span>
                        <button onclick="Cart.removeItem(${index})" class="cart-item-remove">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }
};

// ==========================================
// WhatsApp Integration
// ==========================================

const WhatsApp = {
    /**
     * Send order via WhatsApp
     */
    sendOrder(orderData, restaurantPhone) {
        const message = this.formatOrderMessage(orderData);
        const phone = restaurantPhone.replace(/[^0-9]/g, '');
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        
        window.open(url, '_blank');
    },

    /**
     * Format order as WhatsApp message
     */
    formatOrderMessage(orderData) {
        let message = `🍽️ *طلب جديد من القائمة*\n`;
        message += `━━━━━━━━━━━━━━━\n\n`;
        
        // Customer info
        if (orderData.customerName) {
            message += `👤 *الاسم:* ${orderData.customerName}\n`;
        }
        if (orderData.customerPhone) {
            message += `📱 *الهاتف:* ${orderData.customerPhone}\n`;
        }
        message += `\n`;

        // Order items
        message += `📋 *تفاصيل الطلب:*\n`;
        message += `━━━━━━━━━━━━━━━\n`;
        
        orderData.items.forEach((item, index) => {
            message += `\n${index + 1}. *${item.name}*\n`;
            message += `   الكمية: ${item.quantity}\n`;
            if (item.size) {
                message += `   المقاس: ${item.size.name}\n`;
            }
            if (item.addons && item.addons.length > 0) {
                message += `   الإضافات: ${item.addons.map(a => a.name).join(', ')}\n`;
            }
            message += `   السعر: ${formatCurrency(item.totalPrice)}\n`;
        });

        message += `\n━━━━━━━━━━━━━━━\n`;
        message += `💰 *الإجمالي:* ${formatCurrency(orderData.totalAmount)}\n\n`;

        if (orderData.notes) {
            message += `📝 *ملاحظات:* ${orderData.notes}\n\n`;
        }

        message += `⏰ *وقت الطلب:* ${new Date().toLocaleString('ar-EG')}\n`;
        message += `\n_تم الإرسال via MezoMenu_`;

        return message;
    },

    /**
     * Open WhatsApp chat
     */
    openChat(phone, message = '') {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const url = `https://wa.me/${cleanPhone}${message ? '?text=' + encodeURIComponent(message) : ''}`;
        window.open(url, '_blank');
    }
};

// ==========================================
// Image Upload Helper
// ==========================================

const ImageUpload = {
    /**
     * Handle image upload and convert to base64
     */
    async handleUpload(file, maxSizeMB = 5) {
        return new Promise((resolve, reject) => {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                reject(new Error('يرجى اختيار صورة صالحة'));
                return;
            }

            // Validate file size
            if (file.size > maxSizeMB * 1024 * 1024) {
                reject(new Error(`حجم الملف يجب أن لا يتجاوز ${maxSizeMB} ميجابايت`));
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('فشل في قراءة الملف'));
            reader.readAsDataURL(file);
        });
    },

    /**
     * Compress image before upload
     */
    async compress(file, maxWidth = 800, quality = 0.8) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                // Calculate new dimensions
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                // Draw and export
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(resolve, 'image/jpeg', quality);
            };

            img.src = URL.createObjectURL(file);
        });
    },

    /**
     * Preview image before upload
     */
    preview(input, imgElement) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (imgElement) {
                    imgElement.src = e.target.result;
                }
            };
            reader.readAsDataURL(input.files[0]);
        }
    }
};

// ==========================================
// AI Menu Analysis
// ==========================================

const AIMenuAnalyzer = {
    /**
     * Analyze menu image using AI
     */
    async analyzeImage(imageBase64) {
        try {
            Toast.info('جاري تحليل الصورة بالذكاء الاصطناعي...');
            
            const response = await API.post('/api/ai/analyze', {
                image: imageBase64,
                type: 'menu-ocr',
                options: {
                    language: 'ar',
                    extractPrices: true,
                    extractCategories: true
                }
            });

            if (response.success) {
                Toast.success('تم تحليل القائمة بنجاح!');
                return response.data;
            }

            throw new Error('فشل في التحليل');
        } catch (error) {
            Toast.error(error.message);
            return null;
        }
    },

    /**
     * Import analyzed menu to restaurant
     */
    async importAnalyzedMenu(analyzedData, restaurantId) {
        try {
            // Structure the data for import
            const menuData = {
                restaurantId,
                categories: analyzedData.categories || [],
                items: analyzedData.items || []
            };

            const response = await API.post('/api/menu', menuData);

            if (response.success) {
                Toast.success('تم استيراد القائمة بنجاح!');
                return response.data;
            }

            throw new Error('فشل في الاستيراد');
        } catch (error) {
            Toast.error(error.message);
            return null;
        }
    }
};

// ==========================================
// Notification System
// ==========================================

const Notifications = {
    /**
     * Create notification
     */
    async create(notificationData) {
        const notification = {
            id: generateId(),
            ...notificationData,
            isRead: false,
            createdAt: new Date().toISOString()
        };

        // Save to Firebase
        await Firebase.update(
            `notifications/${notification.id}`,
            notification
        );

        // Show browser notification if permitted
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(notification.title, {
                body: notification.message,
                icon: '/icon-192.png'
            });
        }

        return notification;
    },

    /**
     * Request permission for browser notifications
     */
    async requestPermission() {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }
        return false;
    },

    /**
     * Mark notification as read
     */
    async markAsRead(notificationId) {
        await Firebase.update(`notifications/${notificationId}`, { isRead: true });
    },

    /**
     * Get unread count
     */
    async getUnreadCount(userId) {
        const notifications = await Firebase.get('notifications');
        if (!notifications) return 0;

        return Object.values(notifications).filter(n => 
            !n.isRead && n.userId === userId
        ).length;
    }
};

// ==========================================
// QR Code Generator
// ==========================================

const QRCode = {
    /**
     * Generate QR code for menu URL
     */
    generate(text, size = 200) {
        // Using a simple QR code API or library
        // For now, we'll use a placeholder
        return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;
    },

    /**
     * Download QR code
     */
    download(restaurantSlug) {
        const url = `${window.location.origin}/r/${restaurantSlug}`;
        const qrUrl = this.generate(url, 400);
        
        const link = document.createElement('a');
        link.href = qrUrl;
        link.download = `qrcode-${restaurantSlug}.png`;
        link.target = '_blank';
        link.click();
    }
};

// ==========================================
// Initialize App
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // Initialize modals
    Modal.init();

    // Load saved state
    AppState.cart = Cart.getItems();

    // Update UI
    Cart.updateUI();

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
        // Don't request immediately, maybe after user interaction
    }

    console.log('MezoMenu SaaS Initialized ✅');
});

// Export for use in other scripts
window.MezoMenu = {
    CONFIG,
    AppState,
    Storage,
    Toast,
    Loading,
    Modal,
    API,
    Firebase,
    Cart,
    WhatsApp,
    ImageUpload,
    AIMenuAnalyzer,
    Notifications,
    QRCode,
    formatCurrency,
    formatDateTime,
    generateId,
    slugify,
    isValidEmail,
    isValidPhone,
    getUrlParams
};
