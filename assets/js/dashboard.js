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
const today = new Date().toLocaleDateString('en-CA');
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

    const { error } = await supabaseClient.from('trades').insert({
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

    if (error) {
        alert('Error saving trade: ' + error.message);
        btnSave.textContent = 'Save Trade';
        btnSave.disabled = false;
    } else {
        btnSave.textContent = 'Saved ✓';
        loadRecentTrades();
        setTimeout(() => {
            modalOverlay.classList.remove('active');
            btnSave.textContent = 'Save Trade';
            btnSave.disabled = false;
            selectedEmotions = [];
            renderEmotionTags();
            renderSuggestions();
        }, 1000);
    }
});

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

// Default suggestions if none saved yet
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

    // Save to local storage
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

    const recentEmpty = document.querySelector('.recent-empty');
    const recentCard = document.querySelector('.recent-card');

    if (trades.length === 0) {
        recentEmpty.style.display = 'flex';
        return;
    }

    recentEmpty.style.display = 'none';

    // Remove old table if exists
    const oldTable = document.getElementById('tradesTable');
    if (oldTable) oldTable.remove();

    const table = document.createElement('div');
    table.id = 'tradesTable';
    table.className = 'trades-table';

    table.innerHTML = `
        <div class="trades-header-row">
            <span>Date</span>
            <span>Symbol</span>
            <span>Direction</span>
            <span>Size</span>
            <span>P&L</span>
            <span>Rules</span>
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
            </div>
        `).join('')}
    `;

    recentCard.appendChild(table);
}

// Call on load
loadRecentTrades();

renderSuggestions();

lucide.createIcons();