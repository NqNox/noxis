const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Check auth
supabaseClient.auth.getSession().then(({ data: { session } }) => {
    if (!session) {
        window.location.href = 'login.html';
    }
});

// Sidebar navigation
const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const target = item.dataset.page;

        navItems.forEach(n => n.classList.remove('active'));
        pages.forEach(p => p.classList.remove('active'));

        item.classList.add('active');
        document.getElementById(`page-${target}`).classList.add('active');
    });
});