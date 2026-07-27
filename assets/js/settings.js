/* ===================================
   MezoMenu SaaS - Settings Functions
   إعدادات المطعم
   =================================== */

// ==========================================
// Settings State
// ==========================================
const SettingsState = {
    currentTab: 'general',
    hasUnsavedChanges: false,
    originalData: null
};

// ==========================================
// Initialize Settings Page
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    initSettingsTabs();
    loadRestaurantSettings();
    initColorPicker();
    initLogoUpload();
    generateQRCode();
    
    // Warn before leaving with unsaved changes
    window.addEventListener('beforeunload', (e) => {
        if (SettingsState.hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
});

// ==========================================
// Settings Tabs
// ==========================================
function initSettingsTabs() {
    const tabs = document.querySelectorAll('.settings-tab');
    const panels = document.querySelectorAll('.settings-panel');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;

            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Show corresponding panel
            panels.forEach(panel => {
                panel.classList.remove('active');
                if (panel.id === `panel-${targetTab}`) {
                    panel.classList.add('active');
                }
            });

            SettingsState.currentTab = targetTab;
        });
    });
}

// ==========================================
// Load Restaurant Settings
// ==========================================
async function loadRestaurantSettings() {
    try {
        const restaurantId = getRestaurantIdFromStorage();
        const response = await fetch(`${CONFIG.API_URL}/api/restaurants/${restaurantId}`);
        const data = await response.json();

        if (data.success) {
            SettingsState.originalData = data.restaurant;
            populateSettingsForm(data.restaurant);
        }
    } catch (error) {
        console.error('Error loading settings:', error);
        // Use default values from form
    }
}

// ==========================================
// Populate Form with Data
// ==========================================
function populateSettingsForm(restaurant) {
    // Basic info
    setFieldValue('restaurantName', restaurant.name);
    setFieldValue('restaurantSlug', restaurant.slug);
    setFieldValue('restaurantDescription', restaurant.description);
    setFieldValue('cuisineType', restaurant.cuisineType || 'egyptian');
    setFieldValue('restaurantCity', restaurant.city);
    setFieldValue('restaurantAddress', restaurant.address);
    setFieldValue('restaurantPhone', restaurant.phone);
    setFieldValue('currency', restaurant.currency || 'EGP');
    
    // WhatsApp
    setFieldValue('whatsappNumber', restaurant.whatsappNumber);
    setFieldValue('welcomeMessage', restaurant.welcomeMessage);
    setFieldValue('orderMessageTemplate', restaurant.orderMessageTemplate);

    // Logo
    if (restaurant.logoUrl) {
        const logoPreview = document.getElementById('logoPreview');
        const logoIcon = document.getElementById('logoIcon');
        if (logoPreview && logoIcon) {
            logoPreview.src = restaurant.logoUrl;
            logoPreview.style.display = 'block';
            logoIcon.style.display = 'none';
        }
    }

    // Theme color
    if (restaurant.themeColor) {
        updateThemeColor(restaurant.themeColor);
    }

    // Working hours
    if (restaurant.workingHours) {
        populateWorkingHours(restaurant.workingHours);
    }
}

function setFieldValue(id, value) {
    const field = document.getElementById(id);
    if (field && value !== undefined && value !== null) {
        field.value = value;
    }
}

function populateWorkingHours(hours) {
    const days = ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const dayRows = document.querySelectorAll('.day-row');
    
    dayRows.forEach((row, index) => {
        if (hours[days[index]]) {
            const timeInputs = row.querySelectorAll('input[type="time"]');
            const toggleSwitch = row.querySelector('input[type="checkbox"]');
            
            if (timeInputs.length >= 2) {
                timeInputs[0].value = hours[days[index]].open || '10:00';
                timeInputs[1].value = hours[days[index]].close || '23:59';
            }
            
            if (toggleSwitch) {
                toggleSwitch.checked = hours[days[index]].isOpen !== false;
            }
        }
    });
}

// ==========================================
// Color Picker
// ==========================================
function initColorPicker() {
    const colorBtns = document.querySelectorAll('.color-btn');
    const customColorPicker = document.getElementById('customColorPicker');

    colorBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            colorBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const color = btn.dataset.color;
            updateThemeColor(color);
            
            if (customColorPicker) {
                customColorPicker.value = color;
            }
            
            markAsChanged();
        });
    });

    if (customColorPicker) {
        customColorPicker.addEventListener('input', (e) => {
            colorBtns.forEach(b => b.classList.remove('active'));
            updateThemeColor(e.target.value);
            markAsChanged();
        });
    }
}

function updateThemeColor(color) {
    // This would update CSS variables in real implementation
    console.log('Theme color changed to:', color);
}

// ==========================================
// Logo Upload
// ==========================================
function initLogoUpload() {
    const uploadArea = document.getElementById('logoUploadArea');
    const logoInput = document.getElementById('logoInput');

    if (uploadArea && logoInput) {
        uploadArea.addEventListener('click', () => logoInput.click());

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = 'var(--primary-color)';
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.style.borderColor = 'var(--gray-300)';
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = 'var(--gray-300)';
            
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                handleLogoUpload(file);
            }
        });

        logoInput.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                handleLogoUpload(e.target.files[0]);
            }
        });
    }
}

async function handleLogoUpload(file) {
    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
        showNotification('error', 'حجم الملف كبير جداً. الحد الأقصى 2 ميجابايت');
        return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = async (e) => {
        const logoPreview = document.getElementById('logoPreview');
        const logoIcon = document.getElementById('logoIcon');
        
        if (logoPreview && logoIcon) {
            logoPreview.src = e.target.result;
            logoPreview.style.display = 'block';
            logoIcon.style.display = 'none';
        }

        // Upload to server
        try {
            showLoading('جاري رفع الشعار...');
            
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', 'logo');

            const response = await fetch(`${CONFIG.API_URL}/api/upload`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                showNotification('success', 'تم رفع الشعار بنجاح');
                markAsChanged();
            } else {
                throw new Error(result.error || 'فشل الرفع');
            }
        } catch (error) {
            showNotification('error', error.message);
        } finally {
            hideLoading();
        }
    };
    reader.readAsDataURL(file);
}

// ==========================================
// QR Code Generation
// ==========================================
function generateQRCode() {
    const canvas = document.getElementById('qrCodeCanvas');
    if (!canvas) return;

    const slug = document.getElementById('restaurantSlug')?.value || 'el-mabrouk';
    const menuUrl = `${window.location.origin}/r/${slug}`;

    if (typeof QRCode !== 'undefined') {
        QRCode.toCanvas(canvas, menuUrl, {
            width: 200,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        }, function(error) {
            if (error) console.error(error);
        });
    } else {
        // Fallback: simple placeholder
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, 200, 200);
        ctx.fillStyle = '#333';
        ctx.font = '14px Cairo';
        ctx.textAlign = 'center';
        ctx.fillText('QR Code', 100, 100);
        ctx.fillText(menuUrl, 100, 120);
    }
}

function downloadQRCode() {
    const canvas = document.getElementById('qrCodeCanvas');
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `qrcode-${document.getElementById('restaurantSlug')?.value || 'menu'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    showNotification('success', 'تم تحميل رمز QR');
}

function printQRCode() {
    const canvas = document.getElementById('qrCodeCanvas');
    if (!canvas) return;

    const win = window.open('', '_blank');
    win.document.write(`
        <html dir="rtl">
            <head><title>رمز QR للقائمة</title></head>
            <body style="text-align: center; padding: 20px;">
                <h2>قائمة ${document.getElementById('restaurantName')?.value || 'المطعم'}</h2>
                <img src="${canvas.toDataURL()}" alt="QR Code">
                <p>امسح هذا الكود لعرض القائمة</p>
            </body>
        </html>
    `);
    win.document.close();
    win.print();
}

// ==========================================
// Save Settings
// ==========================================
async function saveAllSettings() {
    try {
        showLoading('جاري حفظ الإعدادات...');

        const settings = collectFormData();

        const restaurantId = getRestaurantIdFromStorage();
        const response = await fetch(`${CONFIG.API_URL}/api/restaurants/${restaurantId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify(settings)
        });

        const result = await response.json();

        if (result.success) {
            SettingsState.hasUnsavedChanges = false;
            SettingsState.originalData = settings;
            showNotification('success', 'تم حفظ الإعدادات بنجاح');
            generateQRCode(); // Regenerate QR code with updated slug
        } else {
            throw new Error(result.error || 'فشل الحفظ');
        }
    } catch (error) {
        showNotification('error', error.message);
    } finally {
        hideLoading();
    }
}

// ==========================================
// Collect Form Data
// ==========================================
function collectFormData() {
    return {
        name: document.getElementById('restaurantName')?.value,
        slug: document.getElementById('restaurantSlug')?.value,
        description: document.getElementById('restaurantDescription')?.value,
        cuisineType: document.getElementById('cuisineType')?.value,
        city: document.getElementById('restaurantCity')?.value,
        address: document.getElementById('restaurantAddress')?.value,
        phone: document.getElementById('restaurantPhone')?.value,
        currency: document.getElementById('currency')?.value,
        whatsappNumber: document.getElementById('whatsappNumber')?.value,
        welcomeMessage: document.getElementById('welcomeMessage')?.value,
        orderMessageTemplate: document.getElementById('orderMessageTemplate')?.value,
        themeColor: document.querySelector('.color-btn.active')?.dataset.color || 
                     document.getElementById('customColorPicker')?.value,
        workingHours: collectWorkingHours()
    };
}

function collectWorkingHours() {
    const days = ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const dayRows = document.querySelectorAll('.day-row');
    const hours = {};

    dayRows.forEach((row, index) => {
        const timeInputs = row.querySelectorAll('input[type="time"]');
        const toggleSwitch = row.querySelector('input[type="checkbox"]');
        
        hours[days[index]] = {
            open: timeInputs[0]?.value || '10:00',
            close: timeInputs[1]?.value || '23:59',
            isOpen: toggleSwitch?.checked !== false
        };
    });

    return hours;
}

// ==========================================
// WhatsApp Test
// ==========================================
function testWhatsApp() {
    const number = document.getElementById('whatsappNumber')?.value;
    if (!number) {
        showNotification('warning', 'الرجاء إدخال رقم واتساب أولاً');
        return;
    }

    const cleanNumber = number.replace(/\s/g, '').replace('+', '');
    const message = encodeURIComponent(document.getElementById('welcomeMessage')?.value || 'رسالة تجريبية من MezoMenu');
    
    window.open(`https://wa.me/${cleanNumber}?text=${message}`, '_blank');
}

// ==========================================
// Subscription Modal
// ==========================================
function showUpgradeModal() {
    // Scroll to subscription section or open modal
    const subPanel = document.getElementById('panel-subscription');
    const subTab = document.querySelector('[data-tab="subscription"]');
    
    if (subTab) subTab.click();
    if (subPanel) subPanel.scrollIntoView({ behavior: 'smooth' });
}

// ==========================================
// Utility Functions
// ==========================================
function markAsChanged() {
    SettingsState.hasUnsavedChanges = true;
}

function getRestaurantIdFromStorage() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.restaurantId || 'default';
}

function getAuthToken() {
    return localStorage.getItem('authToken') || '';
}
