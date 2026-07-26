/**
 * MezoMenu - Customer Menu PWA
 * Interactive restaurant menu for customers
 */

// ========================================
// Configuration
// ========================================

const MENU_CONFIG = {
    // Cloudflare Workers API Base URL for customer menu
    API_BASE_URL: 'https://menu.nonm1724.workers.dev',
    
    // API Endpoints
    ENDPOINTS: {
        publicMenu: '/api/public/menu',
        submitOrder: '/api/orders'
    }
};

// ========================================
// Global State
// ========================================

let restaurantData = null;
let menuData = { categories: [], items: [] };
let cart = [];
let currentCategory = 'all';
let selectedItem = null;

// ========================================
// Initialization
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    initPWA();
    loadMenu();
    setupEventListeners();
});

function initPWA() {
    // Register service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('../sw.js')
            .then(reg => console.log('[SW] Registered:', reg.scope))
            .catch(err => console.error('[SW] Registration failed:', err));
    }

    // Handle install prompt
    let deferredPrompt;
    
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        
        // Show install banner after delay
        setTimeout(() => {
            const banner = document.getElementById('installBanner');
            if (banner && !localStorage.getItem('pwa_dismissed')) {
                banner.style.display = 'block';
            }
        }, 5000);
    });

    window.installPWA = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            
            if (outcome === 'accepted') {
                console.log('[PWA] Installed');
                dismissInstallBanner();
            }
            
            deferredPrompt = null;
        }
    };

    window.dismissInstallBanner = () => {
        document.getElementById('installBanner').style.display = 'none';
        localStorage.setItem('pwa_dismissed', 'true');
    };
}

async function loadMenu() {
    showLoading(true);
    
    try {
        // Get restaurant slug from URL
        const pathParts = window.location.pathname.split('/');
        const slug = pathParts[pathParts.length - 2] || pathParts[pathParts.length - 1];
        
        if (!slug || slug === 'menu' || slug === 'template') {
            showError('يرجى الوصول عبر رابط المطعم الصحيح');
            return;
        }

        // Fetch menu data from API or Firebase
        const response = await fetch(`${MENU_CONFIG.API_BASE_URL}${MENU_CONFIG.ENDPOINTS.publicMenu}/${slug}`);
        
        if (!response.ok) {
            throw new Error('المطعم غير موجود');
        }

        restaurantData = await response.json();
        menuData = {
            categories: restaurantData.categories || [],
            items: restaurantData.items || []
        };

        // Update UI with restaurant data
        updateRestaurantHeader();
        renderCategories();
        renderItems();
        
        showApp();

    } catch (error) {
        console.error('Load menu error:', error);
        showError(error.message || 'فشل في تحميل القائمة');
    } finally {
        showLoading(false);
    }
}

function setupEventListeners() {
    // Search input debounce
    let searchTimeout;
    document.getElementById('searchInput').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => handleSearch(e.target.value), 300);
    });
}

// ========================================
// UI Updates
// ========================================

function updateRestaurantHeader() {
    if (!restaurantData) return;

    document.title = `${restaurantData.name} - قائمة الطعام`;
    
    document.getElementById('restaurantLogo').textContent = restaurantData.logo || '🍽️';
    document.getElementById('restaurantName').textContent = restaurantData.name;
    document.getElementById('restaurantDescription').textContent = restaurantData.description || '';
    document.getElementById('cuisineType').textContent = getCuisineName(restaurantData.cuisineType);
}

function renderCategories() {
    const nav = document.getElementById('categoriesNav');
    
    let html = '<div class="category-tabs">';
    html += `<button class="category-tab active" onclick="filterByCategory('all')" data-category="all">الكل</button>`;
    
    menuData.categories.forEach(cat => {
        html += `
            <button class="category-tab" 
                    onclick="filterByCategory('${cat.id}')" 
                    data-category="${cat.id}">
                <span class="category-icon">${cat.icon || '📁'}</span>
                ${cat.name}
            </button>
        `;
    });
    
    html += '</div>';
    nav.innerHTML = html;
}

function renderItems(items = null) {
    const container = document.getElementById('menuItemsContainer');
    const displayItems = items || getFilteredItems();
    
    if (displayItems.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span>🔍</span>
                <p>لا توجد أصناف</p>
                <p>جرب البحث بكلمات أخرى</p>
            </div>
        `;
        return;
    }

    let html = '<div class="items-grid">';
    
    displayItems.forEach(item => {
        html += createItemCard(item);
    });
    
    html += '</div>';
    container.innerHTML = html;
}

function createItemCard(item) {
    const imageHtml = item.image 
        ? `<img src="${item.image}" alt="${item.name}" loading="lazy">`
        : `<span class="item-emoji-large">${item.emoji || '🍽️'}</span>`;

    const badgeHtml = item.isPopular 
        ? '<span class="item-badge popular">⭐ شائع</span>' 
        : item.isFeatured 
            ? '<span class="item-badge">✨ مميز</span>' 
            : '';

    const originalPriceHtml = item.originalPrice 
        ? `<span class="item-original-price">${item.originalPrice} ${restaurantData?.currencySymbol || 'ج.م'}</span>` 
        : '';

    return `
        <div class="menu-item-card" onclick="openItemModal('${item.id}')">
            <div class="item-image-wrapper">
                ${imageHtml}
                ${badgeHtml}
            </div>
            <div class="item-body">
                <h3 class="item-name">${item.name}</h3>
                <p class="item-description">${item.description || ''}</p>
                <div class="item-footer">
                    <div class="price-wrapper">
                        ${originalPriceHtml}
                        <span class="item-price">${item.price} ${restaurantData?.currencySymbol || 'ج.م'}</span>
                    </div>
                    <button class="add-to-cart-btn" 
                            onclick="event.stopPropagation(); quickAddToCart('${item.id}')"
                            aria-label="أضف للسلة">+</button>
                </div>
            </div>
        </div>
    `;
}

// ========================================
// Category Filtering & Search
// ========================================

function filterByCategory(categoryId) {
    currentCategory = categoryId;
    
    // Update active tab
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.category === categoryId);
    });
    
    renderItems(getFilteredItems());
}

function getFilteredItems() {
    let items = menuData.items.filter(item => item.isAvailable !== false);
    
    if (currentCategory !== 'all') {
        items = items.filter(item => item.categoryId === currentCategory);
    }
    
    return items;
}

function toggleSearch() {
    const container = document.getElementById('searchContainer');
    container.style.display = container.style.display === 'none' ? 'block' : 'none';
    
    if (container.style.display === 'block') {
        document.getElementById('searchInput').focus();
    }
}

function handleSearch(query) {
    const resultsContainer = document.getElementById('searchResults');
    
    if (!query.trim()) {
        resultsContainer.innerHTML = '';
        return;
    }
    
    const results = menuData.items.filter(item => 
        item.name.includes(query) || 
        (item.description && item.description.includes(query))
    );
    
    if (results.length === 0) {
        resultsContainer.innerHTML = '<p style="text-align:center;color:#9ca3af;padding:20px;">لا توجد نتائج</p>';
        return;
    }
    
    resultsContainer.innerHTML = results.map(item => `
        <div class="search-result-item" onclick="openItemModal('${item.id}'); toggleSearch();">
            <span class="emoji">${item.emoji || '🍽️'}</span>
            <div class="info">
                <span class="name">${item.name}</span>
            </div>
            <span class="price">${item.price} ج.م</span>
        </div>
    `).join('');
}

// ========================================
// Item Modal
// ========================================

function openItemModal(itemId) {
    const item = menuData.items.find(i => i.id === itemId);
    if (!item) return;
    
    selectedItem = item;
    
    // Update modal content
    document.getElementById('modalEmoji').textContent = item.emoji || '🍽️';
    document.getElementById('modalItemName').textContent = item.name;
    document.getElementById('modalDescription').textContent = item.description || '';
    document.getElementById('modalPrice').textContent = `${item.price} ${restaurantData?.currencySymbol || 'ج.م'}`;
    
    const originalPriceEl = document.getElementById('modalOriginalPrice');
    if (item.originalPrice) {
        originalPriceEl.textContent = `${item.originalPrice} ${restaurantData?.currencySymbol || 'ج.م'}`;
        originalPriceEl.style.display = 'inline';
    } else {
        originalPriceEl.style.display = 'none';
    }
    
    // Reset quantity
    document.getElementById('modalQuantity').textContent = '1';
    document.getElementById('specialNotes').value = '';
    
    // Show modal
    document.getElementById('itemModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeItemModal() {
    document.getElementById('itemModal').style.display = 'none';
    document.body.style.overflow = '';
    selectedItem = null;
}

function updateModalQuantity(delta) {
    const qtyEl = document.getElementById('modalQuantity');
    let qty = parseInt(qtyEl.textContent) + delta;
    
    if (qty < 1) qty = 1;
    if (qty > 99) qty = 99;
    
    qtyEl.textContent = qty;
}

function addToCartFromModal() {
    if (!selectedItem) return;
    
    const quantity = parseInt(document.getElementById('modalQuantity').textContent);
    const notes = document.getElementById('specialNotes').value;
    
    addToCart(selectedItem, quantity, notes);
    closeItemModal();
}

function quickAddToCart(itemId) {
    const item = menuData.items.find(i => i.id === itemId);
    if (item) {
        addToCart(item, 1, '');
    }
}

// ========================================
// Cart Management
// ========================================

function addToCart(item, quantity, notes) {
    const existingIndex = cart.findIndex(cartItem => cartItem.itemId === item.id);
    
    if (existingIndex > -1) {
        // Update existing item
        cart[existingIndex].quantity += quantity;
        if (notes) cart[existingIndex].notes = notes;
    } else {
        // Add new item
        cart.push({
            itemId: item.id,
            name: item.name,
            price: item.price,
            emoji: item.emoji || '🍽️',
            quantity,
            notes
        });
    }
    
    updateCartUI();
    showToast(`تمت إضافة "${item.name}" إلى السلة`, 'success');
}

function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartUI();
}

function updateCartItemQty(index, delta) {
    cart[index].quantity += delta;
    
    if (cart[index].quantity <= 0) {
        removeFromCart(index);
        return;
    }
    
    updateCartUI();
}

function updateCartUI() {
    // Update count badge
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('cartCount').textContent = totalItems;
    
    // Update cart sidebar
    const cartItemsEl = document.getElementById('cartItems');
    const emptyCartEl = document.getElementById('emptyCart');
    const cartFooterEl = document.getElementById('cartFooter');
    
    if (cart.length === 0) {
        emptyCartEl.style.display = 'block';
        cartFooterEl.style.display = 'none';
        cartItemsEl.querySelectorAll('.cart-item').forEach(el => el.remove());
        return;
    }
    
    emptyCartEl.style.display = 'none';
    cartFooterEl.style.display = 'block';
    
    // Render cart items
    let html = '';
    cart.forEach((item, index) => {
        html += `
            <div class="cart-item">
                <span class="cart-item-emoji">${item.emoji}</span>
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">${(item.price * item.quantity).toFixed(2)} ج.م</div>
                </div>
                <div class="cart-item-quantity">
                    <button class="cart-item-qty-btn" onclick="updateCartItemQty(${index}, -1)">−</button>
                    <span class="cart-item-qty-value">${item.quantity}</span>
                    <button class="cart-item-qty-btn" onclick="updateCartItemQty(${index}, 1)">+</button>
                </div>
                <button class="remove-item-btn" onclick="removeFromCart(${index})">×</button>
            </div>
        `;
    });
    
    // Keep the empty cart element but hide it, and add items before it
    const existingItems = cartItemsEl.querySelectorAll('.cart-item');
    existingItems.forEach(el => el.remove());
    emptyCartEl.insertAdjacentHTML('beforebegin', html);
    
    // Update totals
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    document.getElementById('subtotal').textContent = `${subtotal.toFixed(2)} ج.م`;
    document.getElementById('totalAmount').textContent = `${subtotal.toFixed(2)} ج.م`;
}

function toggleCart() {
    const sidebar = document.getElementById('cartSidebar');
    sidebar.classList.toggle('open');
    
    if (sidebar.classList.contains('open')) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = '';
    }
}

// ========================================
// Order Submission
// ========================================

function proceedToOrder() {
    if (cart.length === 0) {
        showToast('السلة فارغة!', 'error');
        return;
    }
    
    toggleCart();
    
    // Populate order summary
    let summaryHtml = '';
    cart.forEach(item => {
        summaryHtml += `
            <div class="order-summary-item">
                <span>${item.quantity}x ${item.name}</span>
                <span>${(item.price * item.quantity).toFixed(2)} ج.م</span>
            </div>
        `;
    });
    
    document.getElementById('orderItemsSummary').innerHTML = summaryHtml;
    
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    document.getElementById('orderTotalDisplay').textContent = `${total.toFixed(2)} ج.م`;
    
    // Show order modal
    document.getElementById('orderModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeOrderModal() {
    document.getElementById('orderModal').style.display = 'none';
    document.body.style.overflow = '';
}

async function submitOrder(event) {
    event.preventDefault();
    
    const customerName = document.getElementById('customerName').value.trim();
    const customerPhone = document.getElementById('customerPhone').value.trim();
    const deliveryAddress = document.getElementById('deliveryAddress').value.trim();
    const orderNotes = document.getElementById('orderNotes').value.trim();
    
    if (!customerName || !customerPhone) {
        showToast('يرجى إدخال الاسم ورقم الهاتف', 'error');
        return;
    }
    
    // Calculate totals
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const deliveryFee = deliveryAddress ? 20 : 0; // Example delivery fee
    const tax = Math.round(subtotal * 0.14); // 14% VAT
    const total = subtotal + deliveryFee + tax;
    
    // Build WhatsApp message
    const message = buildWhatsAppMessage({
        customerName,
        customerPhone,
        deliveryAddress,
        orderNotes,
        items: cart,
        subtotal,
        deliveryFee,
        tax,
        total
    });
    
    // Open WhatsApp
    const whatsappNumber = restaurantData?.whatsappNumber || '';
    const whatsappUrl = `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
    
    window.open(whatsappUrl, '_blank');
    
    // Clear cart and close modal
    cart = [];
    updateCartUI();
    closeOrderModal();
    
    // Reset form
    document.getElementById('orderForm').reset();
    
    showToast('تم فتح واتساب لإرسال الطلب! 🎉', 'success');
}

function buildWhatsAppMessage(orderData) {
    const { customerName, customerPhone, deliveryAddress, orderNotes, items, subtotal, deliveryFee, tax, total } = orderData;
    
    let message = `🍽️ *طلب جديد من قائمة MezoMenu*\n`;
    message += `━━━━━━━━━━━━━━━\n`;
    message += `👤 *العميل:* ${customerName}\n`;
    message += `📱 *الهاتف:* ${customerPhone}\n`;
    
    if (deliveryAddress) {
        message += `📍 *العنوان:* ${deliveryAddress}\n`;
        message += `🚚 *التوصيل:* نعم\n`;
    } else {
        message += `🏃 *الاستلام:* من المطعم\n`;
    }
    
    message += `\n🛒 *الأصناف:*\n`;
    
    items.forEach(item => {
        message += `• ${item.quantity}x ${item.name} = ${(item.price * item.quantity).toFixed(2)} ج.م\n`;
        if (item.notes) {
            message += `  📝 ملاحظة: ${item.notes}\n`;
        }
    });
    
    message += `\n━━━━━━━━━━━━━━━\n`;
    message += `💰 *المجموع الفرعي:* ${subtotal.toFixed(2)} ج.م\n`;
    
    if (deliveryFee > 0) {
        message += `🚚 *رسوم التوصيل:* ${deliveryFee.toFixed(2)} ج.م\n`;
    }
    
    message += `🧾 *ضريبة القيمة المضافة (14%):* ${tax.toFixed(2)} ج.م\n`;
    message += `\n💳 *الإجمالي:* *${total.toFixed(2)} ج.م*\n`;
    
    if (orderNotes) {
        message += `\n📝 *ملاحظات:* ${orderNotes}\n`;
    }
    
    message += `\n_تم الإرسال via MezoMenu_\n`;
    
    return message;
}

// ========================================
// Utility Functions
// ========================================

function showLoading(show) {
    document.getElementById('loadingScreen').style.display = show ? 'flex' : 'none';
}

function showError(message) {
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('errorScreen').style.display = 'flex';
}

function showApp() {
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('errorScreen').style.display = 'none';
    document.getElementById('menuApp').style.display = 'block';
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = type === 'success' ? `✅ ${message}` : `❌ ${message}`;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'toastIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function getCuisineName(cuisineType) {
    const cuisines = {
        egyptian: 'مصري',
        arabic: 'عربي / شرقي',
        grill: 'مشويات',
        seafood: 'مأكولات بحرية',
        italian: 'إيطالي',
        fastfood: 'وجبات سريعة',
        sweets: 'حلويات',
        drinks: 'مشروبات',
        asian: 'آسيوي',
        other: 'أخرى'
    };
    
    return cuisines[cuisineType] || cuisineType || 'مطعم';
}

// ========================================
// Offline Support
// ========================================

if ('serviceWorker' in navigator) {
    // Listen for online/offline events
    window.addEventListener('online', () => {
        showToast('متصل بالإنترنت ✓', 'success');
        loadMenu();
    });
    
    window.addEventListener('offline', () => {
        showToast('غير متصل بالإنترنت - عرض البيانات المخزنة', 'error');
    });
}
