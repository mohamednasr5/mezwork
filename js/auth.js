/* ===================================
   MezoMenu - Auth JavaScript
   Login & Register Handlers
   =================================== */

document.addEventListener('DOMContentLoaded', function() {
    // Check if already logged in
    if (window.MezoMenu && window.MezoMenu.Auth.isAuthenticated()) {
        const user = window.MezoMenu.Auth.getUser();
        if (user?.restaurantId) {
            window.location.href = '/admin/';
        }
    }

    // Initialize password toggle
    initPasswordToggle();
    
    // Initialize form validation
    initFormValidation();
});

/**
 * Handle login form submission
 */
async function handleLogin(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitBtn = document.getElementById('submitBtn');
    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');
    
    // Hide previous messages
    errorDiv.classList.add('hidden');
    successDiv.classList.add('hidden');
    
    // Get form data
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    
    // Validate
    if (!email || !password) {
        showError('يرجى ملء جميع الحقول المطلوبة');
        return;
    }
    
    // Show loading state
    setLoading(submitBtn, true);
    
    try {
        // For demo purposes, simulate login
        await simulateLogin(email, password);
        
        // Show success message
        showSuccess('تم تسجيل الدخول بنجاح! جاري التحويل...');
        
        // Redirect to admin dashboard after short delay
        setTimeout(() => {
            window.location.href = '/admin/';
        }, 1000);
        
    } catch (error) {
        showError(error.message || 'فشل تسجيل الدخول. يرجى المحاولة مرة أخرى.');
    } finally {
        setLoading(submitBtn, false);
    }
}

/**
 * Handle registration form submission
 */
async function handleRegister(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitBtn = form.querySelector('[type="submit"]');
    const errorDiv = document.getElementById('errorMessage');
    
    // Hide previous messages
    errorDiv.classList.add('hidden');
    
    // Get form data
    const formData = new FormData(form);
    const userData = {
        restaurantName: formData.get('restaurantName'),
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        password: formData.get('password'),
        plan: formData.get('plan') || 'starter'
    };
    
    // Validate required fields
    if (!userData.restaurantName || !userData.name || !userData.email || !userData.password) {
        showError('يرجى ملء جميع الحقول المطلوبة');
        return;
    }
    
    // Validate email format
    if (!MezoMenu.Utils.validateEmail(userData.email)) {
        showError('يرجى إدخال بريد إلكتروني صحيح');
        return;
    }
    
    // Validate password strength
    if (userData.password.length < 6) {
        showError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
        return;
    }
    
    // Show loading
    setLoading(submitBtn, true);
    
    try {
        // Simulate registration
        await simulateRegister(userData);
        
        showSuccess('تم إنشاء حسابك بنجاح! جاري التحويل...');
        
        setTimeout(() => {
            window.location.href = '/admin/settings.html';
        }, 1500);
        
    } catch (error) {
        showError(error.message || 'فشل إنشاء الحساب. يرجى المحاولة مرة أخرى.');
    } finally {
        setLoading(submitBtn, false);
    }
}

/**
 * Simulate login for demo
 */
async function simulateLogin(email, password) {
    // Demo credentials check
    const demoCredentials = [
        { email: 'demo@mernasmenu.com', password: 'demo1234' },
        { email: 'admin@mezomenu.com', password: 'admin123' },
        { email: 'test@test.com', password: 'test123' }
    ];
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const isValid = demoCredentials.some(
        cred => cred.email === email && cred.password === password
    );
    
    if (!isValid) {
        throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }
    
    // Store mock user data
    const mockUser = {
        id: 'usr_' + Date.now(),
        email: email,
        name: 'مطعم تجريبي',
        restaurantId: 'rest_demo_001',
        role: 'owner',
        plan: 'pro',
        createdAt: new Date().toISOString()
    };
    
    localStorage.setItem('mezomenu_user', JSON.stringify(mockUser));
    localStorage.setItem('mezomenu_token', 'mock_token_' + Date.now());
}

/**
 * Simulate registration for demo
 */
async function simulateRegister(userData) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Create mock user
    const mockUser = {
        id: 'usr_' + Date.now(),
        email: userData.email,
        name: userData.name,
        restaurantName: userData.restaurantName,
        restaurantId: 'rest_' + Date.now(),
        role: 'owner',
        plan: userData.plan,
        createdAt: new Date().toISOString()
    };
    
    localStorage.setItem('mezomenu_user', JSON.stringify(mockUser));
    localStorage.setItem('mezomenu_token', 'mock_token_' + Date.now());
}

/**
 * Toggle password visibility
 */
function togglePassword() {
    const passwordInput = document.getElementById('password');
    const eyeIcon = document.querySelector('.eye-icon');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        eyeIcon.innerHTML = `
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
        `;
    } else {
        passwordInput.type = 'password';
        eyeIcon.innerHTML = `
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
        `;
    }
}

/**
 * Initialize password toggle functionality
 */
function initPasswordToggle() {
    // Already handled by inline onclick, but can add more logic here
}

/**
 * Initialize form validation
 */
function initFormValidation() {
    // Real-time email validation
    const emailInput = document.getElementById('email');
    if (emailInput) {
        emailInput.addEventListener('blur', function() {
            if (this.value && !MezoMenu.Utils.validateEmail(this.value)) {
                this.style.borderColor = '#ef4444';
            } else {
                this.style.borderColor = '';
            }
        });
    }
    
    // Password strength indicator
    const passwordInput = document.getElementById('password');
    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
            updatePasswordStrength(this.value);
        });
    }
}

/**
 * Update password strength indicator
 */
function updatePasswordStrength(password) {
    const strengthContainer = document.querySelector('.password-strength');
    if (!strengthContainer) return;
    
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 10) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    
    const bars = strengthContainer.querySelectorAll('.strength-bar');
    const text = strengthContainer.querySelector('.strength-text');
    
    bars.forEach((bar, index) => {
        bar.classList.remove('active', 'weak', 'medium', 'strong');
        if (index < Math.ceil(strength / 1.25)) {
            bar.classList.add('active');
            if (strength <= 2) bar.classList.add('weak');
            else if (strength <= 3) bar.classList.add('medium');
            else bar.classList.add('strong');
        }
    });
    
    if (text) {
        if (strength <= 2) text.textContent = 'ضعيفة - أضف أحرف وأرقام ورموز';
        else if (strength <= 3) text.textContent = 'متوسطة - يمكن تحسينها';
        else if (strength <= 4) text.textContent = 'قوية - جيد!';
        else text.textContent = 'قوية جداً - ممتاز!';
    }
}

/**
 * Set button loading state
 */
function setLoading(button, isLoading) {
    const btnText = button.querySelector('.btn-text');
    const btnLoader = button.querySelector('.btn-loader');
    
    if (isLoading) {
        button.classList.add('loading');
        button.disabled = true;
        if (btnText) btnText.style.visibility = 'hidden';
        if (btnLoader) btnLoader.classList.remove('hidden');
    } else {
        button.classList.remove('loading');
        button.disabled = false;
        if (btnText) btnText.style.visibility = 'visible';
        if (btnLoader) btnLoader.classList.add('hidden');
    }
}

/**
 * Show error message
 */
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
        errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

/**
 * Show success message
 */
function showSuccess(message) {
    const successDiv = document.getElementById('successMessage');
    if (successDiv) {
        successDiv.textContent = message;
        successDiv.classList.remove('hidden');
    }
}

/**
 * Show support modal or redirect
 */
function showSupport() {
    // Open WhatsApp support
    window.open('https://wa.me/201558056568?text=أحتاج%20مساعدة%20في%20MezoMenu', '_blank');
}

// Export functions for global use
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.togglePassword = togglePassword;
window.showSupport = showSupport;
