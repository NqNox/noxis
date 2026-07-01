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

function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

let userPlan = 'free';
let isGeneratingAI = false;
const PLAN_LIMITS = { free: 50, pro: 100, elite: 120 };


function showToast(message, type = 'error', duration = 3000) {
    const container = document.getElementById('toastContainer');
    const icons = { error: '⚠️', success: '✓', warning: '⚡', info: 'ℹ️' };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const iconSpan = document.createElement('span');
    iconSpan.className = 'toast-icon';
    iconSpan.textContent = icons[type];
    const msgSpan = document.createElement('span');
    msgSpan.className = 'toast-message';
    msgSpan.textContent = message;
    toast.appendChild(iconSpan);
    toast.appendChild(msgSpan);

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
        userPlan = 'pro';
    } else {
    await supabaseClient.from('user_plans').insert({
        user_id: session.user.id,
        plan: 'free'
    });
    userPlan = 'pro'; // Temporary: everyone gets Pro during beta
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
    // Check local flag first — fastest check
    if (localStorage.getItem('noxis_onboarding_complete') === 'true') return;

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const { data } = await supabaseClient
        .from('user_plans')
        .select('onboarding_complete')
        .eq('user_id', session.user.id)
        .single();

    if (data?.onboarding_complete) {
        localStorage.setItem('noxis_onboarding_complete', 'true');
        return;
    }

    showOnboarding();
}

async function completeOnboarding(settings) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    localStorage.setItem('noxis_onboarding_complete', 'true');

    const { error } = await supabaseClient
        .from('user_settings')
        .upsert({
            user_id: session.user.id,
            name: settings.name,
            balance: settings.balance || null,
            instrument: settings.instrument,
            firm: settings.firm,
            timezone: settings.timezone,
            session_start: settings.sessionStart,
            session_end: settings.sessionEnd,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

    if (error) console.log('settings error:', error);

    await supabaseClient
        .from('user_plans')
        .update({ onboarding_complete: true })
        .eq('user_id', session.user.id);
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
document.getElementById('onboNext3').addEventListener('click', () => {goToStep(4);});

// Confluence presets per strategy
const CONFLUENCE_PRESETS = {
    'ICT/SMC': {
        'Price Structure': ['Market Structure Shift', 'Break of Structure', 'Change of Character'],
        'Entry Models': ['Fair Value Gap', 'Order Block', 'Breaker Block', 'Optimal Trade Entry'],
        'Liquidity': ['Liquidity Sweep', 'Equal Highs/Lows', 'Stop Hunt'],
        'Time': ['Kill Zone', 'Midnight Open', 'Session Open']
    },
    'CRT': {
        'Candle Structure': ['Candle Range', 'Body Midpoint', 'Wick Rejection'],
        'Entry': ['Range Expansion', 'Inside Candle', 'Outside Candle'],
        'Time': ['Session Alignment', 'HTF Confluence']
    },
    'Wyckoff': {
        'Phases': ['Accumulation', 'Distribution', 'Markup', 'Markdown'],
        'Events': ['Spring', 'Upthrust', 'Test', 'Sign of Strength'],
        'Volume': ['Volume Climax', 'No Supply', 'No Demand']
    },
    'Orderflow': {
        'DOM': ['Large Bid/Ask', 'Iceberg Orders', 'Stacked Imbalance'],
        'Footprint': ['Delta Divergence', 'Point of Control', 'High Volume Node'],
        'Tape': ['Absorption', 'Exhaustion', 'Momentum']
    },
    'Quarterly Theory': {
        'Quarters': ['Q1 Accumulation', 'Q2 Manipulation', 'Q3 Distribution', 'Q4 Continuation'],
        'Alignment': ['HTF Alignment', 'Session Confluence', 'Key Level']
    },
    'AMD': {
        'Phases': ['Accumulation', 'Manipulation', 'Distribution'],
        'Confirmation': ['Phase Transition', 'Key Level Reaction', 'Session Alignment']
    },
    'PDI/Mech': {
        'Phases': ['Accumulation', 'Valid Manipulation', 'Clear Leg'],
        'Confirmation': ['IFVG', 'CISD', 'Displacement ']
    },
    'Other': {
        'General': ['Trend Direction', 'Key Level', 'Support/Resistance', 'Moving Average', 'Volume', 'Momentum', 'Session Open', 'News Event']
    }
};

const RULE_PRESETS = {
    'ICT/SMC': ['Only trade during Kill Zones', 'Wait for liquidity sweep before entry', 'Confirm market structure shift', 'Minimum 2 confluences required', 'No trades during news events'],
    'Price Action': ['Wait for candle close confirmation', 'Only trade at key levels', 'Minimum 1:2 risk to reward', 'No counter-trend trades', 'Set stop loss before entry'],
    'Technical': ['Confirm with volume', 'Wait for indicator alignment', 'No trades in choppy market', 'Follow trend direction', 'Use proper position sizing'],
    'News': ['Check economic calendar before trading', 'No trades 30 min before high impact news', 'Trade the reaction not the news', 'Use wider stops during news'],
    'Other': ['Follow your trading plan', 'Set stop loss before entry', 'Minimum 1:2 risk to reward', 'No revenge trading', 'Max 3 trades per day']
};

let selectedConfluences = [];
let onboRules = [];

// Step 4 — Trading style
document.querySelectorAll('.style-option').forEach(opt => {
    opt.addEventListener('click', () => {
        document.querySelectorAll('.style-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        document.getElementById('onboTradingStyle').value = opt.dataset.value;
        checkStep4Valid();
    });
});

document.querySelectorAll('.strategy-option').forEach(opt => {
    opt.addEventListener('click', () => {
        document.querySelectorAll('.strategy-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        const val = opt.dataset.value;
        document.getElementById('onboStrategyType').value = val;
        const otherInput = document.getElementById('onboStrategyOther');
        if (val === 'Other') {
            otherInput.style.display = 'block';
            otherInput.focus();
        } else {
            otherInput.style.display = 'none';
        }
        checkStep4Valid();
    });
});

document.getElementById('onboStrategyOther').addEventListener('input', (e) => {
    document.getElementById('onboStrategyType').value = e.target.value;
    checkStep4Valid();
});

function checkStep4Valid() {
    const style = document.getElementById('onboTradingStyle').value;
    const strategy = document.getElementById('onboStrategyType').value;
    const btn = document.getElementById('onboNext4');
    if (style && strategy) {
        btn.classList.remove('disabled');
    } else {
        btn.classList.add('disabled');
    }
}

document.getElementById('onboBack4').addEventListener('click', () => goToStep(3, 'back'));
document.getElementById('onboNext4').addEventListener('click', () => {
    const strategy = document.getElementById('onboStrategyType').value;
    if (!strategy) return;

    const presets = CONFLUENCE_PRESETS[strategy] || CONFLUENCE_PRESETS['Other'];
    const list = document.getElementById('onboConfluenceList');
    list.innerHTML = '';
    selectedConfluences = [];

    Object.entries(presets).forEach(([category, items]) => {
        const catEl = document.createElement('div');
        catEl.innerHTML = `<div class="confluence-category-title">${category}</div>
        <div class="confluence-tags-row"></div>`;
        
        const row = catEl.querySelector('.confluence-tags-row');
        items.forEach(c => {
            const tag = document.createElement('div');
            tag.className = 'confluence-tag';
            tag.textContent = c;
            tag.addEventListener('click', () => {
                tag.classList.toggle('active');
                if (tag.classList.contains('active')) {
                    selectedConfluences.push(c);
                } else {
                    selectedConfluences = selectedConfluences.filter(x => x !== c);
                }
            });
            row.appendChild(tag);
        });

        list.appendChild(catEl);
    });

    goToStep(5);
});

// Step 5 — Confluences
document.getElementById('onboAddConfluence').addEventListener('click', () => {
    const input = document.getElementById('onboCustomConfluence');
    const val = input.value.trim();
    if (!val) return;

    const list = document.getElementById('onboConfluenceList');
    const tag = document.createElement('div');
    tag.className = 'confluence-tag active';
    tag.textContent = val;
    selectedConfluences.push(val);
    tag.addEventListener('click', () => {
        tag.classList.toggle('active');
        if (tag.classList.contains('active')) {
            selectedConfluences.push(val);
        } else {
            selectedConfluences = selectedConfluences.filter(x => x !== val);
        }
    });
    list.appendChild(tag);
    input.value = '';
});

document.getElementById('onboCustomConfluence').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('onboAddConfluence').click();
});

document.getElementById('onboBack5').addEventListener('click', () => goToStep(4, 'back'));
document.getElementById('onboNext5').addEventListener('click', () => {
    const strategy = document.getElementById('onboStrategyType').value;
    
    // Load rule presets
    onboRules = [...(RULE_PRESETS[strategy] || RULE_PRESETS['Other'])];
    renderOnboRules();
    goToStep(6);
});

// Step 6 — Rules
function renderOnboRules() {
    const preview = document.getElementById('onboRulesPreview');
    preview.innerHTML = '';
    onboRules.forEach((rule, index) => {
        const el = document.createElement('div');
        el.className = 'rule-preview-item';
        el.innerHTML = `
            <span class="rule-preview-number">${String(index + 1).padStart(2, '0')}</span>
            <span class="rule-preview-text">${rule}</span>
            <button class="rule-remove-btn" data-index="${index}">✕</button>
        `;
        el.querySelector('.rule-remove-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            onboRules.splice(index, 1);
            renderOnboRules();
        });
        preview.appendChild(el);
    });
}

document.getElementById('onboAddRule').addEventListener('click', () => {
    const input = document.getElementById('onboCustomRule');
    const val = input.value.trim();
    if (!val) return;
    onboRules.push(val);
    renderOnboRules();
    input.value = '';
});

document.getElementById('onboCustomRule').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('onboAddRule').click();
});

document.getElementById('onboBack6').addEventListener('click', () => goToStep(5, 'back'));
document.getElementById('onboNext6').addEventListener('click', () => {
    // Build summary
    const name = document.getElementById('onboName').value.trim();
    const balance = document.getElementById('onboBalance').value;
    const firm = document.getElementById('onboFirm').value;
    const instrument = document.getElementById('onboInstrument').value;
    const session = document.querySelector('.session-option.active');
    const style = document.getElementById('onboTradingStyle').value;
    const strategy = document.getElementById('onboStrategyType').value;

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
        <div class="summary-row">
            <span class="summary-label">Style</span>
            <span class="summary-value">${style || '—'}</span>
        </div>
        <div class="summary-row">
            <span class="summary-label">Strategy</span>
            <span class="summary-value">${strategy || '—'}</span>
        </div>
        <div class="summary-row">
            <span class="summary-label">Confluences</span>
            <span class="summary-value">${selectedConfluences.length} selected</span>
        </div>
        <div class="summary-row">
            <span class="summary-label">Rules</span>
            <span class="summary-value">${onboRules.length} rules</span>
        </div>
    `;

    goToStep(7);
});

document.getElementById('onboFinish').addEventListener('click', async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

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

    const strategyData = {
        user_id: session.user.id,
        trading_style: document.getElementById('onboTradingStyle').value,
        strategy_type: document.getElementById('onboStrategyType').value,
        confluences: selectedConfluences,
        updated_at: new Date().toISOString()
    };

    // Closing animation
    const modal = document.querySelector('.onboarding-modal');
    const overlay = document.getElementById('onboardingOverlay');
    modal.style.animation = 'onboarding-out 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards';
    overlay.style.transition = 'opacity 0.4s ease';
    overlay.style.opacity = '0';

    setTimeout(async () => {
        // Save settings
        await completeOnboarding(settings);

        // Save strategy
        await supabaseClient.from('user_strategy').upsert(strategyData, { onConflict: 'user_id' });

        // Save rules to Supabase
        if (onboRules.length > 0) {
            const rulesData = onboRules.map((rule, i) => ({
                user_id: session.user.id,
                rule,
                position: i,
                set_id: null
            }));
            await supabaseClient.from('rules').insert(rulesData);
        }

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
        loadRules();
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
                e.preventDefault();
                e.stopPropagation();

                const ticker = opt.dataset.ticker;
                const name = opt.dataset.name;
                const color = opt.dataset.color;
                const category = opt.dataset.category;

            hiddenInput.value = ticker;
            document.getElementById('symbolName').textContent = `${ticker} — ${name}`;
            document.getElementById('symbolName').style.color = '#ffffff';

            document.getElementById('symbolName').innerHTML = `
                <span style="font-weight:700;font-family:'JetBrains Mono',monospace;">${ticker}</span>
                <span style="color:#888888;font-size:12px;"> — ${name}</span>
                <span style="background:${color};color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:50px;margin-left:8px;">${category}</span>
            `;
            document.getElementById('symbolName').style.color = '#ffffff';

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

// Modal
const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const btnCancel = document.getElementById('btnCancel');
if (btnCancel) btnCancel.addEventListener('click', closeModal);
const logTradeButtons = document.querySelectorAll('.btn-log-trade, .btn-log-trade-sm');
let editingTradeId = null;

const today = new Date().toLocaleDateString('en-CA');
document.getElementById('tradeDate').value = today;

logTradeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        openModal();
        goToModalStep(1);
        loadTradeConfluences();
        loadTradeCounter();
        updatePnL();
    });
});

document.getElementById('fabLogTrade')?.addEventListener('click', () => {
    openModal();
    goToModalStep(1);
    loadTradeConfluences();
    loadTradeCounter();
});

function openModal() {
    const overlay = document.getElementById('modalOverlay');
    const modal = document.querySelector('#modalOverlay .modal');
    modal.style.opacity = '0';
    modal.style.transform = 'scale(0.96) translateY(16px)';
    overlay.classList.add('active');
    overlay.animate([
        { opacity: 0 },
        { opacity: 1 }
    ], { duration: 250, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
    modal.animate([
        { opacity: 0, transform: 'scale(0.96) translateY(16px)' },
        { opacity: 1, transform: 'scale(1) translateY(0)' }
    ], { duration: 250, easing: 'cubic-bezier(0.2, 0, 0, 1)', fill: 'forwards' });
}

function closeModal() {
    const modal = document.querySelector('#modalOverlay .modal');
    const overlay = document.getElementById('modalOverlay');

    modal.animate([
        { opacity: 1, transform: 'scale(1) translateY(0)' },
        { opacity: 0, transform: 'scale(0.96) translateY(16px)' }
    ], { duration: 200, easing: 'cubic-bezier(0.2, 0, 0, 1)', fill: 'forwards' });

    overlay.animate([
        { opacity: 1 },
        { opacity: 0 }
    ], { duration: 200, easing: 'cubic-bezier(0.2, 0, 0, 1)' }).onfinish = () => {
        modalOverlay.classList.remove('active');
        modal.style.opacity = '';
        modal.style.transform = '';

        editingTradeId = null;
        document.getElementById('modalStepTitle').textContent = 'Log Trade';
        document.getElementById('btnSave').textContent = 'Save Trade';
        document.getElementById('tradeDate').value = today;
        document.getElementById('tradeNumber').value = '1';
        document.getElementById('tradeSize').value = '1';
        document.getElementById('tradeEntry').value = '';
        document.getElementById('tradeExit').value = '';
        document.getElementById('tradeStopLoss').value = '';
        document.getElementById('tradeTarget').value = '';
        document.getElementById('tradeNotes').value = '';
        document.getElementById('tradeSetupType').value = '';
        document.getElementById('tradeSession').value = '';
        document.getElementById('tradeSetupRating').value = '';
        document.getElementById('tradeManagementRating').value = '';
        document.getElementById('tradeTakeAgain').value = '';
        document.getElementById('tradeMentalState').value = '';

        // Reset stars
        document.querySelectorAll('.star').forEach(s => s.classList.remove('active'));

        // Reset mental state
        document.querySelectorAll('.mental-option').forEach(o => o.classList.remove('active'));
        selectedMentalStates = [];
        document.getElementById('tradeMentalState').value = '';

        // Reset take again
        document.getElementById('btnTakeAgainYes').classList.remove('active');
        document.getElementById('btnTakeAgainNo').classList.remove('active');
        document.getElementById('btnTakeAgainYes').style.cssText = '';
        document.getElementById('btnTakeAgainNo').style.cssText = '';

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
        screenshotFiles = [];
        renderScreenshotPreviews();
        screenshotPlaceholder.style.display = 'flex';
    };
}

modalClose.addEventListener('click', closeModal);
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

let selectedEmotions = [];
let savedEmotions = JSON.parse(localStorage.getItem('noxis_emotions') || '[]');
const defaultEmotions = ['FOMO', 'Anxious', 'Confident', 'Frustrated', 'Calm', 'Revenge', 'Greedy', 'Patient'];

function renderSuggestions() {
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
    if (!clean || selectedEmotions.includes(clean)) return;
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
        // Upload screenshots
        let screenshotUrls = [];
        if (screenshotFiles.length > 0) {
            const { data: { session: uploadSession } } = await supabaseClient.auth.getSession();
            for (const file of screenshotFiles) {
                const ext = file.name.split('.').pop();
                const path = `${uploadSession.user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
                const { data, error } = await supabaseClient.storage
                    .from('trade-screenshots')
                    .upload(path, file);
                if (!error) screenshotUrls.push(data.path);
            }
        }
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
            screenshots: screenshotUrls,
            notes,
            stop_loss: document.getElementById('tradeStopLoss').value || null,
            target: document.getElementById('tradeTarget').value || null,
            setup_type: document.getElementById('tradeSetupType').value || null,
            session: document.getElementById('tradeSession').value || null,
            mental_state: document.getElementById('tradeMentalState').value || null,
            setup_rating: document.getElementById('tradeSetupRating').value || null,
            management_rating: document.getElementById('tradeManagementRating').value || null,
            take_again: document.getElementById('tradeTakeAgain').value === 'true' ? true : document.getElementById('tradeTakeAgain').value === 'false' ? false : null,
            confluences: [...document.querySelectorAll('.trade-confluence-tag.active')].map(t => t.textContent)
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

// ============================================
// SHARED TRADE-STATS / CHART HELPERS
// (used by both the Dashboard overview and the Insights page)
// ============================================
function computeTradeStats(trades) {
    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl < 0);
    const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
    const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
    const grossWin = wins.reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? Infinity : 0);
    return { totalPnl, winRate, grossWin, grossLoss, profitFactor, wins, losses };
}

function buildEquityPoints(trades, startBalance) {
    let balance = startBalance;
    const points = [{ date: 'Start', balance }];
    trades.forEach(trade => {
        balance += trade.pnl;
        points.push({ date: new Date(trade.date + 'T12:00:00').toLocaleDateString(), balance });
    });
    return points;
}

function renderEquityCurve(containerEl, points, startBalance) {
    if (!containerEl) return;

    if (points.length <= 1) {
        containerEl.innerHTML = '<p style="color:#444;font-size:13px;margin:auto;text-align:center;">Log trades to see your equity curve.</p>';
        containerEl.style.alignItems = 'center';
        containerEl.style.justifyContent = 'center';
        return;
    }

    const maxBal = Math.max(...points.map(p => p.balance));
    const minBal = Math.min(...points.map(p => p.balance));
    const range = maxBal - minBal || 1;
    const w = 600, h = 180, pad = 20;

    const svgPoints = points.map((p, i) => {
        const x = pad + (i / (points.length - 1)) * (w - pad * 2);
        const y = h - pad - ((p.balance - minBal) / range) * (h - pad * 2);
        return `${x},${y}`;
    }).join(' ');

    const lastBalance = points[points.length - 1].balance;
    const lineColor = lastBalance >= startBalance ? '#00c864' : '#ff4444';
    const gradId = `equityGrad-${containerEl.id}`;

    const startLabel = `$${startBalance.toLocaleString()}`;
    const endLabel = `$${lastBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const pnlLabel = (lastBalance - startBalance >= 0 ? '+' : '') + '$' + (lastBalance - startBalance).toFixed(2);

    containerEl.innerHTML = `
        <div style="position:relative;width:100%;height:100%;">
            <div style="position:absolute;top:0;right:0;font-size:12px;font-family:'JetBrains Mono',monospace;color:${lineColor};">${endLabel} <span style="font-size:11px;">(${pnlLabel})</span></div>
            <div style="position:absolute;bottom:0;left:0;font-size:11px;font-family:'JetBrains Mono',monospace;color:#444;">Start: ${startLabel}</div>
            <svg viewBox="0 0 ${w} ${h}" class="equity-line" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="${lineColor}" stop-opacity="0.3"/>
                        <stop offset="100%" stop-color="${lineColor}" stop-opacity="0"/>
                    </linearGradient>
                </defs>
                <polyline
                    class="equity-polyline"
                    points="${svgPoints}"
                    fill="none"
                    stroke="${lineColor}"
                    stroke-width="2"
                    stroke-linejoin="round"
                />
                <polygon
                    class="equity-polygon"
                    points="${svgPoints} ${w - pad},${h} ${pad},${h}"
                    fill="url(#${gradId})"
                />
            </svg>
        </div>
    `;

    // Draw the line in and wipe the fill area in from left to right
    const polyline = containerEl.querySelector('.equity-polyline');
    const polygon = containerEl.querySelector('.equity-polygon');
    const length = polyline.getTotalLength();

    polyline.style.strokeDasharray = length;
    polyline.style.strokeDashoffset = length;
    polygon.style.clipPath = 'inset(0 100% 0 0)';

    requestAnimationFrame(() => {
        polyline.style.transition = 'stroke-dashoffset 1.1s ease-out';
        polygon.style.transition = 'clip-path 1.1s ease-out';
        polyline.style.strokeDashoffset = '0';
        polygon.style.clipPath = 'inset(0 0% 0 0)';
    });
}

function computeMaxDrawdownPct(points) {
    if (!points.length) return 0;
    let peak = points[0].balance;
    let maxDrawdown = 0;
    points.forEach(p => {
        if (p.balance > peak) peak = p.balance;
        if (peak > 0) {
            const dd = ((peak - p.balance) / peak) * 100;
            if (dd > maxDrawdown) maxDrawdown = dd;
        }
    });
    return maxDrawdown;
}

// Noxis AI score: weighted blend of discipline + execution-quality signals.
// Missing components (e.g. no star ratings logged yet) are excluded and the
// remaining weights are re-normalized to 100 rather than counted as zero.
function computeAIScore(trades, stats, equityPoints) {
    const components = [];

    if (trades.length > 0) {
        const compliant = trades.filter(t => t.followed_rules).length;
        components.push({ value: (compliant / trades.length) * 100, weight: 25 });
        components.push({ value: stats.winRate, weight: 20 });
    }

    if (stats.grossWin > 0 || stats.grossLoss > 0) {
        const pf = stats.profitFactor === Infinity ? 2.5 : stats.profitFactor;
        components.push({ value: Math.min(pf, 2.5) / 2.5 * 100, weight: 15 });
    }

    if (equityPoints.length > 1) {
        const ddPct = computeMaxDrawdownPct(equityPoints);
        components.push({ value: 100 - Math.min(ddPct, 50) / 50 * 100, weight: 15 });
    }

    const setupRatings = trades.map(t => t.setup_rating).filter(Boolean);
    if (setupRatings.length > 0) {
        const avg = setupRatings.reduce((a, b) => a + b, 0) / setupRatings.length;
        components.push({ value: avg / 5 * 100, weight: 12.5 });
    }

    const mgmtRatings = trades.map(t => t.management_rating).filter(Boolean);
    if (mgmtRatings.length > 0) {
        const avg = mgmtRatings.reduce((a, b) => a + b, 0) / mgmtRatings.length;
        components.push({ value: avg / 5 * 100, weight: 12.5 });
    }

    if (components.length === 0) return null;

    const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
    return components.reduce((sum, c) => sum + c.value * (c.weight / totalWeight), 0);
}

function renderWinrateGauge(containerEl, winRate, winsCount = 0, lossesCount = 0) {
    if (!containerEl) return;
    const pct = Math.max(0, Math.min(100, winRate || 0));
    const r = 50, cx = 60, cy = 58;
    const circumference = Math.PI * r;
    const offset = circumference - (pct / 100) * circumference;
    const gradId = `winrateGrad-${containerEl.id}`;

    containerEl.innerHTML = `
        <div class="dash-gauge-inner">
            <svg viewBox="0 0 120 72" style="width:100%;overflow:visible;">
                <defs>
                    <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stop-color="#ff4444"/>
                        <stop offset="50%" stop-color="#e08a2e"/>
                        <stop offset="100%" stop-color="#00c864"/>
                    </linearGradient>
                </defs>
                <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="#1a1a1a" stroke-width="9" stroke-linecap="round"/>
                <path class="gauge-arc" d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="url(#${gradId})" stroke-width="9" stroke-linecap="round"
                    stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}"/>
                <text x="${cx - r}" y="${cy + 16}" text-anchor="middle" font-size="9" fill="#ff4444" font-family="JetBrains Mono, monospace" font-weight="600">${lossesCount}L</text>
                <text x="${cx + r}" y="${cy + 16}" text-anchor="middle" font-size="9" fill="#00c864" font-family="JetBrains Mono, monospace" font-weight="600">${winsCount}W</text>
            </svg>
            <div class="dash-gauge-value">${pct.toFixed(0)}%</div>
        </div>
    `;

    // Animate arc filling from empty to target value
    const arc = containerEl.querySelector('.gauge-arc');
    requestAnimationFrame(() => {
        arc.style.transition = 'stroke-dashoffset 1s ease-out';
        arc.style.strokeDashoffset = offset;
    });
}

function renderAiScoreBar(barEl, valueEl, score) {
    if (!barEl || !valueEl) return;
    const marker = barEl.querySelector('.dash-aiscore-marker');
    if (marker) marker.remove();

    if (score === null) {
        valueEl.textContent = '—';
        return;
    }

    valueEl.textContent = score.toFixed(1);
    const target = Math.max(0, Math.min(100, score));
    const newMarker = document.createElement('div');
    newMarker.className = 'dash-aiscore-marker';
    newMarker.style.left = '0%';
    barEl.appendChild(newMarker);

    // Slide the marker in from 0 to its target score
    requestAnimationFrame(() => {
        newMarker.style.transition = 'left 1s ease-out';
        newMarker.style.left = `${target}%`;
    });
}

function renderLatestTradesPreview(trades) {
    const container = document.getElementById('dashLatestTrades');
    const empty = document.getElementById('dashLatestEmpty');
    if (!container || !empty) return;

    if (trades.length === 0) {
        empty.style.display = 'flex';
        container.innerHTML = '';
        return;
    }
    empty.style.display = 'none';

    container.innerHTML = trades.slice(0, 5).map(trade => {
        const d = new Date(trade.date + 'T12:00:00');
        const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const dirLabel = trade.direction === 'long' ? 'Long' : 'Short';
        const dirClass = trade.direction === 'long' ? 'long' : 'short';
        const pnlStr = (trade.pnl >= 0 ? '+$' : '-$') + Math.abs(trade.pnl).toFixed(2);
        return `
        <div class="dash-trade-card">
            <div class="dash-trade-card-main">
                <div style="display:flex;align-items:center;gap:10px;">
                    <span class="dash-trade-card-symbol">${esc(trade.symbol)}</span>
                    <span class="dash-trade-card-dir ${dirClass}">${dirLabel}</span>
                    <span class="dash-trade-card-date">${dateLabel}</span>
                </div>
                <span class="dash-trade-card-pnl ${trade.pnl >= 0 ? 'positive' : 'negative'}">${pnlStr}</span>
            </div>
        </div>`;
    }).join('');
}

// Builds the day grid for a month calendar; dayCellRenderer(dateStr, day) returns { className, label }
function buildMonthGrid(gridEl, monthDate, dayCellRenderer) {
    if (!gridEl) return;
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const lastDay = new Date(year, month + 1, 0);
    const today = new Date().toLocaleDateString('en-CA');

    gridEl.innerHTML = '';

    let startOffset = new Date(year, month, 1).getDay() - 1;
    if (startOffset < 0) startOffset = 6;

    for (let i = 0; i < startOffset; i++) {
        const empty = document.createElement('div');
        empty.className = 'cal-day empty';
        gridEl.appendChild(empty);
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = dateStr === today;
        const { className, label, extraHtml } = dayCellRenderer(dateStr, day);

        const cell = document.createElement('div');
        cell.className = `cal-day ${className}${isToday ? ' today' : ''}`;
        cell.innerHTML = extraHtml
            ? `<span class="cal-day-num">${day}</span>${extraHtml}`
            : `${day}${label ? `<span class="cal-day-label">${label}</span>` : ''}`;
        gridEl.appendChild(cell);
    }
}

let dashCalendarDate = new Date();
let dashTradesCache = [];

function renderDashboardCalendar(trades) {
    const grid = document.getElementById('dashCalendarGrid');
    const monthEl = document.getElementById('dashCalMonth');
    if (!grid || !monthEl) return;

    const statsByDate = {};
    trades.forEach(t => {
        if (!statsByDate[t.date]) statsByDate[t.date] = { pnl: 0, count: 0 };
        statsByDate[t.date].pnl += t.pnl;
        statsByDate[t.date].count++;
    });

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    monthEl.textContent = `${monthNames[dashCalendarDate.getMonth()]} ${dashCalendarDate.getFullYear()}`;

    buildMonthGrid(grid, dashCalendarDate, (dateStr) => {
        const day = statsByDate[dateStr];
        if (!day) return { className: 'no-trade', label: '', extraHtml: null };
        const abs = Math.abs(day.pnl);
        const pnlStr = abs >= 1000
            ? (day.pnl >= 0 ? '+' : '-') + '$' + (abs / 1000).toFixed(1) + 'k'
            : (day.pnl >= 0 ? '+' : '-') + '$' + Math.round(abs);
        const tradeWord = day.count === 1 ? 'trade' : 'trades';
        const extraHtml = `
            <span class="cal-day-pnl">${pnlStr}</span>
            <span class="cal-day-trades">${day.count} ${tradeWord}</span>`;
        return { className: day.pnl >= 0 ? 'win' : 'loss', label: '', extraHtml };
    });
}

document.getElementById('dashCalPrev')?.addEventListener('click', () => {
    dashCalendarDate.setMonth(dashCalendarDate.getMonth() - 1);
    renderDashboardCalendar(dashTradesCache);
});

document.getElementById('dashCalNext')?.addEventListener('click', () => {
    const now = new Date();
    if (dashCalendarDate.getFullYear() > now.getFullYear() ||
        (dashCalendarDate.getFullYear() === now.getFullYear() && dashCalendarDate.getMonth() >= now.getMonth())) {
        return;
    }
    dashCalendarDate.setMonth(dashCalendarDate.getMonth() + 1);
    renderDashboardCalendar(dashTradesCache);
});

// Fetch and display recent trades + drive all dashboard-overview widgets
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
    const pnlEl = document.getElementById('dashPnlValue');
    if (pnlEl) {
        pnlEl.textContent = (totalPnl >= 0 ? '+$' : '-$') + Math.abs(totalPnl).toFixed(2);
        pnlEl.className = 'dash-stat-value ' + (totalPnl >= 0 ? 'positive' : 'negative');
    }

    // Update balance
    const { data: settingsData } = await supabaseClient
        .from('user_settings')
        .select('balance')
        .eq('user_id', session.user.id)
        .single();
    const startBalance = parseFloat(settingsData?.balance) || 50000;
    const currentBalance = startBalance + totalPnl;
    const balanceEl = document.getElementById('dashBalanceValue');
    if (balanceEl) {
        balanceEl.textContent = '$' + currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    renderLatestTradesPreview(trades);

    dashTradesCache = trades;
    renderDashboardCalendar(trades);

    const tradesByDateAsc = [...trades].sort((a, b) => a.date.localeCompare(b.date));
    const equityPoints = buildEquityPoints(tradesByDateAsc, startBalance);
    renderEquityCurve(document.getElementById('dashPnlChart'), equityPoints, startBalance);

    const stats = computeTradeStats(trades);
    renderWinrateGauge(document.getElementById('dashWinrateGauge'), stats.winRate, stats.wins.length, stats.losses.length);

    const pfEl = document.getElementById('dashProfitFactorValue');
    if (pfEl) {
        if (stats.grossWin === 0 && stats.grossLoss === 0) {
            pfEl.textContent = '—';
            pfEl.className = 'dash-profitfactor-value';
        } else {
            pfEl.textContent = stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2);
            pfEl.className = 'dash-profitfactor-value ' + (stats.profitFactor >= 1 ? 'positive' : 'negative');
        }
    }

    const aiScore = computeAIScore(trades, stats, equityPoints);
    renderAiScoreBar(document.getElementById('dashAiScoreBar'), document.getElementById('dashAiScoreValue'), aiScore);

    renderChecklistStats(trades);

    animateDashboardEntrance();
}

// Rule-compliance stats strip on the Checklist page. There's no per-rule history
// saved anywhere (checkedRules is in-memory only) — this uses the aggregate
// followed_rules boolean already stored per trade instead.
function renderChecklistStats(trades) {
    const el7 = document.getElementById('checklistCompliance7d');
    const el30 = document.getElementById('checklistCompliance30d');
    const elAll = document.getElementById('checklistComplianceAll');
    if (!el7 || !el30 || !elAll) return;

    const now = new Date();
    const cutoff7 = new Date(now); cutoff7.setDate(now.getDate() - 7);
    const cutoff30 = new Date(now); cutoff30.setDate(now.getDate() - 30);

    const trades7 = trades.filter(t => new Date(t.date + 'T12:00:00') >= cutoff7);
    const trades30 = trades.filter(t => new Date(t.date + 'T12:00:00') >= cutoff30);

    const computeCompliance = (list) => {
        if (list.length === 0) return null;
        return Math.round((list.filter(t => t.followed_rules).length / list.length) * 100);
    };

    // Windows with a small sample often show an identical % to a wider window
    // just because they contain the exact same trades — the trade-count caption
    // makes that obvious instead of it looking like duplicated/broken data.
    const setStat = (el, subEl, list) => {
        const pct = computeCompliance(list);
        if (pct === null) {
            el.textContent = '—';
            el.className = 'checklist-stat-value';
            if (subEl) subEl.textContent = 'No trades yet';
        } else {
            el.textContent = pct + '%';
            el.className = 'checklist-stat-value ' + (pct >= 70 ? 'positive' : pct < 50 ? 'negative' : '');
            if (subEl) subEl.textContent = `${list.length} trade${list.length === 1 ? '' : 's'}`;
        }
    };

    setStat(el7, document.getElementById('checklistCompliance7dSub'), trades7);
    setStat(el30, document.getElementById('checklistCompliance30dSub'), trades30);
    setStat(elAll, document.getElementById('checklistComplianceAllSub'), trades);
}

// Scroll-driven fade/slide-up reveal for the dashboard cards: cards above the fold
// stagger in immediately, cards below the fold reveal as they scroll into view.
let dashboardRevealObserver = null;
let dashboardEntranceTimer = null;

function animateDashboardEntrance() {
    clearTimeout(dashboardEntranceTimer);
    dashboardEntranceTimer = setTimeout(() => {
        const cards = document.querySelectorAll('#page-dashboard .dash-card');
        cards.forEach(card => card.classList.remove('visible'));

        if (dashboardRevealObserver) dashboardRevealObserver.disconnect();

        requestAnimationFrame(() => {
            dashboardRevealObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    entry.target.classList.add('visible');
                    dashboardRevealObserver.unobserve(entry.target);
                });
            }, { root: document.querySelector('.main-content'), threshold: 0.15 });

            cards.forEach((card, i) => {
                setTimeout(() => dashboardRevealObserver.observe(card), i * 40);
            });
        });
    }, 50);
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

        // Step 1
        document.getElementById('tradeDate').value = trade.date;
        document.getElementById('tradeNumber').value = trade.trade_number;
        document.getElementById('tradeSymbol').value = trade.symbol;
        const inst = INSTRUMENTS.find(i => i.ticker === trade.symbol);
        if (inst) {
            document.getElementById('symbolName').innerHTML = `
                <span style="font-weight:700;font-family:'JetBrains Mono',monospace;">${inst.ticker}</span>
                <span style="color:#888888;font-size:12px;"> — ${inst.name}</span>
                <span style="background:${inst.color};color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:50px;margin-left:8px;">${inst.category}</span>
            `;
            document.getElementById('symbolName').style.color = '#ffffff';
        }
        document.getElementById('tradeSize').value = trade.size;

        direction = trade.direction;
        if (direction === 'long') {
            btnLong.classList.add('active');
            btnShort.classList.remove('active');
        } else {
            btnShort.classList.add('active');
            btnLong.classList.remove('active');
        }

        // Step 2
        document.getElementById('tradeEntry').value = trade.entry_price;
        document.getElementById('tradeExit').value = trade.exit_price;
        document.getElementById('tradeStopLoss').value = trade.stop_loss || '';
        document.getElementById('tradeTarget').value = trade.target || '';
        document.getElementById('pnlDisplay').value = trade.pnl || '';
        document.getElementById('pnlDisplay').className = 'pnl-input ' + (trade.pnl >= 0 ? 'positive' : 'negative');

        // Step 3
        selectedEmotions = trade.emotions ? trade.emotions.split(', ').filter(Boolean) : [];
        renderEmotionTags();
        renderSuggestions();

        if (trade.mental_state) {
            document.querySelectorAll('.mental-option').forEach(opt => {
                opt.classList.toggle('active', opt.dataset.value === trade.mental_state);
            });
            document.getElementById('tradeMentalState').value = trade.mental_state;
        }

        followedRules = trade.followed_rules;
        if (followedRules) {
            btnYes.classList.add('active');
            btnNo.classList.remove('active');
        } else {
            btnNo.classList.add('active');
            btnYes.classList.remove('active');
        }

        // Step 4
        if (trade.setup_type) document.getElementById('tradeSetupType').value = trade.setup_type;
        if (trade.session) document.getElementById('tradeSession').value = trade.session;
        if (trade.setup_rating) {
            document.getElementById('tradeSetupRating').value = trade.setup_rating;
            document.querySelectorAll('#setupRating .star').forEach(s => {
                s.classList.toggle('active', parseInt(s.dataset.value) <= trade.setup_rating);
            });
        }
        if (trade.management_rating) {
            document.getElementById('tradeManagementRating').value = trade.management_rating;
            document.querySelectorAll('#managementRating .star').forEach(s => {
                s.classList.toggle('active', parseInt(s.dataset.value) <= trade.management_rating);
            });
        }
        if (trade.take_again !== null) {
            document.getElementById('tradeTakeAgain').value = trade.take_again;
            if (trade.take_again) {
                document.getElementById('btnTakeAgainYes').classList.add('active');
                document.getElementById('btnTakeAgainNo').classList.remove('active');
            } else {
                document.getElementById('btnTakeAgainNo').classList.add('active');
                document.getElementById('btnTakeAgainYes').classList.remove('active');
            }
        }

        // Step 5
        document.getElementById('tradeNotes').value = trade.notes || '';

        document.getElementById('modalStepTitle').textContent = 'Edit Trade';
        document.getElementById('btnSave').textContent = 'Update Trade';
        openModal();
        goToModalStep(1);
        loadTradeConfluences();
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
            if (!error) {
                loadRecentTrades();
                loadStreak();
            }
        };

        confirmCancel.onclick = () => {
            confirmOverlay.classList.remove('active');
        };
    }
});

async function loadStreak() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const today = new Date();
    const cutoff = new Date(today);
    cutoff.setDate(today.getDate() - 365);

    const { data: trades } = await supabaseClient
        .from('trades')
        .select('date, followed_rules')
        .eq('user_id', session.user.id)
        .gte('date', cutoff.toLocaleDateString('en-CA'))
        .order('date', { ascending: true });

    // Get last 5 weekdays starting from Monday
    const days = [];
    let d = new Date(today);

    // Find the most recent Monday
    while (d.getDay() !== 1) {
        d.setDate(d.getDate() - 1);
    }

    // Get Mon-Fri of current week
    for (let i = 0; i < 5; i++) {
        days.push(new Date(d));
        d.setDate(d.getDate() + 1);
    }

    // Group trades by date
    const tradesByDay = {};
    (trades || []).forEach(t => {
        if (!tradesByDay[t.date]) tradesByDay[t.date] = { traded: true, compliant: true };
        if (!t.followed_rules) tradesByDay[t.date].compliant = false;
    });

    // Render circles
    const streakDaysEl = document.getElementById('streakDays');
    streakDaysEl.innerHTML = '';

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    days.forEach(day => {
        const dateStr = day.toLocaleDateString('en-CA');
        const dayData = tradesByDay[dateStr];
        const isToday = dateStr === today.toLocaleDateString('en-CA');

        let cls = 'day-circle';
        if (dayData && dayData.compliant) cls += ' active';
        else if (dayData && !dayData.compliant) cls += ' broken';
        if (isToday) cls += ' today';

        const dot = document.createElement('div');
        dot.className = 'streak-dot';
        dot.innerHTML = `<div class="${cls}">${day.getDate()}</div><span class="day-label">${dayNames[day.getDay()]}</span>`;
        streakDaysEl.appendChild(dot);
    });

    // Count consecutive compliant trading days (skip non-trading days)
    let streakCount = 0;
    const sortedTradeDates = Object.keys(tradesByDay).sort().reverse();
    for (const date of sortedTradeDates) {
        if (tradesByDay[date].compliant) {
            streakCount++;
        } else {
            break;
        }
    }

    const streakCountEl = document.getElementById('streakCount');
    if (streakCountEl) streakCountEl.textContent = streakCount;
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

function renderDashboardChecklistPreview() {
    const list = document.getElementById('dashChecklistList');
    const fill = document.getElementById('dashChecklistProgressFill');
    const count = document.getElementById('dashChecklistCount');
    if (!list || !fill || !count) return;

    const checked = rules.filter(r => checkedRules.has(r.id)).length;
    const total = rules.length;
    count.textContent = `${checked}/${total}`;
    fill.style.width = total > 0 ? `${(checked / total) * 100}%` : '0%';

    if (total === 0) {
        list.innerHTML = `<div class="dash-checklist-empty">No rules yet.</div>`;
        return;
    }

    list.innerHTML = rules.slice(0, 3).map(rule => `
        <div class="dash-checklist-item ${checkedRules.has(rule.id) ? 'checked' : ''}" data-id="${rule.id}">
            <span class="dash-checklist-check">${checkedRules.has(rule.id) ? '✓' : ''}</span>
            <span class="dash-checklist-text">${esc(rule.rule)}</span>
        </div>
    `).join('');

    list.querySelectorAll('.dash-checklist-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = item.dataset.id;
            if (checkedRules.has(id)) checkedRules.delete(id);
            else checkedRules.add(id);
            renderRules();
        });
    });
}

function renderRules() {
    renderDashboardChecklistPreview();
    const rulesList = document.getElementById('rulesList');
    const checkedCount = document.getElementById('checkedCount');
    const totalCount = document.getElementById('totalCount');
    const progressFill = document.getElementById('progressFill');

    const filteredRules = activeSetId === 'all'
        ? rules
        : rules.filter(r => r.set_id === activeSetId);

    const checked = filteredRules.filter(r => checkedRules.has(r.id)).length;
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
            <span class="rule-text">${esc(rule.rule)}</span>
            <div class="rule-actions">
                <button class="rule-edit-btn" data-rule-id="${rule.id}" data-rule-text="${esc(rule.rule)}" data-rule-set="${rule.set_id || ''}">
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
    renderJournal();
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

    entriesEl.innerHTML = pageTrades.map(trade => {

        // Stars helper
        const renderStars = (rating) => {
            if (!rating) return '<span style="color:#333;font-size:11px;">Not rated</span>';
            return Array.from({length: 5}, (_, i) => 
                `<span style="color:${i < rating ? '#ff9900' : '#2a2a2a'};font-size:13px;">★</span>`
            ).join('');
        };

        // Screenshots
        const screenshots = trade.screenshots && trade.screenshots.length > 0
            ? `<div class="entry-screenshots">
                ${trade.screenshots.map(path => 
                    `<img data-screenshot-path="${path}" class="entry-screenshot-thumb" src="" />`
                ).join('')}
            </div>`
            : '';

        // Confluences
        const confluences = trade.confluences && trade.confluences.length > 0
            ? `<div class="entry-confluences">
                ${trade.confluences.map(c => `<span class="entry-confluence-tag">${esc(c)}</span>`).join('')}
               </div>`
            : '';

        return `
        <div class="journal-entry ${trade.pnl > 0 ? 'win' : trade.pnl < 0 ? 'loss' : ''}">
            
            <!-- LEFT - Trade Data -->
            <div class="entry-data">
                <div class="entry-top">
                    <div class="entry-header-row">
                        <span class="entry-symbol">${esc(trade.symbol)}</span>
                        <span class="entry-pnl ${trade.pnl >= 0 ? 'positive' : 'negative'}">
                            ${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}
                        </span>
                    </div>
                    <div class="entry-meta">
                        <span class="entry-direction ${trade.direction}">
                            ${trade.direction === 'long' ? '↑ Long' : '↓ Short'}
                        </span>
                        <span class="entry-size">${trade.size} contract${trade.size > 1 ? 's' : ''}</span>
                        ${trade.session ? `<span class="entry-session">${esc(trade.session)}</span>` : ''}
                    </div>
                    <div class="entry-prices">
                        <span>In: ${trade.entry_price}</span>
                        <span>Out: ${trade.exit_price}</span>
                        ${trade.stop_loss ? `<span>SL: ${trade.stop_loss}</span>` : ''}
                        ${trade.target ? `<span>TP: ${trade.target}</span>` : ''}
                    </div>
                </div>
                <div class="entry-bottom">
                    <span class="entry-date">${trade.date}</span>
                    <span class="entry-trade-num">Trade #${trade.trade_number}</span>
                    ${trade.setup_type ? `<span class="entry-setup-tag">${esc(trade.setup_type)}</span>` : ''}
                    <span class="entry-rules-badge ${trade.followed_rules ? 'followed' : 'broke'}">
                        ${trade.followed_rules ? '✓ Rules followed' : '✗ Broke rules'}
                    </span>
                    ${trade.mental_state ? `<span class="entry-mental-state">${esc(trade.mental_state)}</span>` : ''}
                </div>
                <div class="entry-ratings">
                    ${trade.setup_rating ? `
                        <div class="entry-rating-row">
                            <span class="entry-rating-label">Setup</span>
                            <span>${renderStars(trade.setup_rating)}</span>
                        </div>` : ''}
                    ${trade.management_rating ? `
                        <div class="entry-rating-row">
                            <span class="entry-rating-label">Mgmt</span>
                            <span>${renderStars(trade.management_rating)}</span>
                        </div>` : ''}
                    ${trade.take_again !== null && trade.take_again !== undefined ? `
                        <div class="entry-rating-row">
                            <span class="entry-rating-label">Again?</span>
                            <span style="font-size:12px;color:${trade.take_again ? '#00c864' : '#ff4444'};">
                                ${trade.take_again ? '✓ Yes' : '✗ No'}
                            </span>
                        </div>` : ''}
                </div>
            </div>

            <!-- RIGHT - Journal Notes -->
            <div class="entry-journal">
                <div class="entry-emotions">
                    ${trade.emotions 
                        ? trade.emotions.split(', ').filter(Boolean).map(e => `<span class="entry-emotion-tag">${esc(e)}</span>`).join('')
                        : ''
                    }
                </div>
                ${confluences}
                <textarea 
                    class="entry-notes-editable" 
                    data-trade-id="${trade.id}"
                    placeholder="Click to add notes..."
                >${esc(trade.notes || '')}</textarea>
                ${screenshots}
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
        `;
    }).join('');

    // Load signed URLs for screenshots
    entriesEl.querySelectorAll('[data-screenshot-path]').forEach(async (img) => {
        const path = img.dataset.screenshotPath;
        const { data } = await supabaseClient.storage
            .from('trade-screenshots')
            .createSignedUrl(path, 3600);
        if (data) {
            img.src = data.signedUrl;
            img.onclick = () => openImageLightbox(data.signedUrl);
        }
    });

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

    // Auto-save notes
    document.querySelectorAll('.entry-notes-editable').forEach(textarea => {
        let saveTimeout;
        textarea.addEventListener('input', () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(async () => {
                await supabaseClient.from('trades').update({ notes: textarea.value }).eq('id', textarea.dataset.tradeId);
            }, 1000);
        });
        textarea.addEventListener('blur', async () => {
            clearTimeout(saveTimeout);
            await supabaseClient.from('trades').update({ notes: textarea.value }).eq('id', textarea.dataset.tradeId);
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

    // Current streak (consecutive compliant trading days, skip non-trading days)
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
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    document.getElementById('calMonth').textContent = `${monthNames[calendarDate.getMonth()]} ${calendarDate.getFullYear()}`;

    buildMonthGrid(document.getElementById('calendarGrid'), calendarDate, (dateStr) => {
        const dayData = tradesByDate[dateStr];
        if (!dayData) return { className: 'no-trade', label: '' };
        return {
            className: dayData.pnl >= 0 && dayData.followed_rules ? 'win' : 'loss',
            label: dayData.followed_rules ? '✓' : '✗'
        };
    });
}
// Calendar navigation
document.getElementById('calPrev').addEventListener('click', () => {
    calendarDate.setMonth(calendarDate.getMonth() - 1);
    loadStreakPage();
});

document.getElementById('calNext').addEventListener('click', () => {
    const now = new Date();
    if (calendarDate.getFullYear() > now.getFullYear() ||
        (calendarDate.getFullYear() === now.getFullYear() && calendarDate.getMonth() >= now.getMonth())) {
        return;
    }
    calendarDate.setMonth(calendarDate.getMonth() + 1);
    loadStreakPage();
});

// ============================================
// SETTINGS
// ============================================
async function loadSettings() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const { data } = await supabaseClient
        .from('user_settings')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

    if (data) {
        document.getElementById('settingName').value = data.name || '';
        document.getElementById('settingBalance').value = data.balance || '';
        document.getElementById('settingInstrument').value = data.instrument || '';
        document.getElementById('settingFirm').value = data.firm || '';
        document.getElementById('settingTimezone').value = data.timezone || '';
        document.getElementById('settingSessionStart').value = data.session_start || '';
        document.getElementById('settingSessionEnd').value = data.session_end || '';

        // Update sidebar
        if (data.name) {
            document.querySelector('.user-name').textContent = data.name;
            document.querySelector('.user-avatar').textContent = data.name.charAt(0).toUpperCase();
        }

        // Update balance
        if (data.balance) {
            const balanceEl = document.getElementById('dashBalanceValue');
            if (balanceEl) balanceEl.textContent = '$' + Number(data.balance).toLocaleString();
        }
    }

    const floatBtn = document.getElementById('settingsFloatSave');
    if (floatBtn) floatBtn.classList.add('visible');

    // Set wizard button state based on onboarding completion
    const wizardBtn = document.getElementById('restartOnboardingBtn');
    if (localStorage.getItem('noxis_onboarding_complete') === 'true') {
        wizardBtn.classList.add('completed');
}
}

async function saveSettingsAction(btn) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const settings = {
        user_id: session.user.id,
        name: document.getElementById('settingName').value,
        balance: document.getElementById('settingBalance').value || null,
        instrument: document.getElementById('settingInstrument').value,
        firm: document.getElementById('settingFirm').value,
        timezone: document.getElementById('settingTimezone').value,
        session_start: document.getElementById('settingSessionStart').value,
        session_end: document.getElementById('settingSessionEnd').value,
        updated_at: new Date().toISOString()
    };

    const { error } = await supabaseClient
        .from('user_settings')
        .upsert(settings, { onConflict: 'user_id' });

    if (error) {
        showToast('Error saving settings.', 'error');
        return;
    }

    // Update sidebar
    if (settings.name) {
        document.querySelector('.user-name').textContent = settings.name;
        document.querySelector('.user-avatar').textContent = settings.name.charAt(0).toUpperCase();
    }

    // Update balance
    if (settings.balance) {
        const balanceEl = document.getElementById('dashBalanceValue');
        if (balanceEl) balanceEl.textContent = '$' + Number(settings.balance).toLocaleString();
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

        const aiLock = document.getElementById('aiLockOverlay');
        const btnGenerate = document.getElementById('btnGenerateAI');
        const aiLockText = document.getElementById('aiLockText');
        const aiItems = document.querySelectorAll('.ai-insight-item');

        if (userPlan === 'free') {
            aiLock.style.display = 'flex';
            aiLockText.textContent = 'Upgrade to Pro to unlock AI insights';
            btnGenerate.style.display = 'none';
        } else {
            aiLock.style.display = 'flex';
            aiLockText.textContent = 'Log at least 5 trades to generate AI insights';
            btnGenerate.style.display = 'none';
        }
        aiItems.forEach(item => item.classList.add('blurred'));
        return;
    }

    // STATS
    const stats = computeTradeStats(trades);
    const { totalPnl, winRate, wins, losses, grossWin, grossLoss } = stats;
    const profitFactor = stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2);
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
    const { data: settingsData } = await supabaseClient
        .from('user_settings')
        .select('balance')
        .eq('user_id', session.user.id)
        .single();
    const startBalance = parseFloat(settingsData?.balance) || 50000;

    const points = buildEquityPoints(trades, startBalance);
    renderEquityCurve(equityChart, points, startBalance);
    equityChart.style.position = 'relative';

    // RULES FOLLOWED VS BROKEN
    const rulesChart = document.getElementById('rulesChart');
    const followed = trades.filter(t => t.followed_rules);
    const broken = trades.filter(t => !t.followed_rules);
    const followedWinRate = followed.length > 0 ? (followed.filter(t => t.pnl > 0).length / followed.length * 100).toFixed(1) : 0;
    const brokenWinRate = broken.length > 0 ? (broken.filter(t => t.pnl > 0).length / broken.length * 100).toFixed(1) : 0;
    const followedAvg = followed.length > 0 ? (followed.reduce((s,t) => s + t.pnl, 0) / followed.length).toFixed(2) : 0;
    const brokenAvg = broken.length > 0 ? (broken.reduce((s,t) => s + t.pnl, 0) / broken.length).toFixed(2) : 0;

    rulesChart.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:12px;width:100%;justify-content:center;">
            <div style="display:flex;align-items:center;gap:12px;">
                <span style="font-size:12px;color:#888;font-family:'JetBrains Mono',monospace;width:80px;">✓ Followed</span>
                <div style="flex:1;height:28px;background:#1a1a1a;border-radius:6px;overflow:hidden;">
                    <div style="width:${followedWinRate}%;height:100%;background:rgba(0,200,100,0.4);border-radius:6px;display:flex;align-items:center;padding-left:8px;">
                        <span style="font-size:11px;color:#00c864;font-weight:700;">${followedWinRate}% WR</span>
                    </div>
                </div>
                <span style="font-size:11px;color:${followedAvg >= 0 ? '#00c864' : '#ff4444'};font-family:'JetBrains Mono',monospace;width:60px;text-align:right;">${followedAvg >= 0 ? '+' : ''}$${followedAvg}</span>
            </div>
            <div style="display:flex;align-items:center;gap:12px;">
                <span style="font-size:12px;color:#888;font-family:'JetBrains Mono',monospace;width:80px;">✗ Broken</span>
                <div style="flex:1;height:28px;background:#1a1a1a;border-radius:6px;overflow:hidden;">
                    <div style="width:${brokenWinRate}%;height:100%;background:rgba(255,68,68,0.4);border-radius:6px;display:flex;align-items:center;padding-left:8px;">
                        <span style="font-size:11px;color:#ff4444;font-weight:700;">${brokenWinRate}% WR</span>
                    </div>
                </div>
                <span style="font-size:11px;color:${brokenAvg >= 0 ? '#00c864' : '#ff4444'};font-family:'JetBrains Mono',monospace;width:60px;text-align:right;">${brokenAvg >= 0 ? '+' : ''}$${brokenAvg}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid #1a1a1a;">
                <span style="font-size:11px;color:#444;">${followed.length} trades with rules</span>
                <span style="font-size:11px;color:#444;">${broken.length} trades without</span>
            </div>
        </div>
    `;
    rulesChart.style.alignItems = 'center';

    // PERFORMANCE BY SESSION
    const sessionChart = document.getElementById('sessionChart');
    const sessionStats = {};
    trades.forEach(t => {
        if (!t.session) return;
        if (!sessionStats[t.session]) sessionStats[t.session] = { wins: 0, total: 0, pnl: 0 };
        sessionStats[t.session].total++;
        sessionStats[t.session].pnl += t.pnl;
        if (t.pnl > 0) sessionStats[t.session].wins++;
    });

    if (Object.keys(sessionStats).length === 0) {
        sessionChart.innerHTML = '<p style="color:#444;font-size:13px;margin:auto;">No session data yet.</p>';
        sessionChart.style.alignItems = 'center';
    } else {
        const sessionList = document.createElement('div');
        sessionList.className = 'emotion-list';
        Object.entries(sessionStats)
            .sort((a, b) => b[1].pnl - a[1].pnl)
            .forEach(([session, stats]) => {
                const wr = (stats.wins / stats.total * 100).toFixed(0);
                const avgPnl = (stats.pnl / stats.total).toFixed(2);
                const color = stats.pnl >= 0 ? 'high' : 'low';
                const row = document.createElement('div');
                row.className = 'emotion-row';
                row.innerHTML = `
                    <span class="emotion-name">${session}</span>
                    <div class="emotion-bar-wrap">
                        <div class="emotion-bar-fill ${color}" style="width:${wr}%"></div>
                    </div>
                    <span class="emotion-pct">${wr}%</span>
                    <span style="font-size:10px;color:${avgPnl >= 0 ? '#00c864' : '#ff4444'};font-family:'JetBrains Mono',monospace;margin-left:8px;">${avgPnl >= 0 ? '+' : ''}$${avgPnl}</span>
                `;
                sessionList.appendChild(row);
            });
        sessionChart.innerHTML = '';
        sessionChart.appendChild(sessionList);
        sessionChart.style.alignItems = 'stretch';
        sessionChart.style.height = 'auto';
    }

    // PERFORMANCE BY MENTAL STATE
    const mentalStateChart = document.getElementById('mentalStateChart');
    const mentalStats = {};
    trades.forEach(t => {
        if (!t.mental_state) return;
        t.mental_state.split(', ').forEach(state => {
            if (!state) return;
            if (!mentalStats[state]) mentalStats[state] = { wins: 0, total: 0, pnl: 0 };
            mentalStats[state].total++;
            mentalStats[state].pnl += t.pnl;
            if (t.pnl > 0) mentalStats[state].wins++;
        });
    });

    if (Object.keys(mentalStats).length === 0) {
        mentalStateChart.innerHTML = '<p style="color:#444;font-size:13px;margin:auto;">No mental state data yet.</p>';
        mentalStateChart.style.alignItems = 'center';
    } else {
        const mentalList = document.createElement('div');
        mentalList.className = 'emotion-list';
        Object.entries(mentalStats)
            .sort((a, b) => b[1].pnl - a[1].pnl)
            .forEach(([state, stats]) => {
                const wr = (stats.wins / stats.total * 100).toFixed(0);
                const avgPnl = (stats.pnl / stats.total).toFixed(2);
                const color = stats.pnl >= 0 ? 'high' : 'low';
                const row = document.createElement('div');
                row.className = 'emotion-row';
                row.innerHTML = `
                    <span class="emotion-name">${state}</span>
                    <div class="emotion-bar-wrap">
                        <div class="emotion-bar-fill ${color}" style="width:${wr}%"></div>
                    </div>
                    <span class="emotion-pct">${wr}%</span>
                    <span style="font-size:10px;color:${avgPnl >= 0 ? '#00c864' : '#ff4444'};font-family:'JetBrains Mono',monospace;margin-left:8px;">${avgPnl >= 0 ? '+' : ''}$${avgPnl}</span>
                `;
                mentalList.appendChild(row);
            });
        mentalStateChart.innerHTML = '';
        mentalStateChart.appendChild(mentalList);
        mentalStateChart.style.alignItems = 'stretch';
        mentalStateChart.style.height = 'auto';
    }

    // PERFORMANCE BY SETUP TYPE
    const setupTypeChart = document.getElementById('setupTypeChart');
    const setupStats = {};
    trades.forEach(t => {
        if (!t.setup_type) return;
        if (!setupStats[t.setup_type]) setupStats[t.setup_type] = { wins: 0, total: 0, pnl: 0 };
        setupStats[t.setup_type].total++;
        setupStats[t.setup_type].pnl += t.pnl;
        if (t.pnl > 0) setupStats[t.setup_type].wins++;
    });

    if (Object.keys(setupStats).length === 0) {
        setupTypeChart.innerHTML = '<p style="color:#444;font-size:13px;margin:auto;">No setup data yet.</p>';
        setupTypeChart.style.alignItems = 'center';
    } else {
        const setupList = document.createElement('div');
        setupList.className = 'emotion-list';
        Object.entries(setupStats)
            .sort((a, b) => b[1].pnl - a[1].pnl)
            .forEach(([setup, stats]) => {
                const wr = (stats.wins / stats.total * 100).toFixed(0);
                const avgPnl = (stats.pnl / stats.total).toFixed(2);
                const color = stats.pnl >= 0 ? 'high' : 'low';
                const row = document.createElement('div');
                row.className = 'emotion-row';
                row.innerHTML = `
                    <span class="emotion-name">${setup}</span>
                    <div class="emotion-bar-wrap">
                        <div class="emotion-bar-fill ${color}" style="width:${wr}%"></div>
                    </div>
                    <span class="emotion-pct">${wr}%</span>
                    <span style="font-size:10px;color:${avgPnl >= 0 ? '#00c864' : '#ff4444'};font-family:'JetBrains Mono',monospace;margin-left:8px;">${avgPnl >= 0 ? '+' : ''}$${avgPnl}</span>
                `;
                setupList.appendChild(row);
            });
        setupTypeChart.innerHTML = '';
        setupTypeChart.appendChild(setupList);
        setupTypeChart.style.alignItems = 'stretch';
        setupTypeChart.style.height = 'auto';
    }

    // SETUP RATING VS OUTCOME
    const setupRatingChart = document.getElementById('setupRatingChart');
    const setupRatingStats = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    trades.forEach(t => {
        if (t.setup_rating) setupRatingStats[t.setup_rating].push(t.pnl);
    });

    const hasSetupRating = Object.values(setupRatingStats).some(arr => arr.length > 0);
    if (!hasSetupRating) {
        setupRatingChart.innerHTML = '<p style="color:#444;font-size:13px;margin:auto;">No rating data yet.</p>';
        setupRatingChart.style.alignItems = 'center';
    } else {
        setupRatingChart.innerHTML = '';
        setupRatingChart.style.alignItems = 'flex-end';
        setupRatingChart.style.padding = '8px 0';
        const maxAvg = Math.max(...Object.entries(setupRatingStats).map(([r, arr]) => arr.length > 0 ? Math.abs(arr.reduce((s,v)=>s+v,0)/arr.length) : 0), 1);
        [1,2,3,4,5].forEach(rating => {
            const arr = setupRatingStats[rating];
            const avg = arr.length > 0 ? arr.reduce((s,v)=>s+v,0)/arr.length : null;
            const heightPct = avg !== null ? (Math.abs(avg) / maxAvg) * 100 : 4;
            const color = avg > 0 ? 'rgba(0,200,100,0.6)' : avg < 0 ? 'rgba(255,68,68,0.6)' : '#2a2a2a';
            const group = document.createElement('div');
            group.className = 'day-bar-group';
            group.innerHTML = `
                <span class="day-bar-value" style="color:${avg > 0 ? '#00c864' : avg < 0 ? '#ff4444' : '#444'}">
                    ${avg !== null ? (avg >= 0 ? '+' : '') + '$' + avg.toFixed(0) : '—'}
                </span>
                <div class="day-bar" style="height:${Math.max(heightPct,4)}%;background:${color};width:100%;border-radius:4px 4px 0 0;"></div>
                <span class="day-bar-label">${'★'.repeat(rating)}</span>
            `;
            setupRatingChart.appendChild(group);
        });
    }

    // MANAGEMENT RATING VS OUTCOME
    const managementRatingChart = document.getElementById('managementRatingChart');
    const mgmtRatingStats = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    trades.forEach(t => {
        if (t.management_rating) mgmtRatingStats[t.management_rating].push(t.pnl);
    });

    const hasMgmtRating = Object.values(mgmtRatingStats).some(arr => arr.length > 0);
    if (!hasMgmtRating) {
        managementRatingChart.innerHTML = '<p style="color:#444;font-size:13px;margin:auto;">No rating data yet.</p>';
        managementRatingChart.style.alignItems = 'center';
    } else {
        managementRatingChart.innerHTML = '';
        managementRatingChart.style.alignItems = 'flex-end';
        managementRatingChart.style.padding = '8px 0';
        const maxAvgM = Math.max(...Object.entries(mgmtRatingStats).map(([r, arr]) => arr.length > 0 ? Math.abs(arr.reduce((s,v)=>s+v,0)/arr.length) : 0), 1);
        [1,2,3,4,5].forEach(rating => {
            const arr = mgmtRatingStats[rating];
            const avg = arr.length > 0 ? arr.reduce((s,v)=>s+v,0)/arr.length : null;
            const heightPct = avg !== null ? (Math.abs(avg) / maxAvgM) * 100 : 4;
            const color = avg > 0 ? 'rgba(0,200,100,0.6)' : avg < 0 ? 'rgba(255,68,68,0.6)' : '#2a2a2a';
            const group = document.createElement('div');
            group.className = 'day-bar-group';
            group.innerHTML = `
                <span class="day-bar-value" style="color:${avg > 0 ? '#00c864' : avg < 0 ? '#ff4444' : '#444'}">
                    ${avg !== null ? (avg >= 0 ? '+' : '') + '$' + avg.toFixed(0) : '—'}
                </span>
                <div class="day-bar" style="height:${Math.max(heightPct,4)}%;background:${color};width:100%;border-radius:4px 4px 0 0;"></div>
                <span class="day-bar-label">${'★'.repeat(rating)}</span>
            `;
            managementRatingChart.appendChild(group);
        });
    }

    // CONFLUENCE COUNT VS OUTCOME
    const confluenceChart = document.getElementById('confluenceChart');
    const confluenceStats = {};
    trades.forEach(t => {
        if (!t.confluences || !t.confluences.length) return;
        t.confluences.forEach(c => {
            if (!confluenceStats[c]) confluenceStats[c] = { wins: 0, total: 0, pnl: 0 };
            confluenceStats[c].total++;
            confluenceStats[c].pnl += t.pnl;
            if (t.pnl > 0) confluenceStats[c].wins++;
        });
    });

    if (Object.keys(confluenceStats).length === 0) {
        confluenceChart.innerHTML = '<p style="color:#444;font-size:13px;margin:auto;">No confluence data yet.</p>';
        confluenceChart.style.alignItems = 'center';
        confluenceChart.style.justifyContent = 'center';
    } else {
        const confList = document.createElement('div');
        confList.className = 'emotion-list';
        Object.entries(confluenceStats)
            .sort((a, b) => b[1].pnl - a[1].pnl)
            .slice(0, 8)
            .forEach(([confluence, stats]) => {
                const wr = (stats.wins / stats.total * 100).toFixed(0);
                const avgPnl = (stats.pnl / stats.total).toFixed(2);
                const color = stats.pnl >= 0 ? 'high' : 'low';
                const row = document.createElement('div');
                row.className = 'emotion-row';
                row.innerHTML = `
                    <span class="emotion-name" style="width:140px;">${confluence}</span>
                    <div class="emotion-bar-wrap">
                        <div class="emotion-bar-fill ${color}" style="width:${wr}%"></div>
                    </div>
                    <span class="emotion-pct">${wr}%</span>
                    <span style="font-size:10px;color:${avgPnl >= 0 ? '#00c864' : '#ff4444'};font-family:'JetBrains Mono',monospace;margin-left:8px;">${avgPnl >= 0 ? '+' : ''}$${avgPnl}</span>
                `;
                confList.appendChild(row);
            });
        confluenceChart.innerHTML = '';
        confluenceChart.appendChild(confList);
        confluenceChart.style.alignItems = 'stretch';
        confluenceChart.style.height = 'auto';
    }

    // Show/hide AI lock based on plan
    const aiLock = document.getElementById('aiLockOverlay');
    const btnGenerate = document.getElementById('btnGenerateAI');
    const aiLockText = document.getElementById('aiLockText');
    const aiItems = document.querySelectorAll('.ai-insight-item');

    if (userPlan === 'free') {
        aiLock.style.display = 'flex';
        aiLockText.textContent = 'Upgrade to Pro to unlock AI insights';
        btnGenerate.style.display = 'none';
        aiItems.forEach(item => item.classList.add('blurred'));
    } else {
        // Check for cached insights first
        const { data: cached, error: cacheError } = await supabaseClient
            .from('ai_insights')
            .select('insights, generated_at, last_auto_date')
            .eq('user_id', session.user.id)
            .single();

        if (cached) {
            aiLock.style.display = 'none';
            aiItems.forEach(item => item.classList.remove('blurred'));

            const today = new Date().toISOString().slice(0, 10);
            if (cached.last_auto_date !== today && trades && trades.length >= 5) {
                generateAIInsights();
            } else {
                displayAIInsights(cached.insights, cached.generated_at);
            }
        } else if (!cacheError || cacheError.code === 'PGRST116') {
            aiLock.style.display = 'flex';
            aiLockText.textContent = 'Generate your personalized AI analysis';
            btnGenerate.style.display = 'block';
            aiItems.forEach(item => item.classList.add('blurred'));
            btnGenerate.onclick = generateAIInsights;
        } else {
            aiLock.style.display = 'flex';
            aiLockText.textContent = 'Could not load insights. Please refresh.';
            btnGenerate.style.display = 'none';
            aiItems.forEach(item => item.classList.add('blurred'));
        }
    }

}

document.getElementById('btnAddRuleInline').addEventListener('click', () => {
    ruleModalOverlay.classList.add('active');
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

// Whats new modal
const WHATS_NEW_VERSION = 'v1.6';
const whatsNewSeen = localStorage.getItem('noxis_whats_new') === WHATS_NEW_VERSION;
const whatsNewDot = document.getElementById('whatsNewDot');
if (whatsNewSeen) whatsNewDot.classList.add('hidden');

document.getElementById('whatsNewBtn').addEventListener('click', () => {
    document.getElementById('whatsNewOverlay').classList.add('active');
    loadChangelog();
    localStorage.setItem('noxis_whats_new', WHATS_NEW_VERSION);
    whatsNewDot.classList.add('hidden');
});

document.getElementById('whatsNewModalClose').addEventListener('click', () => {
    document.getElementById('whatsNewOverlay').classList.remove('active');
});

document.getElementById('whatsNewOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('whatsNewOverlay')) {
        document.getElementById('whatsNewOverlay').classList.remove('active');
    }
});

function toggleChangelog(id) {
    const entry = document.getElementById(id);
    entry.classList.toggle('open');
}

async function loadChangelog() {
    const modalBody = document.querySelector('#whatsNewOverlay .modal-body');
    
    // Show skeleton while loading
    modalBody.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:12px;">
            <div class="changelog-skeleton"></div>
            <div class="changelog-skeleton"></div>
            <div class="changelog-skeleton"></div>
        </div>
    `;

    const { data, error } = await supabaseClient
        .from('changelog')
        .select('*')
        .order('date', { ascending: false });

    if (error || !data) {
        modalBody.innerHTML = '<p style="color:#444;text-align:center;padding:20px;">Failed to load changelog.</p>';
        return;
    }

    modalBody.innerHTML = '';

    data.forEach((entry, index) => {
        const isLatest = entry.is_latest;
        const isFirst = index === 0;
        const items = entry.description.split('\n').filter(l => l.trim());

        const el = document.createElement('div');
        el.className = `changelog-entry ${isFirst ? 'active' : 'collapsed'}`;
        el.id = `changelog-${entry.version.replace('.', '-')}`;

        el.innerHTML = `
            <div class="changelog-header" ${!isFirst ? `onclick="toggleChangelog('changelog-${entry.version.replace('.', '-')}')"` : ''}>
                <div class="changelog-version ${!isFirst ? 'old' : ''}">${entry.version}</div>
                <div class="changelog-date ${!isFirst ? 'old' : ''}">${new Date(entry.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
                <div class="changelog-release-tag ${entry.release_type}">${entry.release_type.replace('-', ' ')}</div>
                ${isLatest ? '<div class="changelog-tag">Latest</div>' : ''}
                ${!isFirst ? '<div class="changelog-toggle">▸</div>' : ''}
            </div>
            <ul class="changelog-list ${!isFirst ? 'old' : ''}">
                ${items.map(item => `<li>${item}</li>`).join('')}
            </ul>
        `;

        el.style.opacity = '0';
        el.style.transform = 'translateY(8px)';
        el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        
        modalBody.appendChild(el);

        setTimeout(() => {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        }, index * 100);
    });
}

document.getElementById('restartOnboardingBtn').addEventListener('click', async () => {
    const isCompleted = document.getElementById('restartOnboardingBtn').classList.contains('completed');
    
    if (isCompleted) {
        const confirmOverlay = document.getElementById('confirmOverlay');
        const confirmDelete = document.getElementById('confirmDelete');
        const confirmCancel = document.getElementById('confirmCancel');

        document.querySelector('.confirm-popup h3').textContent = 'Restart Setup Wizard?';
        document.querySelector('.confirm-popup p').textContent = 'Your current settings and strategy will be overwritten.';
        document.querySelector('.confirm-icon').textContent = '⚙️';
        confirmDelete.textContent = 'Restart';
        confirmOverlay.classList.add('active');

        confirmDelete.onclick = async () => {
            confirmOverlay.classList.remove('active');
            document.querySelector('.confirm-popup h3').textContent = 'Delete Trade?';
            document.querySelector('.confirm-popup p').textContent = "This action can't be undone.";
            document.querySelector('.confirm-icon').textContent = '🗑️';
            confirmDelete.textContent = 'Delete';

            localStorage.removeItem('noxis_onboarding_complete');
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (session) {
                await supabaseClient.from('user_plans')
                    .update({ onboarding_complete: false })
                    .eq('user_id', session.user.id);
            }
            document.getElementById('restartOnboardingBtn').classList.remove('completed');
            showOnboarding();
            goToStep(1);
        };

        confirmCancel.onclick = () => {
            confirmOverlay.classList.remove('active');
            document.querySelector('.confirm-popup h3').textContent = 'Delete Trade?';
            document.querySelector('.confirm-popup p').textContent = "This action can't be undone.";
            document.querySelector('.confirm-icon').textContent = '🗑️';
            confirmDelete.textContent = 'Delete';
        };
        return;
    }

    localStorage.removeItem('noxis_onboarding_complete');
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        await supabaseClient.from('user_plans')
            .update({ onboarding_complete: false })
            .eq('user_id', session.user.id);
    }
    showOnboarding();
    goToStep(1);
});

// Modal step navigation
let currentModalStep = 1;
const TOTAL_MODAL_STEPS = 5;

function goToModalStep(step) {
    document.querySelectorAll('.modal-step').forEach(s => s.classList.remove('active'));
    document.getElementById(`modalStep${step}`).classList.add('active');
    currentModalStep = step;

    // Progress bar
    document.getElementById('modalProgressFill').style.width = `${(step / TOTAL_MODAL_STEPS) * 100}%`;
    document.getElementById('modalStepIndicator').textContent = `Step ${step} of ${TOTAL_MODAL_STEPS}`;

    // Step dots
    document.querySelectorAll('.modal-step-dot').forEach(dot => {
        const dotStep = parseInt(dot.dataset.modalDot);
        dot.classList.remove('active', 'done');
        if (dotStep === step) dot.classList.add('active');
        else if (dotStep < step) dot.classList.add('done');
    });

    lucide.createIcons();
}

// Step 1 next
document.getElementById('modalNext1').addEventListener('click', () => {
    const date = document.getElementById('tradeDate').value;
    const symbol = document.getElementById('tradeSymbol').value;

    if (!date || !symbol) {
        showToast('Please fill in date and symbol.', 'error');
        return;
    }
    goToModalStep(2);
});

// Step 2
document.getElementById('modalBack2').addEventListener('click', () => goToModalStep(1));
document.getElementById('modalNext2').addEventListener('click', () => {
    const entry = document.getElementById('tradeEntry').value;
    const exit = document.getElementById('tradeExit').value;
    if (!entry || !exit) {
        showToast('Please enter entry and exit prices.', 'error');
        return;
    }
    goToModalStep(3);
});

// Step 3
document.getElementById('modalBack3').addEventListener('click', () => goToModalStep(2));
document.getElementById('modalNext3').addEventListener('click', () => goToModalStep(4));

// Step 4 — Load confluences from user strategy
document.getElementById('modalBack4').addEventListener('click', () => goToModalStep(3));
document.getElementById('modalNext4').addEventListener('click', () => goToModalStep(5));

// Step 5
document.getElementById('modalBack5').addEventListener('click', () => goToModalStep(4));

// Mental state
let selectedMentalStates = [];

document.querySelectorAll('.mental-option').forEach(opt => {
    opt.addEventListener('click', () => {
        opt.classList.toggle('active');
        const val = opt.dataset.value;
        if (opt.classList.contains('active')) {
            selectedMentalStates.push(val);
        } else {
            selectedMentalStates = selectedMentalStates.filter(s => s !== val);
        }
        document.getElementById('tradeMentalState').value = selectedMentalStates.join(', ');
    });
});

// Take again toggle
document.getElementById('btnTakeAgainYes').addEventListener('click', () => {
    document.getElementById('btnTakeAgainYes').classList.add('active');
    document.getElementById('btnTakeAgainNo').classList.remove('active');
    document.getElementById('tradeTakeAgain').value = 'true';
});

document.getElementById('btnTakeAgainNo').addEventListener('click', () => {
    document.getElementById('btnTakeAgainNo').classList.add('active');
    document.getElementById('btnTakeAgainYes').classList.remove('active');
    document.getElementById('tradeTakeAgain').value = 'false';
});

// Star ratings
document.querySelectorAll('.star-rating').forEach(ratingEl => {
    const stars = ratingEl.querySelectorAll('.star');
    const hiddenInput = ratingEl.id === 'setupRating'
        ? document.getElementById('tradeSetupRating')
        : document.getElementById('tradeManagementRating');

    stars.forEach(star => {
        star.addEventListener('click', () => {
            const val = parseInt(star.dataset.value);
            hiddenInput.value = val;
            stars.forEach(s => {
                s.classList.toggle('active', parseInt(s.dataset.value) <= val);
            });
        });

        star.addEventListener('mouseover', () => {
            const val = parseInt(star.dataset.value);
            stars.forEach(s => {
                s.style.color = parseInt(s.dataset.value) <= val ? '#ff9900' : '#2a2a2a';
            });
        });

        star.addEventListener('mouseleave', () => {
            const currentVal = parseInt(hiddenInput.value) || 0;
            stars.forEach(s => {
                s.style.color = '';
                s.classList.toggle('active', parseInt(s.dataset.value) <= currentVal);
            });
        });
    });
});

// Load user confluences on step 4
async function loadTradeConfluences() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const { data } = await supabaseClient
        .from('user_strategy')
        .select('confluences')
        .eq('user_id', session.user.id)
        .single();

    const container = document.getElementById('tradeConfluences');

    if (!data || !data.confluences || data.confluences.length === 0) {
        container.innerHTML = '<span style="font-size:12px;color:#444;">Complete setup wizard to see your confluences</span>';
        return;
    }

    container.innerHTML = '';
    data.confluences.forEach(c => {
        const tag = document.createElement('div');
        tag.className = 'trade-confluence-tag';
        tag.textContent = c;
        tag.addEventListener('click', () => tag.classList.toggle('active'));
        container.appendChild(tag);
    });
}

// Screenshot upload
let screenshotFiles = [];
const MAX_SCREENSHOTS = { free: 1, pro: 3, elite: 3 };

const screenshotArea = document.getElementById('screenshotUploadArea');
const screenshotInput = document.getElementById('screenshotInput');
const screenshotPreviews = document.getElementById('screenshotPreviews');
const screenshotPlaceholder = document.getElementById('screenshotPlaceholder');

screenshotArea.addEventListener('click', () => screenshotInput.click());

screenshotArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    screenshotArea.classList.add('dragover');
});

screenshotArea.addEventListener('dragleave', () => {
    screenshotArea.classList.remove('dragover');
});

screenshotArea.addEventListener('drop', (e) => {
    e.preventDefault();
    screenshotArea.classList.remove('dragover');
    handleScreenshotFiles(Array.from(e.dataTransfer.files));
});

screenshotInput.addEventListener('change', () => {
    handleScreenshotFiles(Array.from(screenshotInput.files));
    screenshotInput.value = '';
});

function handleScreenshotFiles(files) {
    const limit = MAX_SCREENSHOTS[userPlan] || 1;
    const remaining = limit - screenshotFiles.length;

    if (remaining <= 0) {
        showToast(`Max ${limit} screenshot${limit > 1 ? 's' : ''} allowed on your plan.`, 'warning');
        return;
    }

    const toAdd = files.slice(0, remaining);

    toAdd.forEach(file => {
        if (file.size > 5 * 1024 * 1024) {
            showToast(`${file.name} is too large. Max 5MB.`, 'error');
            return;
        }
        screenshotFiles.push(file);
        renderScreenshotPreviews();
    });
}

function renderScreenshotPreviews() {
    screenshotPreviews.innerHTML = '';
    const limit = MAX_SCREENSHOTS[userPlan] || 1;

    if (screenshotFiles.length === 0) {
        screenshotPlaceholder.style.display = 'flex';
        return;
    }

    screenshotPlaceholder.style.display = 'none';

    screenshotFiles.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const div = document.createElement('div');
            div.className = 'screenshot-preview';
            div.innerHTML = `
                <img src="${e.target.result}" alt="screenshot" />
                <button class="screenshot-remove" data-index="${index}">✕</button>
            `;
            div.querySelector('.screenshot-remove').addEventListener('click', (ev) => {
                ev.stopPropagation();
                screenshotFiles.splice(index, 1);
                renderScreenshotPreviews();
            });
            screenshotPreviews.appendChild(div);
        };
        reader.readAsDataURL(file);
    });

    const countEl = document.createElement('div');
    countEl.className = 'screenshot-count';
    countEl.textContent = `${screenshotFiles.length} / ${limit} screenshots`;
    screenshotPreviews.appendChild(countEl);
}

async function generateAIInsights() {
    if (isGeneratingAI) return;
    isGeneratingAI = true;

    let session;
    try {
        const result = await supabaseClient.auth.getSession();
        session = result.data.session;
    } catch (e) {
        isGeneratingAI = false; return;
    }
    if (!session) { isGeneratingAI = false; return; }

    if (userPlan === 'free') {
        showAIEmpty('Upgrade to Pro to unlock AI insights.');
        isGeneratingAI = false; return;
    }

    showAILoading();

    const today = new Date().toISOString().slice(0, 10);
    const MANUAL_LIMITS = { free: 0, pro: 0, elite: 2 };

    const { data: insightRecord } = await supabaseClient
        .from('ai_insights')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

    const alreadyGeneratedToday = insightRecord?.last_auto_date === today;
    const manualUsed = insightRecord?.last_manual_date === today
        ? insightRecord.manual_refreshes_today || 0
        : 0;

    if (alreadyGeneratedToday) {
        const limit = MANUAL_LIMITS[userPlan];
        if (limit === 0) {
            showAIEmpty('Manual refreshes are an Elite feature. Your insights auto-refresh daily on login.');
            isGeneratingAI = false; return;
        }
        if (manualUsed >= limit) {
            showAIEmpty(`You've used all ${limit} manual refresh${limit !== 1 ? 'es' : ''} for today. Come back tomorrow.`);
            isGeneratingAI = false; return;
        }
    }

    // Fetch all trades
    const { data: trades } = await supabaseClient
        .from('trades')
        .select('*')
        .eq('user_id', session.user.id)
        .order('date', { ascending: true });

    if (!trades || trades.length < 5) {
        showAIEmpty('Log at least 5 trades to generate AI insights.');
        isGeneratingAI = false; return;
    }

    // Fetch user strategy
    const { data: strategy } = await supabaseClient
        .from('user_strategy')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

    // PREPARE STATS
    const totalTrades = trades.length;
    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl < 0);
    const winRate = (wins.length / totalTrades * 100).toFixed(1);
    const totalPnl = trades.reduce((s, t) => s + t.pnl, 0).toFixed(2);
    const avgPnl = (trades.reduce((s, t) => s + t.pnl, 0) / totalTrades).toFixed(2);
    const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? (grossWin / grossLoss).toFixed(2) : '∞';

    // By session
    const sessionStats = {};
    trades.forEach(t => {
        if (!t.session) return;
        if (!sessionStats[t.session]) sessionStats[t.session] = { wins: 0, total: 0, pnl: 0 };
        sessionStats[t.session].total++;
        sessionStats[t.session].pnl += t.pnl;
        if (t.pnl > 0) sessionStats[t.session].wins++;
    });
    const sessionData = Object.entries(sessionStats).map(([s, d]) => ({
        session: s,
        winRate: (d.wins / d.total * 100).toFixed(1) + '%',
        avgPnl: (d.pnl / d.total).toFixed(2),
        trades: d.total
    }));

    // By mental state
    const mentalStats = {};
    trades.forEach(t => {
        if (!t.mental_state) return;
        t.mental_state.split(', ').forEach(state => {
            if (!state) return;
            if (!mentalStats[state]) mentalStats[state] = { wins: 0, total: 0, pnl: 0 };
            mentalStats[state].total++;
            mentalStats[state].pnl += t.pnl;
            if (t.pnl > 0) mentalStats[state].wins++;
        });
    });
    const mentalData = Object.entries(mentalStats).map(([s, d]) => ({
        state: s,
        winRate: (d.wins / d.total * 100).toFixed(1) + '%',
        avgPnl: (d.pnl / d.total).toFixed(2),
        trades: d.total
    }));

    // By setup type
    const setupStats = {};
    trades.forEach(t => {
        if (!t.setup_type) return;
        if (!setupStats[t.setup_type]) setupStats[t.setup_type] = { wins: 0, total: 0, pnl: 0 };
        setupStats[t.setup_type].total++;
        setupStats[t.setup_type].pnl += t.pnl;
        if (t.pnl > 0) setupStats[t.setup_type].wins++;
    });
    const setupData = Object.entries(setupStats).map(([s, d]) => ({
        setup: s,
        winRate: (d.wins / d.total * 100).toFixed(1) + '%',
        avgPnl: (d.pnl / d.total).toFixed(2),
        trades: d.total
    }));

    // By emotion
    const emotionStats = {};
    trades.forEach(t => {
        if (!t.emotions) return;
        t.emotions.split(', ').forEach(e => {
            if (!e) return;
            if (!emotionStats[e]) emotionStats[e] = { wins: 0, total: 0 };
            emotionStats[e].total++;
            if (t.pnl > 0) emotionStats[e].wins++;
        });
    });
    const emotionData = Object.entries(emotionStats).map(([e, d]) => ({
        emotion: e,
        winRate: (d.wins / d.total * 100).toFixed(1) + '%',
        trades: d.total
    }));

    // Rules
    const followedTrades = trades.filter(t => t.followed_rules === true);
    const brokenTrades = trades.filter(t => t.followed_rules === false);
    const rulesData = {
        followed: {
            trades: followedTrades.length,
            winRate: followedTrades.length > 0 ? (followedTrades.filter(t => t.pnl > 0).length / followedTrades.length * 100).toFixed(1) + '%' : 'N/A',
            avgPnl: followedTrades.length > 0 ? (followedTrades.reduce((s, t) => s + t.pnl, 0) / followedTrades.length).toFixed(2) : 'N/A'
        },
        broken: {
            trades: brokenTrades.length,
            winRate: brokenTrades.length > 0 ? (brokenTrades.filter(t => t.pnl > 0).length / brokenTrades.length * 100).toFixed(1) + '%' : 'N/A',
            avgPnl: brokenTrades.length > 0 ? (brokenTrades.reduce((s, t) => s + t.pnl, 0) / brokenTrades.length).toFixed(2) : 'N/A'
        }
    };

    // By confluence
    const confluenceStats = {};
    trades.forEach(t => {
        if (!t.confluences || !t.confluences.length) return;
        t.confluences.forEach(c => {
            if (!confluenceStats[c]) confluenceStats[c] = { wins: 0, total: 0, pnl: 0 };
            confluenceStats[c].total++;
            confluenceStats[c].pnl += t.pnl;
            if (t.pnl > 0) confluenceStats[c].wins++;
        });
    });
    const confluenceData = Object.entries(confluenceStats).map(([c, d]) => ({
        confluence: c,
        winRate: (d.wins / d.total * 100).toFixed(1) + '%',
        avgPnl: (d.pnl / d.total).toFixed(2),
        trades: d.total
    }));

    // Ratings
    const setupRatingData = {};
    const mgmtRatingData = {};
    [1,2,3,4,5].forEach(r => {
        const sr = trades.filter(t => t.setup_rating == r);
        const mr = trades.filter(t => t.management_rating == r);
        if (sr.length > 0) setupRatingData[r + ' stars'] = { avgPnl: (sr.reduce((s,t) => s+t.pnl, 0)/sr.length).toFixed(2), trades: sr.length };
        if (mr.length > 0) mgmtRatingData[r + ' stars'] = { avgPnl: (mr.reduce((s,t) => s+t.pnl, 0)/mr.length).toFixed(2), trades: mr.length };
    });

    // BUILD PROMPT
    const statsPayload = {
        overview: { totalTrades, winRate: winRate + '%', totalPnl: '$' + totalPnl, avgPnl: '$' + avgPnl, profitFactor },
        bySession: sessionData,
        byMentalState: mentalData,
        bySetupType: setupData,
        byEmotion: emotionData,
        rules: rulesData,
        byConfluence: confluenceData,
        setupRatings: setupRatingData,
        managementRatings: mgmtRatingData
    };

    const prompt = `You are an expert trading coach and behavioral analyst specializing in funded/evaluation traders. You analyze trading journal data and provide honest, specific, actionable insights.

TRADER CONTEXT:
- Trading Style: ${strategy?.trading_style || 'Unknown'}
- Strategy: ${strategy?.strategy_type || 'Unknown'}
- Known Confluences: ${strategy?.confluences?.join(', ') || 'None specified'}

PERFORMANCE DATA:
${JSON.stringify(statsPayload, null, 2)}

Respond ONLY with a valid JSON object in this exact format:
{
  "insights": [
    { "icon": "emoji", "title": "short title", "description": "one specific sentence with numbers from the data" }
  ],
  "strengths": ["bullet point 1", "bullet point 2", "bullet point 3"],
  "weaknesses": ["bullet point 1", "bullet point 2", "bullet point 3"],
  "improvements": ["bullet point 1", "bullet point 2", "bullet point 3"],
  "profile": "2-3 sentence overall trader assessment"
}

Rules:
- insights array must have 3-5 items
- Each insight must reference specific numbers from the data
- strengths, weaknesses, improvements must have 2-4 bullet points each
- profile must be honest, not overly positive
- If there is not enough data for a meaningful insight, say so honestly
- Never make up numbers not in the data
- Be direct and specific, not generic`;

    // CALL CLAUDE API
    try {
        const response = await fetch('/api/insights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'claude-sonnet-4-6',
                max_tokens: 2000,
                messages: [{ role: 'user', content: prompt }]
            })
        });

        const result = await response.json();
        if (!response.ok || !result.content || !result.content[0]) {
            throw new Error(result.error?.message || 'AI service unavailable');
        }
        const text = result.content[0].text;
        const clean = text.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(clean);

        parsed.insights = Array.isArray(parsed.insights) ? parsed.insights : [];
        parsed.strengths = Array.isArray(parsed.strengths) ? parsed.strengths : [];
        parsed.weaknesses = Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [];
        parsed.improvements = Array.isArray(parsed.improvements) ? parsed.improvements : [];
        parsed.profile = typeof parsed.profile === 'string' ? parsed.profile : '';

        // Cache to Supabase
        const remaining = alreadyGeneratedToday
            ? MANUAL_LIMITS[userPlan] - (manualUsed + 1)
            : MANUAL_LIMITS[userPlan];

        await supabaseClient.from('ai_insights').upsert({
            user_id: session.user.id,
            insights: parsed,
            generated_at: new Date().toISOString(),
            last_auto_date: alreadyGeneratedToday ? insightRecord.last_auto_date : today,
            manual_refreshes_today: alreadyGeneratedToday ? manualUsed + 1 : 0,
            last_manual_date: alreadyGeneratedToday ? today : insightRecord?.last_manual_date
        }, { onConflict: 'user_id' });

        displayAIInsights(parsed, new Date().toISOString(), remaining);

    } catch (err) {
        console.error('AI insights error:', err);
        showAIEmpty('Failed to generate insights. Please try again.');
    } finally {
        isGeneratingAI = false;
    }
}

function showAILoading() {
    const aiLock = document.getElementById('aiLockOverlay');
    if (aiLock) aiLock.style.display = 'none';
    document.querySelectorAll('.ai-insight-item').forEach(item => item.classList.remove('blurred'));
    const preview = document.querySelector('.insight-ai-preview');
    preview.innerHTML = `
        <div class="ai-loading">
            <div class="ai-loading-spinner"></div>
            <span class="ai-loading-text">Analyzing your trading data...</span>
        </div>
    `;
}

function showAIEmpty(message) {
    const aiLock = document.getElementById('aiLockOverlay');
    const aiLockText = document.getElementById('aiLockText');
    const btnGenerate = document.getElementById('btnGenerateAI');
    if (aiLock) {
        aiLock.style.display = 'flex';
        aiLockText.textContent = message;
        btnGenerate.style.display = 'none';
    }
    document.querySelectorAll('.ai-insight-item').forEach(item => item.classList.add('blurred'));
    const preview = document.querySelector('.insight-ai-preview');
    preview.innerHTML = '';
}

function displayAIInsights(data, generatedAt, refreshesRemaining) {
    const preview = document.querySelector('.insight-ai-preview');

    // Determine card type from icon
    const getType = (icon) => {
        if (['⚠️','🚨','❌','😰'].includes(icon)) return 'warning';
        if (['✅','💪','📈','🎯'].includes(icon)) return 'positive';
        if (['📊','🧠','💡','ℹ️'].includes(icon)) return 'info';
        if (['⛔','📉'].includes(icon)) return 'negative';
        return 'info';
    };

    const generatedTime = generatedAt 
        ? `Last generated: ${new Date(generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
        : '';

    preview.innerHTML = `
        <p class="insight-ai-generated">${generatedTime}</p>

        <div class="ai-insights-layout">
            <!-- LEFT — Insight Cards -->
            <div class="ai-insights-left">
                ${data.insights.map(insight => `
                    <div class="ai-insight-item ${getType(insight.icon)}">
                        <div class="ai-insight-icon">${esc(insight.icon || '💡')}</div>
                        <div class="ai-insight-text">
                            <span class="ai-insight-title">${esc(insight.title)}</span>
                            <span class="ai-insight-desc">${esc(insight.description)}</span>
                        </div>
                    </div>
                `).join('')}
            </div>

            <!-- RIGHT — Tabs -->
            <div class="ai-insights-right">
                <div class="ai-tabs">
                    <button class="ai-tab active" data-tab="strengths">💪 Strengths</button>
                    <button class="ai-tab" data-tab="weaknesses">⚠️ Weaknesses</button>
                    <button class="ai-tab" data-tab="improvements">🎯 Improve</button>
                    <button class="ai-tab" data-tab="profile">📊 Profile</button>
                </div>

                <div class="ai-tab-content active" id="tab-strengths">
                    <div class="ai-analysis-block">
                        <ul class="ai-analysis-list">
                            ${data.strengths.map(s => `<li>${esc(s)}</li>`).join('')}
                        </ul>
                    </div>
                </div>
                <div class="ai-tab-content" id="tab-weaknesses">
                    <div class="ai-analysis-block">
                        <ul class="ai-analysis-list">
                            ${data.weaknesses.map(w => `<li>${esc(w)}</li>`).join('')}
                        </ul>
                    </div>
                </div>
                <div class="ai-tab-content" id="tab-improvements">
                    <div class="ai-analysis-block">
                        <ul class="ai-analysis-list">
                            ${data.improvements.map(i => `<li>${esc(i)}</li>`).join('')}
                        </ul>
                    </div>
                </div>
                <div class="ai-tab-content" id="tab-profile">
                    <div class="ai-analysis-block">
                        <p class="ai-analysis-profile">${esc(data.profile)}</p>
                    </div>
                </div>
            </div>
        </div>

        ${userPlan === 'elite' ? `
            <button class="btn-regenerate" id="btnRegenerateAI">
                <i data-lucide="refresh-cw" style="width:14px;height:14px;"></i>
                Regenerate Analysis
            </button>
            ${refreshesRemaining !== undefined ? `<p class="ai-refresh-count">${refreshesRemaining} / 2 refreshes left today</p>` : '<p class="ai-refresh-count">2 manual refreshes per day</p>'}
        ` : `
            <button class="btn-regenerate btn-regenerate-locked" disabled>
                <i data-lucide="lock" style="width:14px;height:14px;"></i>
                Upgrade to Elite for manual refreshes
            </button>
            <p class="ai-refresh-count">Auto-refreshes daily on login</p>
        `}
        
    `;

    

    // Tab switching
    document.querySelectorAll('.ai-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.ai-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.ai-tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
        });
    });

    // Animate insight cards in
    setTimeout(() => {
        document.querySelectorAll('.ai-insight-item:not(.blurred)').forEach((card, i) => {
            setTimeout(() => card.classList.add('visible'), i * 120);
        });
    }, 100);

    document.getElementById('btnRegenerateAI')?.addEventListener('click', generateAIInsights);
    lucide.createIcons();
}

// Init
(async () => {
    renderSuggestions();
    await loadUserPlan();
    checkOnboarding();
    loadRuleSets();
    Promise.all([loadRecentTrades(), loadStreak(), loadRules()]).then(() => {
        document.getElementById('page-dashboard')?.classList.remove('dash-loading');
    });
    lucide.createIcons();

    const lastPage = sessionStorage.getItem('noxis_active_page') || 'dashboard';
    pages.forEach(p => p.classList.remove('active'));
    navItems.forEach(n => n.classList.remove('active'));
    document.getElementById(`page-${lastPage}`)?.classList.add('active');
    document.querySelectorAll(`[data-page="${lastPage}"]`).forEach(el => el.classList.add('active'));

    if (lastPage === 'checklist') { loadRuleSets(); loadRules(); }
    if (lastPage === 'journal') loadJournal();
    if (lastPage === 'streak') loadStreakPage();
    if (lastPage === 'settings') loadSettings();
    if (lastPage === 'ai') loadInsights();

    const fab = document.getElementById('fabLogTrade');
    if (fab && lastPage !== 'dashboard') fab.style.display = 'none';
})();

function openImageLightbox(src) {
    const overlay = document.createElement('div');
    overlay.className = 'image-lightbox';
    overlay.innerHTML = `<img src="${src}" class="lightbox-img" />`;
    overlay.addEventListener('click', () => {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 200);
    });
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.style.opacity = '1');
}
