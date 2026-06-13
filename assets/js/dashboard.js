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
        const tag = document.createElement('button');
        tag.className = 'suggestion-tag';
        tag.textContent = emotion;
        tag.addEventListener('click', () => addEmotion(emotion));
        emotionSuggestions.appendChild(tag);
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

renderSuggestions();

lucide.createIcons();