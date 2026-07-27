/* ===================================
   MezoMenu SaaS - Notifications Functions
   إدارة الإشعارات - REAL DATABASE INTEGRATION
   =================================== */

// ==========================================
// Notifications State
// ==========================================
const NotificationsState = {
    notifications: [],
    filteredNotifications: [],
    currentFilter: 'all',
    unreadCount: 0,
    realTimeInterval: null,
    isLoading: false
};

// ==========================================
// Initialize Notifications Page
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    initNotificationFilters();
    loadRealNotifications();
    
    // Auto-refresh notifications every 30 seconds
    NotificationsState.realTimeInterval = setInterval(loadRealNotifications, 30000);
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
// Load REAL Notifications from Firebase
// ==========================================
async function loadRealNotifications() {
    if (NotificationsState.isLoading) return;
    NotificationsState.isLoading = true;

    try {
        console.log('[Notifications] Loading real notifications from Firebase...');
        
        // Use NotificationsService for real Firebase data
        const result = await NotificationsService.getNotifications();
        
        if (result.success && result.notifications) {
            console.log(`[Notifications] Loaded ${result.notifications.length} real notifications`);
            NotificationsState.notifications = result.notifications;
            
            applyNotificationFilter();
            updateUnreadBadge();
            
            // Show notification count in title
            const unreadCount = result.notifications.filter(n => !n.read).length;
            if (unreadCount > 0) {
                document.title = `(${unreadCount}) الإشعارات - MezoMenu`;
            }
        } else {
            console.warn('[Notifications] No notifications found or error:', result.error);
            NotificationsState.notifications = [];
            applyNotificationFilter();
            updateUnreadBadge();
        }
        
    } catch (error) {
        console.error('[Notifications] Error loading real notifications:', error);
        // Don't show sample data - show empty state instead
        NotificationsState.notifications = [];
        applyNotificationFilter();
        updateUnreadBadge();
    } finally {
        NotificationsState.isLoading = false;
    }
}

// Legacy function name support (alias)
async function loadNotifications() {
    await loadRealNotifications();
}

// ==========================================
// NO MORE SAMPLE DATA - Real database only!
// ==========================================

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

    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0));

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
            <div class="empty-state" style="padding: 60px 20px; text-align: center;">
                <i class="fas fa-bell-slash" style="font-size: 4rem; color: #ddd; margin-bottom: 20px;"></i>
                <h3 style="color: #999; margin-bottom: 10px;">لا توجد إشعارات</h3>
                <p style="color: #bbb; font-size: 0.95rem;">
                    ${NotificationsState.currentFilter !== 'all' 
                        ? `لا توجد إشعارات "${getFilterText(NotificationsState.currentFilter)}"` 
                        : 'ستظهر الإشعارات الجديدة هنا تلقائياً'}
                </p>
                ${NotificationsState.currentFilter !== 'all' ? `
                    <button onclick="resetFilter()" class="btn btn-secondary" style="margin-top: 15px;">
                        <i class="fas fa-filter"></i> عرض كل الإشعارات
                    </button>
                ` : ''}
            </div>
        `;
        return;
    }

    container.innerHTML = NotificationsState.filteredNotifications.map(notification => `
        <div class="notification-card ${notification.read ? 'read' : 'unread'}" 
             data-type="${notification.type}" 
             data-id="${notification.id}"
             style="animation: slideIn 0.3s ease;">
            <div class="notification-icon ${getNotificationIconClass(notification.type)}">
                <i class="fas fa-${getNotificationIcon(notification.type)}"></i>
            </div>
            <div class="notification-content">
                <h4>${notification.title}</h4>
                <p>${notification.message}</p>
                <span class="notification-time">${getTimeAgo(notification.timestamp || notification.createdAt)}</span>
            </div>
            <div class="notification-actions">
                ${notification.actionUrl ? `
                    <a href="${notification.actionUrl}" class="btn btn-sm btn-${notification.type === 'orders' ? 'primary' : 'secondary'}">
                        ${getActionText(notification.type)}
                    </a>
                ` : ''}
                ${!notification.read ? `
                    <button onclick="markAsRead(this)" class="btn btn-sm btn-outline" title="تحديد كمقروء">
                        <i class="fas fa-check"></i>
                    </button>
                ` : ''}
                <button onclick="deleteNotification('${notification.id}')" class="btn btn-sm btn-outline text-danger" title="حذف">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function getFilterText(filter) {
    const texts = {
        unread: 'غير مقروءة',
        orders: 'طلبات',
        system: 'نظام',
        promotions: 'عروض'
    };
    return texts[filter] || filter;
}

function resetFilter() {
    const allBtn = document.querySelector('.filter-btn[data-filter="all"]');
    if (allBtn) allBtn.click();
}

// ==========================================
// Mark as Read - REAL Firebase Update
// ==========================================
async function markAsRead(button) {
    const card = button.closest('.notification-card');
    const notificationId = card?.dataset.id;

    if (!notificationId) return;

    try {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        // REAL Firebase update via NotificationsService
        const result = await NotificationsService.markAsRead(notificationId);

        if (result.success) {
            // Update UI locally
            card?.classList.remove('unread');
            card?.classList.add('read');
            
            // Hide the mark as read button
            if (button.parentElement) {
                const markBtn = button.parentElement.querySelector('.btn-outline');
                if (markBtn) markBtn.style.display = 'none';
            }

            // Update local state
            const notification = NotificationsState.notifications.find(n => n.id === notificationId);
            if (notification) {
                notification.read = true;
            }

            updateUnreadBadge();
            showNotification('success', 'تم تحديد الإشعار كمقروء');
        } else {
            throw new Error(result.error || 'فشل التحديث');
        }
    } catch (error) {
        console.error('Error marking notification as read:', error);
        showNotification('error', 'حدث خطأ أثناء التحديث');
        
        // Re-enable button
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-check"></i>';
    }
}

// ==========================================
// Mark All as Read - REAL Firebase Update
// ==========================================
async function markAllAsRead() {
    try {
        showLoading('جاري تحديث جميع الإشعارات...');

        // REAL Firebase update via NotificationsService
        const result = await NotificationsService.markAllAsRead();

        if (result.success) {
            // Update local state
            NotificationsState.notifications.forEach(n => n.read = true);
            applyNotificationFilter();
            updateUnreadBadge();

            hideLoading();
            showNotification('success', 'تم تحديد جميع الإشعارات كمقروءة');
            
            // Reset page title
            document.title = 'الإشعارات - MezoMenu';
        } else {
            throw new Error(result.error || 'فشل التحديث');
        }
    } catch (error) {
        hideLoading();
        showNotification('error', 'حدث خطأ أثناء التحديث: ' + error.message);
    }
}

// ==========================================
// Delete Single Notification
// ==========================================
async function deleteNotification(notificationId) {
    if (!confirm('هل تريد حذف هذا الإشعار؟')) return;

    try {
        // This would call a delete API endpoint
        // For now, just remove from local state and Firebase
        const restaurantId = getRestaurantIdFromStorage();
        
        await FirebaseDB.remove(`notifications/${restaurantId}/${notificationId}`, getAuthToken());

        // Remove from local state
        NotificationsState.notifications = NotificationsState.notifications.filter(n => n.id !== notificationId);
        applyNotificationFilter();
        updateUnreadBadge();

        showNotification('success', 'تم حذف الإشعار');
    } catch (error) {
        console.error('Error deleting notification:', error);
        showNotification('error', 'حدث خطأ أثناء الحذف');
    }
}

// ==========================================
// Clear All Notifications
// ==========================================
async function clearAllNotifications() {
    if (!confirm('هل أنت متأكد من مسح جميع الإشعارات؟')) return;

    try {
        showLoading('جاري مسح الإشعارات...');

        const restaurantId = getRestaurantIdFromStorage();
        
        // Clear from Firebase
        await FirebaseDB.remove(`notifications/${restaurantId}`, getAuthToken());

        // Clear local state
        NotificationsState.notifications = [];
        applyNotificationFilter();
        updateUnreadBadge();

        hideLoading();
        showNotification('success', 'تم مسح جميع الإشعارات');
        
        document.title = 'الإشعارات - MezoMenu';
    } catch (error) {
        hideLoading();
        console.error('Error clearing notifications:', error);
        showNotification('error', 'حدث خطأ أثناء المسح');
    }
}

// ==========================================
// Create Custom Notification (for testing or admin)
// ==========================================
async function createCustomNotification(event) {
    event.preventDefault();

    const title = document.getElementById('notifTitle')?.value;
    const message = document.getElementById('notifMessage')?.value;
    const type = document.getElementById('notifType')?.value || 'system';

    if (!title || !message) {
        showNotification('warning', 'الرجاء ملء جميع الحقول');
        return;
    }

    try {
        showLoading('جاري إنشاء الإشعار...');

        const result = await NotificationsService.createNotification({
            title,
            message,
            type,
            priority: 'normal',
            createdBy: 'admin'
        });

        if (result.success) {
            hideLoading();
            showNotification('success', 'تم إنشاء الإشعار بنجاح');
            
            // Reset form
            document.getElementById('customNotifForm')?.reset();
            
            // Reload notifications
            await loadRealNotifications();
        } else {
            throw new Error(result.error || 'فشل الإنشاء');
        }
    } catch (error) {
        hideLoading();
        showNotification('error', error.message);
    }
}

// ==========================================
// Load More (for pagination if needed)
// ==========================================
function loadMoreNotifications() {
    // Currently loading all notifications at once
    // Could implement pagination here if needed
    showNotification('info', 'جميع الإشعارات محملة');
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
            
            // Add animation for new badges
            if (unreadCount > 0) {
                badge.style.animation = 'pulse 2s infinite';
            }
        }
    });

    // Update page header badge if exists
    const headerBadge = document.querySelector('.page-header .badge');
    if (headerBadge) {
        headerBadge.textContent = unreadCount > 0 ? unreadCount : '';
        headerBadge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
    }

    // Update page title with count
    if (unreadCount > 0) {
        document.title = `(${unreadCount}) الإشعارات - MezoMenu`;
    } else {
        document.title = 'الإشعارات - MezoMenu';
    }

    // Update stats display
    const totalEl = document.getElementById('totalNotifications');
    const unreadEl = document.getElementById('totalUnread');
    
    if (totalEl) totalEl.textContent = NotificationsState.notifications.length;
    if (unreadEl) unreadEl.textContent = unreadCount;
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
        error: 'times-circle',
        payment: 'credit-card',
        customer: 'user'
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
        error: 'danger',
        payment: 'payment',
        customer: 'customer'
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
        error: 'دعم',
        payment: 'الدفع',
        customer: 'الملف الشخصي'
    };
    return texts[type] || 'عرض';
}

function getTimeAgo(timestamp) {
    if (!timestamp) return 'الآن';
    
    const now = new Date();
    const date = new Date(timestamp);
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'الآن';
    
    const intervals = [
        { label: 'دقيقة', seconds: 60, plural: 'دقائق' },
        { label: 'ساعة', seconds: 3600, plural: 'ساعات' },
        { label: 'يوم', seconds: 86400, plural: 'أيام' },
        { label: 'أسبوع', seconds: 604800, plural: 'أسابيع' },
        { label: 'شهر', seconds: 2592000, plural: 'أشهر' }
    ];

    for (const interval of intervals) {
        const count = Math.floor(seconds / interval.seconds);
        if (count >= 1) {
            return count === 1 ? `منذ ${interval.label}` : `منذ ${count} ${interval.plural}`;
        }
    }

    return formatDateTime(timestamp);
}

function getRestaurantIdFromStorage() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.restaurantId || localStorage.getItem('restaurantId') || 'default';
}

function getAuthToken() {
    return localStorage.getItem('authToken') || '';
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (NotificationsState.realTimeInterval) {
        clearInterval(NotificationsState.realTimeInterval);
    }
});

// Add CSS animation for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateX(20px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }
`;
document.head.appendChild(style);
