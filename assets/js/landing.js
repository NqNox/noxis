// Feature tabs
const featureData = [
    { icon: '🤖', title: 'AI-Powered Insights', desc: "Our AI analyzes your trade history and detects behavioral patterns you can't see yourself. Know exactly when, why, and how you self-sabotage." },
    { icon: '✅', title: 'Pre-Entry Checklist', desc: 'Before every trade, run through your personal rule checklist. No more impulsive entries. No more "I knew I shouldn\'t have taken that."' },
    { icon: '🎯', title: 'Session Reminder', desc: "Set your trading sessions and let Noxis handle the rest. Get reminders when your session opens and automatic warnings when you're trading outside your hours." },
    { icon: '🔥', title: 'Discipline Streak', desc: 'Track your rule-following streak every single day. Build the habit of consistency and watch your results follow.' }
];

const featureTabs = document.querySelectorAll('.features-tab');
const featuresCardIcon = document.querySelector('.features-card-icon');
const featuresCardTitle = document.querySelector('.features-card-title');
const featuresCardDesc = document.querySelector('.features-card-desc');

featureTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        featureTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const data = featureData[tab.dataset.index];
        if (data && featuresCardIcon && featuresCardTitle && featuresCardDesc) {
            featuresCardIcon.textContent = data.icon;
            featuresCardTitle.textContent = data.title;
            featuresCardDesc.textContent = data.desc;
        }
    });
});

// Nav blur on scroll
const navWrapper = document.querySelector('.nav-wrapper');

if (navWrapper) {
    const toggleScrolled = () => {
        navWrapper.classList.toggle('scrolled', window.scrollY > 20);
    };
    toggleScrolled();
    window.addEventListener('scroll', toggleScrolled);
}

// Mobile nav toggle
const hamburger = document.querySelector('.nav-hamburger');
const navLinks = document.querySelector('.nav-links');

if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('open');
        navLinks.classList.toggle('open');
    });
}

// Waitlist form
const form = document.querySelector('.cta-form');
const input = document.querySelector('.cta-input');
const btn = document.querySelector('.cta-btn');

if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = input.value;
        if (!email) return;

        btn.textContent = 'Submitting...';
        btn.disabled = true;

        const response = await fetch('https://formspree.io/f/xjgdepde', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        if (response.ok) {
            form.innerHTML = '<p style="color: #00d4d4; font-size: 16px; font-weight: 600;">✓ You\'re on the list. We\'ll be in touch.</p>';
        } else {
            btn.textContent = 'Something went wrong. Try again.';
            btn.disabled = false;
        }
    });
}

// Auth-aware CTA buttons -> dashboard if logged in, login page otherwise
async function goToAppOrLogin(e) {
    e.preventDefault();
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { session } } = await client.auth.getSession();
    if (session) {
        window.location.href = '/pages/dashboard.html';
    } else {
        window.location.href = '/Noxis_v2/login.html';
    }
}

document.querySelectorAll('.btn-cta, .hero-cta').forEach(el => {
    el.addEventListener('click', goToAppOrLogin);
});

// Scroll-reveal animations
const revealEls = document.querySelectorAll('.reveal');

if (revealEls.length && 'IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });

    revealEls.forEach(el => revealObserver.observe(el));
} else {
    revealEls.forEach(el => el.classList.add('visible'));
}
