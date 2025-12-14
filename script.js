/* ========================================
   Busy Beaver - Minimal Interactions
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {
    initSmoothScroll();
    initNavToggle();
    initScrollReveal();
});

/* Smooth scroll for anchor links */
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (href === '#') return;

            e.preventDefault();
            const target = document.querySelector(href);

            if (target) {
                const navHeight = document.querySelector('.nav').offsetHeight;
                const top = target.getBoundingClientRect().top + window.pageYOffset - navHeight - 40;

                window.scrollTo({ top, behavior: 'smooth' });

                // Close mobile nav
                document.querySelector('.nav-links')?.classList.remove('active');
                document.querySelector('.nav-toggle')?.classList.remove('active');
            }
        });
    });
}

/* Mobile nav toggle */
function initNavToggle() {
    const toggle = document.querySelector('.nav-toggle');
    const links = document.querySelector('.nav-links');

    if (!toggle || !links) return;

    // Mobile menu styles
    const styles = document.createElement('style');
    styles.textContent = `
        @media (max-width: 768px) {
            .nav-links {
                position: fixed;
                inset: 0;
                background: rgba(250, 247, 242, 0.98);
                backdrop-filter: blur(20px);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 2rem;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s ease;
            }
            .nav-links.active {
                opacity: 1;
                visibility: visible;
            }
            .nav-links .nav-link {
                font-family: 'Cormorant Garamond', serif;
                font-size: 1.5rem;
            }
            .nav-toggle { z-index: 101; }
            .nav-toggle.active span:first-child {
                transform: rotate(45deg) translate(5px, 5px);
            }
            .nav-toggle.active span:last-child {
                transform: rotate(-45deg) translate(5px, -5px);
            }
        }
    `;
    document.head.appendChild(styles);

    toggle.addEventListener('click', () => {
        toggle.classList.toggle('active');
        links.classList.toggle('active');
    });
}

/* Simple scroll reveal */
function initScrollReveal() {
    const elements = document.querySelectorAll('.about-content, .section-title, .post-item, .contact-content');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animationPlayState = 'running';
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    elements.forEach(el => {
        el.style.animationPlayState = 'paused';
        observer.observe(el);
    });
}
