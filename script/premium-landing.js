/**
 * OFFSZN Premium Landing JS
 * Lightweight logic for FAQ, smooth transitions, and anchor navigation.
 */

document.addEventListener('DOMContentLoaded', () => {
    initFaq();
    initScrollReveal();
    initMobileNav();
    initSmoothScroll();
});

/**
 * FAQ Accordion Toggle
 */
function initFaq() {
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const trigger = item.querySelector('.faq-trigger');
        const content = item.querySelector('.faq-content');
        
        trigger.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            
            // Close all items
            faqItems.forEach(otherItem => {
                otherItem.classList.remove('active');
                const otherContent = otherItem.querySelector('.faq-content');
                if (otherContent) otherContent.style.maxHeight = null;
            });
            
            // Toggle current item
            if (!isActive) {
                item.classList.add('active');
                if (content) content.style.maxHeight = content.scrollHeight + "px";
            } else {
                item.classList.remove('active');
                if (content) content.style.maxHeight = null;
            }
        });
    });
}

/**
 * Basic Scroll Reveal (Using Intersection Observer)
 */
function initScrollReveal() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    const revealElements = document.querySelectorAll('.reveal-on-scroll');
    revealElements.forEach(el => {
        observer.observe(el);
    });
}

/**
 * Mobile Navigation (Simple)
 */
function initMobileNav() {
    const toggle = document.getElementById('mobile-toggle');
    const header = document.querySelector('.navbar-landing');
    
    if (toggle && header) {
        toggle.addEventListener('click', () => {
            header.classList.toggle('mobile-menu-active');
        });
    }
}

/**
 * Smooth Scroll for Anchors
 */
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const target = document.querySelector(targetId);
            if (target) {
                window.scrollTo({
                    top: target.offsetTop - 80,
                    behavior: 'smooth'
                });
            }
        });
    });
}

/**
 * GSAP Animations for the 3-Step Simulator Guide
 */
function initSimulatorAnimations() {
    if (!window.gsap || !window.ScrollTrigger) return;
    
    gsap.registerPlugin(ScrollTrigger);

    // Animate Step Items one by one
    gsap.from(".step-item", {
        scrollTrigger: {
            trigger: ".steps-guide",
            start: "top 80%",
        },
        y: 30,
        opacity: 0,
        duration: 0.8,
        stagger: 0.2,
        ease: "power3.out"
    });

    // Animate Dropzone
    gsap.from(".simulator-interaction-box", {
        scrollTrigger: {
            trigger: ".simulator-interaction-box",
            start: "top 85%",
        },
        scale: 0.95,
        opacity: 0,
        duration: 1,
        ease: "expo.out"
    });
}
