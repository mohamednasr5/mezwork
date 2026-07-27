/* ===================================
   MezoMenu SaaS - Notifications Functions
   إدارة الإشعارات
   =================================== */

// ==========================================
// Notifications State
// ==========================================
const NotificationsState = {
    notifications: [],
    filteredNotifications: [],
    currentFilter: 'all',
    unreadCount: 0
};

// ==========================================
// Initialize Notifications Page
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    initNotificationFilters();
    loadNotifications();
    
    // Auto-refresh notifications every 60 seconds
    setInterval(loadNotifications, 60000);
});

// ==========================================
// Initialize Filters
// ==========================================
function initNotificationFilters() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            NotificationsState.currentFilter = btn.dataset.filter;
            applyNotificationFilter();
        });
    });
}

// ==========================================
// Load Notifications
// ==========================================
async function loadNotifications() {
    try {
        const restaurantId = getRestaurantIdFromStorage();
        const response = await fetch(`${CONFIG.API_URL}/api/notifications?restaurantId=${restaurantId}`);
        const data = await response.json();

        if (data.success) {
            NotificationsState.notifications = data.notifications || [];
            applyNotificationFilter();
            updateUnreadBadge();
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
        // Load sample data for demo
        loadSampleNotifications();
    }
}

// ==========================================
// Sample Notifications Data
// ==========================================
function loadSampleNotifications() {
    NotificationsState.notifications = [
        {
            id: '1',
            type: 'orders',
            title: 'طلب جديد #1001',
            message: 'لقد تلقيت طلباً جديداً من أحمد محمد بمبلغ 250 ج.م',
            timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
            read: false,
            actionUrl: 'orders.html'
        },
        {
            id: '2',
            type: 'orders',
            title: 'طلب جديد #1000',
            message: 'لقد تلقيت طلباً جديداً من سارة أحمد بمبلغ 180 ج.م',
            timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
            read: false,
            actionUrl: 'orders.html'
        },
        {
            id: '3',
            type: 'system',
            title: 'تذكير: تحديث القائمة',
            message: 'لم تقم بتحديث قائمتك منذ أسبوع. حافظ على تحديث القائمة لجذب المزيد من العملاء!',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            read: false,
            actionUrl: 'menu.html'
        },
        {
            id: '4',
            type: 'orders',
            title: 'تم تسليم الطلب #999',
            message: 'تم تسليم الطلب بنجاح للعميل محمود علي',
            timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
            read: true,
            actionUrl: null
        },
        {
            id: '5',
            type: 'system',
            title: 'تحديث النظام',
            message: 'تم إضافة ميزة جديدة: استيراد القائمة بالذكاء الاصطناعي! جربها الآن.',
            timestamp: new Date(Date.now() - 24 * 3600000).toISOString(),
            read: true,
            actionUrl: 'ai-import.html'
        },
        {
            id: '6',
            type: 'promotions',
            title: 'عرض خاص على الباقات المدفوعة',
            message: 'احصل على خصم 20% عند ترقية باقتك خلال هذا الشهر!',
            timestamp: new Date(Date.now() - 3 * 24 * 3600000).toISOString(),
            read: true,
            actionUrl: 'settings.html#subscription'
        }
    ];
    
    applyNotificationFilter();
    updateUnreadBadge();
}

// ==========================================
// Apply Filter
// ==========================================
function applyNotificationFilter() {
    let filtered = [...NotificationsState.notifications];

    switch (NotificationsState.currentFilter) {
        case 'unread':
            filtered = filtered.filter(n => !n.read);
            break;
        case 'orders':
            filtered = filtered.filter(n => n.type === 'orders');
            break;
        case 'system':
            filtered = filtered.filter(n => n.type === 'system');
            break;
        case 'promotions':
            filtered = filtered.filter(n => n.type === 'promotions');
            break;
        default:
            // Show all
            break;
    }

    NotificationsState.filteredNotifications = filtered;
    renderNotifications();
}

// ==========================================
// Render Notifications
// ==========================================
function renderNotifications() {
    const container = document.getElementById('notificationsList');
    if (!container) return;

    if (NotificationsState.filteredNotifications.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bell-slash"></i>
                <p>لا توجد إشعارات</p>
            </div>
        `;
        return;
    }

    container.innerHTML = NotificationsState.filteredNotifications.map(notification => `
        <div class="notification-card ${notification.read ? 'read' : 'unread'}" data-type="${notification.type}" data-id="${notification.id}">
            <div class="notification-icon ${getNotificationIconClass(notification.type)}">
                <i class="fas fa-${getNotificationIcon(notification.type)}"></i>
            </div>
            <div class="notification-content">
                <h4>${notification.title}</h4>
                <p>${notification.message}</p>
                <span class="notification-time">${getTimeAgo(notification.timestamp)}</span>
            </div>
            <div class="notification-actions">
                ${notification.actionUrl ? `
                    <a href="${notification.actionUrl}" class="btn btn-sm btn-${notification.type === 'orders' ? 'primary' : 'secondary'}">
                        ${getActionText(notification.type)}
                    </a>
                ` : ''}
                ${!notification.read ? `
                    <button onclick="markAsRead(this)" class="btn btn-sm btn-outline">✓</button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

// ==========================================
// Mark as Read
// ==========================================
async function markAsRead(button) {
    const card = button.closest('.notification-card');
    const notificationId = card?.dataset.id;

    try {
        // Update on server
        await fetch(`${CONFIG.API_URL}/api/notifications/${notificationId}/read`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }

    // Update UI locally
    card?.classList.remove('unread');
    card?.classList.add('read');
    button.style.display = 'none';

    // Update local state
    const notification = NotificationsState.notifications.find(n => n.id === notificationId);
    if (notification) {
        notification.read = true;
    }

    updateUnreadBadge();
}

// ==========================================
// Mark All as Read
// ==========================================
async function markAllAsRead() {
    try {
        const restaurantId = getRestaurantIdFromStorage();
        
        await fetch(`${CONFIG.API_URL}/api/notifications/read-all?restaurantId=${restaurantId}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });

        // Update local state
        NotificationsState.notifications.forEach(n => n.read = true);
        applyNotificationFilter();
        updateUnreadBadge();

        showNotification('success', 'تم تحديد جميع الإشعارات كمقروءة');
    } catch (error) {
        console.error('Error marking all as read:', error);
        showNotification('error', 'حدث خطأ أثناء التحديث');
    }
}

// ==========================================
// Clear All Notifications
// ==========================================
async function clearAllNotifications() {
    if (!confirm('هل أنت متأكد من مسح جميع الإشعارات؟')) return;

    try {
        const restaurantId = getRestaurantIdFromStorage();
        
        await fetch(`${CONFIG.API_URL}/api/notifications?restaurantId=${restaurantId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });

        // Clear local state
        NotificationsState.notifications = [];
        applyNotificationFilter();
        updateUnreadBadge();

        showNotification('success', 'تم مسح جميع الإشعارات');
    } catch (error) {
        console.error('Error clearing notifications:', error);
        showNotification('error', 'حدث خطأ أثناء المسح');
    }
}

// ==========================================
// Load More
// ==========================================
function loadMoreNotifications() {
    showNotification('info', 'لا توجد إشعارات إضافية');
}

// ==========================================
// Update Unread Badge
// ==========================================
function updateUnreadBadge() {
    const unreadCount = NotificationsState.notifications.filter(n => !n.read).length;
    NotificationsState.unreadCount = unreadCount;

    // Update badge in sidebar
    const sidebarBadges = document.querySelectorAll('.nav-item .badge');
    sidebarBadges.forEach(badge => {
        if (badge.closest('.nav-item')?.querySelector('span')?.textContent.includes('الإشعارات')) {
            badge.textContent = unreadCount > 0 ? unreadCount : '';
            badge.style.display = unreadCount > 0 ? 'inline' : 'none';
        }
    });

    // Update page title with count
    if (unreadCount > 0) {
        document.title = `(${unreadCount}) الإشعارات - MezoMenu`;
    } else {
        document.title = 'الإشعارات - MezoMenu';
    }
}

// ==========================================
// Utility Functions
// ==========================================
function getNotificationIcon(type) {
    const icons = {
        orders: 'receipt',
        system: 'bell',
        promotions: 'percent',
        info: 'info-circle',
        success: 'check-circle',
        warning: 'exclamation-triangle',
        error: 'times-circle'
    };
    return icons[type] || 'bell';
}

function getNotificationIconClass(type) {
    const classes = {
        orders: 'order',
        system: 'system',
        promotions: 'promo',
        info: 'info',
        success: 'success',
        warning: 'warning',
        error: 'danger'
    };
    return classes[type] || 'default';
}

function getActionText(type) {
    const texts = {
        orders: 'عرض الطلب',
        system: 'عرض',
        promotions: 'ترقية الآن',
        info: 'المزيد',
        success: 'تم',
        warning: 'تفقد',
        error: 'دعم'
    };
    return texts[type] || 'عرض';
}

function getTimeAgo(timestamp) {
    const now = new Date();
    const date = new Date(timestamp);
    const seconds = Math.floor((now - date) / 1000);

    const intervals = [
        { label: 'سنة', seconds: 31536000 },
        { label: 'شهر', seconds: 2592000 },
        { label: 'أسبوع', seconds: 604800 },
        { label: 'يوم', seconds: 86400 },
        { label: 'ساعة', seconds: 3600 },
        { label: 'دقيقة', seconds: 60 }
    ];

    for (const interval of intervals) {
        const count = Math.floor(seconds / interval.seconds);
        if (count >= 1) {
            return `منذ ${count} ${interval.label}`;
        }
    }

    return 'الآن';
}

function getRestaurantIdFromStorage() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.restaurantId || 'default';
}

function getAuthToken() {
    return localStorage.getItem('authToken') || '';
}
