const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Check auth
supabaseClient.auth.getSession().then(({ data: { session } }) => {
    if (!session) {
        window.location.href = 'login.html';
    }
});

// Navigation — handles both sidebar and bottom nav
const navItems = document.querySelectorAll('.nav-item, .bottom-nav-item');
const pages = document.querySelectorAll('.page');

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const target = item.dataset.page;

        navItems.forEach(n => n.classList.remove('active'));
        pages.forEach(p => p.classList.remove('active'));

        document.querySelectorAll(`[data-page="${target}"]`).forEach(el => el.classList.add('active'));
        document.getElementById(`page-${target}`).classList.add('active');
    });
});

// Modal
const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const btnCancel = document.getElementById('btnCancel');
const logTradeButtons = document.querySelectorAll('.btn-log-trade, .btn-log-trade-sm');

// Set today's date
const today = new Date().toISOString().split('T')[0];
document.getElementById('tradeDate').value = today;

// Open modal
logTradeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        modalOverlay.classList.add('active');
    });
});

// Close modal
modalClose.addEventListener('click', () => modalOverlay.classList.remove('active'));
btnCancel.addEventListener('click', () => modalOverlay.classList.remove('active'));
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) modalOverlay.classList.remove('active');
});

// Direction toggle
const btnLong = document.getElementById('btnLong');
const btnShort = document.getElementById('btnShort');
let direction = 'long';

btnLong.addEventListener('click', () => {
    direction = 'long';
    btnLong.classList.add('active');
    btnShort.classList.remove('active');
    updatePnL();
});

btnShort.addEventListener('click', () => {
    direction = 'short';
    btnShort.classList.add('active');
    btnLong.classList.remove('active');
    updatePnL();
});

// Rules toggle
const btnYes = document.getElementById('btnYes');
const btnNo = document.getElementById('btnNo');
let followedRules = true;

btnYes.addEventListener('click', () => {
    followedRules = true;
    btnYes.classList.add('active');
    btnNo.classList.remove('active');
});

btnNo.addEventListener('click', () => {
    followedRules = false;
    btnNo.classList.add('active');
    btnYes.classList.remove('active');
});

// P&L calculation
const entryInput = document.getElementById('tradeEntry');
const exitInput = document.getElementById('tradeExit');
const sizeInput = document.getElementById('tradeSize');
const pnlDisplay = document.getElementById('pnlDisplay');

function updatePnL() {
    const entry = parseFloat(entryInput.value);
    const exit = parseFloat(exitInput.value);
    const size = parseFloat(sizeInput.value) || 1;

    if (isNaN(entry) || isNaN(exit)) {
        pnlDisplay.textContent = '$0.00';
        pnlDisplay.className = 'pnl-display';
        return;
    }

    let pnl = direction === 'long' ? (exit - entry) * size * 20 : (entry - exit) * size * 20;
    pnlDisplay.textContent = (pnl >= 0 ? '+' : '') + '$' + pnl.toFixed(2);
    pnlDisplay.className = 'pnl-display ' + (pnl >= 0 ? 'positive' : 'negative');
}

entryInput.addEventListener('input', updatePnL);
exitInput.addEventListener('input', updatePnL);
sizeInput.addEventListener('input', updatePnL);

lucide.createIcons();