/**
 * MezoMenu - Authentication Module
 * Handles login, registration, and session management
 */

document.addEventListener('DOMContentLoaded', function() {
    initAuth();
});

// ========================================
// Initialization
// ========================================

function initAuth() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (loginForm) {
        setupLoginForm(loginForm);
    }

    if (registerForm) {
        setupRegisterForm(registerForm);
        setupPasswordStrength();
        setupStepNavigation();
    }

    // Check for plan parameter in URL
    checkPlanParameter();
}

// ========================================
// Login Form
// ========================================

function setupLoginForm(form) {
    // Toggle password visibility
    const toggleBtns = form.querySelectorAll('.toggle-password');
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const input = this.parentElement.querySelector('input');
            togglePasswordVisibility(input, this);
        });
    });

    // Form submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = form.querySelector('#email').value;
        const password = form.querySelector('#password').value;
        const rememberMe = form.querySelector('[name="remember"]')?.checked;

        await handleLogin(email, password, rememberMe, form);
    });
}

async function handleLogin(email, password, rememberMe, form) {
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    try {
        // Show loading state
        setLoadingState(submitBtn, true, 'جاري تسجيل الدخول...');

        // Validate inputs
        if (!validateEmail(email)) {
            showError(form, 'يرجى إدخال بريد إلكتروني صحيح');
            return;
        }

        if (password.length < 6) {
            showError(form, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
            return;
        }

        // Attempt login
        const result = await loginUser(email, password);

        if (result.user) {
            // Store session data
            const userData = {
                uid: result.user.uid,
                email: email,
                loginTime: Date.now(),
                rememberMe: rememberMe
            };
            
            localStorage.setItem('mezomenu_user', JSON.stringify(userData));

            if (rememberMe) {
                localStorage.setItem('mezomenu_remember', 'true');
            }

            // Show success and redirect
            showSuccess('تم تسجيل الدخول بنجاح! جاري التحويل...');
            
            setTimeout(() => {
                window.location.href = 'admin/index.html';
            }, 1000);
        } else {
            showError(form, 'فشل تسجيل الدخول. يرجى التحقق من البيانات');
        }
    } catch (error) {
        console.error('Login error:', error);
        
        let errorMessage = 'حدث خطأ أثناء تسجيل الدخول';
        
        switch(error.code) {
            case 'auth/user-not-found':
                errorMessage = 'لا يوجد حساب بهذا البريد الإلكتروني';
                break;
            case 'auth/wrong-password':
                errorMessage = 'كلمة المرور غير صحيحة';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'محاولات كثيرة جداً. يرجى المحاولة لاحقاً';
                break;
            case 'auth/invalid-email':
                errorMessage = 'البريد الإلكتروني غير صالح';
                break;
        }
        
        showError(form, errorMessage);
    } finally {
        setLoadingState(submitBtn, false, originalText);
    }
}

// ========================================
// Registration Form
// ========================================

function setupRegisterForm(form) {
    // Toggle password visibility
    const toggleBtns = form.querySelectorAll('.toggle-password');
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const input = this.parentElement.querySelector('input');
            togglePasswordVisibility(input, this);
        });
    });

    // Form submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        await handleRegistration(form);
    });
}

let currentStep = 1;
const totalSteps = 3;

function setupStepNavigation() {
    const nextBtns = document.querySelectorAll('.next-btn');
    const prevBtns = document.querySelectorAll('.prev-btn');

    nextBtns.forEach(btn => {
        btn.addEventListener('click', () => goToStep(currentStep + 1));
    });

    prevBtns.forEach(btn => {
        btn.addEventListener('click', () => goToStep(currentStep - 1));
    });
}

function goToStep(step) {
    if (step < 1 || step > totalSteps) return;

    // Validate current step before proceeding
    if (step > currentStep && !validateStep(currentStep)) {
        return;
    }

    currentStep = step;

    // Update steps UI
    updateStepsUI();

    // Show/hide form steps
    document.querySelectorAll('.form-step').forEach(stepEl => {
        stepEl.classList.remove('active');
        if (parseInt(stepEl.dataset.step) === currentStep) {
            stepEl.classList.add('active');
        }
    });
}

function validateStep(step) {
    const form = document.getElementById('registerForm');

    switch(step) {
        case 1:
            const fullName = form.querySelector('#fullName').value.trim();
            const email = form.querySelector('#regEmail').value.trim();
            const phone = form.querySelector('#phone').value.trim();
            const password = form.querySelector('#regPassword').value;
            const confirmPassword = form.querySelector('#confirmPassword').value;

            if (!fullName) {
                showFieldError(form.querySelector('#fullName'), 'مطلوب');
                return false;
            }
            if (!validateEmail(email)) {
                showFieldError(form.querySelector('#regEmail'), 'بريد إلكتروني غير صالح');
                return false;
            }
            if (!phone) {
                showFieldError(form.querySelector('#phone'), 'مطلوب');
                return false;
            }
            if (password.length < 8) {
                showFieldError(form.querySelector('#regPassword'), '8 أحرف على الأقل');
                return false;
            }
            if (password !== confirmPassword) {
                showFieldError(form.querySelector('#confirmPassword'), 'كلمات المرور غير متطابقة');
                return false;
            }
            return true;

        case 2:
            const restaurantName = form.querySelector('#restaurantName').value.trim();
            const cuisineType = form.querySelector('#cuisineType').value;

            if (!restaurantName) {
                showFieldError(form.querySelector('#restaurantName'), 'مطلوب');
                return false;
            }
            if (!cuisineType) {
                showFieldError(form.querySelector('#cuisineType'), 'مطلوب');
                return false;
            }
            return true;

        case 3:
            const termsChecked = form.querySelector('[name="terms"]').checked;
            if (!termsChecked) {
                alert('يجب الموافقة على الشروط والأحكام');
                return false;
            }
            return true;

        default:
            return true;
    }
}

function updateStepsUI() {
    document.querySelectorAll('.progress-steps .step').forEach((stepEl, index) => {
        const stepNum = index + 1;
        stepEl.classList.remove('active', 'completed');
        
        if (stepNum === currentStep) {
            stepEl.classList.add('active');
        } else if (stepNum < currentStep) {
            stepEl.classList.add('completed');
        }
    });
}

async function handleRegistration(form) {
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;

    try {
        setLoadingState(submitBtn, true, 'جاري إنشاء الحساب...');

        // Collect all form data
        const userData = {
            fullName: form.querySelector('#fullName').value.trim(),
            email: form.querySelector('#regEmail').value.trim(),
            phone: form.querySelector('#phone').value.trim(),
            restaurant: {
                name: form.querySelector('#restaurantName').value.trim(),
                slug: form.querySelector('#restaurantSlug').value.trim().toLowerCase().replace(/\s+/g, '-'),
                cuisineType: form.querySelector('#cuisineType').value,
                address: form.querySelector('#address').value.trim(),
                city: form.querySelector('#city').value,
                whatsappNumber: form.querySelector('#whatsappNumber').value.trim()
            },
            plan: form.querySelector('[name="plan"]:checked')?.value || 'free'
        };

        // Register user
        const result = await registerUser(
            userData.email,
            form.querySelector('#regPassword').value,
            userData
        );

        if (result.user) {
            // Store user data
            localStorage.setItem('mezomenu_user', JSON.stringify({
                uid: result.user.uid,
                email: userData.email,
                displayName: userData.fullName,
                isNewUser: true
            }));

            // Show success message
            showSuccessMessage();

            // Redirect to dashboard after delay
            setTimeout(() => {
                window.location.href = 'admin/index.html?new=true';
            }, 2000);
        }
    } catch (error) {
        console.error('Registration error:', error);
        
        let errorMessage = 'حدث خطأ أثناء إنشاء الحساب';
        
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'هذا البريد الإلكتروني مسجل بالفعل';
        }
        
        alert(errorMessage);
    } finally {
        setLoadingState(submitBtn, false, originalText);
    }
}

// ========================================
// Password Strength
// ========================================

function setupPasswordStrength() {
    const passwordInput = document.querySelector('#regPassword');
    if (!passwordInput) return;

    passwordInput.addEventListener('input', function() {
        const strength = calculatePasswordStrength(this.value);
        updateStrengthIndicator(strength);
    });
}

function calculatePasswordStrength(password) {
    let strength = 0;
    
    if (password.length >= 8) strength++;
    if (password.match(/[a-z]/)) strength++;
    if (password.match(/[A-Z]/)) strength++;
    if (password.match(/[0-9]/)) strength++;
    if (password.match(/[^a-zA-Z0-9]/)) strength++;

    if (strength <= 2) return 'weak';
    if (strength <= 3) return 'medium';
    return 'strong';
}

function updateStrengthIndicator(strength) {
    const bar = document.querySelector('.strength-bar');
    const text = document.querySelector('.strength-text');
    
    if (!bar || !text) return;

    bar.className = 'strength-bar ' + strength;
    
    const messages = {
        weak: 'ضعيفة',
        medium: 'متوسطة',
        strong: 'قوية'
    };
    
    text.textContent = 'قوة كلمة المرور: ' + messages[strength];
}

// ========================================
// Utility Functions
// ========================================

function togglePasswordVisibility(input, btn) {
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
    } else {
        input.type = 'password';
        btn.textContent = '👁️';
    }
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function setLoadingState(btn, loading, text) {
    btn.disabled = loading;
    btn.innerHTML = loading 
        ? '<span class="spinner"></span> ' + text 
        : text;
}

function showError(form, message) {
    // Remove existing error
    const existingError = form.querySelector('.form-error-message');
    if (existingError) existingError.remove();

    // Create error element
    const errorDiv = document.createElement('div');
    errorDiv.className = 'form-error-message';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
        background: #fef2f2;
        color: #dc2626;
        padding: 12px 16px;
        border-radius: 8px;
        margin-bottom: 16px;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    errorDiv.innerHTML = `⚠️ ${message}`;

    form.insertBefore(errorDiv, form.firstChild);

    // Auto remove after 5 seconds
    setTimeout(() => errorDiv.remove(), 5000);
}

function showSuccess(message) {
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = 'toast-success';
    toast.innerHTML = `✅ ${message}`;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        font-weight: 600;
        box-shadow: 0 10px 25px rgba(16, 185, 129, 0.3);
        z-index: 9999;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 3000);
}

function showSuccessMessage() {
    const form = document.getElementById('registerForm');
    if (!form) return;

    form.innerHTML = `
        <div class="success-message" style="display: block;">
            <div class="success-icon">🎉</div>
            <h2>تم إنشاء حسابك بنجاح!</h2>
            <p>جاري تحويلك إلى لوحة التحكم...</p>
        </div>
    `;
}

function showFieldError(field, message) {
    field.classList.add('error');
    
    // Remove existing error
    let errorEl = field.parentElement.querySelector('.field-error');
    if (errorEl) errorEl.remove();

    // Add error message
    errorEl = document.createElement('span');
    errorEl.className = 'field-error';
    errorEl.textContent = message;
    errorEl.style.cssText = `
        color: #dc2626;
        font-size: 12px;
        margin-top: 4px;
        display: block;
    `;
    field.parentElement.appendChild(errorEl);

    // Remove on focus
    field.addEventListener('focus', function() {
        this.classList.remove('error');
        errorEl?.remove();
    }, { once: true });
}

function checkPlanParameter() {
    const urlParams = new URLSearchParams(window.location.search);
    const plan = urlParams.get('plan');
    
    if (plan && document.querySelector(`input[name="plan"][value="${plan}"]`)) {
        document.querySelector(`input[name="plan"][value="${plan}"]`).checked = true;
    }
}

// Add CSS for spinner animation
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    .spinner {
        display: inline-block;
        width: 18px;
        height: 18px;
        border: 2px solid rgba(255,255,255,.3);
        border-radius: 50%;
        border-top-color: white;
        animation: spin 0.8s ease infinite;
    }
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
`;
document.head.appendChild(style);
