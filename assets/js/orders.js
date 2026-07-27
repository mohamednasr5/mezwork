/* ===================================
   MezoMenu SaaS - Orders Management
   إدارة الطلبات
   =================================== */

// ==========================================
// Orders State
// ==========================================
const OrdersState = {
    orders: [],
    filteredOrders: [],
    currentFilter: {
        status: '',
        date: '',
        search: ''
    },
    selectedOrder: null,
    pagination: {
        currentPage: 1,
        itemsPerPage: 10
    }
};

// ==========================================
// Initialize Orders Page
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    initOrdersPage();
    loadOrders();
    setupOrderFilters();
    
    // Auto-refresh orders every 30 seconds
    setInterval(loadOrders, 30000);
});

// ==========================================
// Initialize Page
// ==========================================
function initOrdersPage() {
    // Setup search
    const searchInput = document.getElementById('orderSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
    }

    // Setup status filter
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', handleFilterChange);
    }

    // Setup date filter
    const dateFilter = document.getElementById('dateFilter');
    if (dateFilter) {
        dateFilter.addEventListener('change', handleFilterChange);
    }
}

// ==========================================
// Load Orders from Firebase/Worker
// ==========================================
async function loadOrders() {
    try {
        showLoading('جاري تحميل الطلبات...');
        
        const restaurantId = getRestaurantIdFromStorage();
        const response = await fetch(`${CONFIG.API_URL}/api/orders?restaurantId=${restaurantId}`);
        const data = await response.json();

        if (data.success) {
            OrdersState.orders = data.orders || [];
            applyFilters();
            updateOrderStats();
        } else {
            throw new Error(data.error || 'فشل تحميل الطلبات');
        }
    } catch (error) {
        console.error('Error loading orders:', error);
        // Load sample data for demo
        loadSampleOrders();
    } finally {
        hideLoading();
    }
}

// ==========================================
// Sample Orders Data (for demo)
// ==========================================
function loadSampleOrders() {
    OrdersState.orders = [
        {
            id: '1001',
            customerName: 'أحمد محمد',
            customerPhone: '+20 127 993 4735',
            customerAddress: 'شارع الجامعة، المنصورة',
            items: [
                { name: 'كبدة فراخ', size: 'وسط', quantity: 2, price: 120, addons: ['فلفل رومي'] },
                { name: 'محمرة', size: 'كبير', quantity: 1, price: 85, addons: [] }
            ],
            total: 250,
            status: 'pending',
            createdAt: new Date().toISOString(),
            notes: 'بدون بصل'
        },
        {
            id: '1000',
            customerName: 'سارة أحمد',
            customerPhone: '+20 100 123 4567',
            items: [
                { name: 'شاورما فراخ', size: 'وسط', quantity: 1, price: 65, addons: [] },
                { name: 'بطاطس مقلية', size: 'صغير', quantity: 2, price: 30, addons: [] }
            ],
            total: 180,
            status: 'confirmed',
            createdAt: new Date(Date.now() - 3600000).toISOString()
        },
        {
            id: '999',
            customerName: 'محمود علي',
            customerPhone: '+20 111 987 6543',
            items: [
                { name: 'فتة', size: 'عائلي', quantity: 1, price: 150, addons: [] }
            ],
            total: 150,
            status: 'delivered',
            createdAt: new Date(Date.now() - 7200000).toISOString()
        }
    ];
    
    applyFilters();
    updateOrderStats();
}

// ==========================================
// Filter Functions
// ==========================================
function setupOrderFilters() {
    // Already set up in initOrdersPage
}

function handleSearch(e) {
    OrdersState.currentFilter.search = e.target.value;
    applyFilters();
}

function handleFilterChange(e) {
    const filterType = e.target.id;
    if (filterType === 'statusFilter') {
        OrdersState.currentFilter.status = e.target.value;
    } else if (filterType === 'dateFilter') {
        OrdersState.currentFilter.date = e.target.value;
    }
    applyFilters();
}

function applyFilters() {
    let filtered = [...OrdersState.orders];

    // Status filter
    if (OrdersState.currentFilter.status) {
        filtered = filtered.filter(order => order.status === OrdersState.currentFilter.status);
    }

    // Date filter
    if (OrdersState.currentFilter.date) {
        const now = new Date();
        filtered = filtered.filter(order => {
            const orderDate = new Date(order.createdAt);
            switch (OrdersState.currentFilter.date) {
                case 'today':
                    return orderDate.toDateString() === now.toDateString();
                case 'week':
                    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
                    return orderDate >= weekAgo;
                case 'month':
                    const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
                    return orderDate >= monthAgo;
                default:
                    return true;
            }
        });
    }

    // Search filter
    if (OrdersState.currentFilter.search) {
        const searchTerm = OrdersState.currentFilter.search.toLowerCase();
        filtered = filtered.filter(order => 
            order.id.toLowerCase().includes(searchTerm) ||
            order.customerName.toLowerCase().includes(searchTerm) ||
            order.customerPhone.includes(searchTerm)
        );
    }

    OrdersState.filteredOrders = filtered;
    renderOrdersTable();
}

// ==========================================
// Render Orders Table
// ==========================================
function renderOrdersTable() {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;

    if (OrdersState.filteredOrders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4">
                    <div class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <p>لا توجد طلبات</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    // Pagination
    const start = (OrdersState.pagination.currentPage - 1) * OrdersState.pagination.itemsPerPage;
    const end = start + OrdersState.pagination.itemsPerPage;
    const paginatedOrders = OrdersState.filteredOrders.slice(start, end);

    tbody.innerHTML = paginatedOrders.map(order => `
        <tr class="order-row ${order.status}">
            <td><strong>#${order.id}</strong></td>
            <td>
                <div class="customer-cell">
                    <div class="customer-avatar">${order.customerName.charAt(0)}</div>
                    <span>${order.customerName}</span>
                </div>
            </td>
            <td dir="ltr">${order.customerPhone}</td>
            <td>${order.items.length} أصناف</td>
            <td><strong>${formatCurrency(order.total)}</strong></td>
            <td><span class="status-badge status-${order.status}">${getStatusText(order.status)}</span></td>
            <td>${formatDateTime(order.createdAt)}</td>
            <td>
                <div class="table-actions">
                    <button class="table-action-btn view" title="عرض" onclick="viewOrder('${order.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${order.status !== 'delivered' && order.status !== 'cancelled' ? `
                        <button class="table-action-btn edit" title="تحديث الحالة" onclick="updateOrderStatus('${order.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');

    updatePaginationInfo();
}

// ==========================================
// Order Stats
// ==========================================
function updateOrderStats() {
    const stats = {
        pending: 0,
        confirmed: 0,
        preparing: 0,
        ready: 0,
        delivered: 0
    };

    OrdersState.orders.forEach(order => {
        if (stats.hasOwnProperty(order.status)) {
            stats[order.status]++;
        }
    });

    updateStatElement('pendingCount', stats.pending);
    updateStatElement('confirmedCount', stats.confirmed);
    updateStatElement('preparingCount', stats.preparing);
    updateStatElement('readyCount', stats.ready);
    updateStatElement('deliveredCount', stats.delivered);
}

function updateStatElement(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

// ==========================================
// View Order Details
// ==========================================
function viewOrder(orderId) {
    const order = OrdersState.orders.find(o => o.id === orderId);
    if (!order) return;

    OrdersState.selectedOrder = order;

    // Update modal content
    document.getElementById('modalOrderId').textContent = order.id;
    document.getElementById('modalCustomerName').textContent = order.customerName;
    document.getElementById('modalCustomerPhone').textContent = order.customerPhone;
    document.getElementById('modalCustomerAddress').textContent = order.customerAddress || '---';
    document.getElementById('modalOrderTime').textContent = formatDateTime(order.createdAt);

    // Render order items
    const itemsBody = document.getElementById('modalOrderItems');
    if (itemsBody) {
        itemsBody.innerHTML = order.items.map(item => `
            <tr>
                <td>${item.name}</td>
                <td>${item.size || '-'}</td>
                <td>${item.quantity}</td>
                <td>${formatCurrency(item.price)}</td>
                <td>${item.addons?.length > 0 ? item.addons.map(a => `+ ${a}`).join(', ') : '-'}</td>
            </tr>
        `).join('');
    }

    // Update timeline
    updateOrderTimeline(order.status);

    // Show modal
    document.getElementById('orderModal').classList.add('active');
}

// ==========================================
// Close Order Modal
// ==========================================
function closeOrderModal() {
    document.getElementById('orderModal').classList.remove('active');
    OrdersState.selectedOrder = null;
}

// ==========================================
// Update Order Timeline in Modal
// ==========================================
function updateOrderTimeline(currentStatus) {
    const steps = ['pending', 'confirmed', 'preparing', 'ready', 'delivered'];
    const stepElements = document.querySelectorAll('.timeline-step');

    stepElements.forEach((step, index) => {
        const stepStatus = steps[index];
        step.classList.remove('completed', 'active');
        
        const statusIndex = steps.indexOf(currentStatus);
        
        if (index < statusIndex) {
            step.classList.add('completed');
        } else if (index === statusIndex) {
            step.classList.add('active');
        }
    });
}

// ==========================================
// Update Order Status
// ==========================================
async function updateOrderStatus(orderId) {
    viewOrder(orderId);
}

async function updateStatusFromModal() {
    if (!OrdersState.selectedOrder) return;

    const newStatus = document.getElementById('statusUpdateSelect').value;
    
    try {
        const response = await fetch(`${CONFIG.API_URL}/api/orders/${OrdersState.selectedOrder.id}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({ status: newStatus })
        });

        const result = await response.json();

        if (result.success) {
            // Update local state
            const orderIndex = OrdersState.orders.findIndex(o => o.id === OrdersState.selectedOrder.id);
            if (orderIndex !== -1) {
                OrdersState.orders[orderIndex].status = newStatus;
            }

            showNotification('success', 'تم تحديث حالة الطلب بنجاح');
            closeOrderModal();
            applyFilters();
            updateOrderStats();

            // Send notification to customer if needed
            if (newStatus === 'ready' || newStatus === 'delivered') {
                sendStatusNotification(OrdersState.selectedOrder, newStatus);
            }
        } else {
            throw new Error(result.error || 'فشل تحديث الحالة');
        }
    } catch (error) {
        showNotification('error', error.message);
    }
}

// ==========================================
// Send WhatsApp Notification
// ==========================================
function sendWhatsAppNotification() {
    if (!OrdersState.selectedOrder) return;

    const order = OrdersState.selectedOrder;
    const restaurant = AppState.restaurant || {};
    const phoneNumber = order.customerPhone.replace(/\s/g, '').replace('+', '');
    
    let message = `🆕 *تحديث طلب #${order.id}*\n\n`;
    message += `مرحباً ${order.customerName}،\n\n`;
    message += `تم تحديث حالة طلبك إلى: ${getStatusText(order.status)}\n\n`;
    message += `شكراً لتعاملك مع ${restaurant.name || 'المطعم'} 🙏`;

    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
}

function sendStatusNotification(order, newStatus) {
    // This would typically be handled by a backend service
    console.log(`Sending ${newStatus} notification for order #${order.id}`);
}

// ==========================================
// Pagination
// ==========================================
function updatePaginationInfo() {
    const totalItems = OrdersState.filteredOrders.length;
    const totalPages = Math.ceil(totalItems / OrdersState.pagination.itemsPerPage);
    const start = (OrdersState.pagination.currentPage - 1) * OrdersState.pagination.itemsPerPage + 1;
    const end = Math.min(start + OrdersState.pagination.itemsPerPage - 1, totalItems);

    const infoEl = document.querySelector('.pagination-info');
    if (infoEl) {
        infoEl.textContent = totalItems > 0 
            ? `عرض ${start}-${end} من ${totalItems} طلب`
            : 'لا توجد طلبات';
    }
}

// ==========================================
// Utility Functions
// ==========================================
function getStatusText(status) {
    const statusMap = {
        pending: 'قيد الانتظار',
        confirmed: 'تم التأكيد',
        preparing: 'قيد التحضير',
        ready: 'جاهز للاستلام',
        delivered: 'تم التسليم',
        cancelled: 'ملغي'
    };
    return statusMap[status] || status;
}

function getRestaurantIdFromStorage() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.restaurantId || 'default';
}
