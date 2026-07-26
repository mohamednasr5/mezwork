/**
 * MezoMenu - Admin Dashboard Module
 * Restaurant management dashboard functionality
 */

// ========================================
// Configuration
// ========================================

const ADMIN_CONFIG = {
    // Cloudflare Workers API Base URL for admin panel
    API_BASE_URL: 'https://menu.nonm1724.workers.dev',
    
    // API Endpoints
    ENDPOINTS: {
        menu: '/api/menu',
        orders: '/api/orders',
        upload: '/api/upload',
        ai: '/api/ai'
    }
};

document.addEventListener('DOMContentLoaded', function() {
    initDashboard();
});

// ========================================
// Dashboard Initialization
// ========================================

function initDashboard() {
    // Check authentication
    if (!isAuthenticated() && !isDevMode()) {
        window.location.href = '../login.html';
        return;
    }

    // Initialize components
    initSidebar();
    initSearch();
    loadDashboardData();
    
    // Check for new user
    if (window.location.search.includes('new=true')) {
        showWelcomeModal();
    }
}

// ========================================
// Sidebar Navigation
// ========================================

function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menuToggle');
    const sidebarClose = document.getElementById('sidebarClose');
    const overlay = document.getElementById('sidebarOverlay');

    if (menuToggle) {
        menuToggle.addEventListener('click', () => toggleSidebar(true));
    }

    if (sidebarClose) {
        sidebarClose.addEventListener('click', () => toggleSidebar(false));
    }

    if (overlay) {
        overlay.addEventListener('click', () => toggleSidebar(false));
    }

    // Highlight current page
    highlightCurrentPage();
}

function toggleSidebar(open) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (open) {
        sidebar?.classList.add('open');
        overlay?.classList.add('active');
        document.body.style.overflow = 'hidden';
    } else {
        sidebar?.classList.remove('open');
        overlay?.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function highlightCurrentPage() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');

    navLinks.forEach(link => {
        link.parentElement.classList.remove('active');
        
        if (link.getAttribute('href') === currentPage) {
            link.parentElement.classList.add('active');
        }
    });
}

// ========================================
// Search Functionality
// ========================================

function initSearch() {
    const searchInput = document.querySelector('.search-box input');
    
    if (searchInput) {
        searchInput.addEventListener('input', debounce(function(e) {
            const query = e.target.value.trim();
            if (query.length >= 2) {
                performSearch(query);
            } else {
                hideSearchResults();
            }
        }, 300));
    }

    // Close search on outside click
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.search-box')) {
            hideSearchResults();
        }
    });
}

function performSearch(query) {
    const restaurantId = getRestaurantId();
    
    // Search in menu items
    fetchRestaurantData(restaurantId).then(data => {
        const items = data.menu?.items || [];
        const results = items.filter(item => 
            item.name?.includes(query) || 
            item.description?.includes(query)
        );
        
        displaySearchResults(results, query);
    });
}

function displaySearchResults(results, query) {
    let resultsContainer = document.querySelector('.search-results');
    
    if (!resultsContainer) {
        resultsContainer = document.createElement('div');
        resultsContainer.className = 'search-results';
        document.querySelector('.search-box').appendChild(resultsContainer);
    }

    if (results.length === 0) {
        resultsContainer.innerHTML = `
            <div class="search-result-item">
                <span>لا توجد نتائج لـ "${query}"</span>
            </div>
        `;
    } else {
        resultsContainer.innerHTML = results.map(item => `
            <a href="menu-editor.html?item=${item.id}" class="search-result-item">
                <span class="result-emoji">${item.emoji || '🍽️'}</span>
                <span class="result-name">${item.name}</span>
                <span class="result-price">${item.price} ج.م</span>
            </a>
        `).join('');
    }

    resultsContainer.style.display = 'block';
}

function hideSearchResults() {
    const resultsContainer = document.querySelector('.search-results');
    if (resultsContainer) {
        resultsContainer.style.display = 'none';
    }
}

// ========================================
// Load Dashboard Data
// ========================================

async function loadDashboardData() {
    const restaurantId = getRestaurantId();
    
    try {
        // Load restaurant data
        const restaurantData = await fetchRestaurantData(restaurantId);
        
        // Update UI with data
        updateStatsCards(restaurantData);
        updateRecentOrders(restaurantData);
        updatePopularItems(restaurantData);
        updateMenuLink(restaurantData);
        
        // Setup real-time listeners
        setupRealTimeListeners(restaurantId);
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showErrorMessage('حدث خطأ في تحميل البيانات');
    }
}

function updateStatsCards(data) {
    // Update revenue (mock calculation)
    const revenueEl = document.querySelector('.revenue-icon + .stat-content .stat-value');
    if (revenueEl) {
        revenueEl.textContent = formatCurrency(calculateTodayRevenue(data));
    }

    // Update orders count
    const ordersEl = document.querySelector('.orders-icon + .stat-content .stat-value');
    if (ordersEl) {
        ordersEl.textContent = calculateTodayOrders(data);
    }

    // Update menu items count
    const itemsEl = document.querySelector('.items-icon + .stat-content .stat-value');
    if (itemsEl) {
        const itemCount = data.menu?.items?.length || 0;
        itemsEl.textContent = itemCount;
    }
}

function updateRecentOrders(data) {
    const ordersList = document.querySelector('.orders-list');
    if (!ordersList || !data.orders) return;

    const recentOrders = Object.values(data.orders)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 5);

    if (recentOrders.length === 0) {
        ordersList.innerHTML = `
            <div class="empty-state">
                <span>📋</span>
                <p>لا توجد طلبات بعد</p>
            </div>
        `;
        return;
    }

    ordersList.innerHTML = recentOrders.map(order => `
        <div class="order-item" onclick="viewOrder('${order.id}')">
            <div class="order-info">
                <span class="order-id">${order.orderId || '#' + order.id.slice(-4)}</span>
                <span class="order-customer">${order.customerName || 'عميل'}</span>
            </div>
            <div class="order-details">
                <span class="order-items">${order.items?.length || 0} أصناف</span>
                <span class="order-total">${formatCurrency(order.total)}</span>
            </div>
            <span class="order-status ${getOrderStatusClass(order.status)}">
                ${getOrderStatusText(order.status)}
            </span>
        </div>
    `).join('');
}

function updatePopularItems(data) {
    const popularList = document.querySelector('.popular-list');
    if (!popularList || !data.menu?.items) return;

    const popularItems = [...data.menu.items]
        .filter(item => item.isPopular)
        .slice(0, 5);

    if (popularItems.length === 0) {
        // Show top items by mock order count
        const allItems = [...data.menu.items].slice(0, 5);
        popularList.innerHTML = allItems.map((item, index) => `
            <div class="popular-item">
                <div class="popular-rank">${index + 1}</div>
                <div class="popular-img">${item.emoji || '🍽️'}</div>
                <div class="popular-info">
                    <h4>${item.name}</h4>
                    <span>طلب شائع</span>
                </div>
                <span class="popular-price">${item.price} ج.م</span>
            </div>
        `).join('');
        return;
    }

    popularList.innerHTML = popularItems.map((item, index) => `
        <div class="popular-item">
            <div class="popular-rank">${index + 1}</div>
            <div class="popular-img">${item.emoji || '🍽️'}</div>
            <div class="popular-info">
                <h4>${item.name}</h4>
                <span>شائع جداً</span>
            </div>
            <span class="popular-price">${item.price} ج.م</span>
        </div>
    `).join('');
}

function updateMenuLink(data) {
    const linkInput = document.querySelector('.link-input-group input');
    if (linkInput && data.slug) {
        linkInput.value = `mezomenu.com/${data.slug}`;
    }
}

// ========================================
// Real-time Updates
// ========================================

function setupRealTimeListeners(restaurantId) {
    // Listen for new orders
    listenForNewOrders(restaurantId, (order) => {
        showNewOrderNotification(order);
        updateRecentOrders({ orders: [order] });
        
        // Play notification sound
        playNotificationSound();
    });

    // Listen for menu changes
    listenToMenuChanges(restaurantId, (menuData) => {
        console.log('Menu updated:', menuData);
    });
}

function showNewOrderNotification(order) {
    // Create notification toast
    const toast = document.createElement('div');
    toast.className = 'new-order-toast';
    toast.innerHTML = `
        <div class="toast-icon">🛒</div>
        <div class="toast-content">
            <strong>طلب جديد!</strong>
            <span>#${order.orderId || order.id} - ${formatCurrency(order.total)}</span>
        </div>
        <button onclick="this.parentElement.remove()" class="toast-close">×</button>
    `;

    toast.style.cssText = `
        position: fixed;
        top: 80px;
        left: 20px;
        right: 20px;
        max-width: 400px;
        margin-left: auto;
        background: white;
        border-radius: 12px;
        padding: 16px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 9999;
        animation: slideDown 0.3s ease;
        border-right: 4px solid #6366f1;
    `;

    document.body.appendChild(toast);

    // Auto remove after 5 seconds
    setTimeout(() => toast.remove(), 5000);

    // Update badge count
    updateOrderBadge();
}

function updateOrderBadge() {
    const badge = document.querySelector('.notification-badge');
    if (badge) {
        const currentCount = parseInt(badge.textContent) || 0;
        badge.textContent = currentCount + 1;
        badge.style.animation = 'pulse 0.5s ease';
    }
}

function playNotificationSound() {
    // Create a simple beep sound using Web Audio API
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
        console.log('Could not play sound');
    }
}

// ========================================
// Order Management
// ========================================

function viewOrder(orderId) {
    window.location.href = `orders.html?id=${orderId}`;
}

async function changeOrderStatus(orderId, newStatus) {
    const restaurantId = getRestaurantId();
    
    try {
        await updateOrderStatus(restaurantId, orderId, newStatus);
        showSuccessMessage(`تم تحديث حالة الطلب إلى ${getOrderStatusText(newStatus)}`);
    } catch (error) {
        showErrorMessage('فشل في تحديث حالة الطلب');
    }
}

function getOrderStatusClass(status) {
    const classes = {
        'new': 'new',
        'pending': 'pending',
        'preparing': 'preparing',
        'ready': 'ready',
        'completed': 'completed',
        'cancelled': 'cancelled'
    };
    return classes[status] || 'pending';
}

function getOrderStatusText(status) {
    const texts = {
        'new': 'جديد',
        'pending': 'قيد الانتظار',
        'preparing': 'قيد التحضير',
        'ready': 'جاهز للاستلام',
        'completed': 'تم التسليم',
        'cancelled': 'ملغي'
    };
    return texts[status] || status;
}

// ========================================
// Utility Functions
// ========================================

function formatCurrency(amount) {
    return new Intl.NumberFormat('ar-EG', {
        style: 'decimal',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount) + ' ج.م';
}

function calculateTodayRevenue(data) {
    // Mock calculation - in real app this would come from orders
    return Math.floor(Math.random() * 5000) + 1000;
}

function calculateTodayOrders(data) {
    // Mock calculation
    return Math.floor(Math.random() * 30) + 10;
}

function isDevMode() {
    return localStorage.getItem('mezomenu_dev_mode') === 'true';
}

function showWelcomeModal() {
    const modal = document.createElement('div');
    modal.className = 'welcome-modal';
    modal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-content">
            <div class="modal-header">
                <span class="modal-icon">🎉</span>
                <h2>مرحباً بك في MezoMenu!</h2>
            </div>
            <div class="modal-body">
                <p>تم إنشاء حسابك بنجاح! ابدأ الآن بإضافة قائمة مطعمك.</p>
                <ul class="getting-started-list">
                    <li>✅ أضف معلومات مطعمك الأساسية</li>
                    <li>✅ أنشئ أقسام القائمة</li>
                    <li>✅ أضف أصنافك أو استخدم AI لتحليل صورة</li>
                    <li>✅ شارك رابط قائمتك مع العملاء</li>
                </ul>
            </div>
            <div class="modal-footer">
                <button onclick="closeWelcomeModal()" class="btn btn-primary btn-lg">
                    ابدأ الآن
                </button>
            </div>
        </div>
    `;

    modal.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    // Add event listeners
    modal.querySelector('.modal-overlay').addEventListener('click', closeWelcomeModal);
}

function closeWelcomeModal() {
    const modal = document.querySelector('.welcome-modal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = '';
    }
    
    // Remove URL parameter
    if (window.history.replaceState) {
        window.history.replaceState({}, '', window.location.pathname);
    }
}

function copyLink() {
    const input = document.querySelector('.link-input-group input');
    if (input) {
        navigator.clipboard.writeText(input.value).then(() => {
            const btn = document.querySelector('.copy-btn');
            const originalText = btn.innerHTML;
            btn.innerHTML = '✅ تم النسخ!';
            setTimeout(() => btn.innerHTML = originalText, 2000);
        });
    }
}

function handleLogout() {
    if (confirm('هل تريد تسجيل الخروج؟')) {
        logoutUser();
    }
}

function showErrorMessage(message) {
    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.innerHTML = `❌ ${message}`;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #fee2e2;
        color: #dc2626;
        padding: 16px 24px;
        border-radius: 12px;
        font-weight: 600;
        box-shadow: 0 10px 25px rgba(220, 38, 38, 0.2);
        z-index: 9999;
        animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// Debounce helper
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

// Add additional styles
const adminStyles = document.createElement('style');
adminStyles.textContent = `
    @keyframes slideDown {
        from { transform: translateY(-20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }
    
    @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.2); }
    }
    
    .search-results {
        position: absolute;
        top: 100%;
        right: 0;
        left: 0;
        background: white;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        margin-top: 8px;
        max-height: 300px;
        overflow-y: auto;
        z-index: 100;
    }
    
    .search-result-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        cursor: pointer;
        transition: background 0.2s;
    }
    
    .search-result-item:hover {
        background: #f9fafb;
    }
    
    .result-emoji {
        font-size: 20px;
    }
    
    .result-name {
        flex: 1;
        font-weight: 500;
    }
    
    .result-price {
        color: #6366f1;
        font-weight: 600;
    }
    
    .empty-state {
        text-align: center;
        padding: 40px 20px;
        color: #9ca3af;
    }
    
    .empty-state span {
        font-size: 48px;
        display: block;
        margin-bottom: 8px;
    }
    
    .welcome-modal .modal-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0,0,0,0.5);
    }
    
    .welcome-modal .modal-content {
        position: relative;
        background: white;
        border-radius: 24px;
        max-width: 480px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
        animation: scaleIn 0.3s ease;
    }
    
    @keyframes scaleIn {
        from { transform: scale(0.95); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
    }
    
    .welcome-modal .modal-header {
        text-align: center;
        padding: 32px 24px 16px;
    }
    
    .modal-icon {
        font-size: 64px;
        display: block;
        margin-bottom: 16px;
    }
    
    .welcome-modal h2 {
        font-size: 24px;
        color: #111827;
    }
    
    .welcome-modal .modal-body {
        padding: 0 24px 24px;
    }
    
    .welcome-modal p {
        color: #6b7280;
        margin-bottom: 16px;
    }
    
    .getting-started-list {
        text-align: right;
    }
    
    .getting-started-list li {
        padding: 8px 0;
        color: #374151;
    }
    
    .welcome-modal .modal-footer {
        padding: 16px 24px 32px;
        text-align: center;
    }
`;
document.head.appendChild(adminStyles);
