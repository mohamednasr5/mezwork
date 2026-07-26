/* ===================================
   MezoMenu - Customer Menu JavaScript
   PWA for restaurant customers
   =================================== */

// Global State
const MenuState = {
    restaurant: null,
    menu: { categories: [], items: [] },
    currentCategory: 'all',
    cart: [],
    favorites: [],
    selectedItem: null,
    isLoading: true
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', function() {
    // Load saved state from localStorage
    loadSavedState();
    
    // Get restaurant slug from URL
    const pathParts = window.location.pathname.split('/');
    const slug = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2];
    
    // Load restaurant data
    loadRestaurantData(slug);
    
    // Register service worker for PWA
    registerServiceWorker();
});

/**
 * Load saved state from localStorage
 */
function loadSavedState() {
    try {
        const savedCart = localStorage.getItem('mezomenu_cart');
        const savedFavorites = localStorage.getItem('mezomenu_favorites');
        
        if (savedCart) MenuState.cart = JSON.parse(savedCart);
        if (savedFavorites) MenuState.favorites = JSON.parse(savedFavorites);
    } catch (e) {
        console.warn('Failed to load saved state:', e);
    }
}

/**
 * Save state to localStorage
 */
function saveState() {
    localStorage.setItem('mezomenu_cart', JSON.stringify(MenuState.cart));
    localStorage.setItem('mezomenu_favorites', JSON.stringify(MenuState.favorites));
}

/**
 * Load restaurant and menu data
 */
async function loadRestaurantData(slug) {
    showLoading(true);
    
    try {
        // In production, fetch from API
        // For demo, use mock data
        const response = await fetch(`/api/public/menu/${slug}`);
        
        let data;
        if (response.ok) {
            data = await response.json();
        } else {
            // Use mock data for demo
            data = getMockMenuData();
        }
        
        // Set restaurant info
        MenuState.restaurant = data.restaurant;
        MenuState.menu = data.menu;
        
        // Update UI
        updateRestaurantHeader(data.restaurant);
        renderCategories(data.menu.categories);
        renderItems(data.menu.items);
        
        // Hide loading screen
        setTimeout(() => {
            showLoading(false);
        }, 500);
        
    } catch (error) {
        console.error('Failed to load menu:', error);
        
        // Show error state
        document.getElementById('loadingScreen').innerHTML = `
            <div class="loader-content">
                <div style="font-size: 4rem;">😔</div>
                <h2>عذراً، حدث خطأ</h2>
                <p>لم نتمكن من تحميل القائمة</p>
                <button onclick="location.reload()" class="btn btn-primary">إعادة المحاولة</button>
            </div>
        `;
    }
}

/**
 * Update restaurant header UI
 */
function updateRestaurantHeader(restaurant) {
    // Set cover image
    const coverImg = document.getElementById('coverImg');
    if (coverImg && restaurant.coverImage) {
        coverImg.src = restaurant.coverImage;
    }
    
    // Set logo
    const logoImg = document.getElementById('logoImg');
    if (logoImg && restaurant.logo) {
        logoImg.src = restaurant.logo;
    }
    
    // Set name and description
    const nameEl = document.getElementById('restaurantName');
    const descEl = document.getElementById('restaurantDesc');
    
    if (nameEl) nameEl.textContent = restaurant.name;
    if (descEl) descEl.textContent = restaurant.description || '';
    
    // Update page title
    document.title = `${restaurant.name} - قائمة الطعام`;
}

/**
 * Render categories navigation
 */
function renderCategories(categories) {
    const container = document.getElementById('categoriesScroll');
    if (!container || !categories) return;
    
    // Add "All" category first
    let html = `<button class="category-chip active" onclick="filterByCategory('all', this)">الكل</button>`;
    
    categories.forEach(category => {
        html += `
            <button class="category-chip" onclick="filterByCategory('${category.id}', this)">
                ${getCategoryIcon(category.name)} ${category.name}
            </button>
        `;
    });
    
    container.innerHTML = html;
}

/**
 * Get emoji icon for category
 */
function getCategoryIcon(name) {
    const icons = {
        'المقبلات': '🥗',
        'سلطات': '🥬',
        'مشويات': '🍖',
        'أطباق رئيسية': '🍽️',
        'حلويات': '🍰',
        'مشروبات': '🥤',
        'بيتزا': '🍕',
        'برجر': '🍔',
        'ساندويتشات': '🥪',
        'شوربة': '🍲',
        'معجنات': '🥟',
        'أرز': '🍚',
        'معكرونة': '🍝'
    };
    
    return icons[name] || '🍴';
}

/**
 * Filter items by category
 */
function filterByCategory(categoryId, element) {
    // Update active state
    document.querySelectorAll('.category-chip').forEach(chip => {
        chip.classList.remove('active');
    });
    if (element) element.classList.add('active');
    
    MenuState.currentCategory = categoryId;
    
    // Re-render items with filter
    renderItems(MenuState.menu.items, categoryId);
}

/**
 * Render menu items grid
 */
function renderItems(items, categoryId = 'all') {
    const container = document.getElementById('menuItemsContainer');
    if (!container) return;
    
    let filteredItems = items || [];
    
    // Apply category filter
    if (categoryId !== 'all') {
        filteredItems = filteredItems.filter(item => item.categoryId === categoryId);
    }
    
    if (filteredItems.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">🍽️</div>
                <p color="var(--gray-500)">لا توجد أصناف في هذا القسم</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    filteredItems.forEach(item => {
        const isFavorite = MenuState.favorites.includes(item.id);
        const inCart = MenuState.cart.find(ci => ci.id === item.id);
        
        html += `
            <div class="menu-item-card" onclick="openItemModal('${item.id}')">
                <div class="menu-item-image">
                    ${item.image 
                        ? `<img src="${item.image}" alt="${item.name}" loading="lazy">` 
                        : `<div class="menu-item-image-placeholder">${getItemEmoji(item.name)}</div>`
                    }
                    ${item.isPopular ? '<span class="item-badge">الأكثر مبيعاً</span>' : ''}
                    ${item.isSpecial ? '<span class="item-badge" style="background: #8b5cf6;">عرض خاص</span>' : ''}
                    <button class="item-favorite-btn ${isFavorite ? 'active' : ''}" 
                            onclick="event.stopPropagation(); toggleFavorite('${item.id}')"
                            aria-label="${isFavorite ? 'إزالة من المفضلة' : 'أضف للمفضلة'}">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="${isFavorite ? '#ef4444' : 'none'}" stroke="${isFavorite ? '#ef4444' : 'currentColor'}" stroke-width="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                    </button>
                </div>
                <div class="menu-item-info">
                    <h3 class="menu-item-name">${item.name}</h3>
                    ${item.description ? `<p class="menu-item-description">${item.description}</p>` : ''}
                    <div class="menu-item-footer">
                        <span class="menu-item-price">${formatPrice(item.price)}</span>
                        ${inCart 
                            ? `<span class="badge badge-success" style="font-size: 0.75rem;">في السلة (${inCart.quantity})</span>`
                            : `<button class="add-to-cart-mini" onclick="event.stopPropagation(); quickAddToCart('${item.id}')" aria-label="أضف للسلة">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="12" y1="5" x2="12" y2="19"/>
                                    <line x1="5" y1="12" x2="19" y2="12"/>
                                </svg>
                               </button>`
                        }
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

/**
 * Get emoji for item based on name
 */
function getItemEmoji(name) {
    const lowerName = name.toLowerCase();
    
    if (lowerName.includes('بيتزا')) return '🍕';
    if (lowerName.includes('برجر')) return '🍔';
    if (lowerName.includes('دجاج') || lowerName.includes('تشكن')) return '🍗';
    if (lowerName.includes('لحم')) return '🥩';
    if (lowerName.includes('سمك')) return '🐟';
    if (lowerName.includes('سلط')) return '🥗';
    if (lowerName.includes('حلو') || lowerName.includes('كيك')) return '🍰';
    if (lowerName.includes('عصير') || lowerName.includes('مشروب')) return '🥤';
    if (lowerName.includes('قهوة')) return '☕';
    if (lowerName.includes('شاي')) return '🍵';
    if (lowerName.includes('ساندويتش')) return '🥪';
    if (lowerName.includes('حساء') || lowerName.includes('شوربة')) return '🍲';
    if (lowerName.includes('معكرونة') || lowerName.includes('سباغيتي')) return '🍝';
    if (lowerName.includes('أرز')) return '🍚';
    
    return '🍽️';
}

/**
 * Open item detail modal
 */
function openItemModal(itemId) {
    const item = MenuState.menu.items.find(i => i.id === itemId);
    if (!item) return;
    
    MenuState.selectedItem = item;
    
    // Update modal content
    const modalImg = document.getElementById('modalImg');
    const itemName = document.getElementById('modalItemName');
    const itemDesc = document.getElementById('modalItemDesc');
    const itemPrice = document.getElementById('modalItemPrice');
    const favoriteBtn = document.getElementById('modalFavoriteBtn');
    const quantityInput = document.getElementById('modalQuantity');
    
    if (modalImg) modalImg.src = item.image || '';
    if (itemName) itemName.textContent = item.name;
    if (itemDesc) itemDesc.textContent = item.description || '';
    if (itemPrice) itemPrice.textContent = formatPrice(item.price);
    if (quantityInput) quantityInput.value = 1;
    
    // Update favorite button state
    const isFavorite = MenuState.favorites.includes(item.id);
    if (favoriteBtn) {
        favoriteBtn.classList.toggle('active', isFavorite);
        favoriteBtn.querySelector('svg').setAttribute('fill', isFavorite ? '#ef4444' : 'none');
    }
    
    // Update total price display
    updateModalTotal();
    
    // Show modal
    document.getElementById('itemModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

/**
 * Close item modal
 */
function closeItemModal() {
    document.getElementById('itemModal').classList.add('hidden');
    document.body.style.overflow = '';
    MenuState.selectedItem = null;
}

/**
 * Toggle favorite status in modal
 */
function toggleModalFavorite() {
    if (!MenuState.selectedItem) return;
    toggleFavorite(MenuState.selectedItem.id);
    
    // Update button state
    const isFavorite = MenuState.favorites.includes(MenuState.selectedItem.id);
    const btn = document.getElementById('modalFavoriteBtn');
    if (btn) {
        btn.classList.toggle('active', isFavorite);
        btn.querySelector('svg').setAttribute('fill', isFavorite ? '#ef4444' : 'none');
    }
}

/**
 * Update quantity in modal
 */
function updateModalQuantity(delta) {
    const input = document.getElementById('modalQuantity');
    if (!input) return;
    
    let value = parseInt(input.value) + delta;
    value = Math.max(1, Math.min(99, value));
    input.value = value;
    
    updateModalTotal();
}

/**
 * Update modal total price
 */
function updateModalTotal() {
    if (!MenuState.selectedItem) return;
    
    const quantity = parseInt(document.getElementById('modalQuantity')value) || 1;
    const total = MenuState.selectedItem.price * quantity;
    
    const totalPriceEl = document.getElementById('modalTotalPrice');
    if (totalPriceEl) {
        totalPriceEl.textContent = formatPrice(total);
    }
}

/**
 * Add item to cart from modal
 */
function addToCartFromModal() {
    if (!MenuState.selectedItem) return;
    
    const quantity = parseInt(document.getElementById('modalQuantity').value) || 1;
    const notes = document.getElementById('specialNotes')?.value || '';
    
    addToCart(MenuState.selectedItem, quantity, notes);
    
    // Close modal
    closeItemModal();
    
    // Show toast
    showToast(`تمت إضافة "${MenuState.selectedItem.name}" للسلة`, 'success');
}

/**
 * Quick add to card from grid
 */
function quickAddToCart(itemId) {
    const item = MenuState.menu.items.find(i => i.id === itemId);
    if (!item) return;
    
    addToCart(item, 1);
    showToast(`تمت إضافة "${item.name}" للسلة`, 'success');
}

/**
 * Add item to cart
 */
function addToCart(item, quantity = 1, notes = '') {
    const existingIndex = MenuState.cart.findIndex(ci => ci.id === item.id && ci.notes === notes);
    
    if (existingIndex > -1) {
        MenuState.cart[existingIndex].quantity += quantity;
    } else {
        MenuState.cart.push({
            id: item.id,
            name: item.name,
            price: item.price,
            image: item.image,
            quantity,
            notes
        });
    }
    
    saveState();
    updateCartUI();
}

/**
 * Remove item from cart
 */
function removeFromCart(index) {
    MenuState.cart.splice(index, 1);
    saveState();
    updateCartUI();
    renderCartItems();
}

/**
 * Update cart quantity
 */
function updateCartQuantity(index, delta) {
    const newQty = MenuState.cart[index].quantity + delta;
    
    if (newQty <= 0) {
        removeFromCart(index);
        return;
    }
    
    MenuState.cart[index].quantity = Math.min(99, newQty);
    saveState();
    updateCartUI();
    renderCartItems();
}

/**
 * Toggle item as favorite
 */
function toggleFavorite(itemId) {
    const index = MenuState.favorites.indexOf(itemId);
    
    if (index > -1) {
        MenuState.favorites.splice(index, 1);
        showToast('تم الإزالة من المفضلة', 'info');
    } else {
        MenuState.favorites.push(itemId);
        showToast('تمت الإضافة للمفضلة ❤️', 'success');
    }
    
    saveState();
    
    // Re-render to update UI
    renderItems(MenuState.menu.items, MenuState.currentCategory);
}

/**
 * Open cart drawer
 */
function openCart() {
    if (MenuState.cart.length === 0) {
        showToast('سلتك فارغة', 'warning');
        return;
    }
    
    document.getElementById('cartDrawer').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    renderCartItems();
}

/**
 * Close cart drawer
 */
function closeCart() {
    document.getElementById('cartDrawer').classList.add('hidden');
    document.body.style.overflow = '';
}

/**
 * Render cart items
 */
function renderCartItems() {
    const container = document.getElementById('cartItems');
    const emptyState = document.getElementById('cartEmpty');
    const footer = document.getElementById('cartFooter');
    
    if (!container) return;
    
    if (MenuState.cart.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        if (footer) footer.classList.add('hidden');
        return;
    }
    
    if (emptyState) emptyState.classList.add('hidden');
    if (footer) footer.classList.remove('hidden');
    
    let html = '';
    MenuState.cart.forEach((item, index) => {
        html += `
            <div class="cart-item">
                <div class="cart-item-image">
                    ${item.image 
                        ? `<img src="${item.image}" alt="${item.name}">` 
                        : `<div class="menu-item-image-placeholder" style="width:100%;height:100%;">${getItemEmoji(item.name)}</div>`
                    }
                </div>
                <div class="cart-item-details">
                    <div class="cart-item-name">${item.name}</div>
                    ${item.notes ? `<div class="cart-item-notes">📝 ${item.notes}</div>` : ''}
                    <div class="cart-item-bottom">
                        <div class="quantity-selector" style="background:transparent;padding:0;">
                            <button onclick="updateCartQuantity(${index}, -1)" class="qty-btn minus">−</button>
                            <span style="min-width:30px;text-align:center;font-weight:600;">${item.quantity}</span>
                            <button onclick="updateCartQuantity(${index}, 1)" class="qty-btn plus">+</button>
                        </div>
                        <span class="cart-item-price">${formatPrice(item.price * item.quantity)}</span>
                        <button onclick="removeFromCart(${index})" class="cart-item-remove" aria-label="حذف">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3,6 5,6 21,6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    // Update totals
    updateCartTotals();
}

/**
 * Update cart totals
 */
function updateCartTotals() {
    const subtotal = MenuState.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    const subtotalEl = document.getElementById('subtotal');
    const totalEl = document.getElementById('cartTotal');
    const floatingTotalEl = document.getElementById('floatingTotal');
    
    if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
    if (totalEl) totalEl.textContent = formatPrice(subtotal);
    if (floatingTotalEl) floatingTotalEl.textContent = formatPrice(subtotal);
    
    // Update cart count badge
    const count = MenuState.cart.reduce((sum, item) => sum + item.quantity, 0);
    const countBadges = document.querySelectorAll('.cart-count');
    countBadges.forEach(badge => {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline-flex' : 'none';
    });
    
    // Show/hide floating button
    const floatingBtn = document.getElementById('floatingOrderBtn');
    if (floatingBtn) {
        floatingBtn.classList.toggle('visible', count > 0);
    }
}

/**
 * Update cart UI elements
 */
function updateCartUI() {
    updateCartTotals();
}

/**
 * Submit order via WhatsApp
 */
async function submitOrder(event) {
    event.preventDefault();
    
    const customerName = document.getElementById('customerName').value.trim();
    const customerPhone = document.getElementById('customerPhone').value.trim();
    const orderNotes = document.getElementById('orderNotes').value.trim();
    
    // Validate
    if (!customerName || !customerPhone) {
        showToast('يرجى إدخال الاسم ورقم الهاتف', 'error');
        return;
    }
    
    // Build order message
    const orderData = {
        id: `ORD_${Date.now()}`,
        customerName,
        customerPhone,
        items: MenuState.cart,
        notes: orderNotes,
        total: MenuState.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        restaurant: MenuState.restaurant?.name
    };
    
    // Format WhatsApp message
    const message = formatWhatsAppMessage(orderData);
    
    // Get WhatsApp number (from restaurant settings or default)
    const whatsappNumber = MenuState.restaurant?.phone || '201558056568';
    
    // Open WhatsApp
    const url = `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    
    // Clear cart after successful order
    MenuState.cart = [];
    saveState();
    updateCartUI();
    closeCart();
    
    showToast('تم إرسال الطلب بنجاح! 🎉', 'success');
}

/**
 * Format WhatsApp message
 */
function formatWhatsAppMessage(order) {
    let msg = `🆕 *طلب جديد من MezoMenu*\n\n`;
    msg += `📍 المطعم: ${order.restaurant}\n`;
    msg += `👤 الزبون: ${order.customerName}\n`;
    msg += `📱 الهاتف: ${order.customerPhone}\n\n`;
    msg += `*📋 تفاصيل الطلب:*\n`;
    msg += `─`.repeat(25) + `\n`;
    
    order.items.forEach((item, idx) => {
        msg += `${idx + 1}. ${item.name}`;
        if (item.quantity > 1) msg += ` ×${item.quantity}`;
        msg += ` - ${formatPrice(item.price * item.quantity)}\n`;
        if (item.notes) msg += `   📝 ${item.notes}\n`;
    });
    
    msg += `\n─`.repeat(25) + `\n`;
    msg += `💰 *الإجمالي: ${formatPrice(order.total)}*\n\n`;
    
    if (order.notes) {
        msg += `📝 *ملاحظات:* ${order.notes}\n\n`;
    }
    
    msg += `تم الطلب عبر MezoMenu 🍽️`;
    
    return msg;
}

/**
 * Share menu
 */
async function shareMenu() {
    const shareData = {
        title: `${MenuState.restaurant?.name} - قائمة الطعام`,
        text: `اطلع على قائمة ${MenuState.restaurant?.name}`,
        url: window.location.href
    };
    
    if (navigator.share) {
        try {
            await navigator.share(shareData);
        } catch (e) {
            // User cancelled or share failed
            copyToClipboard(window.location.href);
        }
    } else {
        copyToClipboard(window.location.href);
    }
}

/**
 * Copy text to clipboard
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('تم نسخ الرابط!', 'success');
    } catch (e) {
        console.error('Failed to copy:', e);
    }
}

/**
 * Toggle favorites modal
 */
function toggleFavorites() {
    const modal = document.getElementById('favoritesModal');
    modal.classList.toggle('hidden');
    
    if (!modal.classList.contains('hidden')) {
        renderFavoritesList();
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = '';
    }
}

/**
 * Render favorites list
 */
function renderFavoritesList() {
    const container = document.getElementById('favoritesList');
    const emptyState = document.getElementById('favoritesEmpty');
    
    if (!container) return;
    
    const favoriteItems = MenuState.menu.items.filter(item => 
        MenuState.favorites.includes(item.id)
    );
    
    if (favoriteItems.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }
    
    if (emptyState) emptyState.classList.add('hidden');
    
    // Reuse the same card rendering logic
    renderItems(favoriteItems);
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'toastSlideUp 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Show/hide loading screen
 */
function showLoading(show) {
    const loadingScreen = document.getElementById('loadingScreen');
    const app = document.getElementById('app');
    
    if (show) {
        if (loadingScreen) loadingScreen.classList.remove('hidden');
        if (app) app.classList.add('hidden');
        MenuState.isLoading = true;
    } else {
        if (loadingScreen) loadingScreen.classList.add('hidden');
        if (app) app.classList.remove('hidden');
        MenuState.isLoading = false;
    }
}

/**
 * Register service worker for PWA
 */
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('SW registered:', registration.scope);
                })
                .catch(error => {
                    console.log('SW registration failed:', error);
                });
        });
    }
}

/**
 * Format price
 */
function formatPrice(price) {
    return `${Number(price).toLocaleString('ar-EG')} ج.م`;
}

// ==================== MOCK DATA FOR DEMO ====================

function getMockMenuData() {
    return {
        restaurant: {
            id: 'rest_demo_001',
            name: 'مطعم البركة',
            slug: 'matam-el-baraka',
            description: 'أشهى المأكولات الشرقية والغربية في مكان واحد',
            logo: '',
            coverImage: '',
            phone: '201558056568'
        },
        categories: [
            { id: 'appetizers', name: 'المقبلات' },
            { id: 'mains', name: 'أطباق رئيسية' },
            { id: 'grills', name: 'مشويات' },
            { id: 'drinks', name: 'مشروبات' },
            { id: 'desserts', name: 'حلويات' },
            { id: 'salads', name: 'سلطات' }
        ],
        items: [
            { id: 'item_1', name: 'بيتزا مارجريتا', description: 'صلصة طماطم، موزاريلا، ريحان طازج', price: 120, categoryId: 'mains', image: '', isPopular: true },
            { id: 'item_2', name: 'برجر لحم مضاعف', description: 'قطعتين لحم بقري، جبن، خضار طازج', price: 180, categoryId: 'mains', image: '', isPopular: true },
            { id: 'item_3', name: 'سلطة كيزر', description: 'خس، خيار، طماطم، صلصة كيزر خاصة', price: 45, categoryId: 'salads', image: '' },
            { id: 'item_4', name: 'سباغيتي بولونيز', description: 'سباغيتي بصلصة اللحم المفروم', price: 85, categoryId: 'mains', image: '' },
            { id: 'item_5', name: 'تشكن كريسبى', description: 'دجاج مقرمش مع صلصة الثوم', price: 95, categoryId: 'grills', image: '', isSpecial: true },
            { id: 'item_6', name: 'شيش طاووي', description: 'فراخ مشوية بالتوابل الشامية', price: 110, categoryId: 'grills', image: '' },
            { id: 'item_7', name: 'حمص بالطحينة', description: 'حمص مع طحينة وليمون وزيت زيتون', price: 35, categoryId: 'appetizers', image: '' },
            { id: 'item_8', name: 'فتة شاورما فراخ', description: 'خبز محمر، شاورما فراخ، صلصة ثوم', price: 65, categoryId: 'appetizers', image: '' },
            { id: 'item_9', name: 'عصير برتقال طازج', description: 'برتقال طازج مع سكر حسب الطلب', price: 25, categoryId: 'drinks', image: '' },
            { id: 'item_10', name: 'مهلبية', description: 'حلى مهلبية بالحليب والهيل', price: 35, categoryId: 'desserts', image: '' },
            { id: 'item_11', name: 'كنافة بالجبن', description: 'كنافة عربية بالجبن العكاوي', price: 55, categoryId: 'desserts', image: '', isPopular: true },
            { id: 'item_12', name: 'كولا كبيرة', description: 'مشروب غازي بارد', price: 15, categoryId: 'drinks', image: '' }
        ]
    };
}

// Export functions for global access
window.filterByCategory = filterByCategory;
window.openItemModal = openItemModal;
window.closeItemModal = closeItemModal;
window.toggleModalFavorite = toggleModalFavorite;
window.updateModalQuantity = updateModalQuantity;
window.addToCartFromModal = addToCartFromModal;
window.quickAddToCart = quickAddToCart;
window.toggleFavorite = toggleFavorite;
window.openCart = openCart;
window.closeCart = closeCart;
window.removeFromCart = removeFromCart;
window.updateCartQuantity = updateCartQuantity;
window.submitOrder = submitOrder;
window.shareMenu = shareMenu;
window.toggleFavorites = toggleFavorites;
