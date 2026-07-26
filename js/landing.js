/* ===================================
   MezoMenu - Landing Page JavaScript
   =================================== */

document.addEventListener('DOMContentLoaded', function() {
    // Mobile Menu Toggle
    initMobileMenu();
    
    // Smooth Scroll for anchor links
    initSmoothScroll();
    
    // Navbar scroll effect
    initNavbarScroll();
    
    // Animation on scroll
    initScrollAnimations();
});

/**
 * Initialize mobile menu toggle
 */
function initMobileMenu() {
    const menuBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');
    
    if (menuBtn && navLinks) {
        menuBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            menuBtn.classList.toggle('active');
            
            // Animate hamburger to X
            const spans = menuBtn.querySelectorAll('span');
            if (menuBtn.classList.contains('active')) {
                spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
                spans[1].style.opacity = '0';
                spans[2].style.transform = 'rotate(-45deg) translate(7px, -6px)';
            } else {
                spans[0].style.transform = 'none';
                spans[1].style.opacity = '1';
                spans[2].style.transform = 'none';
            }
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!menuBtn.contains(e.target) && !navLinks.contains(e.target)) {
                navLinks.classList.remove('active');
                menuBtn.classList.remove('active');
                const spans = menuBtn.querySelectorAll('span');
                spans[0].style.transform = 'none';
                spans[1].style.opacity = '1';
                spans[2].style.transform = 'none';
            }
        });
    }
}

/**
 * Initialize smooth scrolling for anchor links
 */
function initSmoothScroll() {
    const links = document.querySelectorAll('a[href^="#"]');
    
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href');
            
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                const navbarHeight = document.querySelector('.navbar')?.offsetHeight || 0;
                const targetPosition = targetElement.offsetTop - navbarHeight - 20;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
                
                // Close mobile menu if open
                const navLinks = document.querySelector('.nav-links');
                const menuBtn = document.querySelector('.mobile-menu-btn');
                if (navLinks?.classList.contains('active')) {
                    navLinks.classList.remove('active');
                    menuBtn?.classList.remove('active');
                }
            }
        });
    });
}

/**
 * Add shadow to navbar on scroll
 */
function initNavbarScroll() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;
    
    let lastScrollY = 0;
    
    window.addEventListener('scroll', MezoMenu.Utils.throttle(() => {
        const currentScrollY = window.scrollY;
        
        if (currentScrollY > 50) {
            navbar.style.boxShadow = '0 4px 6px -1px rgb(0 0 0 / 0.1)';
        } else {
            navbar.style.boxShadow = 'none';
        }
        
        lastScrollY = currentScrollY;
    }, 100));
}

/**
 * Initialize scroll animations using Intersection Observer
 */
function initScrollAnimations() {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-fade-in');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    // Observe feature cards, steps, pricing cards
    const animateElements = document.querySelectorAll(
        '.feature-card, .step, .pricing-card'
    );
    
    animateElements.forEach((el, index) => {
        el.style.opacity = '0';
        el.style.animationDelay = `${index * 100}ms`;
        observer.observe(el);
    });
}

/**
 * Pricing plan selection handler
 */
function selectPlan(planType) {
    // Store selected plan and redirect to register
    localStorage.setItem('selectedPlan', planType);
    window.location.href = `/register.html?plan=${planType}`;
}

/**
 * Track CTA clicks (for analytics)
 */
function trackCTA(action, label) {
    console.log(`CTA: ${action} - ${label}`);
    // In production, send to analytics service
}
