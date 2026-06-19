// Feature tabs
const tabs = document.querySelectorAll('.tab-btn');
const contents = document.querySelectorAll('.feature-content');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.querySelector(`[data-feature="${tab.dataset.target}"]`).classList.add('active');
    });
});

// Waitlist form
const form = document.querySelector('.cta-form');
const input = document.querySelector('.cta-input');
const btn = document.querySelector('.cta-btn');

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

document.getElementById('btnDashboard').addEventListener('click', async () => {
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { session } } = await client.auth.getSession();
    if (session) {
        window.location.href = '/pages/dashboard.html';
    } else {
        window.location.href = '/pages/login.html';
    }
});