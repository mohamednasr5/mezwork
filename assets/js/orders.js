/* ===================================
   MezoMenu SaaS - Orders Management
   إدارة الطلبات - REAL DATABASE INTEGRATION
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
    },
    realTimeListener: null,
    isLoading: false
};

// ==========================================
// Initialize Orders Page
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    initOrdersPage();
    loadRealOrders();
    setupOrderFilters();
    
    // Auto-refresh orders every 15 seconds for real-time updates
    OrdersState.realTimeInterval = setInterval(loadRealOrders, 15000);
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
// Load REAL Orders from Firebase/Worker
// ==========================================
async function loadRealOrders() {
    if (OrdersState.isLoading) return;
    OrdersState.isLoading = true;

    try {
        console.log('[Orders] Loading real orders from Firebase...');
        
        // Use OrdersService for real Firebase data
        const result = await OrdersService.getOrders();
        
        if (result.success && result.orders) {
            console.log(`[Orders] Loaded ${result.orders.length} real orders from Firebase`);
            OrdersState.orders = result.orders;
            
            applyFilters();
            updateOrderStats();
            updateOrderCountBadge();
        } else {
            console.warn('[Orders] No orders found or error:', result.error);
            OrdersState.orders = [];
            applyFilters();
            updateOrderStats();
        }
        
    } catch (error) {
        console.error('[Orders] Error loading real orders:', error);
        showNotification('error', 'خطأ في تحميل الطلبات: ' + error.message);
        OrdersState.orders = [];
        applyFilters();
        updateOrderStats();
    } finally {
        OrdersState.isLoading = false;
    }
}

// Legacy function name support (alias)
async function loadOrders() {
    await loadRealOrders();
}

// ==========================================
// NO MORE SAMPLE DATA - Real database only!
// ==========================================

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
            const orderDate = new Date(order.createdAt || order.timestamp);
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
            (order.customerName && order.customerName.toLowerCase().includes(searchTerm)) ||
            (order.customerPhone && order.customerPhone.includes(searchTerm)) ||
            (order.customerEmail && order.customerEmail.toLowerCase().includes(searchTerm))
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
                    <div class="empty-state" style="padding: 40px; text-align: center;">
                        <i class="fas fa-inbox" style="font-size: 3rem; color: #ddd; margin-bottom: 16px;"></i>
                        <p style="color: #999; font-size: 1.1rem; margin-bottom: 8px;">لا توجد طلبات</p>
                        <small style="color: #bbb;">ستظهر الطلبات الجديدة هنا تلقائياً عند استلامها</small>
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
        <tr class="order-row ${order.status}" data-order-id="${order.id}">
            <td><strong>#${formatOrderId(order.id)}</strong></td>
            <td>
                <div class="customer-cell">
                    <div class="customer-avatar">${(order.customerName || 'ع')[0]}</div>
                    <span>${order.customerName || 'عميل'}</span>
                </div>
            </td>
            <td dir="ltr">${order.customerPhone || '---'}</td>
            <td>${order.items ? order.items.length : (order.itemCount || 0)} أصناف</td>
            <td><strong>${formatCurrency(order.total || order.amount || 0)}</strong></td>
            <td><span class="status-badge status-${order.status}">${getStatusText(order.status)}</span></td>
            <td>${formatDateTime(order.createdAt || order.timestamp)}</td>
            <td>
                <div class="table-actions">
                    <button class="table-action-btn view" title="عرض التفاصيل" onclick="viewOrderDetails('${order.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${order.status !== 'delivered' && order.status !== 'cancelled' ? `
                        <button class="table-action-btn edit" title="تحديث الحالة" onclick="openStatusUpdate('${order.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                    ` : ''}
                    <button class="table-action-btn whatsapp" title="إرسال عبر واتساب" onclick="sendWhatsAppToCustomer('${order.id}')">
                        <i class="fab fa-whatsapp"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    updatePaginationInfo();
}

// ==========================================
// Format Order ID for display
// ==========================================
function formatOrderId(id) {
    if (!id) return '---';
    // Show last 6-8 characters for readability
    if (id.length > 8) {
        return '#' + id.slice(-8);
    }
    return '#' + id;
}

// ==========================================
// Order Stats - REAL calculations
// ==========================================
function updateOrderStats() {
    const stats = {
        pending: 0,
        confirmed: 0,
        preparing: 0,
        ready: 0,
        delivered: 0,
        cancelled: 0,
        totalRevenue: 0
    };

    OrdersState.orders.forEach(order => {
        if (stats.hasOwnProperty(order.status)) {
            stats[order.status]++;
        }
        // Calculate total revenue from delivered orders
        if (order.status === 'delivered') {
            stats.totalRevenue += (order.total || order.amount || 0);
        }
    });

    // Update stat elements
    updateStatElement('pendingCount', stats.pending);
    updateStatElement('confirmedCount', stats.confirmed);
    updateStatElement('preparingCount', stats.preparing);
    updateStatElement('readyCount', stats.ready);
    updateStatElement('deliveredCount', stats.delivered);

    // Update total revenue display
    const revenueEl = document.getElementById('totalRevenue');
    if (revenueEl) {
        revenueEl.textContent = formatCurrency(stats.totalRevenue);
    }
}

function updateStatElement(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function updateOrderCountBadge() {
    const pendingCount = OrdersState.orders.filter(o => o.status === 'pending').length;
    
    // Update any badges in the UI
    document.querySelectorAll('.orders-badge').forEach(badge => {
        badge.textContent = pendingCount > 0 ? pendingCount : '';
        badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
    });
}

// ==========================================
// VIEW ORDER DETAILS - Full Modal with all info
// ==========================================
async function viewOrderDetails(orderId) {
    try {
        showLoading('جاري تحميل تفاصيل الطلب...');

        // Get full order details from Firebase
        let order = OrdersState.orders.find(o => o.id === orderId);
        
        if (!order) {
            // Try to fetch from Firebase directly
            const result = await OrdersService.getOrderDetails(orderId);
            if (result.success) {
                order = result.order;
            } else {
                throw new Error('الطلب غير موجود');
            }
        }

        hideLoading();
        OrdersState.selectedOrder = order;

        // Update modal content with REAL data
        document.getElementById('modalOrderId').textContent = formatOrderId(order.id);
        document.getElementById('modalCustomerName').textContent = order.customerName || 'غير محدد';
        document.getElementById('modalCustomerPhone').textContent = order.customerPhone || '---';
        document.getElementById('modalCustomerAddress').textContent = order.customerAddress || order.deliveryAddress || '---';
        document.getElementById('modalCustomerEmail').textContent = order.customerEmail || '---';
        document.getElementById('modalOrderTime').textContent = formatDateTime(order.createdAt || order.timestamp);
        document.getElementById('modalOrderTotal').textContent = formatCurrency(order.total || order.amount || 0);
        document.getElementById('modalOrderStatus').innerHTML = `<span class="status-badge status-${order.status}">${getStatusText(order.status)}</span>`;

        // Payment method
        const paymentEl = document.getElementById('modalPaymentMethod');
        if (paymentEl) {
            paymentEl.textContent = getPaymentMethodText(order.paymentMethod || 'cash');
        }

        // Order type (delivery/dine-in/takeaway)
        const typeEl = document.getElementById('modalOrderType');
        if (typeEl) {
            typeEl.textContent = getOrderTypeText(order.orderType || 'delivery');
        }

        // Notes
        const notesEl = document.getElementById('modalOrderNotes');
        if (notesEl) {
            notesEl.textContent = order.notes || order.customerNotes || 'لا توجد ملاحظات';
        }

        // Render order items table
        const itemsBody = document.getElementById('modalOrderItems');
        if (itemsBody && order.items) {
            itemsBody.innerHTML = order.items.map((item, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>
                        <div class="item-name-cell">
                            <strong>${item.name || item.itemName || 'صنف'}</strong>
                            ${item.description ? `<small class="text-muted">${item.description}</small>` : ''}
                            ${item.variants ? `<br><small class="text-info">الخيارات: ${item.variants.join(', ')}</small>` : ''}
                        </div>
                    </td>
                    <td>${item.size || item.variant || '-'}</td>
                    <td>${item.quantity || 1}</td>
                    <td>${formatCurrency(item.price || item.unitPrice || 0)}</td>
                    <td><strong>${formatCurrency((item.price || item.unitPrice || 0) * (item.quantity || 1))}</strong></td>
                    <td>${item.addons && item.addons.length > 0 ? item.addons.map(a => `<span class="addon-tag">+ ${a}</span>`).join(' ') : '-'}</td>
                </tr>
            `).join('');

            // Update items count
            const itemsCountEl = document.getElementById('modalItemsCount');
            if (itemsCountEl) {
                itemsCountEl.textContent = `${order.items.length} أصناف`;
            }
        } else if (itemsBody) {
            itemsBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">لا توجد تفاصيل الأصناف</td></tr>`;
        }

        // Update timeline based on current status
        updateOrderTimeline(order.status);

        // Populate status update dropdown
        const statusSelect = document.getElementById('statusUpdateSelect');
        if (statusSelect) {
            statusSelect.value = order.status;
        }

        // Show modal
        document.getElementById('orderModal').classList.add('active');

        // Log view for analytics
        console.log(`[Orders] Viewing details for order ${orderId}`);

    } catch (error) {
        hideLoading();
        showNotification('error', error.message);
    }
}

// Legacy alias
function viewOrder(orderId) {
    viewOrderDetails(orderId);
}

// ==========================================
// Close Order Modal
// ==========================================
function closeOrderModal() {
    document.getElementById('orderModal').classList.remove('active');
    OrdersState.selectedOrder = null;
}

// ==========================================
// Open Status Update Modal
// ==========================================
function openStatusUpdate(orderId) {
    viewOrderDetails(orderId);
    // Focus on the status select
    setTimeout(() => {
        const select = document.getElementById('statusUpdateSelect');
        if (select) select.focus();
    }, 300);
}

// ==========================================
// Update Order Status - REAL Firebase update
// ==========================================
async function updateStatusFromModal() {
    if (!OrdersState.selectedOrder) return;

    const newStatus = document.getElementById('statusUpdateSelect').value;
    const orderId = OrdersState.selectedOrder.id;
    
    try {
        showLoading('جاري تحديث حالة الطلب...');

        // Call REAL Firebase update via OrdersService
        const result = await OrdersService.updateStatus(orderId, newStatus);

        if (result.success) {
            // Update local state
            const orderIndex = OrdersState.orders.findIndex(o => o.id === orderId);
            if (orderIndex !== -1) {
                OrdersState.orders[orderIndex].status = newStatus;
                OrdersState.orders[orderIndex].updatedAt = new Date().toISOString();
            }

            showNotification('success', `تم تحديث حالة الطلب إلى "${getStatusText(newStatus)}"`);
            
            closeOrderModal();
            applyFilters();
            updateOrderStats();

            // Send notification to customer if needed
            if (newStatus === 'ready' || newStatus === 'delivered') {
                sendStatusNotification(OrdersState.selectedOrder, newStatus);
            }

            // Create notification in system
            await NotificationsService.generateOrderNotification({
                ...OrdersState.selectedOrder,
                status: newStatus
            });

        } else {
            throw new Error(result.error || 'فشل تحديث الحالة');
        }
    } catch (error) {
        hideLoading();
        showNotification('error', error.message);
    }
}

// Legacy alias
async function updateOrderStatus(orderId) {
    openStatusUpdate(orderId);
}

// ==========================================
// Order Timeline Visualization
// ==========================================
function updateOrderTimeline(currentStatus) {
    const steps = ['pending', 'confirmed', 'preparing', 'ready', 'delivered'];
    const stepElements = document.querySelectorAll('.timeline-step');

    stepElements.forEach((step, index) => {
        const stepStatus = steps[index];
        step.classList.remove('completed', 'active');
        
        const statusIndex = steps.indexOf(currentStatus);
        
        if (currentStatus === 'cancelled') {
            // Special handling for cancelled orders
            step.classList.add(index === 0 ? 'cancelled' : '');
        } else if (index < statusIndex) {
            step.classList.add('completed');
        } else if (index === statusIndex) {
            step.classList.add('active');
        }
    });
}

// ==========================================
// WhatsApp Integration
// ==========================================
function sendWhatsAppNotification() {
    if (!OrdersState.selectedOrder) return;
    sendWhatsAppToCustomer(OrdersState.selectedOrder.id);
}

function sendWhatsAppToCustomer(orderId) {
    const order = OrdersState.orders.find(o => o.id === orderId) || OrdersState.selectedOrder;
    if (!order || !order.customerPhone) {
        showNotification('warning', 'لا يوجد رقم هاتف لهذا الطلب');
        return;
    }

    const restaurant = AppState.restaurant || {};
    const phoneNumber = order.customerPhone.replace(/\s/g, '').replace('+', '');
    
    let message = `🆕 *تحديث طلب ${formatOrderId(order.id)}*\n\n`;
    message += `مرحباً ${order.customerName || 'عميلنا العزيز'}،\n\n`;
    message += `📋 *حالة الطلب:* ${getStatusText(order.status)}\n`;
    
    if (order.items && order.items.length > 0) {
        message += `\n🛒 *الأصناف:*\n`;
        order.items.forEach((item, i) => {
            message += `${i+1}. ${item.name || 'صنف'} × ${item.quantity || 1}\n`;
        });
    }
    
    message += `\n💰 *الإجمالي:* ${formatCurrency(order.total || order.amount || 0)}\n\n`;
    message += `شكراً لتعاملك مع ${restaurant.name || 'المطعم'} 🙏`;

    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
    
    console.log(`[Orders] Sent WhatsApp notification for order ${orderId}`);
}

function sendStatusNotification(order, newStatus) {
    // This would typically trigger a backend notification service
    console.log(`[Orders] Sending ${newStatus} notification for order ${order.id}`);
    // In production, this could integrate with:
    // - Firebase Cloud Messaging (FCM)
    // - Twilio SMS
    // - Email service
    // - WebSocket push
}

// ==========================================
// Print Order
// ==========================================
function printOrder() {
    if (!OrdersState.selectedOrder) return;
    
    const order = OrdersState.selectedOrder;
    const printContent = document.getElementById('printOrderContent');
    
    if (printContent) {
        printContent.innerHTML = generateOrderPrintHTML(order);
        printElement('printOrderContent');
    }
}

function generateOrderPrintHTML(order) {
    const restaurant = AppState.restaurant || { name: 'المطعم' };
    
    let html = `
        <div style="font-family: 'Cairo', sans-serif; direction: rtl; padding: 20px; max-width: 400px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px dashed #333; padding-bottom: 20px;">
                <h2 style="margin: 0;">${restaurant.name}</h2>
                <p style="color: #666; margin: 5px 0;">${restaurant.address || ''}</p>
                <p style="color: #666; margin: 5px 0;">📞 ${restaurant.phone || ''}</p>
            </div>
            
            <h3 style="margin-bottom: 10px;">إيصال طلب #${formatOrderId(order.id)}</h3>
            <p style="color: #666; margin-bottom: 20px;">${formatDateTime(order.createdAt || order.timestamp)}</p>
            
            <div style="margin-bottom: 20px;">
                <p><strong>العميل:</strong> ${order.customerName || '---'}</p>
                <p><strong>الهاتف:</strong> ${order.customerPhone || '---'}</p>
                <p><strong>الحالة:</strong> ${getStatusText(order.status)}</p>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                    <tr style="border-bottom: 2px solid #333;">
                        <th style="padding: 8px; text-align: right;">الصنف</th>
                        <th style="padding: 8px; text-align: center;">الكمية</th>
                        <th style="padding: 8px; text-align: left;">السعر</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    if (order.items) {
        order.items.forEach(item => {
            html += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 8px;">${item.name || '---'}</td>
                    <td style="padding: 8px; text-align: center;">${item.quantity || 1}</td>
                    <td style="padding: 8px; text-align: left;">${formatCurrency(item.price || 0)}</td>
                </tr>
            `;
        });
    }
    
    html += `
                </tbody>
            </table>
            
            <div style="border-top: 2px dashed #333; padding-top: 15px; text-align: left;">
                <h3 style="margin: 0;">الإجمالي: ${formatCurrency(order.total || order.amount || 0)}</h3>
            </div>
            
            ${order.notes ? `<p style="margin-top: 20px; padding: 10px; background: #f9f9f9; border-radius: 5px;"><strong>ملاحظات:</strong> ${order.notes}</p>` : ''}
            
            <div style="text-align: center; margin-top: 30px; color: #999; font-size: 12px;">
                <p>شكراً لتعاملكم معنا! 🙏</p>
            </div>
        </div>
    `;
    
    return html;
}

// ==========================================
// Export Orders to Excel/CSV
// ==========================================
function exportOrders() {
    if (OrdersState.filteredOrders.length === 0) {
        showNotification('warning', 'لا توجد طلبات للتصدير');
        return;
    }

    const exportData = OrdersState.filteredOrders.map(order => ({
        'رقم الطلب': formatOrderId(order.id),
        'اسم العميل': order.customerName || '',
        'هاتف العميل': order.customerPhone || '',
        'عدد الأصناف': order.items?.length || 0,
        'الإجمالي': order.total || order.amount || 0,
        'الحالة': getStatusText(order.status),
        'تاريخ الطلب': formatDateTime(order.createdAt || order.timestamp)
    }));

    downloadJSON(exportData, `orders-${new Date().toISOString().split('T')[0]}.json`);
    showNotification('success', 'تم تصدير الطلبات بنجاح');
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

    // Update pagination buttons
    updatePaginationButtons(totalPages);
}

function updatePaginationButtons(totalPages) {
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    const currentPageEl = document.getElementById('currentPage');
    const totalPagesEl = document.getElementById('totalPages');

    if (prevBtn) prevBtn.disabled = OrdersState.pagination.currentPage <= 1;
    if (nextBtn) nextBtn.disabled = OrdersState.pagination.currentPage >= totalPages;
    if (currentPageEl) currentPageEl.textContent = OrdersState.pagination.currentPage;
    if (totalPagesEl) totalPagesEl.textContent = totalPages || 1;
}

function goToPage(pageNum) {
    const totalPages = Math.ceil(OrdersState.filteredOrders.length / OrdersState.pagination.itemsPerPage);
    if (pageNum >= 1 && pageNum <= totalPages) {
        OrdersState.pagination.currentPage = pageNum;
        renderOrdersTable();
    }
}

function nextPage() {
    goToPage(OrdersState.pagination.currentPage + 1);
}

function prevPage() {
    goToPage(OrdersState.pagination.currentPage - 1);
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

function getPaymentMethodText(method) {
    const methods = {
        cash: 'نقدي',
        card: 'بطاقة',
        wallet: 'محفظة إلكترونية',
        online: 'دفع أونلاين'
    };
    return methods[method] || method || 'نقدي';
}

function getOrderTypeText(type) {
    const types = {
        delivery: 'توصيل',
        dine_in: 'في المطعم',
        takeaway: 'استلام من المطعم'
    };
    return types[type] || type || 'توصيل';
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
    if (OrdersState.realTimeInterval) {
        clearInterval(OrdersState.realTimeInterval);
    }
});
