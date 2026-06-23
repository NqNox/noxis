const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});

// Check auth
supabaseClient.auth.getSession().then(({ data: { session } }) => {
    if (!session) {
        supabaseClient.auth.refreshSession().then(({ data: { session: refreshed } }) => {
            if (!refreshed) {
                window.location.href = 'login.html';
            }
        });
    } else {
        const userSettings = JSON.parse(localStorage.getItem('noxis_settings') || '{}');
        const displayName = userSettings.name || session.user.email?.split('@')[0] || 'User';
        document.querySelector('.user-name').textContent = displayName;
        document.querySelector('.user-avatar').textContent = displayName.charAt(0).toUpperCase();
    }
    
}); 

let userPlan = 'free';
const PLAN_LIMITS = { free: 50, pro: 100, elite: 120 };


function showToast(message, type = 'error', duration = 3000) {
    const container = document.getElementById('toastContainer');
    const icons = { error: '⚠️', success: '✓', warning: '⚡', info: 'ℹ️' };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

async function loadUserPlan() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const { data } = await supabaseClient
        .from('user_plans')
        .select('plan')
        .eq('user_id', session.user.id)
        .single();

    if (data) {
        userPlan = 'elite';
    } else {
    await supabaseClient.from('user_plans').insert({
        user_id: session.user.id,
        plan: 'free'
    });
    userPlan = 'elite'; // Temporary: everyone gets Elite during beta
    }

    // Update plan badge in sidebar
    const planEl = document.querySelector('.user-plan');
    if (planEl) {
        const labels = { free: 'Free Plan', pro: 'Pro Plan', elite: 'Elite Plan' };
        planEl.textContent = labels[userPlan] || 'Free Plan';
        planEl.className = 'user-plan plan-' + userPlan;
        const sidebarUser = document.querySelector('.sidebar-user');
        if (sidebarUser) {
            sidebarUser.className = 'sidebar-user plan-bg-' + userPlan;
        }
    }
}

async function checkOnboarding() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const { data } = await supabaseClient
        .from('user_plans')
        .select('onboarding_complete')
        .eq('user_id', session.user.id)
        .single();

    if (!data || !data.onboarding_complete) {
        showOnboarding();
    }
}

async function completeOnboarding(settings) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    localStorage.setItem('noxis_settings', JSON.stringify(settings));

    const { error } = await supabaseClient
        .from('user_plans')
        .update({ onboarding_complete: true })
        .eq('user_id', session.user.id);

    if (error) console.log('onboarding error:', error);
}

// ============================================
// ONBOARDING
// ============================================

function showOnboarding() {
    document.getElementById('onboardingOverlay').classList.add('active');
}

function goToStep(newStep, direction = 'forward') {
    const currentStep = document.querySelector('.onboarding-step.active');
    const nextStep = document.getElementById(`onboStep${newStep}`);

    currentStep.style.animation = direction === 'forward'
        ? 'step-out 0.2s ease forwards'
        : 'step-in-reverse 0.2s ease forwards';

    setTimeout(() => {
        currentStep.classList.remove('active');
        currentStep.style.animation = '';
        nextStep.classList.add('active');
        nextStep.style.animation = direction === 'forward'
            ? 'step-in 0.3s ease'
            : 'step-in-reverse 0.3s ease';

        document.querySelectorAll('.onboarding-dot').forEach(d => d.classList.remove('active'));
        document.querySelector(`.onboarding-dot[data-step="${newStep}"]`).classList.add('active');
    }, 200);
}

// Step 1 — Name validation
const onboNameInput = document.getElementById('onboName');
const onboNext1 = document.getElementById('onboNext1');

onboNameInput.addEventListener('input', () => {
    if (onboNameInput.value.trim().length > 0) {
        onboNext1.classList.remove('disabled');
    } else {
        onboNext1.classList.add('disabled');
    }
});

onboNext1.addEventListener('click', () => {
    if (onboNameInput.value.trim()) goToStep(2);
});

// Step 2 — Balance presets
document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const val = btn.dataset.value;
        const customInput = document.getElementById('onboBalance');
        if (val === 'custom') {
            customInput.style.display = 'block';
            customInput.focus();
            customInput.value = '';
        } else {
            customInput.style.display = 'none';
            customInput.value = val;
        }
    });
});

// Step 2 — Firm search
const firmSearch = document.getElementById('onboFirmSearch');
const firmList = document.getElementById('onboFirmList');
const onboFirmHidden = document.getElementById('onboFirm');

firmSearch.addEventListener('input', () => {
    const query = firmSearch.value.toLowerCase();
    firmList.querySelectorAll('.firm-option').forEach(opt => {
        opt.style.display = opt.textContent.toLowerCase().includes(query) ? 'block' : 'none';
    });
});

firmList.querySelectorAll('.firm-option').forEach(opt => {
    opt.addEventListener('click', () => {
        firmList.querySelectorAll('.firm-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        const val = opt.dataset.value;
        onboFirmHidden.value = val;
        firmSearch.value = opt.textContent;
        if (val === 'Other') {
            document.getElementById('onboFirmOther').style.display = 'block';
        } else {
            document.getElementById('onboFirmOther').style.display = 'none';
        }
    });
});

document.getElementById('onboFirmOther').addEventListener('input', (e) => {
    onboFirmHidden.value = e.target.value;
});

document.getElementById('onboBack2').addEventListener('click', () => goToStep(1, 'back'));
document.getElementById('onboNext2').addEventListener('click', () => goToStep(3));

// Step 3 — Instrument search
const instrumentSearch = document.getElementById('onboInstrumentSearch');
const instrumentList = document.getElementById('onboInstrumentList');
const onboInstrumentHidden = document.getElementById('onboInstrument');

instrumentSearch.addEventListener('input', () => {
    const query = instrumentSearch.value.toLowerCase();
    instrumentList.querySelectorAll('.firm-option').forEach(opt => {
        opt.style.display = opt.textContent.toLowerCase().includes(query) ? 'block' : 'none';
    });
});

instrumentList.querySelectorAll('.firm-option').forEach(opt => {
    opt.addEventListener('click', () => {
        instrumentList.querySelectorAll('.firm-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        onboInstrumentHidden.value = opt.dataset.value;
        instrumentSearch.value = opt.textContent;
    });
});

// Step 3 — Session options
document.querySelectorAll('.session-option').forEach(opt => {
    opt.addEventListener('click', () => {
        document.querySelectorAll('.session-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        document.getElementById('onboSessionStart').value = opt.dataset.start;
        document.getElementById('onboSessionEnd').value = opt.dataset.end;
    });
});

document.getElementById('onboBack3').addEventListener('click', () => goToStep(2, 'back'));
document.getElementById('onboNext3').addEventListener('click', () => {
    // Build summary
    const name = document.getElementById('onboName').value.trim();
    const balance = document.getElementById('onboBalance').value;
    const firm = document.getElementById('onboFirm').value;
    const instrument = document.getElementById('onboInstrument').value;
    const session = document.querySelector('.session-option.active');

    const summary = document.getElementById('onboSummary');
    summary.innerHTML = `
        <div class="summary-row">
            <span class="summary-label">Name</span>
            <span class="summary-value">${name || '—'}</span>
        </div>
        <div class="summary-row">
            <span class="summary-label">Balance</span>
            <span class="summary-value">${balance ? '$' + Number(balance).toLocaleString() : '—'}</span>
        </div>
        <div class="summary-row">
            <span class="summary-label">Firm</span>
            <span class="summary-value">${firm || '—'}</span>
        </div>
        <div class="summary-row">
            <span class="summary-label">Instrument</span>
            <span class="summary-value">${instrument || '—'}</span>
        </div>
        <div class="summary-row">
            <span class="summary-label">Session</span>
            <span class="summary-value">${session ? session.querySelector('.session-name').textContent : '—'}</span>
        </div>
    `;

    goToStep(4);
});

// Step 4 — Finish
document.getElementById('onboFinish').addEventListener('click', async () => {
    const settings = {
        name: document.getElementById('onboName').value.trim(),
        balance: document.getElementById('onboBalance').value,
        firm: document.getElementById('onboFirmOther').style.display !== 'none'
            ? document.getElementById('onboFirmOther').value
            : document.getElementById('onboFirm').value,
        instrument: document.getElementById('onboInstrument').value,
        sessionStart: document.getElementById('onboSessionStart').value,
        sessionEnd: document.getElementById('onboSessionEnd').value,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };

    // Closing animation
    const modal = document.querySelector('.onboarding-modal');
    const overlay = document.getElementById('onboardingOverlay');

    modal.style.animation = 'onboarding-out 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards';
    overlay.style.transition = 'opacity 0.4s ease';
    overlay.style.opacity = '0';

    setTimeout(async () => {
        await completeOnboarding(settings);
        overlay.classList.remove('active');
        overlay.style.opacity = '';
        modal.style.animation = '';

        if (settings.name) {
            document.querySelector('.user-name').textContent = settings.name;
            document.querySelector('.user-avatar').textContent = settings.name.charAt(0).toUpperCase();
        }

        showToast('Welcome to Noxis AI! 🔥', 'success', 4000);
        loadRecentTrades();
        loadStreak();
        loadSettings();
    }, 400);
});

let pnlManuallyEdited = false;

document.getElementById('pnlDisplay').addEventListener('input', () => {
    pnlManuallyEdited = true;
});

const POINT_VALUES = {
    'NQ': 20, 'MNQ': 2, 'ES': 50, 'MES': 5,
    'GC': 100, 'MGC': 10, 'CL': 1000, 'MCL': 100,
    'YM': 5, 'MYM': 0.5, 'RTY': 50, 'M2K': 10,
    'EUR/USD': 10, 'GBP/USD': 10, 'USD/JPY': 9.09,
    'USD/CHF': 10, 'AUD/USD': 10, 'USD/CAD': 10,
    'NZD/USD': 10, 'EUR/GBP': 12.5, 'EUR/JPY': 9.09,
    'GBP/JPY': 9.09, 'XAU/USD': 1, 'XAG/USD': 50,
    'BTC/USD': 1, 'ETH/USD': 1
};

function getPointValue(symbol) {
    return POINT_VALUES[symbol.toUpperCase()] || 20;
}

const INSTRUMENTS = [
    // Index Futures
    { ticker: 'NQ', name: 'Nasdaq Futures', color: '#1a3a6b', category: 'Index' },
    { ticker: 'ES', name: 'S&P 500 Futures', color: '#1a3a6b', category: 'Index' },
    { ticker: 'YM', name: 'Dow Jones Futures', color: '#1a3a6b', category: 'Index' },
    { ticker: 'RTY', name: 'Russell 2000', color: '#1a3a6b', category: 'Index' },
    // Micro Index
    { ticker: 'MNQ', name: 'Micro Nasdaq', color: '#0d5c3a', category: 'Micro' },
    { ticker: 'MES', name: 'Micro S&P 500', color: '#0d5c3a', category: 'Micro' },
    { ticker: 'MYM', name: 'Micro Dow Jones', color: '#0d5c3a', category: 'Micro' },
    { ticker: 'M2K', name: 'Micro Russell 2000', color: '#0d5c3a', category: 'Micro' },
    // Metals
    { ticker: 'GC', name: 'Gold Futures', color: '#6b4a00', category: 'Metals' },
    { ticker: 'SI', name: 'Silver Futures', color: '#4a4a4a', category: 'Metals' },
    { ticker: 'MGC', name: 'Micro Gold', color: '#6b4a00', category: 'Metals' },
    // Energy
    { ticker: 'CL', name: 'Crude Oil', color: '#3a1a00', category: 'Energy' },
    { ticker: 'MCL', name: 'Micro Crude Oil', color: '#3a1a00', category: 'Energy' },
    { ticker: 'NG', name: 'Natural Gas', color: '#1a3a3a', category: 'Energy' },
    // Bonds
    { ticker: 'ZB', name: '30Y T-Bond', color: '#3a003a', category: 'Bonds' },
    { ticker: 'ZN', name: '10Y T-Note', color: '#3a003a', category: 'Bonds' },
    // Forex Majors
    { ticker: 'EUR/USD', name: 'Euro / US Dollar', color: '#1a4a2a', category: 'Forex' },
    { ticker: 'GBP/USD', name: 'British Pound / USD', color: '#1a4a2a', category: 'Forex' },
    { ticker: 'USD/JPY', name: 'US Dollar / Yen', color: '#1a4a2a', category: 'Forex' },
    { ticker: 'USD/CHF', name: 'US Dollar / Swiss Franc', color: '#1a4a2a', category: 'Forex' },
    { ticker: 'AUD/USD', name: 'Australian Dollar / USD', color: '#1a4a2a', category: 'Forex' },
    { ticker: 'USD/CAD', name: 'US Dollar / Canadian Dollar', color: '#1a4a2a', category: 'Forex' },
    { ticker: 'NZD/USD', name: 'New Zealand Dollar / USD', color: '#1a4a2a', category: 'Forex' },
    // Forex Minors
    { ticker: 'EUR/GBP', name: 'Euro / British Pound', color: '#1a4a2a', category: 'Forex' },
    { ticker: 'EUR/JPY', name: 'Euro / Japanese Yen', color: '#1a4a2a', category: 'Forex' },
    { ticker: 'GBP/JPY', name: 'British Pound / Yen', color: '#1a4a2a', category: 'Forex' },
    { ticker: 'EUR/AUD', name: 'Euro / Australian Dollar', color: '#1a4a2a', category: 'Forex' },
    { ticker: 'GBP/AUD', name: 'British Pound / AUD', color: '#1a4a2a', category: 'Forex' },
    { ticker: 'AUD/JPY', name: 'Australian Dollar / Yen', color: '#1a4a2a', category: 'Forex' },
    // Forex Metals
    { ticker: 'XAU/USD', name: 'Gold / US Dollar', color: '#6b4a00', category: 'Forex' },
    { ticker: 'XAG/USD', name: 'Silver / US Dollar', color: '#4a4a4a', category: 'Forex' },
    // Crypto
    { ticker: 'BTC/USD', name: 'Bitcoin / US Dollar', color: '#4a2a00', category: 'Crypto' },
    { ticker: 'ETH/USD', name: 'Ethereum / US Dollar', color: '#1a1a4a', category: 'Crypto' },
];

const BLOCKED_WORDS = [
    'nigger', 'nigga', 'faggot', 'retard', 'chink', 'spic', 'kike', 'cunt',
    'tranny', 'wetback', 'beaner', 'gook', 'raghead', 'towelhead', 'cracker',
    'fuck', 'slut'
];


function containsBlockedWord(text) {
    const lower = text.toLowerCase();
    return BLOCKED_WORDS.some(word => lower.includes(word));
}


function initSymbolSelector() {
    const selector = document.getElementById('symbolSelector');
    const selected = document.getElementById('symbolSelected');
    const dropdown = document.getElementById('symbolDropdown');
    const search = document.getElementById('symbolSearch');
    const list = document.getElementById('symbolList');
    const hiddenInput = document.getElementById('tradeSymbol');

    function renderList(filter = '') {
        const filtered = INSTRUMENTS.filter(i =>
            i.ticker.toLowerCase().includes(filter.toLowerCase()) ||
            i.name.toLowerCase().includes(filter.toLowerCase())
        );

        list.innerHTML = filtered.map(inst => `
            <div class="symbol-option ${inst.ticker === hiddenInput.value ? 'selected' : ''}" 
                 data-ticker="${inst.ticker}" 
                 data-name="${inst.name}"
                 data-color="${inst.color}"
                 data-category="${inst.category}">
                <div class="symbol-option-left">
                    <span class="symbol-option-ticker-large">${inst.ticker}</span>
                    <span class="symbol-option-name">${inst.name}</span>
                </div>
                <span class="symbol-category-pill" style="background:${inst.color}">${inst.category}</span>
            </div>
        `).join('');

        list.querySelectorAll('.symbol-option').forEach(opt => {
            opt.addEventListener('mousedown', (e) => {
                console.log('option clicked:', opt.dataset.ticker);
                e.preventDefault();
                e.stopPropagation();

                const ticker = opt.dataset.ticker;
                const name = opt.dataset.name;
                const color = opt.dataset.color;
                const category = opt.dataset.category;

            hiddenInput.value = ticker;
            document.getElementById('selectedTicker').textContent = ticker;
            document.getElementById('selectedCategory').textContent = category;
            document.getElementById('selectedCategory').style.background = color;

                dropdown.classList.remove('active');
                search.value = '';
                updatePnL();
            });
        });
    }

    selected.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('active');
        if (dropdown.classList.contains('active')) {
            search.focus();
            renderList();
        }
    });

    search.addEventListener('input', () => renderList(search.value));

    document.addEventListener('click', (e) => {
        if (!selector.contains(e.target)) {
            dropdown.classList.remove('active');
            search.value = '';
        }
    });

    renderList();
}

initSymbolSelector();

// Sidebar toggle
document.getElementById('sidebarToggle').addEventListener('click', () => {
    if (window.innerWidth <= 768) return;
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    const icon = document.querySelector('#sidebarToggle i');
    
    sidebar.classList.toggle('collapsed');
    mainContent.classList.toggle('expanded');
    
    if (sidebar.classList.contains('collapsed')) {
        icon.setAttribute('data-lucide', 'chevrons-right');
    } else {
        icon.setAttribute('data-lucide', 'chevrons-left');
    }
    lucide.createIcons();
});

// Navigation
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
        sessionStorage.setItem('noxis_active_page', target); 

        const fab = document.getElementById('fabLogTrade');
        if (fab) fab.style.display = target === 'dashboard' ? 'flex' : 'none';
        

        // Load page data when switching
        if (target === 'checklist'){
            loadRuleSets();
            loadRules();
        }
        if (target === 'dashboard') {
            loadRecentTrades();
            loadStreak();
        }
        if (target === 'journal') loadJournal();
        if (target === 'streak') loadStreakPage();
        if (target === 'settings') loadSettings();
        if (target === 'ai') loadInsights();
    });
});

// View toggle — declared early so loadRecentTrades can use it
let currentView = window.innerWidth < 768 ? 'cards' : 'table';

// Modal
const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const btnCancel = document.getElementById('btnCancel');
const logTradeButtons = document.querySelectorAll('.btn-log-trade, .btn-log-trade-sm');
let editingTradeId = null;

const today = new Date().toLocaleDateString('en-CA');
document.getElementById('tradeDate').value = today;

logTradeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        modalOverlay.classList.add('active');
        loadTradeCounter();
        const lastSymbol = document.getElementById('tradeSymbol').value || 'NQ';
        const inst = INSTRUMENTS.find(i => i.ticker === lastSymbol) || INSTRUMENTS[0];
        document.getElementById('selectedTicker').textContent = inst.ticker;
        document.getElementById('selectedCategory').textContent = inst.category;
        document.getElementById('selectedCategory').style.background = inst.color;
        document.getElementById('tradeSymbol').value = inst.ticker;
        updatePnL();
        modalOverlay.classList.add('active');
    });
});

function closeModal() {
    modalOverlay.classList.remove('active');
    editingTradeId = null;
    document.querySelector('.modal-header h2').textContent = 'Log Trade';
    document.getElementById('btnSave').textContent = 'Save Trade';
    document.getElementById('tradeDate').value = today;
    document.getElementById('tradeNumber').value = '1';
    document.getElementById('tradeSize').value = '1';
    document.getElementById('tradeEntry').value = '';
    document.getElementById('tradeExit').value = '';
    document.getElementById('tradeNotes').value = '';
    pnlManuallyEdited = false;
    document.getElementById('pnlDisplay').value = '';
    document.getElementById('pnlDisplay').className = 'pnl-input';
    const limitBanner = document.getElementById('limitBanner');
    if (limitBanner) limitBanner.style.display = 'none';
    const btnSave = document.getElementById('btnSave');
    if (btnSave) {
        btnSave.disabled = false;
        btnSave.style.opacity = '1';
        btnSave.style.cursor = 'pointer';
    }
    direction = 'long';
    btnLong.classList.add('active');
    btnShort.classList.remove('active');
    followedRules = true;
    btnYes.classList.add('active');
    btnNo.classList.remove('active');
    selectedEmotions = [];
    renderEmotionTags();
    renderSuggestions();
}

modalClose.addEventListener('click', closeModal);
btnCancel.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});

// Direction toggle
const btnLong = document.getElementById('btnLong');
const btnShort = document.getElementById('btnShort');
let direction = 'long';
btnLong.classList.add('active');
btnShort.classList.remove('active');

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

function updatePnL() {
    if (pnlManuallyEdited) return;
    
    const entry = parseFloat(entryInput.value);
    const exit = parseFloat(exitInput.value);
    const size = parseFloat(sizeInput.value) || 1;
    const symbolVal = document.getElementById('tradeSymbol').value || 'NQ';
    const pointValue = getPointValue(symbolVal);

    if (isNaN(entry) || isNaN(exit)) {
        document.getElementById('pnlDisplay').value = '';
        document.getElementById('pnlDisplay').className = 'pnl-input';
        return;
    }

    let pnl = direction === 'long' ? (exit - entry) * size * pointValue : (entry - exit) * size * pointValue;
    document.getElementById('pnlDisplay').value = pnl.toFixed(2);
    document.getElementById('pnlDisplay').className = 'pnl-input ' + (pnl >= 0 ? 'positive' : 'negative');
}

entryInput.addEventListener('input', updatePnL);
exitInput.addEventListener('input', updatePnL);
sizeInput.addEventListener('input', updatePnL);
document.getElementById('tradeSymbol').addEventListener('input', updatePnL);

// Emotion tags
const emotionInput = document.getElementById('emotionInput');
const emotionTagsEl = document.getElementById('emotionTags');
const emotionSuggestions = document.getElementById('emotionSuggestions');
const emotionTagsContainer = document.getElementById('emotionTagsContainer');
console.log('emotion elements:', emotionInput, emotionTagsEl, emotionSuggestions, emotionTagsContainer);

let selectedEmotions = [];
let savedEmotions = JSON.parse(localStorage.getItem('noxis_emotions') || '[]');
const defaultEmotions = ['FOMO', 'Anxious', 'Confident', 'Frustrated', 'Calm', 'Revenge', 'Greedy', 'Patient'];

function renderSuggestions() {
    console.log('renderSuggestions called, savedEmotions:', savedEmotions);
    const allSuggestions = [...new Set([...defaultEmotions, ...savedEmotions])];
    const filtered = allSuggestions.filter(e => !selectedEmotions.includes(e));
    emotionSuggestions.innerHTML = '';
    filtered.forEach(emotion => {
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.gap = '2px';

        const tag = document.createElement('button');
        tag.className = 'suggestion-tag';
        tag.textContent = emotion;
        tag.addEventListener('click', () => addEmotion(emotion));

        const del = document.createElement('span');
        del.textContent = '✕';
        del.style.cssText = 'font-size:10px;color:#444;cursor:pointer;padding:2px 4px;transition:color 0.2s';
        del.addEventListener('mouseenter', () => del.style.color = '#ff4444');
        del.addEventListener('mouseleave', () => del.style.color = '#444');
        del.addEventListener('click', () => {
            savedEmotions = savedEmotions.filter(e => e !== emotion);
            localStorage.setItem('noxis_emotions', JSON.stringify(savedEmotions));
            renderSuggestions();
        });

        wrapper.appendChild(tag);
        wrapper.appendChild(del);
        emotionSuggestions.appendChild(wrapper);
    });
}

function addEmotion(emotion) {
    const clean = emotion.trim();
    if (!clean || selectedEmotions.includes(clean)) { console.log('2. early return'); return; }
    if (containsBlockedWord(clean)) {
        return;
    }
    selectedEmotions.push(clean);
    if (!savedEmotions.includes(clean)) {
        savedEmotions.push(clean);
        localStorage.setItem('noxis_emotions', JSON.stringify(savedEmotions));
    }
    renderEmotionTags();
    renderSuggestions();
    emotionInput.value = '';
}

function removeEmotion(emotion) {
    selectedEmotions = selectedEmotions.filter(e => e !== emotion);
    renderEmotionTags();
    renderSuggestions();
}

function renderEmotionTags() {
    emotionTagsEl.innerHTML = '';
    selectedEmotions.forEach(emotion => {
        const tag = document.createElement('div');
        tag.className = 'emotion-tag';
        tag.innerHTML = `${emotion} <span class="remove-tag" data-emotion="${emotion}">✕</span>`;
        tag.querySelector('.remove-tag').addEventListener('click', () => removeEmotion(emotion));
        emotionTagsEl.appendChild(tag);
    });
}

emotionInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        addEmotion(emotionInput.value);
    }
});

emotionTagsContainer.addEventListener('click', () => emotionInput.focus());

// Save trade
document.getElementById('btnSave').addEventListener('click', async () => {
    const date = document.getElementById('tradeDate').value;
    const tradeNumber = document.getElementById('tradeNumber').value;
    const symbol = document.getElementById('tradeSymbol').value;
    const size = document.getElementById('tradeSize').value;
    const entry = parseFloat(document.getElementById('tradeEntry').value);
    const exit = parseFloat(document.getElementById('tradeExit').value);
    const notes = document.getElementById('tradeNotes').value;

    if (!date || !symbol || !entry || !exit) {
        showToast('Please fill in all required fields.', 'error');
        return;
    }

    if (entry < 0 || exit < 0) {
    showToast('Entry and exit prices must be positive.', 'error');
    return;
    }

    const btnSave = document.getElementById('btnSave');
    btnSave.textContent = 'Saving...';
    btnSave.disabled = true;

    const { data: { session } } = await supabaseClient.auth.getSession();
    // Check trade limit (only for new trades, not edits)
    if (!editingTradeId) {
        const limit = PLAN_LIMITS[userPlan];
        const now = new Date();
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        const { count } = await supabaseClient
            .from('trades')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', session.user.id)
            .gte('created_at', firstOfMonth);
  
        if (count >= limit) {
            showToast(`You've reached your ${limit} trades/month limit. Upgrade to log more.`, 'warning');
            btnSave.textContent = 'Save Trade';
            btnSave.disabled = false;
            return;
        }
    }
    const pnlInputVal = parseFloat(document.getElementById('pnlDisplay').value);
    const symbolVal = document.getElementById('tradeSymbol').value || 'NQ';
    const pointValue = getPointValue(symbolVal);
    let pnl = parseFloat(document.getElementById('pnlDisplay').value);

    let result;
    if (editingTradeId) {
        result = await supabaseClient.from('trades').update({
            date,
            trade_number: parseInt(tradeNumber),
            symbol: symbol.toUpperCase(),
            direction,
            size: parseInt(size),
            entry_price: entry,
            exit_price: exit,
            pnl,
            emotions: selectedEmotions.join(', '),
            followed_rules: followedRules,
            notes
        }).eq('id', editingTradeId);
    } else {
        result = await supabaseClient.from('trades').insert({
            user_id: session.user.id,
            date,
            trade_number: parseInt(tradeNumber),
            symbol: symbol.toUpperCase(),
            direction,
            size: parseInt(size),
            entry_price: entry,
            exit_price: exit,
            pnl,
            emotions: selectedEmotions.join(', '),
            followed_rules: followedRules,
            notes
        });
    }

    const { error } = result;

    if (error) {
        showToast('Error saving trade: ' + error.message);
        btnSave.textContent = editingTradeId ? 'Update Trade' : 'Save Trade';
        btnSave.disabled = false;
    } else {
        btnSave.textContent = 'Saved ✓';
        loadRecentTrades();
        loadStreak();
        setTimeout(() => {
            closeModal();
            btnSave.disabled = false;
        }, 1000);
    }
});

// Fetch and display recent trades
async function loadRecentTrades() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const { data: trades, error } = await supabaseClient
        .from('trades')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

    if (error || !trades) return;

    const totalPnl = trades.reduce((sum, trade) => sum + trade.pnl, 0);
    const rpnlEl = document.querySelector('.stat-value:not(.green)');
    if (rpnlEl) {
        rpnlEl.textContent = (totalPnl >= 0 ? '+$' : '-$') + Math.abs(totalPnl).toFixed(2);
        rpnlEl.className = 'stat-value ' + (totalPnl >= 0 ? 'positive' : 'negative');
    }

    // Update balance
    const userSettings = JSON.parse(localStorage.getItem('noxis_settings') || '{}');
    const startBalance = parseFloat(userSettings.balance) || 50000;
    const currentBalance = startBalance + totalPnl;
    const balanceEl = document.querySelector('.stat-value.green');
    if (balanceEl) {
        balanceEl.textContent = '$' + currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    const recentEmpty = document.querySelector('.recent-empty');
    const recentCard = document.querySelector('.recent-card');

    const oldTable = document.getElementById('tradesTable');
    if (oldTable) oldTable.remove();

    if (trades.length === 0) {
        recentEmpty.style.display = 'flex';
        return;
    }
    
        const displayTrades = trades.slice(0, );

    recentEmpty.style.display = 'none';

    const container = document.createElement('div');
    container.id = 'tradesTable';

    if (currentView === 'table') {
        container.className = 'trades-table';
        container.innerHTML = `
            <div class="trades-header-row">
                <span>Date</span>
                <span>Symbol</span>
                <span>Direction</span>
                <span>Size</span>
                <span>P&L</span>
                <span>Rules</span>
                <span></span>
            </div>
            ${displayTrades.map(trade => `
                <div class="trade-row">
                    <span>${trade.date}</span>
                    <span>${trade.symbol}</span>
                    <span class="${trade.direction === 'long' ? 'long' : 'short'}">
                        ${trade.direction === 'long' ? '↑ Long' : '↓ Short'}
                    </span>
                    <span>${trade.size}</span>
                    <span class="${trade.pnl >= 0 ? 'positive' : 'negative'}">
                        ${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}
                    </span>
                    <span>${trade.followed_rules ? '✓' : '✗'}</span>
                    <span class="trade-actions">
                        <button class="trade-edit-btn" data-id="${trade.id}">
                            <i data-lucide="pencil" class="pencil-icon"></i>
                        </button>
                        <button class="trade-delete-btn" data-id="${trade.id}">
                            <i data-lucide="trash-2" class="trash-icon"></i>
                        </button>
                    </span>
                </div>
            `).join('')}
        `;
    } else if (currentView === 'cards') {
        container.className = 'trades-cards';
        container.innerHTML = displayTrades.map(trade => `
            <div class="trade-card ${trade.pnl >= 0 ? 'win' : 'loss'}">
                <div class="trade-card-header">
                    <span class="trade-card-symbol">${trade.symbol}</span>
                    <span class="trade-card-pnl ${trade.pnl >= 0 ? 'positive' : 'negative'}">
                        ${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}
                    </span>
                </div>
                <div class="trade-card-details">
                    <span class="trade-card-tag ${trade.direction}">${trade.direction === 'long' ? '↑ Long' : '↓ Short'}</span>
                    </span>
                    <span class="trade-card-tag">${trade.size} contract${trade.size > 1 ? 's' : ''}</span>
                    <span class="trade-card-tag">${trade.followed_rules ? '✓ Rules' : '✗ Rules'}</span>
                    ${trade.emotions ? `<span class="trade-card-tag">${trade.emotions}</span>` : ''}
                </div>
                <div class="trade-card-footer">
                    <span class="trade-card-date">${trade.date}</span>
                    <div class="trade-card-actions">
                        <button class="trade-edit-btn" data-id="${trade.id}">
                            <i data-lucide="pencil" class="pencil-icon"></i>
                        </button>
                        <button class="trade-delete-btn" data-id="${trade.id}">
                            <i data-lucide="trash-2" class="trash-icon"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    } 

    recentCard.appendChild(container);
    lucide.createIcons();
}

// Edit and delete handler
document.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.trade-edit-btn');
    if (editBtn) {
        editingTradeId = editBtn.dataset.id;

        const { data: trade } = await supabaseClient
            .from('trades')
            .select('*')
            .eq('id', editingTradeId)
            .single();

        if (!trade) return;

        document.getElementById('tradeDate').value = trade.date;
        document.getElementById('tradeNumber').value = trade.trade_number;
        document.getElementById('tradeSymbol').value = trade.symbol;
        const inst = INSTRUMENTS.find(i => i.ticker === trade.symbol);
        if (inst) {
            document.getElementById('selectedTicker').textContent = inst.ticker;
            document.getElementById('selectedCategory').textContent = inst.category;
            document.getElementById('selectedCategory').style.background = inst.color;
        }
        updatePnL();
        document.getElementById('tradeSize').value = trade.size;
        document.getElementById('tradeEntry').value = trade.entry_price;
        document.getElementById('tradeExit').value = trade.exit_price;
        document.getElementById('tradeNotes').value = trade.notes || '';
        document.getElementById('pnlDisplay').value = trade.pnl || '';
        document.getElementById('pnlDisplay').className = 'pnl-input ' + (trade.pnl >= 0 ? 'positive' : 'negative');

        direction = trade.direction;
        if (direction === 'long') {
            btnLong.classList.add('active');
            btnShort.classList.remove('active');
        } else {
            btnShort.classList.add('active');
            btnLong.classList.remove('active');
        }

        followedRules = trade.followed_rules;
        if (followedRules) {
            btnYes.classList.add('active');
            btnNo.classList.remove('active');
        } else {
            btnNo.classList.add('active');
            btnYes.classList.remove('active');
        }

        selectedEmotions = trade.emotions ? trade.emotions.split(', ').filter(Boolean) : [];
        renderEmotionTags();
        renderSuggestions();
        updatePnL();

        document.querySelector('.modal-header h2').textContent = 'Edit Trade';
        document.getElementById('btnSave').textContent = 'Update Trade';
        modalOverlay.classList.add('active');
        lucide.createIcons();
    }

    const deleteBtn = e.target.closest('.trade-delete-btn');
    if (deleteBtn) {
        const tradeId = deleteBtn.dataset.id;
        const confirmOverlay = document.getElementById('confirmOverlay');
        const confirmDelete = document.getElementById('confirmDelete');
        const confirmCancel = document.getElementById('confirmCancel');

        confirmOverlay.classList.add('active');

        confirmDelete.onclick = async () => {
            const { error } = await supabaseClient
                .from('trades')
                .delete()
                .eq('id', tradeId);
            confirmOverlay.classList.remove('active');
            if (!error) loadRecentTrades();
        };

        confirmCancel.onclick = () => {
            confirmOverlay.classList.remove('active');
        };
    }
});

// View toggle
function setView(view) {
    currentView = view;
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    loadRecentTrades();
}

document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
});

if (window.innerWidth < 768) {
    document.querySelector('[data-view="cards"]')?.classList.add('active');
    document.querySelector('[data-view="table"]')?.classList.remove('active');
}

async function loadStreak() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    // Get last 7 days of trades
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    const { data: trades } = await supabaseClient
        .from('trades')
        .select('date, followed_rules')
        .eq('user_id', session.user.id)
        .order('date', { ascending: true });
        console.log('today:', today.toLocaleDateString('en-CA'));
        console.log('sevenDaysAgo:', sevenDaysAgo.toLocaleDateString('en-CA'));
        console.log('trades fetched:', trades); 

    // Get last 5 weekdays starting from Monday
    const days = [];
    let d = new Date(today);
    let daysFound = 0;

    // Find the most recent Monday
    while (d.getDay() !== 1) {
        d.setDate(d.getDate() - 1);
    }

    // Get Mon-Fri of current week
    for (let i = 0; i < 5; i++) {
        days.push(new Date(d));
        d.setDate(d.getDate() + 1);
    }

    // Check which days have compliant trades
    const tradedDays = new Set(
        (trades || [])
            .filter(t => t.followed_rules)
            .map(t => t.date)
    );

    // Render circles
    const streakDaysEl = document.getElementById('streakDays');
    streakDaysEl.innerHTML = '';

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    days.forEach(day => {
        const dateStr = day.toLocaleDateString('en-CA');
        const isActive = tradedDays.has(dateStr);
        const isToday = dateStr === today.toLocaleDateString('en-CA');

        const circle = document.createElement('div');
        circle.className = 'day-circle' + (isActive ? ' active' : '') + (isToday ? ' today' : '');
        circle.innerHTML = `${day.getDate()}<span>${dayNames[day.getDay()]}</span>`;
        streakDaysEl.appendChild(circle);
    });

    // Count streak
    // Count streak using same logic as streak page
    const tradingDates = [...tradedDays].sort();
    let streakCount = 0;
    for (const date of [...tradingDates].reverse()) {
        if (tradedDays.has(date)) {
            streakCount++;
        } else {
            break;
        }
    }  

    const flame = document.querySelector('.streak-flame');
    flame.textContent = streakCount > 0 ? '🔥' : '💤';
    document.querySelector('.streak-title').textContent = 
        streakCount > 0 ? `${streakCount} Day Streak` : 'No streak yet';
}

// ============================================
// CHECKLIST
// ============================================
let rules = [];
let ruleSets = [];
let checkedRules = new Set();
let editingRuleId = null;
let activeSetId = 'all';

const ruleModalOverlay = document.getElementById('ruleModalOverlay');
const ruleModalClose = document.getElementById('ruleModalClose');
const btnRuleCancel = document.getElementById('btnRuleCancel');
const btnRuleSave = document.getElementById('btnRuleSave');
const btnAddRule = document.getElementById('btnAddRule');
const ruleInput = document.getElementById('ruleInput');

const setModalOverlay = document.getElementById('setModalOverlay');
const setModalClose = document.getElementById('setModalClose');
const btnSetCancel = document.getElementById('btnSetCancel');
const btnSetSave = document.getElementById('btnSetSave');
const btnAddSet = document.getElementById('btnAddSet');
const setInput = document.getElementById('setInput');

function closeRuleModal() {
    ruleModalOverlay.classList.remove('active');
    ruleInput.value = '';
    editingRuleId = null;
    document.querySelector('#ruleModalOverlay .modal-header h2').textContent = 'Add Rule';
    btnRuleSave.textContent = 'Add Rule';
}

function closeSetModal() {
    setModalOverlay.classList.remove('active');
    setInput.value = '';
}

btnAddRule.addEventListener('click', () => ruleModalOverlay.classList.add('active'));
ruleModalClose.addEventListener('click', closeRuleModal);
btnRuleCancel.addEventListener('click', closeRuleModal);
ruleModalOverlay.addEventListener('click', (e) => {
    if (e.target === ruleModalOverlay) closeRuleModal();
});

btnAddSet.addEventListener('click', () => setModalOverlay.classList.add('active'));
setModalClose.addEventListener('click', closeSetModal);
btnSetCancel.addEventListener('click', closeSetModal);
setModalOverlay.addEventListener('click', (e) => {
    if (e.target === setModalOverlay) closeSetModal();
});

ruleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveRule();
});

setInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveSet();
});

btnRuleSave.addEventListener('click', saveRule);
btnSetSave.addEventListener('click', saveSet);

async function saveRule() {
    const text = ruleInput.value.trim();
    if (!text) return;

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const RULE_LIMITS = { free: 5, pro: 10, elite: 15 };
    const ruleLimit = RULE_LIMITS[userPlan];
    const currentSetId = document.getElementById('ruleSetSelect').value || null;
    const rulesInSet = currentSetId 
        ? rules.filter(r => r.set_id === currentSetId).length
        : rules.filter(r => !r.set_id).length;
    if (!editingRuleId && rulesInSet >= ruleLimit) {
        showToast(`You've reached your ${ruleLimit} rules per set limit. Upgrade to add more.`, 'warning');
        closeRuleModal();
        return;
    }

    const setId = document.getElementById('ruleSetSelect').value || null;

    if (editingRuleId) {
        await supabaseClient.from('rules').update({ rule: text, set_id: setId }).eq('id', editingRuleId);
    } else {
        await supabaseClient.from('rules').insert({
            user_id: session.user.id,
            rule: text,
            set_id: setId,
            position: rules.length
        });
    }

    closeRuleModal();
    loadRules();
}

async function saveSet() {
    const name = setInput.value.trim();
    if (!name) return;

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const SET_LIMITS = { free: 1, pro: 3, elite: 5 };
    const setLimit = SET_LIMITS[userPlan];
    if (ruleSets.length >= setLimit) {
        showToast(`You've reached your ${setLimit} rule set limit. Upgrade to add more.`, 'warning');
        closeSetModal();
        return;
    }

    await supabaseClient.from('rule_sets').insert({
        user_id: session.user.id,
        name
    });

    closeSetModal();
    loadRuleSets();
}

async function loadRuleSets() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const { data } = await supabaseClient
        .from('rule_sets')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: true });

    ruleSets = data || [];
    renderSets();
    updateRuleSetSelect();
}

function renderSets() {
    const setsList = document.getElementById('setsList');
    setsList.innerHTML = `
        <div class="set-item ${activeSetId === 'all' ? 'active' : ''}" data-set-id="all">
            <span>All Rules</span>
        </div>
        ${ruleSets.length === 0 ? `
            <div style="font-size:12px;color:#444;padding:8px 10px;text-align:center;">
                No sets yet.<br>Click + to create one.
            </div>
        ` : ''}
        ${ruleSets.map(set => `
            <div class="set-item ${activeSetId === set.id ? 'active' : ''}" data-set-id="${set.id}">
                <span>${set.name}</span>
                <div style="display:flex;gap:4px;">
                    <button class="set-edit-btn" data-set-id="${set.id}" data-set-name="${set.name}">
                        <i data-lucide="pencil"></i>
                    </button>
                    <button class="set-delete-btn" data-set-id="${set.id}">
                        <i data-lucide="x"></i>
                    </button>
                </div>
            </div>
        `).join('')}
    `;

    document.querySelectorAll('.set-edit-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.setId;
        const currentName = btn.dataset.setName;
        setInput.value = currentName;
        document.querySelector('#setModalOverlay .modal-header h2').textContent = 'Edit Rule Set';
        setModalOverlay.classList.add('active');

        btnSetSave.onclick = async () => {
            const name = setInput.value.trim();
            if (!name) return;
            await supabaseClient.from('rule_sets').update({ name }).eq('id', id);
            closeSetModal();
            document.querySelector('#setModalOverlay .modal-header h2').textContent = 'New Rule Set';
            btnSetSave.onclick = null;
            loadRuleSets();
        };
    });
});

    document.querySelectorAll('.set-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.set-delete-btn')) return;
            activeSetId = item.dataset.setId;
            renderSets();
            renderRules();
        });
    });

    document.querySelectorAll('.set-delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.setId;
            const confirmOverlay = document.getElementById('confirmOverlay');
            const confirmDelete = document.getElementById('confirmDelete');
            const confirmCancel = document.getElementById('confirmCancel');

            confirmOverlay.classList.add('active');

            document.querySelector('.confirm-popup h3').textContent = 'Delete Rule Set?';
            document.querySelector('.confirm-popup p').textContent = 'This will delete the set but not the rules inside it.';

            confirmDelete.onclick = async () => {
                await supabaseClient.from('rule_sets').delete().eq('id', id);
                if (activeSetId === id) activeSetId = 'all';
                confirmOverlay.classList.remove('active');
                document.querySelector('.confirm-popup h3').textContent = 'Delete Trade?';
                document.querySelector('.confirm-popup p').textContent = "This action can't be undone.";
                loadRuleSets();
                loadRules();
            };

            confirmCancel.onclick = () => confirmOverlay.classList.remove('active');
        });
    });

    lucide.createIcons();
}

function updateRuleSetSelect() {
    const select = document.getElementById('ruleSetSelect');
    select.innerHTML = `<option value="">No set</option>` +
        ruleSets.map(set => `<option value="${set.id}">${set.name}</option>`).join('');
}

async function loadRules() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const { data } = await supabaseClient
        .from('rules')
        .select('*')
        .eq('user_id', session.user.id)
        .order('position', { ascending: true });

    rules = data || [];
    renderRules();
}

function renderRules() {
    const rulesList = document.getElementById('rulesList');
    const checkedCount = document.getElementById('checkedCount');
    const totalCount = document.getElementById('totalCount');
    const progressFill = document.getElementById('progressFill');

    const filteredRules = activeSetId === 'all'
        ? rules
        : rules.filter(r => r.set_id === activeSetId);

    const checked = filteredRules.filter(r => checkedRules.has(r.id)).size || [...filteredRules].filter(r => checkedRules.has(r.id)).length;
    const total = filteredRules.length;

    checkedCount.textContent = checked;
    totalCount.textContent = total;
    progressFill.style.width = total > 0 ? `${(checked / total) * 100}%` : '0%';

    if (filteredRules.length === 0) {
        rulesList.innerHTML = `<div class="rules-empty"><p>No rules here yet.</p></div>`;
        return;
    }

    rulesList.innerHTML = filteredRules.map(rule => `
        <div class="rule-item ${checkedRules.has(rule.id) ? 'checked' : ''}" data-id="${rule.id}">
            <div class="rule-checkbox">${checkedRules.has(rule.id) ? '✓' : ''}</div>
            <span class="rule-text">${rule.rule}</span>
            <div class="rule-actions">
                <button class="rule-edit-btn" data-rule-id="${rule.id}" data-rule-text="${rule.rule}" data-rule-set="${rule.set_id || ''}">
                    <i data-lucide="pencil"></i>
                </button>
                <button class="rule-delete" data-rule-id="${rule.id}">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        </div>
    `).join('');

    document.querySelectorAll('.rule-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.rule-actions')) return;
            const id = item.dataset.id;
            if (checkedRules.has(id)) {
                checkedRules.delete(id);
            } else {
                checkedRules.add(id);
            }
            renderRules();
        });
    });

    document.querySelectorAll('.rule-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            editingRuleId = btn.dataset.ruleId;
            ruleInput.value = btn.dataset.ruleText;
            document.getElementById('ruleSetSelect').value = btn.dataset.ruleSet || '';
            document.querySelector('#ruleModalOverlay .modal-header h2').textContent = 'Edit Rule';
            btnRuleSave.textContent = 'Update Rule';
            ruleModalOverlay.classList.add('active');
        });
    });

    document.querySelectorAll('.rule-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.ruleId;
            const confirmOverlay = document.getElementById('confirmOverlay');
            const confirmDelete = document.getElementById('confirmDelete');
            const confirmCancel = document.getElementById('confirmCancel');

            confirmOverlay.classList.add('active');

            confirmDelete.onclick = async () => {
                await supabaseClient.from('rules').delete().eq('id', id);
                checkedRules.delete(id);
                confirmOverlay.classList.remove('active');
                loadRules();
            };

            confirmCancel.onclick = () => confirmOverlay.classList.remove('active');
        });
    });

    lucide.createIcons();
}

document.getElementById('btnReset').addEventListener('click', () => {
    checkedRules = new Set();
    renderRules();
});

// ============================================
// JOURNAL
// ============================================
let journalPage = 1;
const TRADES_PER_PAGE = 8;
let allTrades = [];
let filteredTrades = [];

async function loadJournal() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const { data: trades } = await supabaseClient
        .from('trades')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

    allTrades = trades || [];

    // Show/hide filter lock based on plan
    const filterLockOverlay = document.getElementById('filterLockOverlay');
    if (filterLockOverlay) {
        filterLockOverlay.style.display = userPlan === 'free' ? 'flex' : 'none';
    }

    // Populate symbol filter
    const symbols = [...new Set(allTrades.map(t => t.symbol))];
    const symbolSelect = document.getElementById('filterSymbol');
    symbolSelect.innerHTML = `<option value="">All Symbols</option>` +
        symbols.map(s => `<option value="${s}">${s}</option>`).join('');

    applyFilters();
}

function applyFilters() {
    const dateFrom = document.getElementById('filterDateFrom').value;
    const dateTo = document.getElementById('filterDateTo').value;
    const symbol = document.getElementById('filterSymbol').value;
    const direction = document.getElementById('filterDirection').value;
    const rules = document.getElementById('filterRules').value;

    filteredTrades = allTrades.filter(trade => {
        if (dateFrom && trade.date < dateFrom) return false;
        if (dateTo && trade.date > dateTo) return false;
        if (symbol && trade.symbol !== symbol) return false;
        if (direction && trade.direction !== direction) return false;
        if (rules !== '' && String(trade.followed_rules) !== rules) return false;
        return true;
    });

    const sortBy = document.getElementById('journalSort').value;
    if (sortBy === 'newest') {
        filteredTrades.sort((a, b) => {
            if (b.date !== a.date) return b.date.localeCompare(a.date);
            if (a.created_at && b.created_at) return new Date(b.created_at) - new Date(a.created_at);
            return b.trade_number - a.trade_number;
        });
    } else if (sortBy === 'oldest') {
        filteredTrades.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            if (a.created_at && b.created_at) return new Date(a.created_at) - new Date(b.created_at);
            return a.trade_number - b.trade_number;
        });
    } else if (sortBy === 'pnl_high') {
        filteredTrades.sort((a, b) => b.pnl - a.pnl);
    } else if (sortBy === 'pnl_low') {
        filteredTrades.sort((a, b) => a.pnl - b.pnl);
    }
    journalPage = 1;
    console.log('sorted:', filteredTrades.map(t => t.date + ' #' + t.trade_number));
    renderJournal();
    console.log('allTrades:', allTrades.length);
    console.log('filters:', { dateFrom, dateTo, symbol, direction, rules });
}

function renderJournal() {
    const entriesEl = document.getElementById('journalEntries');
    const paginationEl = document.getElementById('journalPagination');

    if (filteredTrades.length === 0) {
        entriesEl.innerHTML = `<div class="journal-empty"><p>No trades match your filters.</p></div>`;
        paginationEl.innerHTML = '';
        return;
    }

    const totalPages = Math.ceil(filteredTrades.length / TRADES_PER_PAGE);
    const start = (journalPage - 1) * TRADES_PER_PAGE;
    const pageTrades = filteredTrades.slice(start, start + TRADES_PER_PAGE);

    entriesEl.innerHTML = pageTrades.map(trade => `
        <div class="journal-entry ${trade.pnl > 0 ? 'win' : trade.pnl < 0 ? 'loss' : ''}">
            
            <!-- LEFT - Trade Data -->
            <div class="entry-data">
                <div class="entry-top">
                    <div class="entry-header-row">
                        <span class="entry-symbol">${trade.symbol}</span>
                        <span class="entry-pnl ${trade.pnl >= 0 ? 'positive' : 'negative'}">
                            ${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}
                        </span>
                    </div>
                    <div class="entry-meta">
                        <span class="entry-direction ${trade.direction}">
                            ${trade.direction === 'long' ? '↑ Long' : '↓ Short'}
                        </span>
                        <span class="entry-size">${trade.size} contract${trade.size > 1 ? 's' : ''}</span>
                    </div>
                    <div class="entry-prices">
                        <span>In: ${trade.entry_price}</span>
                        <span>Out: ${trade.exit_price}</span>
                    </div>
                </div>
                <div class="entry-bottom">
                    <span class="entry-date">${trade.date}</span>
                    <span class="entry-trade-num">Trade #${trade.trade_number}</span>
                    <span class="entry-rules-badge ${trade.followed_rules ? 'followed' : 'broke'}">
                        ${trade.followed_rules ? '✓ Rules followed' : '✗ Broke rules'}
                    </span>
                </div>
            </div>

            <!-- RIGHT - Journal Notes -->
            <div class="entry-journal">
                <div class="entry-emotions">
                    ${trade.emotions 
                        ? trade.emotions.split(', ').map(e => `<span class="entry-emotion-tag">${e}</span>`).join('')
                        : ''
                    }
                </div>
                <textarea 
                    class="entry-notes-editable" 
                    data-trade-id="${trade.id}"
                    placeholder="Click to add notes..."
                >${trade.notes || ''}</textarea>
                <div class="entry-actions">
                    <button class="trade-edit-btn" data-id="${trade.id}">
                        <i data-lucide="pencil" class="pencil-icon"></i>
                    </button>
                    <button class="trade-delete-btn" data-id="${trade.id}">
                        <i data-lucide="trash-2" class="trash-icon"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');

    // Pagination
    paginationEl.innerHTML = `
        <button class="page-btn" id="prevPage" ${journalPage === 1 ? 'disabled' : ''}>← Prev</button>
        ${Array.from({length: totalPages}, (_, i) => `
            <button class="page-btn ${journalPage === i + 1 ? 'active' : ''}" data-page="${i + 1}">${i + 1}</button>
        `).join('')}
        <button class="page-btn" id="nextPage" ${journalPage === totalPages ? 'disabled' : ''}>Next →</button>
    `;

    document.getElementById('prevPage').addEventListener('click', () => {
        if (journalPage > 1) { journalPage--; renderJournal(); }
    });

    document.getElementById('nextPage').addEventListener('click', () => {
        if (journalPage < totalPages) { journalPage++; renderJournal(); }
    });

    document.querySelectorAll('.page-btn[data-page]').forEach(btn => {
        btn.addEventListener('click', () => {
            journalPage = parseInt(btn.dataset.page);
            renderJournal();
        });
    });

    lucide.createIcons();

    // Auto-save notes on blur
    document.querySelectorAll('.entry-notes-editable').forEach(textarea => {
        let saveTimeout;
        textarea.addEventListener('input', () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(async () => {
                const tradeId = textarea.dataset.tradeId;
                await supabaseClient
                    .from('trades')
                    .update({ notes: textarea.value })
                    .eq('id', tradeId);
            }, 1000);
        });

        textarea.addEventListener('blur', async () => {
            clearTimeout(saveTimeout);
            const tradeId = textarea.dataset.tradeId;
            await supabaseClient
                .from('trades')
                .update({ notes: textarea.value })
                .eq('id', tradeId);
        });
    });
}

// Filter listeners
['filterSymbol', 'filterDirection', 'filterRules', 'journalSort'].forEach(id => {
    document.getElementById(id).addEventListener('change', applyFilters);
});

document.getElementById('filterDateFrom').addEventListener('input', applyFilters);
document.getElementById('filterDateTo').addEventListener('input', applyFilters);

document.getElementById('btnFilterReset').addEventListener('click', () => {
    document.getElementById('filterDateFrom').value = '';
    document.getElementById('filterDateTo').value = '';
    document.getElementById('filterSymbol').value = '';
    document.getElementById('filterDirection').value = '';
    document.getElementById('filterRules').value = '';
    applyFilters();
});

// ============================================
// STREAK PAGE
// ============================================
const RANKS = [
    { name: 'Bronze', icon: '🥉', min: 0, max: 4 },
    { name: 'Silver', icon: '🥈', min: 5, max: 9 },
    { name: 'Gold', icon: '🥇', min: 10, max: 14 },
    { name: 'Platinum', icon: '💎', min: 15, max: 19 },
    { name: 'Titanium', icon: '🔩', min: 20, max: 29 },
    { name: 'Diamond', icon: '💠', min: 30, max: Infinity }
];

let calendarDate = new Date();

function getRank(totalDays) {
    return RANKS.find(r => totalDays >= r.min && totalDays <= r.max) || RANKS[0];
}

async function loadStreakPage() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const { data: trades } = await supabaseClient
        .from('trades')
        .select('date, pnl, followed_rules')
        .eq('user_id', session.user.id)
        .order('date', { ascending: true });

    if (!trades) return;

    // Group by date
    const tradesByDate = {};
    trades.forEach(trade => {
        if (!tradesByDate[trade.date]) {
            tradesByDate[trade.date] = { pnl: 0, followed_rules: true };
        }
        tradesByDate[trade.date].pnl += trade.pnl;
        if (!trade.followed_rules) tradesByDate[trade.date].followed_rules = false;
    });

    // Total compliant days
    const compliantDays = Object.values(tradesByDate).filter(d => d.followed_rules).length;

    // Highest win streak
    const tradingDates = Object.keys(tradesByDate).sort();
    let maxStreak = 0;
    let currentStreak = 0;
    tradingDates.forEach(date => {
        if (tradesByDate[date].followed_rules) {
            currentStreak++;
            maxStreak = Math.max(maxStreak, currentStreak);
        } else {
            currentStreak = 0;
        }
    });

    // Current streak
    let streak = 0;
    const sortedDates = [...tradingDates].reverse();
    for (const date of sortedDates) {
        if (tradesByDate[date].followed_rules) {
            streak++;
        } else {
            break;
        }
    }

    // Rank
    const rank = getRank(compliantDays);
    const nextRank = RANKS.find(r => r.min > compliantDays);
    const daysToNext = nextRank ? nextRank.min - compliantDays : 0;
    const progressPct = nextRank
        ? ((compliantDays - rank.min) / (nextRank.min - rank.min)) * 100
        : 100;

    // Update stats
    document.getElementById('highestWinStreak').textContent = `${maxStreak} days`;
    document.getElementById('totalCompliantDays').textContent = `${compliantDays} days`;
    document.getElementById('streakPageFlame').textContent = streak > 0 ? '🔥' : '💤';
    document.getElementById('streakPageTitle').textContent = streak > 0 ? `${streak} Day Streak` : 'No streak yet';

    // Rank
    document.getElementById('rankIcon').textContent = rank.icon;
    document.getElementById('rankName').textContent = rank.name;
    document.getElementById('rankProgressLabel').textContent = nextRank
        ? `${daysToNext} days to ${nextRank.name}`
        : '🏆 Max rank achieved!';
    document.getElementById('rankProgressFill').style.width = `${progressPct}%`;

    // Streak days widget
    const streakPageDays = document.getElementById('streakPageDays');
    streakPageDays.innerHTML = '';
    const today = new Date();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const days = [];
    let d = new Date(today);
    while (d.getDay() !== 1) d.setDate(d.getDate() - 1);
    for (let i = 0; i < 5; i++) {
        days.push(new Date(d));
        d.setDate(d.getDate() + 1);
    }
    days.forEach(day => {
        const dateStr = day.toLocaleDateString('en-CA');
        const isToday = dateStr === today.toLocaleDateString('en-CA');
        const dayData = tradesByDate[dateStr];
        const isActive = dayData && dayData.followed_rules;
        const circle = document.createElement('div');
        circle.className = 'day-circle' + (isActive ? ' active' : '') + (isToday ? ' today' : '');
        circle.innerHTML = `${day.getDate()}<span>${dayNames[day.getDay()]}</span>`;
        streakPageDays.appendChild(circle);
    });

    renderCalendar(tradesByDate);
}

function renderCalendar(tradesByDate) {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    document.getElementById('calMonth').textContent = `${monthNames[month]} ${year}`;

    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const today = new Date().toLocaleDateString('en-CA');

    // Monday-based offset
    let startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6;

    for (let i = 0; i < startOffset; i++) {
        const empty = document.createElement('div');
        empty.className = 'cal-day empty';
        grid.appendChild(empty);
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayData = tradesByDate[dateStr];
        const isToday = dateStr === today;

        const cell = document.createElement('div');
        let className = 'cal-day';

        if (dayData) {
            className += dayData.pnl >= 0 && dayData.followed_rules ? ' win' : ' loss';
        } else {
            className += ' no-trade';
        }

        if (isToday) className += ' today';
        cell.className = className;
        cell.innerHTML = `${day}${dayData ? `<span class="cal-day-label">${dayData.followed_rules ? '✓' : '✗'}</span>` : ''}`;
        grid.appendChild(cell);
    }
}
// Calendar navigation
document.getElementById('calPrev').addEventListener('click', () => {
    calendarDate.setMonth(calendarDate.getMonth() - 1);
    loadStreakPage();
});

document.getElementById('calNext').addEventListener('click', () => {
    calendarDate.setMonth(calendarDate.getMonth() + 1);
    loadStreakPage();
});

// ============================================
// SETTINGS
// ============================================
async function loadSettings() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    document.getElementById('settingEmail').value = session.user.email || '';

    // Load saved settings from localStorage
    const savedSettings = JSON.parse(localStorage.getItem('noxis_settings') || '{}');
    if (savedSettings.name) document.getElementById('settingName').value = savedSettings.name;
    if (savedSettings.balance) document.getElementById('settingBalance').value = savedSettings.balance;
    if (savedSettings.instrument) document.getElementById('settingInstrument').value = savedSettings.instrument;
    if (savedSettings.firm) document.getElementById('settingFirm').value = savedSettings.firm;
    if (savedSettings.timezone) document.getElementById('settingTimezone').value = savedSettings.timezone;
    if (savedSettings.sessionStart) document.getElementById('settingSessionStart').value = savedSettings.sessionStart;
    if (savedSettings.sessionEnd) document.getElementById('settingSessionEnd').value = savedSettings.sessionEnd;
    // Update sidebar user info
    const displayName = savedSettings.name || session.user.email?.split('@')[0] || 'User';
    document.querySelector('.user-name').textContent = displayName;
    document.querySelector('.user-avatar').textContent = displayName.charAt(0).toUpperCase();
}

function saveSettingsAction(btn) {
    const settings = {
        name: document.getElementById('settingName').value,
        balance: document.getElementById('settingBalance').value,
        instrument: document.getElementById('settingInstrument').value,
        firm: document.getElementById('settingFirm').value,
        timezone: document.getElementById('settingTimezone').value,
        sessionStart: document.getElementById('settingSessionStart').value,
        sessionEnd: document.getElementById('settingSessionEnd').value,
    };

    localStorage.setItem('noxis_settings', JSON.stringify(settings));

    if (settings.balance) {
        const balanceEl = document.querySelector('.stat-value.green');
        if (balanceEl) balanceEl.textContent = '$' + Number(settings.balance).toLocaleString();
    }

    if (settings.name) {
        document.querySelector('.user-name').textContent = settings.name;
    }

    btn.textContent = 'Saved ✓';
    setTimeout(() => btn.textContent = 'Save Changes', 2000);
}

document.getElementById('btnSaveSettings').addEventListener('click', () => {
    saveSettingsAction(document.getElementById('btnSaveSettings'));
});

document.getElementById('btnSaveSettingsBottom')?.addEventListener('click', () => {
    saveSettingsAction(document.getElementById('btnSaveSettingsBottom'));
});

// Logout
document.getElementById('btnLogout').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
});

// Delete all trades
document.getElementById('btnDeleteTrades').addEventListener('click', () => {
    const confirmOverlay = document.getElementById('confirmOverlay');
    const confirmDelete = document.getElementById('confirmDelete');
    const confirmCancel = document.getElementById('confirmCancel');

    document.querySelector('.confirm-popup h3').textContent = 'Delete All Trades?';
    document.querySelector('.confirm-popup p').innerHTML = 'Type <strong>DELETE</strong> to confirm. This cannot be undone.';
    
    // Add input field
    const existing = document.getElementById('deleteConfirmInput');
    if (!existing) {
        const input = document.createElement('input');
        input.id = 'deleteConfirmInput';
        input.placeholder = 'Type DELETE here';
        input.style.cssText = 'background:#0a0a0a;border:1px solid #2a2a2a;border-radius:8px;padding:10px 14px;color:#fff;font-size:14px;font-family:Space Grotesk,sans-serif;outline:none;width:100%;margin-top:4px;';
        document.querySelector('.confirm-actions').before(input);
    } else {
        existing.value = '';
    }

    confirmOverlay.classList.add('active');

    confirmDelete.onclick = async () => {
        const inputVal = document.getElementById('deleteConfirmInput')?.value;
        if (inputVal !== 'DELETE') {
            document.getElementById('deleteConfirmInput').style.borderColor = '#ff4444';
            return;
        }
        const { data: { session } } = await supabaseClient.auth.getSession();
        await supabaseClient.from('trades').delete().eq('user_id', session.user.id);
        confirmOverlay.classList.remove('active');
        document.getElementById('deleteConfirmInput')?.remove();
        document.querySelector('.confirm-popup h3').textContent = 'Delete Trade?';
        document.querySelector('.confirm-popup p').textContent = "This action can't be undone.";
        loadRecentTrades();
        loadStreak();
    };

    confirmCancel.onclick = () => {
        confirmOverlay.classList.remove('active');
        document.getElementById('deleteConfirmInput')?.remove();
        document.querySelector('.confirm-popup h3').textContent = 'Delete Trade?';
        document.querySelector('.confirm-popup p').textContent = "This action can't be undone.";
    };
});

// Mobile settings button
const mobileSettingsBtn = document.querySelector('.mobile-settings-btn');
if (mobileSettingsBtn) {
    mobileSettingsBtn.addEventListener('click', () => {
        navItems.forEach(n => n.classList.remove('active'));
        pages.forEach(p => p.classList.remove('active'));
        document.getElementById('page-settings').classList.add('active');
        sessionStorage.setItem('noxis_active_page', 'settings');
        loadSettings();
        lucide.createIcons();
        const fab = document.getElementById('fabLogTrade');
        if (fab) fab.style.display = 'none';
    });
}

// ============================================
// INSIGHTS
// ============================================
async function loadInsights() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const { data: trades } = await supabaseClient
        .from('trades')
        .select('*')
        .eq('user_id', session.user.id)
        .order('date', { ascending: true });

    if (!trades || trades.length === 0) {
        document.getElementById('insightTotalPnl').textContent = '$0';
        document.getElementById('insightWinRate').textContent = '0%';
        document.getElementById('insightProfitFactor').textContent = '—';
        document.getElementById('insightAvgRatio').textContent = '—';
        return;
    }

    // STATS
    const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl < 0);
    const winRate = (wins.length / trades.length) * 100;
    const grossWin = wins.reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? (grossWin / grossLoss).toFixed(2) : '∞';
    const avgWin = wins.length > 0 ? grossWin / wins.length : 0;
    const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
    const avgRatio = avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : '∞';

    document.getElementById('insightTotalPnl').textContent =
        (totalPnl >= 0 ? '+$' : '-$') + Math.abs(totalPnl).toFixed(2);
    document.getElementById('insightTotalPnl').className =
        'insight-stat-value ' + (totalPnl >= 0 ? 'positive' : 'negative');
    document.getElementById('insightWinRate').textContent = winRate.toFixed(1) + '%';
    document.getElementById('insightWinRate').className = 'insight-stat-value ' + (winRate >= 50 ? 'positive' : 'negative');
    document.getElementById('insightProfitFactor').textContent = profitFactor;
    document.getElementById('insightAvgRatio').textContent = avgRatio;

    // DAY OF WEEK CHART
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const dayPnl = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0 };
    const dayCount = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0 };
    const dayNames2 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    trades.forEach(trade => {
        const day = dayNames2[new Date(trade.date + 'T12:00:00').getDay()];
        if (dayPnl[day] !== undefined) {
            dayPnl[day] += trade.pnl;
            dayCount[day]++;
        }
    });

    const maxAbsDay = Math.max(...Object.values(dayPnl).map(Math.abs), 1);
    const dayChart = document.getElementById('dayOfWeekChart');
    dayChart.style.alignItems = 'flex-end';
    dayChart.style.padding = '8px 0';

    const hasAnyDayData = Object.values(dayCount).some(c => c > 0);

    if (!hasAnyDayData) {
        dayChart.innerHTML = '<p style="color:#444;font-size:13px;margin:auto;">No trade data yet.</p>';
        dayChart.style.alignItems = 'center';
    } else {
        dayChart.innerHTML = '';
        dayNames.forEach(day => {
            const pnl = dayPnl[day];
            const heightPct = maxAbsDay > 0 ? (Math.abs(pnl) / maxAbsDay) * 100 : 4;
            const color = pnl > 0 ? 'rgba(0,200,100,0.6)' : pnl < 0 ? 'rgba(255,68,68,0.6)' : '#2a2a2a';
            const group = document.createElement('div');
            group.className = 'day-bar-group';
            group.innerHTML = `
                <span class="day-bar-value" style="color:${pnl > 0 ? '#00c864' : pnl < 0 ? '#ff4444' : '#444'}">
                    ${dayCount[day] > 0 ? (pnl >= 0 ? '+' : '') + '$' + pnl.toFixed(0) : '—'}
                </span>
                <div class="day-bar" style="height:${Math.max(heightPct, 4)}%;background:${color};width:100%;border-radius:4px 4px 0 0;"></div>
                <span class="day-bar-label">${day}</span>
            `;
            dayChart.appendChild(group);
        });
    }

    // EMOTION CORRELATION
    const emotionStats = {};
    trades.forEach(trade => {
        if (!trade.emotions) return;
        trade.emotions.split(', ').forEach(emotion => {
            if (!emotion) return;
            if (!emotionStats[emotion]) emotionStats[emotion] = { wins: 0, total: 0 };
            emotionStats[emotion].total++;
            if (trade.pnl > 0) emotionStats[emotion].wins++;
        });
    });

    const emotionChart = document.getElementById('emotionChart');
    emotionChart.style.height = 'auto';
    emotionChart.style.alignItems = 'stretch';

    if (Object.keys(emotionStats).length === 0) {
        emotionChart.innerHTML = '<p style="color:#444;font-size:13px;margin:auto;">No emotion data yet.</p>';
    } else {
        const sorted = Object.entries(emotionStats)
            .map(([name, s]) => ({ name, winRate: (s.wins / s.total) * 100, total: s.total }))
            .sort((a, b) => b.winRate - a.winRate)
            .slice(0, 6);

        const list = document.createElement('div');
        list.className = 'emotion-list';

        sorted.forEach(e => {
            const color = e.winRate >= 60 ? 'high' : e.winRate >= 40 ? 'mid' : 'low';
            const row = document.createElement('div');
            row.className = 'emotion-row';
            row.innerHTML = `
                <span class="emotion-name">${e.name}</span>
                <div class="emotion-bar-wrap">
                    <div class="emotion-bar-fill ${color}" style="width: ${e.winRate}%"></div>
                </div>
                <span class="emotion-pct">${e.winRate.toFixed(0)}%</span>
            `;
            list.appendChild(row);
        });

        emotionChart.innerHTML = '';
        emotionChart.appendChild(list);
    }

    // EQUITY CURVE
    const equityChart = document.getElementById('equityChart');
    const settings = JSON.parse(localStorage.getItem('noxis_settings') || '{}');
    const startBalance = parseFloat(settings.balance) || 50000;

    let balance = startBalance;
    const points = [{ date: 'Start', balance }];
    trades.forEach(trade => {
        balance += trade.pnl;
        points.push({ date: new Date(trade.date + 'T12:00:00').toLocaleDateString(), balance });
    });

    const maxBal = Math.max(...points.map(p => p.balance));
    const minBal = Math.min(...points.map(p => p.balance));
    const range = maxBal - minBal || 1;
    const w = 600;
    const h = 180;
    const pad = 20;

    const svgPoints = points.map((p, i) => {
        const x = pad + (i / (points.length - 1)) * (w - pad * 2);
        const y = h - pad - ((p.balance - minBal) / range) * (h - pad * 2);
        return `${x},${y}`;
    }).join(' ');

    const lastBalance = points[points.length - 1].balance;
    const lineColor = lastBalance >= startBalance ? '#00c864' : '#ff4444';

    if (points.length <= 1) {
    equityChart.innerHTML = '<p style="color:#444;font-size:13px;margin:auto;text-align:center;">Log trades to see your equity curve.</p>';
    equityChart.style.alignItems = 'center';
    equityChart.style.justifyContent = 'center';
    return;
    }

    const startLabel = `$${startBalance.toLocaleString()}`;
    const endLabel = `$${lastBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const pnlLabel = (lastBalance - startBalance >= 0 ? '+' : '') + '$' + (lastBalance - startBalance).toFixed(2);

    equityChart.innerHTML = `
        <div style="position:relative;width:100%;height:100%;">
            <div style="position:absolute;top:0;right:0;font-size:12px;font-family:'JetBrains Mono',monospace;color:${lineColor};">${endLabel} <span style="font-size:11px;">(${pnlLabel})</span></div>
            <div style="position:absolute;bottom:0;left:0;font-size:11px;font-family:'JetBrains Mono',monospace;color:#444;">Start: ${startLabel}</div>
            <svg viewBox="0 0 ${w} ${h}" class="equity-line" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="${lineColor}" stop-opacity="0.3"/>
                        <stop offset="100%" stop-color="${lineColor}" stop-opacity="0"/>
                    </linearGradient>
                </defs>
                <polyline
                    points="${svgPoints}"
                    fill="none"
                    stroke="${lineColor}"
                    stroke-width="2"
                    stroke-linejoin="round"
                />
                <polygon
                    points="${svgPoints} ${600 - pad},${h} ${pad},${h}"
                    fill="url(#equityGrad)"
                />
            </svg>
        </div>
    `;

    equityChart.style.position = 'relative';

    // Show/hide AI lock based on plan
    const aiLock = document.querySelector('.insight-ai-lock');
    const aiItems = document.querySelectorAll('.ai-insight-item.blurred');

    if (userPlan === 'free') {
        if (aiLock) aiLock.style.display = 'flex';
        aiItems.forEach(item => item.classList.add('blurred'));
    } else if (userPlan === 'pro' || userPlan === 'elite') {
        if (aiLock) aiLock.style.display = 'none';
        aiItems.forEach(item => item.classList.remove('blurred'));
    }
    }

document.getElementById('btnAddRuleInline').addEventListener('click', () => {
    ruleModalOverlay.classList.add('active');
});

document.getElementById('fabLogTrade')?.addEventListener('click', () => {
    modalOverlay.classList.add('active');
    loadTradeCounter();
});

async function loadTradeCounter() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const limit = PLAN_LIMITS[userPlan];
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { count } = await supabaseClient
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .gte('created_at', firstOfMonth);

    const counter = document.getElementById('tradeCounter');
    if (!counter) return;

    counter.textContent = `${count} / ${limit} trades this month`;
    counter.className = 'trade-counter';

    const limitBanner = document.getElementById('limitBanner');
    const btnSave = document.getElementById('btnSave');

    if (count >= limit) {
        counter.classList.add('full');
        if (limitBanner) limitBanner.style.display = 'flex';
        if (btnSave) {
            btnSave.disabled = true;
            btnSave.style.opacity = '0.4';
            btnSave.style.cursor = 'not-allowed';
        }
    } else {
        if (limitBanner) limitBanner.style.display = 'none';
        if (btnSave) {
            btnSave.disabled = false;
            btnSave.style.opacity = '1';
            btnSave.style.cursor = 'pointer';
        }
        if (count >= limit * 0.8) {
            counter.classList.add('warning');
        }
    }
}

document.getElementById('btnSaveSettingsBottom')?.addEventListener('click', () => {
    document.getElementById('btnSaveSettings').click();
});

//Init
await loadUserPlan();
checkOnboarding();
loadTradeCounter();
renderSuggestions();
loadRecentTrades();
loadStreak();
loadRuleSets();
loadRules();
lucide.createIcons();
// Restore last active page
const lastPage = sessionStorage.getItem('noxis_active_page') || 'dashboard';
pages.forEach(p => p.classList.remove('active'));
navItems.forEach(n => n.classList.remove('active'));
document.getElementById(`page-${lastPage}`)?.classList.add('active');
document.querySelectorAll(`[data-page="${lastPage}"]`).forEach(el => el.classList.add('active'));

if (lastPage === 'checklist') {
    loadRuleSets()
    loadRules();
}
if (lastPage === 'dashboard') {
    loadRecentTrades();
    loadStreak();
}
if (lastPage === 'journal') loadJournal();
if (lastPage === 'streak') loadStreakPage();
if (lastPage === 'settings') loadSettings();
if (lastPage === 'ai') loadInsights();

const fab = document.getElementById('fabLogTrade');
if (fab && lastPage !== 'dashboard') fab.style.display = 'none';
