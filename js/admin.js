/* ===================================
   MezoMenu - Admin Panel JavaScript
   Dashboard & Management Logic
   =================================== */

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    if (!checkAuth()) return;
    
    // Load user data
    loadUserData();
    
    // Load dashboard stats
    loadDashboardStats();
    
    // Initialize sidebar state
    initSidebar();
    
    // Close dropdowns on outside click
    document.addEventListener('click', closeDropdowns);
});

/**
 * Check if user is authenticated
 */
function checkAuth() {
    const user = localStorage.getItem('mezomenu_user');
    const token = localStorage.getItem('mezomenu_token');
    
    if (!user || !token) {
        window.location.href = '/login.html';
        return false;
    }
    
    try {
        window.currentUser = JSON.parse(user);
        return true;
    } catch (e) {
        window.location.href = '/login.html';
        return false;
    }
}

/**
 * Load user data into UI
 */
function loadUserData() {
    if (!window.currentUser) return;
    
    // Update username in sidebar
    const userNameEl = document.getElementById('userName');
    if (userNameEl) {
        userNameEl.textContent = window.currentUser.restaurantName || window.currentUser.name || 'المستخدم';
    }
    
    // Update restaurant name
    const restaurantNameEl = document.getElementById('restaurantName');
    if (restaurantNameEl) {
        restaurantNameEl.textContent = window.currentUser.restaurantName || 'مطعمي';
    }
}

/**
 * Load dashboard statistics (mock data for demo)
 */
async function loadDashboardStats() {
    // In production, this would fetch from API
    const mockStats = {
        totalOrders: 127,
        totalRevenue: 15450,
        totalCustomers: 89,
        totalViews: 2340,
        recentOrders: [
            { id: '#ORD-001', customer: 'أحمد محمد', total: 245, status: 'preparing' },
            { id: '#ORD-002', customer: 'سارة علي', total: 180, status: 'delivered' },
            { id: '#ORD-003', customer: 'محمد حسن', total: 320, status: 'new' },
            { id: '#ORD-004', customer: 'فاطمة أحمد', total: 95, status: 'new' }
        ]
    };
    
    // Animate numbers
    animateValue('totalOrders', 0, mockStats.totalOrders, 1500);
    animateValue('totalRevenue', 0, mockStats.totalRevenue, 1500, true);
    animateValue('totalCustomers', 0, mockStats.totalCustomers, 1500);
    animateValue('totalViews', 0, mockStats.totalViews, 1500);
    
    // Update orders badge
    const ordersBadge = document.getElementById('ordersBadge');
    if (ordersBadge) {
        const newOrders = mockStats.recentOrders.filter(o => o.status === 'new').length;
        ordersBadge.textContent = newOrders;
        if (newOrders === 0) ordersBadge.style.display = 'none';
    }
}

/**
 * Animate numeric value
 */
function animateValue(elementId, start, end, duration, formatCurrency = false) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const range = end - start;
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const current = Math.floor(start + range * easeOutQuart);
        
        element.textContent = formatCurrency 
            ? current.toLocaleString('ar-EG')
            : current.toLocaleString('ar-EG');
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

/**
 * Sidebar toggle functionality
 */
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    
    if (sidebar && overlay) {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('show');
        document.body.style.overflow = sidebar.classList.contains('open') ? 'hidden' : '';
    }
}

/**
 * Initialize sidebar based on screen size
 */
function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    
    if (window.innerWidth <= 992) {
        sidebar?.classList.remove('open');
    } else {
        sidebar?.classList.add('open');
    }
    
    // Listen for resize
    window.addEventListener('resize', MezoMenu.Utils.debounce(() => {
        if (window.innerWidth > 992) {
            sidebar?.classList.remove('open');
            document.getElementById('overlay')?.classList.remove('show');
            document.body.style.overflow = '';
        }
    }, 250));
}

/**
 * Toggle notifications panel
 */
function toggleNotifications() {
    const panel = document.getElementById('notificationPanel');
    const dropdown = document.getElementById('userDropdown');
    
    if (panel) {
        panel.classList.toggle('hidden');
        // Close user menu if open
        if (dropdown && !panel.classList.contains('hidden')) {
            dropdown.classList.add('hidden');
        }
    }
}

/**
 * Toggle user dropdown menu
 */
function toggleUserMenu() {
    const dropdown = document.getElementById('userDropdown');
    const panel = document.getElementById('notificationPanel');
    
    if (dropdown) {
        dropdown.classList.toggle('hidden');
        // Close notifications if open
        if (panel && !dropdown.classList.contains('hidden')) {
            panel.classList.add('hidden');
        }
    }
}

/**
 * Close all dropdowns when clicking outside
 */
function closeDropdowns(event) {
    const userMenu = document.querySelector('.user-menu-btn');
    const userDropdown = document.getElementById('userDropdown');
    const notificationBtn = document.querySelector('.notification-btn');
    const notificationPanel = document.getElementById('notificationPanel');
    
    // Close user dropdown
    if (userDropdown && !userDropdown.classList.contains('hidden')) {
        if (!userMenu?.contains(event.target)) {
            userDropdown.classList.add('hidden');
        }
    }
    
    // Close notification panel
    if (notificationPanel && !notificationPanel.classList.contains('hidden')) {
        if (!notificationBtn?.contains(event.target)) {
            notificationPanel.classList.add('hidden');
        }
    }
}

/**
 * Download QR Code
 */
function downloadQR() {
    const qrImg = document.querySelector('.qr-code-img');
    if (qrImg) {
        const link = document.createElement('a');
        link.href = qrImg.src;
        link.download = `qrcode-${Date.now()}.png`;
        link.click();
        
        MezoMenu.Utils.showAlert('تم تحميل QR Code بنجاح!', 'success');
    }
}

/**
 * Copy menu link to clipboard
 */
async function copyMenuLink() {
    const link = 'https://mezomenu.com/menu/matam-el-baraka';
    
    try {
        await MezoMenu.Utils.copyToClipboard(link);
        MezoMenu.Utils.showAlert('تم نسخ الرابط بنجاح!', 'success');
    } catch (error) {
        MezoMenu.Utils.showAlert('فشل نسخ الرابط', 'error');
    }
}

/**
 * Print QR Codes
 */
function printQRCode() {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html dir="rtl">
        <head>
            <title>طباعة QR Codes</title>
            <style>
                body { font-family: Cairo, sans-serif; text-align: center; padding: 20px; }
                .qr-container { display: inline-block; margin: 20px; padding: 20px; border: 2px solid #ddd; border-radius: 10px; }
                img { width: 200px; height: 200px; }
                h3 { margin-top: 10px; color: #333; }
            </style>
        </head>
        <body>
            <h1>QR Codes للمطعم</h1>
            <div class="qr-container">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://mezomenu.com/menu/matam-el-baraka" alt="QR Code">
                <h3>مطعم البركة</h3>
            </div>
            <script>window.print();</script>
        </body>
        </html>
    `);
}

/**
 * Logout function
 */
function logout() {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        localStorage.removeItem('mezomenu_user');
        localStorage.removeItem('mezomenu_token');
        window.location.href = '/login.html';
    }
}

/**
 * Global search handler
 */
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('globalSearch');
    if (searchInput) {
        searchInput.addEventListener('input', MezoMenu.Utils.debounce(function(e) {
            const query = e.target.value.trim().toLowerCase();
            
            if (query.length < 2) return;
            
            // Simple search implementation
            console.log('Searching for:', query);
            // In production, this would call the API
            
        }, 300));
    }
    
    // Language switcher
    const langBtns = document.querySelectorAll('.lang-btn');
    langBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            langBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const lang = this.textContent;
            document.documentElement.lang = lang === 'EN' ? 'en' : 'ar';
            document.documentElement.dir = lang === 'EN' ? 'ltr' : 'rtl';
            
            // Save preference
            localStorage.setItem('preferred_lang', lang.toLowerCase());
        });
    });
    
    // Load saved language preference
    const savedLang = localStorage.getItem('preferred_lang');
    if (savedLang) {
        langBtns.forEach(btn => {
            btn.classList.toggle('active', btn.textContent.toUpperCase() === savedLang.toUpperCase());
        });
    }
});

// Export functions for global access
window.toggleSidebar = toggleSidebar;
window.toggleNotifications = toggleNotifications;
window.toggleUserMenu = toggleUserMenu;
window.downloadQR = downloadQR;
window.copyMenuLink = copyMenuLink;
window.printQRCode = printQRCode;
window.logout = logout;

// Service Worker Registration for PWA
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
