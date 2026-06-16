const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Check auth
supabaseClient.auth.getSession().then(({ data: { session } }) => {
    if (!session) {
        window.location.href = 'login.html';
    }
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
    });
});

function closeModal() {
    modalOverlay.classList.remove('active');
    editingTradeId = null;
    document.querySelector('.modal-header h2').textContent = 'Log Trade';
    document.getElementById('btnSave').textContent = 'Save Trade';
    document.getElementById('tradeDate').value = today;
    document.getElementById('tradeNumber').value = '1';
    document.getElementById('tradeSymbol').value = '';
    document.getElementById('tradeSize').value = '1';
    document.getElementById('tradeEntry').value = '';
    document.getElementById('tradeExit').value = '';
    document.getElementById('tradeNotes').value = '';
    pnlDisplay.textContent = '$0.00';
    pnlDisplay.className = 'pnl-display';
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

// Emotion tags
const emotionInput = document.getElementById('emotionInput');
const emotionTagsEl = document.getElementById('emotionTags');
const emotionSuggestions = document.getElementById('emotionSuggestions');
const emotionTagsContainer = document.getElementById('emotionTagsContainer');

let selectedEmotions = [];
let savedEmotions = JSON.parse(localStorage.getItem('noxis_emotions') || '[]');
const defaultEmotions = ['FOMO', 'Anxious', 'Confident', 'Frustrated', 'Calm', 'Revenge', 'Greedy', 'Patient'];

function renderSuggestions() {
    const allSuggestions = savedEmotions.length > 0 ? savedEmotions : defaultEmotions;
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
        alert('Please fill in all required fields.');
        return;
    }

    const btnSave = document.getElementById('btnSave');
    btnSave.textContent = 'Saving...';
    btnSave.disabled = true;

    const { data: { session } } = await supabaseClient.auth.getSession();
    let pnl = direction === 'long' ? (exit - entry) * size * 20 : (entry - exit) * size * 20;

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
        alert('Error saving trade: ' + error.message);
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
        .limit(5);

    if (error || !trades) return;

    const totalPnl = trades.reduce((sum, trade) => sum + trade.pnl, 0);
    const rpnlEl = document.querySelector('.stat-value:not(.green)');
    if (rpnlEl) {
        rpnlEl.textContent = (totalPnl >= 0 ? '+$' : '-$') + Math.abs(totalPnl).toFixed(2);
        rpnlEl.className = 'stat-value ' + (totalPnl >= 0 ? 'positive' : 'negative');
    }

    const recentEmpty = document.querySelector('.recent-empty');
    const recentCard = document.querySelector('.recent-card');

    const oldTable = document.getElementById('tradesTable');
    if (oldTable) oldTable.remove();

    if (trades.length === 0) {
        recentEmpty.style.display = 'flex';
        return;
    }

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
            ${trades.map(trade => `
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
        container.innerHTML = trades.map(trade => `
            <div class="trade-card">
                <div class="trade-card-header">
                    <span class="trade-card-symbol">${trade.symbol}</span>
                    <span class="trade-card-pnl ${trade.pnl >= 0 ? 'positive' : 'negative'}">
                        ${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}
                    </span>
                </div>
                <div class="trade-card-details">
                    <span class="trade-card-tag ${trade.direction === 'long' ? 'long' : 'short'}">
                        ${trade.direction === 'long' ? '↑ Long' : '↓ Short'}
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
    } else if (currentView === 'list') {
        container.className = 'trades-list';
        container.innerHTML = trades.map(trade => `
            <div class="trade-list-item">
                <div class="trade-list-left">
                    <span class="trade-list-symbol">${trade.symbol}</span>
                    <span class="trade-list-dir ${trade.direction === 'long' ? 'long' : 'short'}">
                        ${trade.direction === 'long' ? '↑' : '↓'}
                    </span>
                    <span class="trade-list-date">${trade.date}</span>
                </div>
                <div class="trade-list-right">
                    <span class="trade-list-pnl ${trade.pnl >= 0 ? 'positive' : 'negative'}">
                        ${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}
                    </span>
                    <div class="trade-list-actions">
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
        document.getElementById('tradeSize').value = trade.size;
        document.getElementById('tradeEntry').value = trade.entry_price;
        document.getElementById('tradeExit').value = trade.exit_price;
        document.getElementById('tradeNotes').value = trade.notes || '';

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
        .gte('date', sevenDaysAgo.toLocaleDateString('en-CA'));

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
    let streak = 0;
    const checkDate = new Date(today);
    while (true) {
        const day = checkDate.getDay();
        if (day !== 0 && day !== 6) {
            const dateStr = checkDate.toLocaleDateString('en-CA');
            if (tradedDays.has(dateStr)) {
                streak++;
            } else {
                break;
            }
        }
        checkDate.setDate(checkDate.getDate() - 1);
        if (streak > 365) break;
    }

    // Update flame and title
    const flame = document.querySelector('.streak-flame');
    flame.textContent = streak > 0 ? '🔥' : '💤';
    document.querySelector('.streak-title').textContent = 
        streak > 0 ? `${streak} Day Streak` : 'No streak yet';
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
        ${ruleSets.map(set => `
            <div class="set-item ${activeSetId === set.id ? 'active' : ''}" data-set-id="${set.id}">
                <span>${set.name}</span>
                <button class="set-delete-btn" data-set-id="${set.id}">
                    <i data-lucide="x"></i>
                </button>
            </div>
        `).join('')}
    `;

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

            confirmDelete.onclick = async () => {
                await supabaseClient.from('rule_sets').delete().eq('id', id);
                if (activeSetId === id) activeSetId = 'all';
                confirmOverlay.classList.remove('active');
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
        .order('date', { ascending: false })
        .order('trade_number', { ascending: false });

    allTrades = trades || [];

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

    journalPage = 1;
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
            <div class="entry-date-col">
                <span class="entry-date">${trade.date}</span>
                <span class="entry-trade-num">Trade #${trade.trade_number}</span>
                <span class="entry-rules-badge ${trade.followed_rules ? 'followed' : 'broke'}">
                    ${trade.followed_rules ? '✓ Rules' : '✗ Broke rules'}
                </span>
            </div>
            <div class="entry-main">
                <div class="entry-top">
                    <span class="entry-symbol">${trade.symbol}</span>
                    <span class="entry-direction ${trade.direction}">
                        ${trade.direction === 'long' ? '↑ Long' : '↓ Short'}
                    </span>
                    <span class="entry-size">${trade.size} contract${trade.size > 1 ? 's' : ''}</span>
                </div>
                <div class="entry-prices">
                    <span>Entry: ${trade.entry_price}</span>
                    <span>Exit: ${trade.exit_price}</span>
                </div>
                ${trade.emotions ? `
                    <div class="entry-emotions">
                        ${trade.emotions.split(', ').map(e => `<span class="entry-emotion-tag">${e}</span>`).join('')}
                    </div>
                ` : ''}
                ${trade.notes ? `<div class="entry-notes">"${trade.notes}"</div>` : ''}
            </div>
            <div class="entry-pnl-col">
                <span class="entry-pnl ${trade.pnl >= 0 ? 'positive' : 'negative'}">
                    ${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}
                </span>
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
}

// Filter listeners
['filterSymbol', 'filterDirection', 'filterRules'].forEach(id => {
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

//Init
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