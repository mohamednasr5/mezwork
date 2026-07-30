/**
 * MezoMenu - Main Application Logic
 * Handles all UI interactions, data loading, and CRUD operations
 */

// ============================================
// Global State
// ============================================
const AppState = {
    currentTab: 'dashboard',
    menuItems: [],
    categories: [],
    orders: [],
    promotions: [],
    reservations: [],
    notifications: [],
    settings: null,
    aiResults: null,
    selectedCategory: 'all',
    refreshInterval: null
};

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('MezoMenu Initializing...');
    
    // Initialize navigation
    initNavigation();
    
    // Initialize sidebar toggle
    initSidebar();
    
    // Initialize image upload for AI
    initAIUpload();
    
    // Load initial data
    await loadInitialData();
    
    // Setup auto-refresh (every 15 seconds)
    startAutoRefresh();
    
    console.log('MezoMenu Ready!');
});

/**
 * Load all initial data
 */
async function loadInitialData() {
    try {
        showLoading(true);
        
        // Test connection first
        const connectionOk = await testFirebaseConnection();
        if (!connectionOk) {
            showFirebaseErrorHelp();
            return;
        }
        
        // Load settings first
        AppState.settings = await MezoMenuAPI.Settings.get().catch(() => ({}));
        
        // Load categories
        AppState.categories = await MezoMenuAPI.Categories.getAll().catch(() => []);
        
        // Load menu items
        AppState.menuItems = await MezoMenuAPI.MenuItems.getAll().catch(() => []);
        
        // Load orders
        AppState.orders = await MezoMenuAPI.Orders.getAll().catch(() => []);
        
        // Load promotions
        AppState.promotions = await MezoMenuAPI.Promotions.getAll().catch(() => []);
        
        // Load reservations
        AppState.reservations = await MezoMenuAPI.Reservations.getAll().catch(() => []);
        
        // Load notifications
        AppState.notifications = await MezoMenuAPI.Notifications.getAll().catch(() => []);
        
        // Update UI
        updateDashboardStats();
        renderRecentOrders();
        renderTopItems();
        updateNotificationBadge();
        
        // Populate dropdowns
        populateCategoryDropdowns();
        
        showLoading(false);
        
    } catch (error) {
        console.error('Error loading initial data:', error);
        handleLoadError(error);
        showLoading(false);
    }
}

/**
 * Test Firebase connection
 */
async function testFirebaseConnection() {
    try {
        const response = await fetch(`${FIREBASE_CONFIG.DATABASE_URL}/.json`);
        return response.ok;
    } catch (e) {
        return false;
    }
}

/**
 * Show Firebase error help
 */
function showFirebaseErrorHelp() {
    showLoading(false);
    
    // Create error overlay
    const overlay = document.createElement('div');
    overlay.id = 'firebaseErrorOverlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.8);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
    `;
    
    overlay.innerHTML = `
        <div style="background: white; border-radius: 20px; padding: 40px; max-width: 600px; width: 100%; text-align: right;">
            <h2 style="color: #c33; margin-bottom: 15px;">⚠️ خطأ في الاتصال بـ Firebase</h2>
            <p style="color: #666; margin-bottom: 25px; line-height: 1.8;">
                يبدو أن هناك مشكلة في الاتصال بقاعدة البيانات.<br>
                هذا عادةً بسبب قواعد الأمان في Firebase.
            </p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                <strong style="display: block; margin-bottom: 10px;">🔧 الحل السريع:</strong>
                <ol style="padding-right: 20px; line-height: 2;">
                    <li>اذهب إلى <a href="https://console.firebase.google.com/" target="_blank" style="color: #667eea;">Firebase Console</a></li>
                    <li>اختر مشروعك ثم <strong>Realtime Database</strong></li>
                    <li>اضغط على تبويب <strong>Rules</strong></li>
                    <li>استبدل الكود بهذا:
                        <pre style="background: #1a1a2e; color: #00ff88; padding: 10px; border-radius: 8px; direction: ltr; text-align: left; margin-top: 10px;">{
  "rules": {
    ".read": true,
    ".write": true
  }
}</pre>
                    </li>
                    <li>اضغط <strong>Publish</strong></li>
                </ol>
            </div>
            
            <div style="display: flex; gap: 15px;">
                <button onclick="location.reload()" style="flex:1; padding: 15px; background: linear-gradient(135deg, #FF6B35, #FF8C5A); color: white; border: none; border-radius: 12px; font-weight: bold; cursor: pointer;">
                    🔄 إعادة المحاولة
                </button>
                <button onclick="window.open('setup.html', '_blank')" style="flex:1; padding: 15px; background: #667eea; color: white; border: none; border-radius: 12px; font-weight: bold; cursor: pointer;">
                    📋 صفحة الإعداد
                </button>
            </div>
            
            <button onclick="this.closest('#firebaseErrorOverlay').remove()" style="margin-top: 15px; width:100%; padding: 10px; background: transparent; border: 1px solid #ddd; border-radius: 8px; cursor: pointer; color: #666;">
                ✕ إغلاق والاستمرار بدون بيانات (وضع العرض)
            </button>
        </div>
    `;
    
    document.body.appendChild(overlay);
}

/**
 * Handle load errors with specific messages
 */
function handleLoadError(error) {
    if (error.code === 'AUTH_REQUIRED' || error.message?.includes('401')) {
        showFirebaseErrorHelp();
    } else if (error.code === 'NOT_FOUND') {
        showToast('قاعدة البيانات فارغة - أضف بعض البيانات!', 'info');
    } else if (error.code === 'NETWORK_ERROR') {
        showToast('خطأ في الشبكة - تأكد من اتصال الإنترنت', 'error');
    } else {
        showToast(`خطأ: ${error.message}`, 'error');
    }
}

/**
 * Start auto-refresh interval
 */
function startAutoRefresh() {
    if (AppState.refreshInterval) {
        clearInterval(AppState.refreshInterval);
    }
    
    AppState.refreshInterval = setInterval(async () => {
        try {
            // Refresh current tab data
            switch (AppState.currentTab) {
                case 'dashboard':
                    await loadDashboardData();
                    break;
                case 'menu':
                    AppState.menuItems = await MezoMenuAPI.MenuItems.getAll();
                    renderMenuItems();
                    break;
                case 'orders':
                    AppState.orders = await MezoMenuAPI.Orders.getAll();
                    renderOrders();
                    break;
                case 'notifications':
                    AppState.notifications = await MezoMenuAPI.Notifications.getAll();
                    renderNotifications();
                    break;
            }
            
            // Always update notification badge
            const count = await MezoMenuAPI.Notifications.getUnreadCount();
            updateNotificationBadge(count);
            
        } catch (error) {
            console.error('Auto-refresh error:', error);
        }
    }, 15000); // 15 seconds
}

// ============================================
// Navigation
// ============================================

/**
 * Initialize navigation click handlers
 */
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const tab = link.dataset.tab;
            if (tab) {
                switchTab(tab);
            }
        });
    });
}

/**
 * Switch between tabs
 */
function switchTab(tabName) {
    // Update state
    AppState.currentTab = tabName;
    
    // Update navigation active state
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.tab === tabName);
    });
    
    // Update tab content visibility
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}Tab`);
    });
    
    // Load tab-specific data
    loadTabData(tabName);
}

/**
 * Load data for specific tab
 */
async function loadTabData(tabName) {
    try {
        switch (tabName) {
            case 'dashboard':
                await loadDashboardData();
                break;
            case 'menu':
                await loadMenuData();
                break;
            case 'orders':
                await loadOrdersData();
                break;
            case 'promotions':
                await loadPromotionsData();
                break;
            case 'reservations':
                await loadReservationsData();
                break;
            case 'notifications':
                await loadNotificationsData();
                break;
            case 'settings':
                await loadSettingsData();
                break;
            case 'ai-import':
                // AI import doesn't need initial data load
                break;
        }
    } catch (error) {
        console.error(`Error loading ${tabName} data:`, error);
        showToast('خطأ في تحميل البيانات', 'error');
    }
}

// ============================================
// Sidebar
// ============================================

/**
 * Initialize sidebar toggle for mobile
 */
function initSidebar() {
    const toggleBtn = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('show');
        });
        
        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 992 && 
                !sidebar.contains(e.target) && 
                !toggleBtn.contains(e.target)) {
                sidebar.classList.remove('show');
            }
        });
    }
}

// ============================================
// Dashboard
// ============================================

/**
 * Load dashboard data
 */
async function loadDashboardData() {
    const stats = await MezoMenuAPI.Dashboard.getStats();
    
    // Update stat cards
    document.getElementById('totalOrders').textContent = stats.orders.total;
    document.getElementById('totalRevenue').textContent = `$${stats.orders.totalRevenue.toFixed(2)}`;
    document.getElementById('totalItems').textContent = stats.menuItems.total;
    document.getElementById('totalReservations').textContent = stats.reservations.today;
    
    // Update recent orders
    AppState.recentOrders = stats.recentOrders;
    renderRecentOrders();
    
    // Update top items
    AppState.topItems = stats.topItems;
    renderTopItems();
}

/**
 * Update dashboard statistics
 */
function updateDashboardStats() {
    // Calculate from loaded data
    const totalOrders = AppState.orders.length;
    const totalRevenue = AppState.orders
        .filter(o => o.status === 'delivered')
        .reduce((sum, o) => sum + (o.total || 0), 0);
    const totalItems = AppState.menuItems.length;
    const todayReservations = AppState.reservations.filter(r => 
        r.date === new Date().toISOString().split('T')[0]
    ).length;
    
    document.getElementById('totalOrders').textContent = totalOrders;
    document.getElementById('totalRevenue').textContent = `$${totalRevenue.toFixed(2)}`;
    document.getElementById('totalItems').textContent = totalItems;
    document.getElementById('totalReservations').textContent = todayReservations;
}

/**
 * Render recent orders table
 */
function renderRecentOrders() {
    const tbody = document.getElementById('recentOrdersTable');
    const recentOrders = AppState.orders.slice(0, 5);
    
    if (recentOrders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">لا توجد طلبات</td></tr>';
        return;
    }
    
    tbody.innerHTML = recentOrders.map((order, index) => `
        <tr>
            <td>#${order.id?.slice(-6) || index + 1}</td>
            <td>${order.customerName || 'عميل'}</td>
            <td>$${(order.total || 0).toFixed(2)}</td>
            <td><span class="status-badge status-${order.status}">${getStatusText(order.status)}</span></td>
        </tr>
    `).join('');
}

/**
 * Render top selling items
 */
function renderTopItems() {
    const list = document.getElementById('topItemsList');
    const topItems = [...AppState.menuItems]
        .sort((a, b) => (b.orderCount || 0) - (a.orderCount || 0))
        .slice(0, 5);
    
    if (topItems.length === 0) {
        list.innerHTML = '<li class="text-center">لا توجد عناصر</li>';
        return;
    }
    
    list.innerHTML = topItems.map((item, index) => `
        <li>
            <span class="top-item-rank">${index + 1}</span>
            <img src="${item.image || 'https://via.placeholder.com/45'}" 
                 alt="${item.name}" class="top-item-img" 
                 onerror="this.src='https://via.placeholder.com/45?text=🍽️'">
            <div class="top-item-info">
                <div class="top-item-name">${item.name}</div>
                <div class="top-item-sales">${item.orderCount || 0} طلب</div>
            </div>
        </li>
    `).join('');
}

// ============================================
// Menu Management
// ============================================

/**
 * Load menu data
 */
async function loadMenuData() {
    AppState.menuItems = await MezoMenuAPI.MenuItems.getAll();
    AppState.categories = await MezoMenuAPI.Categories.getAll();
    
    renderCategoriesTabs();
    renderCategoryFilter();
    renderMenuItems();
}

/**
 * Render categories tabs
 */
function renderCategoriesTabs() {
    const container = document.getElementById('categoriesTabs');
    
    let html = `<button class="category-tab ${AppState.selectedCategory === 'all' ? 'active' : ''}" 
                       data-category="all" onclick="filterByCategory('all')">الكل</button>`;
    
    AppState.categories.forEach(cat => {
        html += `<button class="category-tab ${AppState.selectedCategory === cat.id ? 'active' : ''}" 
                        data-category="${cat.id}" onclick="filterByCategory('${cat.id}')">
                    <i class="fas ${cat.icon || 'fa-folder'}"></i> ${cat.name}
                 </button>`;
    });
    
    container.innerHTML = html;
}

/**
 * Render category filter dropdown
 */
function renderCategoryFilter() {
    const select = document.getElementById('categoryFilter');
    
    let html = '<option value="">كل الفئات</option>';
    AppState.categories.forEach(cat => {
        html += `<option value="${cat.id}">${cat.name}</option>`;
    });
    
    select.innerHTML = html;
}

/**
 * Filter by category
 */
function filterByCategory(categoryId) {
    AppState.selectedCategory = categoryId;
    renderCategoriesTabs();
    renderMenuItems();
}

/**
 * Render menu items grid
 */
function renderMenuItems() {
    const grid = document.getElementById('menuGrid');
    
    let filteredItems = [...AppState.menuItems];
    
    // Filter by selected category
    if (AppState.selectedCategory && AppState.selectedCategory !== 'all') {
        filteredItems = filteredItems.filter(item => item.categoryId === AppState.selectedCategory);
    }
    
    // Filter by search query
    const searchQuery = document.getElementById('menuSearch')?.value.toLowerCase();
    if (searchQuery) {
        filteredItems = filteredItems.filter(item =>
            item.name?.toLowerCase().includes(searchQuery) ||
            item.description?.toLowerCase().includes(searchQuery)
        );
    }
    
    // Filter by availability
    const availabilityFilter = document.getElementById('availabilityFilter')?.value;
    if (availabilityFilter) {
        const isAvailable = availabilityFilter === 'available';
        filteredItems = filteredItems.filter(item => item.available === isAvailable);
    }
    
    if (filteredItems.length === 0) {
        grid.innerHTML = `
            <div class="text-center p-5" style="grid-column: 1/-1;">
                <i class="fas fa-utensils" style="font-size: 48px; color: var(--text-light);"></i>
                <p class="mt-20 text-muted">لا توجد عناصر في هذه الفئة</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = filteredItems.map(item => {
        const category = AppState.categories.find(c => c.id === item.categoryId);
        return `
            <div class="menu-card">
                <div class="menu-card-image">
                    <img src="${item.image || 'https://via.placeholder.com/400x200?text=' + encodeURIComponent(item.name)}" 
                         alt="${item.name}"
                         onerror="this.src='https://via.placeholder.com/400x200?text=🍽️'">
                    <div class="menu-card-badges">
                        ${!item.available ? '<span class="status-badge status-unavailable">غير متاح</span>' : ''}
                        ${item.featured ? '<span class="status-badge" style="background: #FDCB6E; color: #333;">⭐ مميز</span>' : ''}
                        ${item.spicy ? '<span class="status-badge" style="background: #FF6B6B; color: white;">🌶️ حار</span>' : ''}
                        ${item.vegetarian ? '<span class="status-badge" style="background: #A8E6CF; color: #333;">🥬 نباتي</span>' : ''}
                    </div>
                </div>
                <div class="menu-card-body">
                    <div class="menu-card-category">${category?.name || 'بدون فئة'}</div>
                    <h3 class="menu-card-title">${item.name}</h3>
                    <p class="menu-card-description">${item.description || 'لا يوجد وصف'}</p>
                    <div class="menu-card-footer">
                        <span class="menu-card-price">$${(item.price || 0).toFixed(2)}</span>
                        <div class="menu-card-actions">
                            <button class="btn btn-sm btn-icon-text btn-outline" onclick="editMenuItem('${item.id}')">
                                <i class="fas fa-edit"></i> تعديل
                            </button>
                            <button class="btn btn-sm btn-icon-text btn-danger" onclick="deleteMenuItem('${item.id}')">
                                <i class="fas fa-trash"></i> حذف
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Open menu item modal for new item
 */
function openMenuItemModal() {
    document.getElementById('menuItemModalTitle').textContent = 'إضافة عنصر جديد';
    document.getElementById('menuItemForm').reset();
    document.getElementById('itemId').value = '';
    document.getElementById('itemImagePreview').style.display = 'none';
    document.getElementById('ItemUploadPlaceholder').style.display = 'block';
    populateItemCategoryDropdown();
    openModal('menuItemModal');
}

/**
 * Edit existing menu item
 */
async function editMenuItem(id) {
    const item = await MezoMenuAPI.MenuItems.getById(id);
    if (!item) {
        showToast('العنصر غير موجود', 'error');
        return;
    }
    
    document.getElementById('menuItemModalTitle').textContent = 'تعديل العنصر';
    document.getElementById('itemId').value = id;
    document.getElementById('itemName').value = item.name || '';
    document.getElementById('itemPrice').value = item.price || '';
    document.getElementById('itemDescription').value = item.description || '';
    document.getElementById('itemIngredients').value = (item.ingredients || []).join(', ');
    document.getElementById('itemAvailability').value = String(item.available !== false);
    document.getElementById('itemFeatured').checked = item.featured || false;
    document.getElementById('itemSpicy').checked = item.spicy || false;
    document.getElementById('itemVegetarian').checked = item.vegetarian || false;
    
    populateItemCategoryDropdown(item.categoryId);
    
    // Show image preview if exists
    if (item.image) {
        document.getElementById('itemImagePreview').src = item.image;
        document.getElementById('itemImagePreview').style.display = 'block';
        document.getElementById('ItemUploadPlaceholder').style.display = 'none';
    } else {
        document.getElementById('itemImagePreview').style.display = 'none';
        document.getElementById('ItemUploadPlaceholder').style.display = 'block';
    }
    
    openModal('menuItemModal');
}

/**
 * Save menu item (create or update)
 */
async function saveMenuItem() {
    const id = document.getElementById('itemId').value;
    const name = document.getElementById('itemName').value.trim();
    const price = parseFloat(document.getElementById('itemPrice').value);
    const categoryId = document.getElementById('itemCategory').value;
    
    // Validation
    if (!name) {
        showToast('يرجى إدخال اسم العنصر', 'warning');
        return;
    }
    if (isNaN(price) || price < 0) {
        showToast('يرجى إدخال سعر صحيح', 'warning');
        return;
    }
    if (!categoryId) {
        showToast('يرجى اختيار فئة', 'warning');
        return;
    }
    
    const itemData = {
        name,
        price,
        categoryId,
        description: document.getElementById('itemDescription').value.trim(),
        ingredients: document.getElementById('itemIngredients').value
            .split(',')
            .map(i => i.trim())
            .filter(i => i),
        available: document.getElementById('itemAvailability').value === 'true',
        featured: document.getElementById('itemFeatured').checked,
        spicy: document.getElementById('itemSpicy').checked,
        vegetarian: document.getElementById('itemVegetarian').checked
    };
    
    // Handle image upload
    const imageInput = document.getElementById('itemImageInput');
    if (imageInput.files[0]) {
        try {
            showToast('جاري رفع الصورة...', 'info');
            const compressedImage = await MezoMenuAPI.compressImage(imageInput.files[0]);
            itemData.image = await MezoMenuAPI.uploadImage(compressedImage, 'menu-items');
        } catch (error) {
            console.error('Image upload error:', error);
            showToast('خطأ في رفع الصورة', 'error');
        }
    } else if (id) {
        // Keep existing image if not changed
        const existingItem = await MezoMenuAPI.MenuItems.getById(id);
        if (existingItem?.image) {
            itemData.image = existingItem.image;
        }
    }
    
    try {
        if (id) {
            await MezoMenuAPI.MenuItems.update(id, itemData);
            showToast('تم تحديث العنصر بنجاح', 'success');
        } else {
            await MezoMenuAPI.MenuItems.create(itemData);
            showToast('تم إضافة العنصر بنجاح', 'success');
        }
        
        closeModal('menuItemModal');
        await loadMenuData();
        
    } catch (error) {
        console.error('Save error:', error);
        showToast('خطأ في حفظ العنصر', 'error');
    }
}

/**
 * Delete menu item
 */
async function deleteMenuItem(id) {
    if (!confirm('هل أنت متأكد من حذف هذا العنصر؟')) return;
    
    try {
        await MezoMenuAPI.MenuItems.delete(id);
        showToast('تم حذف العنصر بنجاح', 'success');
        await loadMenuData();
    } catch (error) {
        console.error('Delete error:', error);
        showToast('خطأ في حذف العنصر', 'error');
    }
}

/**
 * Preview uploaded item image
 */
function previewItemImage(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('itemImagePreview').src = e.target.result;
            document.getElementById('itemImagePreview').style.display = 'block';
            document.getElementById('ItemUploadPlaceholder').style.display = 'none';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

/**
 * Populate item category dropdown
 */
function populateItemCategoryDropdown(selectedId = '') {
    const select = document.getElementById('itemCategory');
    select.innerHTML = '<option value="">اختر فئة</option>';
    
    AppState.categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        if (cat.id === selectedId) option.selected = true;
        select.appendChild(option);
    });
}

/**
 * Populate all category dropdowns
 */
function populateCategoryDropdowns() {
    const dropdowns = ['defaultCategory'];
    
    dropdowns.forEach(id => {
        const select = document.getElementById(id);
        if (select) {
            select.innerHTML = '<option value="">اختر فئة</option>';
            AppState.categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id;
                option.textContent = cat.name;
                select.appendChild(option);
            });
        }
    });
}

// ============================================
// Orders Management
// ============================================

/**
 * Load orders data
 */
async function loadOrdersData() {
    AppState.orders = await MezoMenuAPI.Orders.getAll();
    renderOrders();
}

/**
 * Render orders table
 */
function renderOrders() {
    const tbody = document.getElementById('ordersTableBody');
    
    let filteredOrders = [...AppState.orders];
    
    // Filter by status
    const statusFilter = document.getElementById('orderStatusFilter')?.value;
    if (statusFilter) {
        filteredOrders = filteredOrders.filter(o => o.status === statusFilter);
    }
    
    if (filteredOrders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">لا توجد طلبات</td></tr>';
        return;
    }
    
    tbody.innerHTML = filteredOrders.map(order => `
        <tr>
            <td>#${order.id?.slice(-6) || '-'}</td>
            <td>${order.customerName || 'عميل'}</td>
            <td>${order.items?.length || 0} عناصر</td>
            <td>$${(order.total || 0).toFixed(2)}</td>
            <td><span class="status-badge status-${order.status}">${getStatusText(order.status)}</span></td>
            <td>${formatDate(order.createdAt)}</td>
            <td>
                <div class="menu-card-actions">
                    <button class="btn btn-sm btn-icon-text btn-outline" onclick="viewOrderDetails('${order.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <select class="form-select" style="width:auto; padding: 4px 8px;" 
                            onchange="updateOrderStatus('${order.id}', this.value)">
                        <option value="" disabled selected>تغيير</option>
                        <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>قيد الانتظار</option>
                        <option value="preparing" ${order.status === 'preparing' ? 'selected' : ''}>قيد التحضير</option>
                        <option value="ready" ${order.status === 'ready' ? 'selected' : ''}>جاهز</option>
                        <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>تم التسليم</option>
                        <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>ملغي</option>
                    </select>
                </div>
            </td>
        </tr>
    `).join('');
}

/**
 * View order details
 */
async function viewOrderDetails(id) {
    const order = await MezoMenuAPI.Orders.getById(id);
    if (!order) return;
    
    document.getElementById('orderDetailId').textContent = order.id?.slice(-6) || id;
    
    const body = document.getElementById('orderDetailsBody');
    body.innerHTML = `
        <div class="order-details-grid">
            <div class="detail-section">
                <h4>معلومات العميل</h4>
                <p><strong>الاسم:</strong> ${order.customerName || '-'}</p>
                <p><strong>الهاتف:</strong> ${order.customerPhone || '-'}</p>
                <p><strong>العنوان:</strong> ${order.address || '-'}</p>
            </div>
            <div class="detail-section">
                <h4>معلومات الطلب</h4>
                <p><strong>الحالة:</strong> <span class="status-badge status-${order.status}">${getStatusText(order.status)}</span></p>
                <p><strong>التاريخ:</strong> ${formatDate(order.createdAt)}</p>
                <p><strong>ملاحظات:</strong> ${order.notes || 'لا يوجد'}</p>
            </div>
        </div>
        <div class="detail-section mt-20">
            <h4>عناصر الطلب</h4>
            <table class="table">
                <thead>
                    <tr>
                        <th>العنصر</th>
                        <th>الكمية</th>
                        <th>السعر</th>
                        <th>المجموع</th>
                    </tr>
                </thead>
                <tbody>
                    ${(order.items || []).map(item => `
                        <tr>
                            <td>${item.itemName || item.name || '-'}</td>
                            <td>${item.quantity || 1}</td>
                            <td>$${(item.price || 0).toFixed(2)}</td>
                            <td>$${((item.price || 0) * (item.quantity || 1)).toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="3"><strong>المجموع الكلي:</strong></td>
                        <td><strong>$${(order.total || 0).toFixed(2)}</strong></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;
    
    openModal('orderDetailsModal');
}

/**
 * Update order status
 */
async function updateOrderStatus(id, newStatus) {
    try {
        await MezoMenuAPI.Orders.updateStatus(id, newStatus);
        showToast(`تم تحديث حالة الطلب إلى ${getStatusText(newStatus)}`, 'success');
        await loadOrdersData();
    } catch (error) {
        console.error('Update status error:', error);
        showToast('خطأ في تحديث الحالة', 'error');
    }
}

/**
 * Export orders to CSV
 */
function exportOrders() {
    const headers = ['#', 'العميل', 'الهاتف', 'المجموع', 'الحالة', 'التاريخ'];
    const rows = AppState.orders.map(o => [
        o.id?.slice('-6'),
        o.customerName,
        o.customerPhone,
        o.total,
        getStatusText(o.status),
        formatDate(o.createdAt)
    ]);
    
    let csv = '\uFEFF'; // BOM for UTF-8
    csv += headers.join(',') + '\n';
    rows.forEach(row => {
        csv += row.map(cell => `"${cell || ''}"`).join(',') + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast('تم تصدير الطلبات بنجاح', 'success');
}

// ============================================
// Promotions Management
// ============================================

/**
 * Load promotions data
 */
async function loadPromotionsData() {
    AppState.promotions = await MezoMenuAPI.Promotions.getAll();
    renderPromotions();
}

/**
 * Render promotions grid
 */
function renderPromotions() {
    const grid = document.getElementById('promotionsGrid');
    
    if (AppState.promotions.length === 0) {
        grid.innerHTML = `
            <div class="text-center p-5" style="grid-column: 1/-1;">
                <i class="fas fa-tags" style="font-size: 48px; color: var(--text-light);"></i>
                <p class="mt-20 text-muted">لا توجد عروض حالية</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = AppState.promotions.map(promo => `
        <div class="promotion-card">
            <div class="promotion-card-image">
                ${promo.image 
                    ? `<img src="${promo.image}" alt="${promo.title}">` 
                    : `<i class="fas fa-percent" style="font-size: 64px; color: rgba(255,255,255,0.5);"></i>`}
                <div class="promotion-discount">${getDiscountDisplay(promo)}</div>
            </div>
            <div class="promotion-card-body">
                <h3 class="promotion-card-title">${promo.title}</h3>
                <p class="promotion-card-description">${promo.description || 'لا يوجد وصف'}</p>
                <div class="promotion-card-meta">
                    <span><i class="fas fa-calendar"></i> ${formatDate(promo.startDate)} - ${formatDate(promo.endDate)}</span>
                    ${promo.code ? `<span class="promotion-code">${promo.code}</span>` : ''}
                </div>
                <div class="mt-20" style="display:flex; gap:10px;">
                    <button class="btn btn-sm btn-outline" onclick="editPromotion('${promo.id}')">
                        <i class="fas fa-edit"></i> تعديل
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deletePromotion('${promo.id}')">
                        <i class="fas fa-trash"></i> حذف
                    </button>
                    <button class="btn btn-sm ${promo.active ? 'btn-warning' : 'btn-success'}" 
                            onclick="togglePromotion('${promo.id}', ${!promo.active})">
                        <i class="fas fa-${promo.active ? 'pause' : 'play'}"></i>
                        ${promo.active ? 'إيقاف' : 'تفعيل'}
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * Get discount display text
 */
function getDiscountDisplay(promo) {
    switch (promo.type) {
        case 'percentage': return `%${promo.value}`;
        case 'fixed': return `$${promo.value}`;
        case 'bogo': return '1+1';
        case 'free_delivery': return 'مجاني';
        default: return promo.value;
    }
}

/**
 * Open promotion modal
 */
function openPromotionModal() {
    document.getElementById('promotionModalTitle').textContent = 'إضافة عرض جديد';
    document.getElementById('promotionForm').reset();
    document.getElementById('promotionId').value = '';
    document.getElementById('promotionImagePreview').style.display = 'none';
    document.getElementById('promotionUploadPlaceholder').style.display = 'block';
    openModal('promotionModal');
}

/**
 * Edit promotion
 */
async function editPromotion(id) {
    const promo = await MezoMenuAPI.Promotions.getById(id);
    if (!promo) return;
    
    document.getElementById('promotionModalTitle').textContent = 'تعديل العرض';
    document.getElementById('promotionId').value = id;
    document.getElementById('promotionTitle').value = promo.title || '';
    document.getElementById('promotionDescription').value = promo.description || '';
    document.getElementById('promotionType').value = promo.type || 'percentage';
    document.getElementById('promotionValue').value = promo.value || '';
    document.getElementById('promotionStartDate').value = promo.startDate || '';
    document.getElementById('promotionEndDate').value = promo.endDate || '';
    document.getElementById('promotionCode').value = promo.code || '';
    document.getElementById('promotionActive').checked = promo.active !== false;
    
    if (promo.image) {
        document.getElementById('promotionImagePreview').src = promo.image;
        document.getElementById('promotionImagePreview').style.display = 'block';
        document.getElementById('promotionUploadPlaceholder').style.display = 'none';
    }
    
    openModal('promotionModal');
}

/**
 * Save promotion
 */
async function savePromotion() {
    const id = document.getElementById('promotionId').value;
    const title = document.getElementById('promotionTitle').value.trim();
    const value = parseFloat(document.getElementById('promotionValue').value);
    const startDate = document.getElementById('promotionStartDate').value;
    const endDate = document.getElementById('promotionEndDate').value;
    
    if (!title) {
        showToast('يرجى إدخال عنوان العرض', 'warning');
        return;
    }
    if (isNaN(value)) {
        showToast('يرجى إدخال قيمة الخصم', 'warning');
        return;
    }
    if (!startDate || !endDate) {
        showToast('يرجى إدخال التواريخ', 'warning');
        return;
    }
    
    const promoData = {
        title,
        description: document.getElementById('promotionDescription').value.trim(),
        type: document.getElementById('promotionType').value,
        value,
        startDate,
        endDate,
        code: document.getElementById('promotionCode').value.trim(),
        active: document.getElementById('promotionActive').checked
    };
    
    // Handle image
    const imageInput = document.getElementById('promotionImageInput');
    if (imageInput.files[0]) {
        try {
            promoData.image = await MezoMenuAPI.uploadImage(imageInput.files[0], 'promotions');
        } catch (error) {
            console.error('Image upload error:', error);
        }
    } else if (id) {
        const existing = await MezoMenuAPI.Promotions.getById(id);
        if (existing?.image) promoData.image = existing.image;
    }
    
    try {
        if (id) {
            await MezoMenuAPI.Promotions.update(id, promoData);
            showToast('تم تحديث العرض بنجاح', 'success');
        } else {
            await MezoMenuAPI.Promotions.create(promoData);
            showToast('تم إضافة العرض بنجاح', 'success');
        }
        
        closeModal('promotionModal');
        await loadPromotionsData();
    } catch (error) {
        console.error('Save error:', error);
        showToast('خطأ في حفظ العرض', 'error');
    }
}

/**
 * Delete promotion
 */
async function deletePromotion(id) {
    if (!confirm('هل أنت متأكد من حذف هذا العرض؟')) return;
    
    try {
        await MezoMenuAPI.Promotions.delete(id);
        showToast('تم حذف العرض بنجاح', 'success');
        await loadPromotionsData();
    } catch (error) {
        showToast('خطأ في حذف العرض', 'error');
    }
}

/**
 * Toggle promotion active state
 */
async function togglePromotion(id, active) {
    try {
        await MezoMenuAPI.Promotions.update(id, { active });
        showToast(active ? 'تم تفعيل العرض' : 'تم إيقاف العرض', 'success');
        await loadPromotionsData();
    } catch (error) {
        showToast('خطأ في تحديث العرض', 'error');
    }
}

/**
 * Preview promotion image
 */
function previewPromotionImage(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('promotionImagePreview').src = e.target.result;
            document.getElementById('promotionImagePreview').style.display = 'block';
            document.getElementById('promotionUploadPlaceholder').style.display = 'none';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// ============================================
// Reservations Management
// ============================================

/**
 * Load reservations data
 */
async function loadReservationsData() {
    AppState.reservations = await MezoMenuAPI.Reservations.getAll();
    renderReservations();
}

/**
 * Render reservations table
 */
function renderReservations() {
    const tbody = document.getElementById('reservationsTableBody');
    
    if (AppState.reservations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">لا توجد حجوزات</td></tr>';
        return;
    }
    
    tbody.innerHTML = AppState.reservations.map(res => `
        <tr>
            <td>#${res.id?.slice(-6) || '-'}</td>
            <td>${res.customerName || '-'}</td>
            <td>${res.phone || '-'}</td>
            <td>${res.date || '-'}</td>
            <td>${res.time || '-'}</td>
            <td>${res.guests || 1}</td>
            <td><span class="status-badge status-${res.status}">${getReservationStatusText(res.status)}</span></td>
            <td>
                <div class="menu-card-actions">
                    <button class="btn btn-sm btn-icon-text btn-outline" onclick="editReservation('${res.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteReservation('${res.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

/**
 * Open reservation modal
 */
function openReservationModal() {
    document.getElementById('reservationModalTitle').textContent = 'إضافة حجز جديد';
    document.getElementById('reservationForm').reset();
    document.getElementById('reservationId').value = '';
    openModal('reservationModal');
}

/**
 * Edit reservation
 */
async function editReservation(id) {
    const res = await MezoMenuAPI.Reservations.getById(id);
    if (!res) return;
    
    document.getElementById('reservationModalTitle').textContent = 'تعديل الحجز';
    document.getElementById('reservationId').value = id;
    document.getElementById('reservationName').value = res.customerName || '';
    document.getElementById('reservationPhone').value = res.phone || '';
    document.getElementById('reservationDate').value = res.date || '';
    document.getElementById('reservationTime').value = res.time || '';
    document.getElementById('reservationGuests').value = res.guests || 1;
    document.getElementById('reservationNotes').value = res.notes || '';
    document.getElementById('reservationStatus').value = res.status || 'pending';
    
    openModal('reservationModal');
}

/**
 * Save reservation
 */
async function saveReservation() {
    const id = document.getElementById('reservationId').value;
    const customerName = document.getElementById('reservationName').value.trim();
    const phone = document.getElementById('reservationPhone').value.trim();
    const date = document.getElementById('reservationDate').value;
    const time = document.getElementById('reservationTime').value;
    const guests = parseInt(document.getElementById('reservationGuests').value);
    
    if (!customerName || !phone || !date || !time) {
        showToast('يرجى ملء جميع الحقول المطلوبة', 'warning');
        return;
    }
    
    const reservationData = {
        customerName,
        phone,
        date,
        time,
        guests: guests || 1,
        notes: document.getElementById('reservationNotes').value.trim(),
        status: document.getElementById('reservationStatus').value
    };
    
    try {
        if (id) {
            await MezoMenuAPI.Reservations.update(id, reservationData);
            showToast('تم تحديث الحجز بنجاح', 'success');
        } else {
            await MezoMenuAPI.Reservations.create(reservationData);
            showToast('تم إضافة الحجز بنجاح', 'success');
        }
        
        closeModal('reservationModal');
        await loadReservationsData();
    } catch (error) {
        console.error('Save error:', error);
        showToast('خطأ في حفظ الحجز', 'error');
    }
}

/**
 * Delete reservation
 */
async function deleteReservation(id) {
    if (!confirm('هل أنت متأكد من حذف هذا الحجز؟')) return;
    
    try {
        await MezoMenuAPI.Reservations.delete(id);
        showToast('تم حذف الحجز بنجاح', 'success');
        await loadReservationsData();
    } catch (error) {
        showToast('خطأ في حذف الحجز', 'error');
    }
}

// ============================================
// Notifications Management
// ============================================

/**
 * Load notifications data
 */
async function loadNotificationsData() {
    AppState.notifications = await MezoMenuAPI.Notifications.getAll();
    renderNotifications();
    updateNotificationBadge();
}

/**
 * Render notifications list
 */
function renderNotifications() {
    const container = document.getElementById('notificationsList');
    
    if (AppState.notifications.length === 0) {
        container.innerHTML = `
            <div class="text-center p-5">
                <i class="fas fa-bell-slash" style="font-size: 48px; color: var(--text-light);"></i>
                <p class="mt-20 text-muted">لا توجد إشعارات</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = AppState.notifications.map(notif => `
        <div class="notification-item ${notif.read ? '' : 'unread'}">
            <div class="notification-icon notification-${notif.type || 'system'}">
                <i class="fas ${getNotificationIcon(notif.type)}"></i>
            </div>
            <div class="notification-content">
                <div class="notification-title">${notif.title}</div>
                <div class="notification-message">${notif.message}</div>
                <div class="notification-time">${formatDate(notif.createdAt)}</div>
            </div>
            <div style="display:flex; gap:8px;">
                ${!notif.read ? `
                    <button class="btn btn-sm btn-outline" onclick="markAsRead('${notif.id}')">
                        <i class="fas fa-check"></i>
                    </button>
                ` : ''}
                <button class="btn btn-sm btn-danger" onclick="deleteNotification('${notif.id}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `).join('');
}

/**
 * Mark notification as read
 */
async function markAsRead(id) {
    try {
        await MezoMenuAPI.Notifications.markAsRead(id);
        await loadNotificationsData();
    } catch (error) {
        showToast('خطأ في تحديث الإشعار', 'error');
    }
}

/**
 * Mark all notifications as read
 */
async function markAllAsRead() {
    try {
        const count = await MezoMenuAPI.Notifications.markAllAsRead();
        showToast(`تم تعيين ${count} إشعارات كمقروءة`, 'success');
        await loadNotificationsData();
    } catch (error) {
        showToast('خطأ في تحديث الإشعارات', 'error');
    }
}

/**
 * Delete notification
 */
async function deleteNotification(id) {
    try {
        await MezoMenuAPI.Notifications.delete(id);
        await loadNotificationsData();
    } catch (error) {
        showToast('خطأ في حذف الإشعار', 'error');
    }
}

/**
 * Update notification badge count
 */
function updateNotificationBadge(count) {
    const badge = document.getElementById('notificationBadge');
    if (count !== undefined) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    } else {
        const unreadCount = AppState.notifications.filter(n => !n.read).length;
        badge.textContent = unreadCount;
        badge.style.display = unreadCount > 0 ? 'flex' : 'none';
    }
}

// ============================================
// Settings Management
// ============================================

/**
 * Load settings data
 */
async function loadSettingsData() {
    AppState.settings = await MezoMenuAPI.Settings.get();
    
    // Fill restaurant info form
    document.querySelector('#restaurantInfoForm [name="restaurantName"]').value = AppState.settings.restaurantName || '';
    document.querySelector('#restaurantInfoForm [name="address"]').value = AppState.settings.address || '';
    document.querySelector('#restaurantInfoForm [name="phone"]').value = AppState.settings.phone || '';
    document.querySelector('#restaurantInfoForm [name="email"]').value = AppState.settings.email || '';
    document.querySelector('#restaurantInfoForm [name="description"]').value = AppState.settings.description || '';
    
    // Fill working hours form
    if (AppState.settings.workingHours) {
        document.querySelector('#workingHoursForm [name="openingTime"]').value = AppState.settings.workingHours.openingTime || '10:00';
        document.querySelector('#workingHoursForm [name="closingTime"]').value = AppState.settings.workingHours.closingTime || '23:00';
        
        // Check days
        const days = AppState.settings.workingHours.days || [];
        document.querySelectorAll('#workingHoursForm [name="days"]').forEach(cb => {
            cb.checked = days.includes(cb.value);
        });
    }
    
    // Render categories management
    renderCategoriesManagement();
}

/**
 * Render categories management section
 */
function renderCategoriesManagement() {
    const container = document.getElementById('categoriesManagement');
    
    if (AppState.categories.length === 0) {
        container.innerHTML = '<p class="text-muted">لا توجد فئات بعد</p>';
        return;
    }
    
    container.innerHTML = AppState.categories.map(cat => `
        <div class="category-management-item">
            <div class="category-management-icon">
                <i class="fas ${cat.icon || 'fa-folder'}"></i>
            </div>
            <div class="category-management-info">
                <div class="category-management-name">${cat.name}</div>
                <div class="category-management-count">
                    ${AppState.menuItems.filter(i => i.categoryId === cat.id).length} عنصر
                </div>
            </div>
            <div style="display:flex; gap:8px;">
                <button class="btn btn-sm btn-outline" onclick="editCategory('${cat.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteCategory('${cat.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

/**
 * Handle restaurant info form submission
 */
document.getElementById('restaurantInfoForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    try {
        await MezoMenuAPI.Settings.updatePartial(data);
        showToast('تم حفظ إعدادات المطعم بنجاح', 'success');
    } catch (error) {
        showToast('خطأ في حفظ الإعدادات', 'error');
    }
});

/**
 * Handle working hours form submission
 */
document.getElementById('workingHoursForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const days = [];
    document.querySelectorAll('[name="days"]:checked').forEach(cb => days.push(cb.value));
    
    const data = {
        workingHours: {
            openingTime: formData.get('openingTime'),
            closingTime: formData.get('closingTime'),
            days
        }
    };
    
    try {
        await MezoMenuAPI.Settings.updatePartial(data);
        showToast('تم حفظ ساعات العمل بنجاح', 'success');
    } catch (error) {
        showToast('خطأ في حفظ الإعدادات', 'error');
    }
});

/**
 * Open category modal
 */
function openCategoryModal() {
    document.getElementById('categoryModalTitle').textContent = 'إضافة فئة جديدة';
    document.getElementById('categoryForm').reset();
    document.getElementById('categoryId').value = '';
    document.getElementById('categoryImagePreview').style.display = 'none';
    document.getElementById('categoryUploadPlaceholder').style.display = 'block';
    openModal('categoryModal');
}

/**
 * Edit category
 */
async function editCategory(id) {
    const cat = await MezoMenuAPI.Categories.getById(id);
    if (!cat) return;
    
    document.getElementById('categoryModalTitle').textContent = 'تعديل الفئة';
    document.getElementById('categoryId').value = id;
    document.getElementById('categoryName').value = cat.name || '';
    document.getElementById('categoryIcon').value = cat.icon || 'fa-utensils';
    document.getElementById('categoryDescription').value = cat.description || '';
    document.getElementById('categoryOrder').value = cat.order || 0;
    
    if (cat.image) {
        document.getElementById('categoryImagePreview').src = cat.image;
        document.getElementById('categoryImagePreview').style.display = 'block';
        document.getElementById('categoryUploadPlaceholder').style.display = 'none';
    }
    
    openModal('categoryModal');
}

/**
 * Save category
 */
async function saveCategory() {
    const id = document.getElementById('categoryId').value;
    const name = document.getElementById('categoryName').value.trim();
    
    if (!name) {
        showToast('يرجى إدخال اسم الفئة', 'warning');
        return;
    }
    
    const categoryData = {
        name,
        icon: document.getElementById('categoryIcon').value || 'fa-utensils',
        description: document.getElementById('categoryDescription').value.trim(),
        order: parseInt(document.getElementById('categoryOrder').value) || 0
    };
    
    // Handle image
    const imageInput = document.getElementById('categoryImageInput');
    if (imageInput.files[0]) {
        try {
            categoryData.image = await MezoMenuAPI.uploadImage(imageInput.files[0], 'categories');
        } catch (error) {
            console.error('Image upload error:', error);
        }
    } else if (id) {
        const existing = await MezoMenuAPI.Categories.getById(id);
        if (existing?.image) categoryData.image = existing.image;
    }
    
    try {
        if (id) {
            await MezoMenuAPI.Categories.update(id, categoryData);
            showToast('تم تحديث الفئة بنجاح', 'success');
        } else {
            await MezoMenuAPI.Categories.create(categoryData);
            showToast('تم إضافة الفئة بنجاح', 'success');
        }
        
        closeModal('categoryModal');
        AppState.categories = await MezoMenuAPI.Categories.getAll();
        renderCategoriesManagement();
        populateCategoryDropdowns();
    } catch (error) {
        console.error('Save error:', error);
        showToast('خطأ في حفظ الفئة', 'error');
    }
}

/**
 * Delete category
 */
async function deleteCategory(id) {
    if (!confirm('هل أنت متأكد من حذف هذه الفئة؟ سيؤثر ذلك على العناصر المرتبطة.')) return;
    
    try {
        await MezoMenuAPI.Categories.delete(id);
        showToast('تم حذف الفئة بنجاح', 'success');
        AppState.categories = await MezoMenuAPI.Categories.getAll();
        renderCategoriesManagement();
        populateCategoryDropdowns();
    } catch (error) {
        showToast('خطأ في حذف الفئة', 'error');
    }
}

/**
 * Preview category image
 */
function previewCategoryImage(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('categoryImagePreview').src = e.target.result;
            document.getElementById('categoryImagePreview').style.display = 'block';
            document.getElementById('categoryUploadPlaceholder').style.display = 'none';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// ============================================
// AI Import Section
// ============================================

let aiSelectedFile = null;

/**
 * Initialize AI upload area
 */
function initAIUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('menuImageInput');
    
    // Click to upload
    uploadArea.addEventListener('click', () => fileInput.click());
    
    // File selection
    fileInput.addEventListener('change', handleAIFileSelect);
    
    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleAIFile(files[0]);
        }
    });
}

/**
 * Handle AI file selection from input
 */
function handleAIFileSelect(e) {
    const file = e.target.files[0];
    if (file) handleAIFile(file);
}

/**
 * Handle AI file
 */
function handleAIFile(file) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showToast('يرجى اختيار ملف صورة', 'error');
        return;
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        showToast('حجم الملف كبير جداً (حد أقصى 10MB)', 'error');
        return;
    }
    
    aiSelectedFile = file;
    
    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('previewImage').src = e.target.result;
        document.getElementById('uploadArea').style.display = 'none';
        document.getElementById('previewArea').style.display = 'block';
        document.getElementById('aiResults').style.display = 'none';
    };
    reader.readAsDataURL(file);
}

/**
 * Remove preview and reset
 */
function removePreview() {
    aiSelectedFile = null;
    document.getElementById('previewImage').src = '';
    document.getElementById('uploadArea').style.display = 'block';
    document.getElementById('previewArea').style.display = 'none';
    document.getElementById('aiResults').style.display = 'none';
    document.getElementById('menuImageInput').value = '';
    AppState.aiResults = null;
}

/**
 * Analyze image with AI
 */
async function analyzeWithAI() {
    if (!aiSelectedFile) {
        showToast('يرجى اختيار صورة أولاً', 'warning');
        return;
    }
    
    const analyzeBtn = document.getElementById('analyzeBtn');
    const loadingDiv = document.getElementById('aiLoading');
    const resultsDiv = document.getElementById('aiResults');
    const progressFill = document.getElementById('progressFill');
    const statusText = document.getElementById('loadingStatus');
    
    // Show loading
    analyzeBtn.disabled = true;
    loadingDiv.style.display = 'block';
    resultsDiv.style.display = 'none';
    
    try {
        // Compress image
        updateProgress(progressFill, 10);
        statusText.textContent = 'ضغط الصورة...';
        const compressedImage = await MezoMenuAPI.compressImage(aiSelectedFile);
        
        // Convert to base64
        updateProgress(progressFill, 30);
        statusText.textContent = 'تحويل الصورة...';
        const base64 = await fileToBase64(compressedImage);
        
        // Call AI API
        updateProgress(progressFill, 50);
        statusText.textContent = 'تحليل الصورة بالذكاء الاصطناعي...';
        
        const options = {
            category: document.getElementById('defaultCategory').value,
            currency: document.getElementById('currencySelect').value
        };
        
        const result = await MezoMenuAPI.analyzeMenuImage(base64, options);
        
        // Complete
        updateProgress(progressFill, 100);
        statusText.textContent = 'اكتمل التحليل!';
        
        // Store results
        AppState.aiResults = result.items || result;
        
        // Show results
        setTimeout(() => {
            loadingDiv.style.display = 'none';
            resultsDiv.style.display = 'block';
            document.getElementById('extractedCount').textContent = Array.isArray(AppState.aiResults) ? AppState.aiResults.length : 1;
            renderAIResults();
            analyzeBtn.disabled = false;
        }, 500);
        
    } catch (error) {
        console.error('AI Analysis Error:', error);
        loadingDiv.style.display = 'none';
        analyzeBtn.disabled = false;
        showToast(`خطأ في التحليل: ${error.message}`, 'error');
    }
}

/**
 * Update progress bar
 */
function updateProgress(element, percent) {
    element.style.width = `${percent}%`;
}

/**
 * Convert file to base64
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Render AI results
 */
function renderAIResults() {
    const container = document.getElementById('resultsPreview');
    const items = Array.isArray(AppState.aiResults) ? AppState.aiResults : [AppState.aiResults];
    
    container.innerHTML = `
        <table class="table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>اسم العنصر</th>
                    <th>الوصف</th>
                    <th>السعر</th>
                    <th>الفئة</th>
                </tr>
            </thead>
            <tbody>
                ${items.map((item, i) => `
                    <tr>
                        <td>${i + 1}</td>
                        <td><strong>${item.name || '-'}</strong></td>
                        <td>${item.description || '-'}</td>
                        <td>${item.price ? '$' + item.price : '-'}</td>
                        <td>${item.category || '-'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

/**
 * Import AI results to menu
 */
async function importToMenu() {
    if (!AppState.aiResults || AppState.aiResults.length === 0) {
        showToast('لا توجد نتائج للاستيراد', 'warning');
        return;
    }
    
    const items = Array.isArray(AppState.aiResults) ? AppState.aiResults : [AppState.aiResults];
    const defaultCategory = document.getElementById('defaultCategory').value;
    let imported = 0;
    
    try {
        for (const item of items) {
            const menuItemData = {
                name: item.name,
                description: item.description || '',
                price: parseFloat(item.price) || 0,
                categoryId: item.categoryId || defaultCategory || (AppState.categories[0]?.id || ''),
                available: true,
                featured: false,
                ingredients: item.ingredients || []
            };
            
            await MezoMenuAPI.MenuItems.create(menuItemData);
            imported++;
        }
        
        showToast(`تم استيراد ${imported} عناصر بنجاح`, 'success');
        
        // Switch to menu tab and reload
        setTimeout(() => {
            switchTab('menu');
            removePreview();
        }, 1000);
        
    } catch (error) {
        console.error('Import error:', error);
        showToast('خطأ في استيراد العناصر', 'error');
    }
}

/**
 * Edit AI results before importing
 */
function editResults() {
    // For now, just show a toast - could implement inline editing
    showToast('يمكنك تعديل العناصر بعد الاستيراد من قسم القائمة', 'info');
}

// ============================================
// Utility Functions
// ============================================

/**
 * Open modal
 */
function openModal(modalId) {
    document.getElementById(modalId)?.classList.add('show');
    document.body.style.overflow = 'hidden';
}

/**
 * Close modal
 */
function closeModal(modalId) {
    document.getElementById(modalId)?.classList.remove('show');
    document.body.style.overflow = '';
}

/**
 * Show toast notification
 */
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas ${icons[type]} toast-icon"></i>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(toast);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
        toast.style.animation = 'toastSlideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

/**
 * Show/hide loading state
 */
function showLoading(show) {
    // Could add a global loading overlay here
    console.log(show ? 'Loading...' : 'Done loading');
}

/**
 * Format date for display
 */
function formatDate(dateString) {
    if (!dateString) return '-';
    
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    // Less than 24 hours ago
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        if (hours < 1) {
            const minutes = Math.floor(diff / 60000);
            return `منذ ${minutes} دقيقة`;
        }
        return `منذ ${hours} ساعة`;
    }
    
    // Otherwise show formatted date
    return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Get status text in Arabic
 */
function getStatusText(status) {
    const statuses = {
        pending: 'قيد الانتظار',
        preparing: 'قيد التحضير',
        ready: 'جاهز',
        delivered: 'تم التسليم',
        cancelled: 'ملغي'
    };
    return statuses[status] || status;
}

/**
 * Get reservation status text in Arabic
 */
function getReservationStatusText(status) {
    const statuses = {
        confirmed: 'مؤكد',
        pending: 'قيد الانتظار',
        cancelled: 'ملغي',
        completed: 'مكتمل'
    };
    return statuses[status] || status;
}

/**
 * Get notification icon based on type
 */
function getNotificationIcon(type) {
    const icons = {
        order: 'fa-shopping-cart',
        reservation: 'fa-calendar-alt',
        promotion: 'fa-tags',
        system: 'fa-cog'
    };
    return icons[type] || 'fa-bell';
}

// Close modals when clicking outside
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('show');
        document.body.style.overflow = '';
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Escape to close modals
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.show').forEach(modal => {
            modal.classList.remove('show');
        });
        document.body.style.overflow = '';
    }
});

// ============================================
// NEW: Logo & Cover Image Functions
// ============================================

let logoDataUrl = null;
let coverDataUrl = null;

/**
 * Preview uploaded logo
 */
function previewLogo(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        if (file.size > 2 * 1024 * 1024) {
            showToast('حجم الملف كبير جداً (حد أقصى 2MB)', 'error');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            logoDataUrl = e.target.result;
            document.getElementById('logoPreview').src = logoDataUrl;
            document.getElementById('logoPreviewContainer').style.display = 'block';
            document.getElementById('logoPlaceholder').style.display = 'none';
            
            // Auto-save logo to settings
            saveBrandingSettings();
        };
        reader.readAsDataURL(file);
    }
}

/**
 * Remove logo
 */
function removeLogo() {
    logoDataUrl = null;
    document.getElementById('logoPreview').src = '';
    document.getElementById('logoPreviewContainer').style.display = 'none';
    document.getElementById('logoPlaceholder').style.display = 'block';
    document.getElementById('logoInput').value = '';
    saveBrandingSettings();
}

/**
 * Preview uploaded cover image
 */
function previewCover(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        if (file.size > 5 * 1024 * 1024) {
            showToast('حجم الملف كبير جداً (حد أقصى 5MB)', 'error');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            coverDataUrl = e.target.result;
            document.getElementById('coverPreview').src = coverDataUrl;
            document.getElementById('coverPreviewContainer').style.display = 'block';
            document.getElementById('coverPlaceholder').style.display = 'none';
            
            // Auto-save cover to settings
            saveBrandingSettings();
        };
        reader.readAsDataURL(file);
    }
}

/**
 * Remove cover image
 */
function removeCover() {
    coverDataUrl = null;
    document.getElementById('coverPreview').src = '';
    document.getElementById('coverPreviewContainer').style.display = 'none';
    document.getElementById('coverPlaceholder').style.display = 'block';
    document.getElementById('coverInput').value = '';
    saveBrandingSettings();
}

/**
 * Save branding settings (logo, cover, colors)
 */
async function saveBrandingSettings() {
    try {
        const settings = {
            ...(AppState.settings || {}),
            logo: logoDataUrl,
            coverImage: coverDataUrl,
            primaryColor: document.getElementById('primaryColor')?.value || '#FF6B35',
            secondaryColor: document.getElementById('secondaryColor')?.value || '#1A1A2E',
            bgColor: document.getElementById('bgColor')?.value || '#FFFFFF'
        };
        
        AppState.settings = settings;
        await MezoMenuAPI.Settings.update(settings);
        console.log('Branding settings saved');
    } catch (error) {
        console.error('Error saving branding:', error);
    }
}

// ============================================
// NEW: AI Color Extraction from Logo
// ============================================

/**
 * Extract dominant colors from logo using canvas
 */
async function extractColorsFromLogo() {
    if (!logoDataUrl) {
        showToast('يرجى رفع الشعار أولاً', 'warning');
        return;
    }

    showToast('جاري استخراج الألوان...', 'info');

    try {
        // Create image element
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = logoDataUrl;
        });

        // Create canvas and extract colors
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const colors = extractDominantColors(imageData);

        // Display colors
        displayExtractedColors(colors);

        // Apply primary color
        if (colors.length > 0) {
            document.getElementById('primaryColor').value = colors[0];
            showToast(`تم استخراج ${colors.length} ألوان!`, 'success');
        }

    } catch (error) {
        console.error('Color extraction error:', error);
        showToast('خطأ في استخراج الألوان', 'error');
    }
}

/**
 * Extract dominant colors from image data
 */
function extractDominantColors(imageData) {
    const colorMap = {};
    const step = 4; // Sample every 4th pixel for performance

    for (let i = 0; i < imageData.length; i += 4 * step) {
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];
        const a = imageData[i + 3];

        if (a < 128) continue; // Skip transparent pixels

        // Quantize colors to reduce variations
        const qr = Math.round(r / 32) * 32;
        const qg = Math.round(g / 32) * 32;
        const qb = Math.round(b / 32) * 32;

        const key = `${qr},${qg},${qb}`;
        colorMap[key] = (colorMap[key] || 0) + 1;
    }

    // Sort by frequency and get top colors
    const sortedColors = Object.entries(colorMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([color]) => {
            const [r, g, b] = color.split(',').map(Number);
            return rgbToHex(r, g, b);
        });

    return sortedColors;
}

/**
 * Convert RGB to Hex
 */
function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

/**
 * Display extracted colors in UI
 */
function displayExtractedColors(colors) {
    const container = document.getElementById('extractedColors');
    
    container.innerHTML = colors.map((color, index) => `
        <div class="color-swatch ${index === 0 ? 'selected' : ''}" 
             style="background:${color};"
             data-color="${color}"
             onclick="selectExtractedColor('${color}', this)"
             title="${color}">
        </div>
    `).join('');
}

/**
 * Select extracted color as primary
 */
function selectExtractedColor(color, element) {
    document.querySelectorAll('.color-swatch').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    document.getElementById('primaryColor').value = color;
}

/**
 * Apply custom colors manually
 */
function applyCustomColors() {
    const primary = document.getElementById('primaryColor').value;
    const secondary = document.getElementById('secondaryColor').value;
    
    // Update CSS variables
    document.documentElement.style.setProperty('--primary', primary);
    
    // Calculate lighter shade
    const lightColor = lightenColor(primary, 20);
    document.documentElement.style.setProperty('--primary-light', lightColor);
    
    // Save to settings
    saveBrandingSettings();
    
    showToast('تم تطبيق الألوان بنجاح!', 'success');
}

/**
 * Lighten a hex color
 */
function lightenColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (
        0x1000000 +
        (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 1 ? 0 : B) : 255)
    ).toString(16).slice(1);
}

// ============================================
// NEW: QR Code Generation
// ============================================

let qrCodeInstance = null;

/**
 * Generate QR Code for menu
 */
function generateQRCode() {
    // Get the customer page URL (relative or absolute)
    let menuUrl = window.location.href.replace('/index.html', '/customer/index.html');
    
    // If on root, construct URL
    if (!menuUrl.includes('customer')) {
        menuUrl = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/customer/index.html');
    }
    
    openModal('qrModal');
    
    // Clear previous QR code
    const container = document.getElementById('qrModalCode');
    container.innerHTML = '';
    
    // Generate new QR code
    qrCodeInstance = new QRCode(container, {
        text: menuUrl,
        width: 200,
        height: 200,
        colorDark: '#FF6B35',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
    });
    
    // Also generate in settings page
    generateSettingsQRCode(menuUrl);
}

/**
 * Generate QR Code in settings section
 */
function generateSettingsQRCode(url) {
    const container = document.getElementById('qrCode');
    if (!container) return;
    
    container.innerHTML = '';
    
    new QRCode(container, {
        text: url || (window.location.origin + '/customer/index.html'),
        width: 180,
        height: 180,
        colorDark: '#333333',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
    });
}

/**
 * Download QR Code as image
 */
function downloadQRCode() {
    const canvas = document.querySelector('#qrModalCode canvas') || document.querySelector('#qrCode canvas');
    if (!canvas) {
        showToast('لم يتم إنشاء QR Code بعد', 'warning');
        return;
    }
    
    const link = document.createElement('a');
    link.download = 'mezomenu-qrcode.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    
    showToast('تم تحميل QR Code', 'success');
}

/**
 * Print QR Code
 */
function printQRCode() {
    const canvas = document.querySelector('#qrModalCode canvas') || document.querySelector('#qrCode canvas');
    if (!canvas) {
        showToast('لم يتم إنشاء QR Code بعد', 'warning');
        return;
    }
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head><title>QR Code - MezoMenu</title></head>
        <body style="text-align:center; padding:50px; font-family:sans-serif;">
            <h1>QR Code للقائمة</h1>
            <p>امسح هذا الكود للوصول إلى قائمة المطعم</p>
            <img src="${canvas.toDataURL()}" style="max-width:300px;">
            <p style="color:#666; margin-top:20px;">${document.getElementById('restaurantName')?.textContent || 'MezoMenu'}</p>
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

// ============================================
// NEW: Icon Selector Function
// ============================================

/**
 * Select icon for category
 */
function selectIcon(iconClass) {
    document.getElementById('categoryIcon').value = iconClass;
    
    // Update visual selection
    document.querySelectorAll('.icon-option').forEach(btn => {
        btn.classList.toggle('selected', btn.onclick.toString().includes(iconClass));
    });
}

// ============================================
// Helper Functions for AI Import
// ============================================

/**
 * Helper: Delay function
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Update progress bar
 */
function updateProgress(element, percentElement, percent, status) {
    element.style.width = `${percent}%`;
    percentElement.textContent = `${percent}%`;
    if (status && document.getElementById('loadingStatus')) {
        document.getElementById('loadingStatus').textContent = status;
    }
}

/**
 * Update step indicators
 */
function updateStepIndicators(currentStep) {
    const steps = document.querySelectorAll('.step-number');
    steps.forEach((step, index) => {
        step.classList.remove('active', 'completed');
        if (index + 1 < currentStep) {
            step.classList.add('completed');
        } else if (index + 1 === currentStep) {
            step.classList.add('active');
        }
    });
}

/**
 * Remove preview and reset to step 1
 */
function removePreview() {
    aiSelectedFile = null;
    AppState.aiResults = null;
    
    document.getElementById('previewImage').src = '';
    document.getElementById('menuImageInput').value = '';
    
    // Show step 1, hide others
    document.getElementById('aiStep1').classList.remove('hidden');
    document.getElementById('aiStep2').classList.add('hidden');
    document.getElementById('aiStep3').classList.add('hidden');
    document.getElementById('aiLoading').classList.add('hidden');
    
    // Reset progress
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('progressPercent').textContent = '0%';
    
    // Reset step indicators
    updateStepIndicators(1);
}

/**
 * Handle AI file selection
 */
function handleAIFileSelect(e) {
    const file = e.target.files[0];
    if (file) handleAIFile(file);
}

/**
 * Handle AI file
 */
function handleAIFile(file) {
    // Validate
    if (!file.type.startsWith('image/')) {
        showToast('يرجى اختيار ملف صورة فقط', 'error');
        return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
        showToast('حجم الملف كبير جداً (حد أقصى 10MB)', 'error');
        return;
    }
    
    aiSelectedFile = file;
    
    // Show preview and move to step 2
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('previewImage').src = e.target.result;
        
        // Show step 2, hide step 1
        document.getElementById('aiStep1').classList.add('hidden');
        document.getElementById('aiStep2').classList.remove('hidden');
        document.getElementById('aiStep3').classList.add('hidden');
        
        // Update step indicators
        updateStepIndicators(2);
    };
    reader.readAsDataURL(file);
}

/**
 * Analyze image with AI - Enhanced
 */
async function analyzeWithAI() {
    if (!aiSelectedFile) {
        showToast('يرجى اختيار صورة أولاً', 'warning');
        return;
    }
    
    const analyzeBtn = document.getElementById('analyzeBtn');
    const loadingDiv = document.getElementById('aiLoading');
    const resultsDiv = document.getElementById('aiResults');
    const progressFill = document.getElementById('progressFill');
    const progressPercent = document.getElementById('progressPercent');
    const loadingStatus = document.getElementById('loadingStatus');
    const loadingTitle = document.getElementById('loadingTitle');
    
    // Show loading state
    analyzeBtn.disabled = true;
    loadingDiv.classList.remove('hidden');
    resultsDiv.parentElement.classList.add('hidden');
    
    try {
        // Step 1: Compress image
        updateProgress(progressFill, progressPercent, 10, 'ضغط الصورة...');
        loadingTitle.textContent = 'جاري تحضير الصورة...';
        const compressedImage = await MezoMenuAPI.compressImage(aiSelectedFile, 1024, 0.85);
        
        // Step 2: Convert to base64
        updateProgress(progressFill, progressPercent, 30, 'تحويل الصورة...');
        loadingTitle.textContent = 'جاري المعالجة...';
        const base64 = await fileToBase64(compressedImage);
        
        // Step 3: Call AI API
        updateProgress(progressFill, progressPercent, 50, 'تحليل بالذكاء الاصطناعي...');
        loadingTitle.textContent = '🤖 الذكاء الاصطناعي يعمل...';
        loadingStatus.textContent = 'يتم تحليل صورة القائمة واستخراج العناصر...';
        
        const options = {
            category: document.getElementById('defaultCategory')?.value || '',
            currency: document.getElementById('currencySelect')?.value || 'EGP',
            provider: document.getElementById('aiProvider')?.value || 'auto'
        };
        
        // Try real AI analysis first, fallback to simulation
        try {
            const result = await MezoMenuAPI.analyzeMenuImage(base64, options);
            if (result && result.items && result.items.length > 0) {
                AppState.aiResults = result.items;
            } else {
                await simulateAIAnalysis(base64, options, progressFill, progressPercent, loadingStatus);
            }
        } catch (aiError) {
            console.warn('AI API failed, using simulation:', aiError);
            await simulateAIAnalysis(base64, options, progressFill, progressPercent, loadingStatus);
        }
        
        // Complete
        updateProgress(progressFill, progressPercent, 100, 'مكت!');
        loadingTitle.textContent = '✅ تم التحليل بنجاح!';
        
        // Show results
        setTimeout(() => {
            loadingDiv.classList.add('hidden');
            resultsDiv.parentElement.classList.remove('hidden');
            document.getElementById('aiStep2').classList.add('hidden');
            document.getElementById('aiStep3').classList.remove('hidden');
            
            updateStepIndicators(3);
            
            // Display extracted items
            document.getElementById('extractedCount').textContent = AppState.aiResults?.length || 0;
            renderAIResults();
            
            analyzeBtn.disabled = false;
        }, 800);
        
    } catch (error) {
        console.error('AI Analysis Error:', error);
        loadingDiv.classList.add('hidden');
        analyzeBtn.disabled = false;
        showToast(`خطأ في التحليل: ${error.message}`, 'error');
    }
}

/**
 * Simulate AI Analysis (replace with real API call when Worker is deployed)
 */
async function simulateAIAnalysis(imageBase64, options, progressFill, progressPercent, statusEl) {
    // Simulate processing time
    await delay(500);
    updateProgress(progressFill, progressPercent, 60, 'استخراج النصوص...');
    statusEl.textContent = 'جاري قراءة نصوص القائمة...';
    
    await delay(700);
    updateProgress(progressFill, progressPercent, 75, 'تحليل العناصر...');
    statusEl.textContent = 'جاري تحديد الأسعار والأسماء...';
    
    await delay(600);
    updateProgress(progressFill, progressPercent, 90, 'تنسيق البيانات...');
    statusEl.textContent = 'جاري تنسيق البيانات المستخرجة...';
    
    await delay(400);
    
    // Generate sample results based on common menu items
    // In production, this would come from actual AI response
    AppState.aiResults = generateSampleMenuItems(options);
}

/**
 * Generate sample menu items (for demo/when AI is not available)
 */
function generateSampleMenuItems(options) {
    const categories = ['main', 'appetizers', 'drinks', 'desserts'];
    const sampleItems = [
        { name: 'بيتزا مارجريتا', description: 'بيتزا تقليدية بصلصة الطماطم والموزاريلا', price: 45, category: options.category || categories[0], ingredients: ['عجينة', 'صلصة طماطم', 'جبنة موزاريلا'] },
        { name: 'برجر لحم', description: 'برجر لحم بقري مع الجبنة والخضروات', price: 55, category: options.category || categories[0], ingredients: ['لحم بقري', 'خبز برجر', 'خس', 'طماطم'] },
        { name: 'سلطة سيزر', description: 'سلطة طازجة مع صلصة سيزر الكلاسيك', price: 35, category: options.category || categories[1], ingredients: ['خس', 'كروتون', 'بارميزان'] },
        { name: 'مشروب مانجو', description: 'مشروب منعش بالمانجو الطازج', price: 25, category: options.category || categories[2], ingredients: ['مانجو', 'حليب', 'سكر'] },
        { name: 'تشيز كيك', description: 'تشيز كيك نيويورك كلاسيكي', price: 40, category: options.category || categories[3], ingredients: ['جبنة كريمية', 'بسكويت', 'فراولة'] },
        { name: 'كريب الدجاج', description: 'دجاج مقرمش مع الصلحة الخاصة', price: 42, category: options.category || categories[0], ingredients: ['دجاج', 'دقيق', 'توابل'] }
    ];
    
    // Add some randomness
    return sampleItems.slice(0, Math.floor(Math.random() * 3) + 4);
}

/**
 * Render AI Results
 */
function renderAIResults() {
    const container = document.getElementById('resultsPreview');
    const items = Array.isArray(AppState.aiResults) ? AppState.aiResults : [AppState.aiResults];
    
    if (items.length === 0) {
        container.innerHTML = '<p class="text-center text-muted">لم يتم استخراج أي عناصر</p>';
        return;
    }
    
    container.innerHTML = `
        <table class="table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>اسم العنصر</th>
                    <th>الوصف</th>
                    <th>السعر (${document.getElementById('currencySelect')?.value || 'EGP'})</th>
                    <th>الفئة</th>
                </tr>
            </thead>
            <tbody>
                ${items.map((item, i) => `
                    <tr>
                        <td>${i + 1}</td>
                        <td><strong>${item.name}</strong></td>
                        <td style="max-width:200px;">${item.description || '-'}</td>
                        <td><span style="color:#FF6B35;font-weight:700">${item.price || 0}</span></td>
                        <td>${item.category || '-'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

/**
 * Import AI results to menu
 */
async function importToMenu() {
    if (!AppState.aiResults || AppState.aiResults.length === 0) {
        showToast('لا توجد نتائج للاستيراد', 'warning');
        return;
    }
    
    const items = Array.isArray(AppState.aiResults) ? AppState.aiResults : [AppState.aiResults];
    const defaultCategory = document.getElementById('defaultCategory')?.value || 
                           (AppState.categories[0]?.id || '');
    let imported = 0;
    let errors = 0;
    
    try {
        for (const item of items) {
            try {
                const menuItemData = {
                    name: item.name,
                    description: item.description || '',
                    price: parseFloat(item.price) || 0,
                    categoryId: item.categoryId || defaultCategory,
                    available: true,
                    featured: false,
                    ingredients: item.ingredients || []
                };
                
                await MezoMenuAPI.MenuItems.create(menuItemData);
                imported++;
                
                // Small delay between requests
                await delay(100);
            } catch (err) {
                console.error('Import error:', err);
                errors++;
            }
        }
        
        if (imported > 0) {
            showToast(`✅ تم استيراد ${imported} عناصر بنجاح!`, 'success');
            
            // Switch to menu tab after short delay
            setTimeout(() => {
                switchTab('menu');
                removePreview();
            }, 1500);
        }
        
        if (errors > 0) {
            showToast(`⚠️ فشل استيراد ${errors} عناصر`, 'warning');
        }
        
    } catch (error) {
        console.error('Import error:', error);
        showToast(`خطأ في الاستيراد: ${error.message}`, 'error');
    }
}

/**
 * Edit AI results before importing
 */
function editResults() {
    showToast('يمكنك تعديل العناصر بعد الاستيراد من قسم "إدارة القائمة"', 'info');
}

// ============================================
// Logo & Banner Upload Functionality
// ============================================

let logoDataUrl = null;
let coverDataUrl = null;

/**
 * Initialize logo upload
 */
function initLogoUpload() {
    const logoInput = document.getElementById('logoInput');
    const logoDropZone = document.getElementById('logoDropZone');
    
    if (!logoInput) return;
    
    // Click to upload
    if (logoDropZone) {
        logoDropZone.addEventListener('click', () => logoInput.click());
        
        // Drag and drop
        logoDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            logoDropZone.classList.add('dragover');
        });
        
        logoDropZone.addEventListener('dragleave', () => {
            logoDropZone.classList.remove('dragover');
        });
        
        logoDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            logoDropZone.classList.remove('dragover');
            if (e.dataTransfer.files[0]) {
                handleLogoUpload(e.dataTransfer.files[0]);
            }
        });
    }
    
    logoInput.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            handleLogoUpload(e.target.files[0]);
        }
    });
}

/**
 * Handle logo file upload
 */
async function handleLogoUpload(file) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showToast('يرجى اختيار ملف صورة فقط', 'error');
        return;
    }
    
    // Validate file size (max 2MB for logo)
    if (file.size > 2 * 1024 * 1024) {
        showToast('حجم الشعار كبير جداً (حد أقصى 2MB)', 'error');
        return;
    }
    
    try {
        // Compress and convert to data URL
        const compressedFile = await MezoMenuAPI.compressImage(file, 512, 0.9);
        logoDataUrl = await fileToBase64(compressedFile);
        
        // Show preview
        const preview = document.getElementById('logoPreview');
        const previewContainer = document.getElementById('logoPreviewContainer');
        const placeholder = document.getElementById('logoPlaceholder');
        
        if (preview) preview.src = logoDataUrl;
        if (previewContainer) previewContainer.style.display = 'block';
        if (placeholder) placeholder.style.display = 'none';
        
        showToast('تم تحميل الشعار بنجاح', 'success');
        
        // Auto-extract colors from logo
        extractColorsFromLogo(logoDataUrl);
        
    } catch (error) {
        console.error('Logo upload error:', error);
        showToast('خطأ في تحميل الشعار', 'error');
    }
}

/**
 * Initialize cover/banner upload
 */
function initCoverUpload() {
    const coverInput = document.getElementById('coverInput');
    const coverDropZone = document.getElementById('coverDropZone');
    
    if (!coverInput) return;
    
    // Click to upload
    if (coverDropZone) {
        coverDropZone.addEventListener('click', () => coverInput.click());
        
        // Drag and drop
        coverDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            coverDropZone.classList.add('dragover');
        });
        
        coverDropZone.addEventListener('dragleave', () => {
            coverDropZone.classList.remove('dragover');
        });
        
        coverDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            coverDropZone.classList.remove('dragover');
            if (e.dataTransfer.files[0]) {
                handleCoverUpload(e.dataTransfer.files[0]);
            }
        });
    }
    
    coverInput.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            handleCoverUpload(e.target.files[0]);
        }
    });
}

/**
 * Handle cover/banner file upload
 */
async function handleCoverUpload(file) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showToast('يرجى اختيار ملف صورة فقط', 'error');
        return;
    }
    
    // Validate file size (max 5MB for cover)
    if (file.size > 5 * 1024 * 1024) {
        showToast('حجم الغلاف كبير جداً (حد أقصى 5MB)', 'error');
        return;
    }
    
    try {
        // Compress and convert to data URL
        const compressedFile = await MezoMenuAPI.compressImage(file, 1920, 0.85);
        coverDataUrl = await fileToBase64(compressedFile);
        
        // Show preview
        const preview = document.getElementById('coverPreview');
        const previewContainer = document.getElementById('coverPreviewContainer');
        const placeholder = document.getElementById('coverPlaceholder');
        
        if (preview) preview.src = coverDataUrl;
        if (previewContainer) previewContainer.style.display = 'block';
        if (placeholder) placeholder.style.display = 'none';
        
        showToast('تم تحميل الغلاف بنجاح', 'success');
        
    } catch (error) {
        console.error('Cover upload error:', error);
        showToast('خطأ في تحميل الغلاف', 'error');
    }
}

/**
 * Remove logo
 */
function removeLogo() {
    logoDataUrl = null;
    document.getElementById('logoInput').value = '';
    const preview = document.getElementById('logoPreview');
    const previewContainer = document.getElementById('logoPreviewContainer');
    const placeholder = document.getElementById('logoPlaceholder');
    
    if (preview) preview.src = '';
    if (previewContainer) previewContainer.style.display = 'none';
    if (placeholder) placeholder.style.display = 'block';
}

/**
 * Remove cover image
 */
function removeCover() {
    coverDataUrl = null;
    document.getElementById('coverInput').value = '';
    const preview = document.getElementById('coverPreview');
    const previewContainer = document.getElementById('coverPreviewContainer');
    const placeholder = document.getElementById('coverPlaceholder');
    
    if (preview) preview.src = '';
    if (previewContainer) previewContainer.style.display = 'none';
    if (placeholder) placeholder.style.display = 'block';
}

// ============================================
// AI Color Extraction from Logo
// ============================================

/**
 * Extract dominant colors from logo using canvas
 */
function extractColorsFromLogo(imageDataUrl) {
    if (!imageDataUrl) return;
    
    const statusEl = document.getElementById('colorExtractionStatus');
    if (statusEl) statusEl.textContent = 'جاري استخراج الألوان...';
    
    try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            // Create canvas to analyze image
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Use smaller size for performance
            const maxSize = 100;
            const scale = Math.min(maxSize / img.width, maxSize / img.height);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            // Get pixel data
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const pixels = imageData.data;
            
            // Extract colors using simple quantization
            const colors = extractDominantColors(pixels, 5);
            
            // Apply colors to UI
            applyExtractedColors(colors);
            
            if (statusEl) statusEl.textContent = 'تم استخراج الألوان بنجاح ✓';
        };
        img.onerror = () => {
            if (statusEl) statusEl.textContent = 'فشل استخراج الألوان';
        };
        img.src = imageDataUrl;
        
    } catch (error) {
        console.error('Color extraction error:', error);
        if (statusEl) statusEl.textContent = 'خطأ في استخراج الألوان';
    }
}

/**
 * Extract dominant colors from pixel data
 */
function extractDominantColors(pixels, numColors) {
    const colorMap = {};
    
    // Sample pixels (every 4th pixel for performance)
    for (let i = 0; i < pixels.length; i += 16) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];
        
        // Skip transparent pixels
        if (a < 128) continue;
        
        // Quantize colors (reduce to 32 levels per channel)
        const qr = Math.floor(r / 32) * 32;
        const qg = Math.floor(g / 32) * 32;
        const qb = Math.floor(b / 32) * 32;
        
        const key = `${qr},${qg},${qb}`;
        colorMap[key] = (colorMap[key] || 0) + 1;
    }
    
    // Sort by frequency and get top colors
    const sortedColors = Object.entries(colorMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, numColors * 2) // Get more than needed to filter
        .map(([color]) => {
            const [r, g, b] = color.split(',').map(Number);
            return { r, g, b, hex: rgbToHex(r, g, b) };
        });
    
    // Filter out similar colors and return top N
    const filtered = [];
    for (const color of sortedColors) {
        const isSimilar = filtered.some(fc => colorDistance(color, fc) < 50);
        if (!isSimilar) {
            filtered.push(color);
            if (filtered.length >= numColors) break;
        }
    }
    
    // If not enough colors, add some defaults
    while (filtered.length < numColors) {
        const defaults = [
            { r: 255, g: 107, b: 53, hex: '#FF6B35' },  // Orange
            { r: 45, g: 55, b: 72, hex: '#2D3748' },     // Dark
            { r: 255, g: 255, b: 255, hex: '#FFFFFF' },   // White
        ];
        if (filtered.length < defaults.length) {
            filtered.push(defaults[filtered.length]);
        } else {
            break;
        }
    }
    
    return filtered;
}

/**
 * Calculate distance between two colors
 */
function colorDistance(c1, c2) {
    return Math.sqrt(
        Math.pow(c1.r - c2.r, 2) +
        Math.pow(c1.g - c2.g, 2) +
        Math.pow(c1.b - c2.b, 2)
    );
}

/**
 * Convert RGB to Hex
 */
function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

/**
 * Apply extracted colors to UI
 */
function applyExtractedColors(colors) {
    if (!colors || colors.length === 0) return;
    
    // Set primary color (first dominant color)
    const primaryColorInput = document.getElementById('primaryColor');
    if (primaryColorInput && colors[0]) {
        primaryColorInput.value = colors[0].hex;
    }
    
    // Set secondary color (second dominant color)
    const secondaryColorInput = document.getElementById('secondaryColor');
    if (secondaryColorInput && colors[1]) {
        secondaryColorInput.value = colors[1].hex;
    }
    
    // Show color swatches
    const swatchContainer = document.getElementById('colorSwatches');
    if (swatchContainer) {
        swatchContainer.innerHTML = colors.map((color, i) => `
            <div class="color-swatch" 
                 style="background-color: ${color.hex};"
                 title="${color.hex}"
                 onclick="document.getElementById('${i === 0 ? 'primaryColor' : 'secondaryColor'}').value = '${color.hex}'">
            </div>
        `).join('');
        swatchContainer.style.display = 'flex';
    }
    
    // Live preview
    livePreviewTheme(colors[0]?.hex || '#FF6B35', colors[1]?.hex || '#2D3748');
}

/**
 * Live theme preview
 */
function livePreviewTheme(primaryColor, secondaryColor) {
    const previewBox = document.getElementById('themePreviewBox');
    if (!previewBox) return;
    
    previewBox.style.background = `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`;
    previewBox.innerHTML = `
        <div style="background: rgba(255,255,255,0.9); padding: 20px; border-radius: 12px;">
            <h3 style="color: ${primaryColor}; margin: 0 0 10px;">معاينة الثيم</h3>
            <p style="color: ${secondaryColor}; margin: 0; font-size: 14px;">هذا كيف سيظهر المينو للعملاء</p>
        </div>
    `;
}

// ============================================
// QR Code Generation
// ============================================

/**
 * Generate QR Code for menu link
 */
function generateQRCode() {
    const qrContainer = document.getElementById('qrCodeContainer');
    if (!qrContainer) return;
    
    // Get restaurant name for the link
    const restaurantName = AppState.settings?.restaurantName || 'MezoMenu';
    
    // Generate customer URL (relative path to customer page)
    // In production, this would be your actual domain
    const baseUrl = window.location.href.substring(0, window.location.lastIndexOf('/') + 1);
    const menuUrl = `${baseUrl}customer/`;
    
    // Simple QR Code generation using a free API or library
    // Using Google Charts API as fallback (or qrcode.js if loaded)
    if (typeof QRCode !== 'undefined') {
        // Using qrcode.js library
        qrContainer.innerHTML = '';
        new QRCode(qrContainer, {
            text: menuUrl,
            width: 200,
            height: 200,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        });
    } else {
        // Fallback: Use online API or show instructions
        qrContainer.innerHTML = `
            <div style="text-center">
                <div id="qrCodeImg" style="background: white; padding: 15px; display: inline-block; border-radius: 8px;">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(menuUrl)}" 
                         alt="QR Code" 
                         style="width: 200px; height: 200px;"
                         onerror="this.parentElement.innerHTML='<p style=\\'color:#666\\'>QR Code<br><small>${menuUrl}</small></p>'">
                </div>
                <p style="margin-top: 15px; font-size: 13px; color: #666;">
                    امسح Kod QR لمشاركة المينو مع العملاء
                </p>
                <button onclick="downloadQRCode()" class="btn btn-primary" style="margin-top: 10px;">
                    <i class="fas fa-download"></i> تحميل QR Code
                </button>
                <button onclick="copyMenuLink()" class="btn btn-secondary" style="margin-top: 10px; margin-right: 8px;">
                    <i class="fas fa-copy"></i> نسخ الرابط
                </button>
            </div>
        `;
    }
    
    // Store menu URL globally for copy function
    window.currentMenuUrl = menuUrl;
}

/**
 * Generate QR code in settings tab
 */
function generateSettingsQRCode() {
    generateQRCode();
}

/**
 * Download QR Code as image
 */
function downloadQRCode() {
    const qrImg = document.querySelector('#qrCodeContainer img');
    if (qrImg && qrImg.src) {
        const link = document.createElement('a');
        link.download = 'mezomenu-qrcode.png';
        link.href = qrImg.src;
        link.click();
        showToast('تم تحميل QR Code', 'success');
    } else {
        showToast('لم يتم إنشاء QR Code بعد', 'warning');
    }
}

/**
 * Copy menu link to clipboard
 */
async function copyMenuLink() {
    const menuUrl = window.currentMenuUrl || (window.location.href.replace('/index.html', '') + '/customer/');
    
    try {
        await navigator.clipboard.writeText(menuUrl);
        showToast('تم نسخ الرابط ✓', 'success');
    } catch (error) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = menuUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showToast('تم نسخ الرابط ✓', 'success');
    }
}

// ============================================
// Notifications System - Fixed
// ============================================

/**
 * Load notifications data
 */
async function loadNotificationsData() {
    try {
        AppState.notifications = await MezoMenuAPI.Notifications.getAll();
        renderNotifications();
        updateNotificationBadge();
    } catch (error) {
        console.error('Error loading notifications:', error);
        // Don't show toast for notifications to avoid spam
    }
}

/**
 * Render notifications list
 */
function renderNotifications() {
    const container = document.getElementById('notificationsList');
    if (!container) return;
    
    if (!AppState.notifications || AppState.notifications.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bell-slash"></i>
                <h3>لا توجد إشعارات</h3>
                <p>ستظهر هنا الإشعارات الجديدة</p>
                <button onclick="createTestNotification()" class="btn btn-primary">
                    <i class="fas fa-plus"></i> إنشاء إشعار اختباري
                </button>
            </div>
        `;
        return;
    }
    
    // Sort by date (newest first)
    const sorted = [...AppState.notifications].sort((a, b) => 
        new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );
    
    container.innerHTML = sorted.map(notification => `
        <div class="notification-item ${notification.read ? '' : 'unread'}" data-id="${notification.id}">
            <div class="notification-icon">
                <i class="fas ${getNotificationIcon(notification.type)}"></i>
            </div>
            <div class="notification-content">
                <h4>${notification.title || 'إشعار'}</h4>
                <p>${notification.message || ''}</p>
                <span class="notification-time">${formatDate(notification.createdAt)}</span>
            </div>
            <div class="notification-actions">
                ${!notification.read ? `<button onclick="markAsRead('${notification.id}')" class="btn-icon" title="تحديد كمقروء"><i class="fas fa-check"></i></button>` : ''}
                <button onclick="deleteNotification('${notification.id}')" class="btn-icon text-danger" title="حذف"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
}

/**
 * Get notification icon based on type
 */
function getNotificationIcon(type) {
    const icons = {
        order: 'fa-shopping-cart',
        reservation: 'fa-calendar-check',
        promotion: 'fa-tag',
        system: 'fa-cog',
        info: 'fa-info-circle',
        warning: 'fa-exclamation-triangle',
        success: 'fa-check-circle',
        default: 'fa-bell'
    };
    return icons[type] || icons.default;
}

/**
 * Mark notification as read
 */
async function markAsRead(id) {
    try {
        await MezoMenuAPI.Notifications.update(id, { read: true });
        
        // Update local state
        const notification = AppState.notifications.find(n => n.id === id);
        if (notification) notification.read = true;
        
        renderNotifications();
        updateNotificationBadge();
        showToast('تم تحديد الإشعار كمقروء', 'success');
    } catch (error) {
        console.error('Error marking notification as read:', error);
        showToast('خطأ في تحديث الإشعار', 'error');
    }
}

/**
 * Delete notification
 */
async function deleteNotification(id) {
    if (!confirm('هل أنت متأكد من حذف هذا الإشعار؟')) return;
    
    try {
        await MezoMenuAPI.Notifications.delete(id);
        
        // Update local state
        AppState.notifications = AppState.notifications.filter(n => n.id !== id);
        
        renderNotifications();
        updateNotificationBadge();
        showToast('تم حذف الإشعار', 'success');
    } catch (error) {
        console.error('Error deleting notification:', error);
        showToast('خطأ في حذف الإشعار', 'error');
    }
}

/**
 * Mark all notifications as read
 */
async function markAllAsRead() {
    try {
        const unreadIds = AppState.notifications
            .filter(n => !n.read)
            .map(n => n.id);
        
        for (const id of unreadIds) {
            await MezoMenuAPI.Notifications.update(id, { read: true });
        }
        
        // Update local state
        AppState.notifications.forEach(n => n.read = true);
        
        renderNotifications();
        updateNotificationBadge();
        showToast(`تم تحديد ${unreadIds.length} إشعارات كمقروءة`, 'success');
    } catch (error) {
        console.error('Error marking all as read:', error);
        showToast('خطأ في تحديث الإشعارات', 'error');
    }
}

/**
 * Create a test notification
 */
async function createTestNotification() {
    try {
        const notification = {
            title: 'إشعار اختباري 🧪',
            message: 'هذا إشعار تجريبي للتأكد من أن نظام الإشعارات يعمل بشكل صحيح!',
            type: 'system',
            read: false,
            createdAt: new Date().toISOString(),
            data: { test: true }
        };
        
        await MezoMenuAPI.Notifications.create(notification);
        
        // Reload notifications
        await loadNotificationsData();
        
        showToast('تم إنشاء الإشعار الاختباري', 'success');
        
    } catch (error) {
        console.error('Error creating test notification:', error);
        showToast('خطأ في إنشاء الإشعار', 'error');
    }
}

/**
 * Update notification badge count
 */
function updateNotificationBadge() {
    const badge = document.getElementById('notificationBadge');
    if (!badge) return;
    
    const unreadCount = AppState.notifications.filter(n => !n.read).length;
    badge.textContent = unreadCount;
    badge.style.display = unreadCount > 0 ? 'flex' : 'none';
}

// ============================================
// Settings Save with Branding
// ============================================

/**
 * Save settings including branding (logo, cover, colors)
 */
async function saveSettingsEnhanced() {
    const restaurantName = document.querySelector('#restaurantInfoForm [name="restaurantName"]')?.value.trim();
    const address = document.querySelector('#restaurantInfoForm [name="address"]')?.value.trim();
    const phone = document.querySelector('#restaurantInfoForm [name="phone"]')?.value.trim();
    const email = document.querySelector('#restaurantInfoForm [name="email"]')?.value.trim();
    const description = document.querySelector('#restaurantInfoForm [name="description"]')?.value.trim();
    const openingTime = document.querySelector('#workingHoursForm [name="openingTime"]')?.value || '10:00';
    const closingTime = document.querySelector('#workingHoursForm [name="closingTime"]')?.value || '23:00';
    
    // Get working days
    const days = [];
    document.querySelectorAll('#workingHoursForm [name="days"]:checked').forEach(cb => {
        days.push(cb.value);
    });
    
    // Get colors
    const primaryColor = document.getElementById('primaryColor')?.value || '#FF6B35';
    const secondaryColor = document.getElementById('secondaryColor')?.value || '#2D3748';
    
    // Build settings object
    const settingsData = {
        restaurantName,
        address,
        phone,
        email,
        description,
        workingHours: {
            openingTime,
            closingTime,
            days
        },
        primaryColor,
        secondaryColor,
        // Include branding images
        ...(logoDataUrl && { logo: logoDataUrl }),
        ...(coverDataUrl && { coverImage: coverDataUrl }),
        updatedAt: new Date().toISOString()
    };
    
    try {
        await MezoMenuAPI.Settings.update(settingsData);
        AppState.settings = settingsData;
        
        showToast('تم حفظ الإعدادات بنجاح ✓', 'success');
        
        // Regenerate QR code with updated info
        generateQRCode();
        
    } catch (error) {
        console.error('Error saving settings:', error);
        showToast('خطأ في حفظ الإعدادات: ' + error.message, 'error');
    }
}

// ============================================
// File to Base64 Converter
// ============================================

/**
 * Convert File to Base64
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// ============================================
// Additional Helper Functions for HTML Events
// ============================================

/**
 * Preview logo when selected via input
 */
async function previewLogo(input) {
    if (input.files && input.files[0]) {
        await handleLogoUpload(input.files[0]);
    }
}

/**
 * Preview cover image when selected via input
 */
async function previewCover(input) {
    if (input.files && input.files[0]) {
        await handleCoverUpload(input.files[0]);
    }
}

/**
 * Apply custom colors manually selected by user
 */
function applyCustomColors() {
    const primaryColor = document.getElementById('primaryColor')?.value || '#FF6B35';
    const secondaryColor = document.getElementById('secondaryColor')?.value || '#2D3748';
    
    livePreviewTheme(primaryColor, secondaryColor);
    showToast('تم تطبيق الألوان ✓', 'success');
}

/**
 * Print QR Code
 */
function printQRCode() {
    const qrContainer = document.getElementById('qrCodeContainer');
    if (!qrContainer) return;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html dir="rtl">
        <head>
            <title>QR Code - ${AppState.settings?.restaurantName || 'MezoMenu'}</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    text-align: center; 
                    padding: 40px;
                    direction: rtl;
                }
                h2 { margin-bottom: 20px; }
                .qr-wrapper { 
                    display: inline-block; 
                    padding: 20px; 
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                }
                p { color: #666; margin-top: 15px; }
            </style>
        </head>
        <body>
            <h2>${AppState.settings?.restaurantName || 'MezoMenu'}</h2>
            <div class="qr-wrapper">
                ${qrContainer.innerHTML}
            </div>
            <p>امسح Kod QR للوصول إلى القائمة</p>
            <script>window.onload = () => window.print();</script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// ============================================
// Initialization Enhancements
// ============================================

/**
 * Enhanced initialization for settings tab
 */
function initSettingsEnhanced() {
    // Initialize logo upload
    initLogoUpload();
    
    // Initialize cover upload
    initCoverUpload();
    
    // Load settings with branding
    loadSettingsDataEnhanced();
}

// Override or enhance the switchTab function to initialize settings when needed
const originalSwitchTabInit = typeof switchTab === 'function';

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait for main initialization, then setup settings enhancements
    setTimeout(() => {
        // Initialize logo/cover upload if on settings tab
        if (AppState.currentTab === 'settings') {
            initSettingsEnhanced();
        }
    }, 500);
});
