const tg = window.Telegram.WebApp;
tg.expand();

const SUPABASE_URL = 'https://ktiagbzahwmrrppcrlnz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_QRT5iIa7zGIi0RPknh4yeA_EWSOV_7V';
const TG_ID = tg.initDataUnsafe?.user?.id || 12345;

const userName = tg.initDataUnsafe?.user?.first_name || "друг";
document.getElementById('user-name').textContent = userName;

const now = new Date();
const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
document.getElementById('current-date').textContent = `${months[now.getMonth()]} ${now.getFullYear()}`;

const DEFAULT_CATEGORIES = [
    { id: 'housing', name: 'Жилье', icon: '🛒', spent: 0 },
    { id: 'utilities', name: 'ЖКХ', icon: '🔌', spent: 0 },
    { id: 'food', name: 'Продукты', icon: '🍔', spent: 0 },
    { id: 'transport', name: 'Транспорт', icon: '🚌', spent: 0 },
    { id: 'hobbies', name: 'Увлечения', icon: '🎮', spent: 0 },
    { id: 'education', name: 'Обучение', icon: '📚', spent: 0 },
    { id: 'other', name: 'Прочее', icon: '📦', spent: 0 }
];

let state = {
    id: null, pair_code: null, income: 0, essentials: 0, goals: [], categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES))
};

let isSyncing = false;
let syncInterval = null;

// --- Навигация ---
const navItems = document.querySelectorAll('.nav-item');
const screens = document.querySelectorAll('.screen');

navItems.forEach(item => {
    item.onclick = () => {
        navItems.forEach(n => n.classList.remove('active'));
        screens.forEach(s => s.classList.add('hidden'));
        item.classList.add('active');
        const targetId = item.getAttribute('data-target');
        document.getElementById(targetId).classList.remove('hidden');
        if (targetId === 'screen-stats') updateChart();
    };
});

// --- API ---
async function apiRequest(endpoint, method = 'GET', body = null) {
    const headers = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, options);
    if (!res.ok) { console.error('API Error:', await res.text()); return null; }
    return await res.json();
}

async function initApp() {
    const data = await apiRequest(`budgets?or=(user1_id.eq.${TG_ID},user2_id.eq.${TG_ID})`);
    if (data && data.length > 0) {
        state = data[0];
        if (!state.categories) state.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
        updateUI();
    } else {
        const newBudget = { user1_id: TG_ID, pair_code: null, income: 0, essentials: 0, goals: [], categories: DEFAULT_CATEGORIES };
        const res = await apiRequest('budgets', 'POST', newBudget);
        if (res && res.length > 0) { state = res[0]; updateUI(); }
    }
    if (!syncInterval) syncInterval = setInterval(syncFromDB, 3000);
}

async function syncFromDB() {
    if (!state.id || isSyncing) return;
    isSyncing = true;
    const data = await apiRequest(`budgets?id=eq.${state.id}`);
    if (data && data.length > 0) { 
        state = data[0]; 
        if (!state.categories) state.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
        updateUI(); 
    }
    isSyncing = false;
}

// УМНАЯ ФУНКЦИЯ СОХРАНЕНИЯ
async function saveState() {
    if (!state.id) return;
    
    // Жестко блокируем любые синхронизации
    isSyncing = true; 

    const updateData = { 
        income: state.income, 
        essentials: state.essentials, 
        goals: state.goals, 
        categories: state.categories,
        pair_code: state.pair_code, 
        user2_id: state.user2_id || null 
    };
    
    // Ждем, пока база данных ответит, что всё сохранила
    await apiRequest(`budgets?id=eq.${state.id}`, 'PATCH', updateData);
    
    // После успешного сохранения обновляем интерфейс
    updateUI();
    
    // Разблокируем синхронизацию с задержкой (чтобы база точно не выдала старые данные при следующем запросе)
    setTimeout(() => { isSyncing = false; }, 1500);
}

// --- Интерфейс ---
function updateUI() {
    if (state.user2_id) {
        document.getElementById('pair-connected').classList.remove('hidden');
        document.getElementById('pair-disconnected').classList.add('hidden');
    } else {
        document.getElementById('pair-connected').classList.add('hidden');
        document.getElementById('pair-disconnected').classList.remove('hidden');
    }

    const totalSavedInGoals = state.goals.reduce((sum, goal) => sum + goal.saved, 0);
    const totalSpentFact = state.categories.reduce((sum, cat) => sum + cat.spent, 0);
    
    const remainder = state.income - state.essentials - totalSpentFact - totalSavedInGoals;
    
    document.getElementById('display-remainder').textContent = formatMoney(remainder);
    document.getElementById('display-income').textContent = formatMoney(state.income);
    document.getElementById('display-essentials').textContent = formatMoney(state.essentials);

    // Цели
    const goalsList = document.getElementById('goals-list');
    goalsList.innerHTML = '';
    state.goals.forEach(goal => {
        const percent = goal.target > 0 ? Math.min((goal.saved / goal.target) * 100, 100) : 0;
        const isCompleted = goal.saved >= goal.target;
        const actionButton = isCompleted ? `<div class="goal-completed">Цель достигнута! 🎉</div>` : `<button class="goal-btn-add" onclick="addToGoal(${goal.id})">+ Добавить</button>`;
        const card = document.createElement('div');
        card.className = 'goal-card';
        card.innerHTML = `
            <div class="goal-actions">
                <button class="edit-goal" onclick="editGoal(${goal.id})">✏️</button>
                <button class="delete-goal" onclick="deleteGoal(${goal.id})">×</button>
            </div>
            <div class="goal-title">${goal.title}</div>
            <div class="goal-sums"><span>${formatMoney(goal.saved)} из ${formatMoney(goal.target)}</span><span class="goal-percent">${Math.round(percent)}%</span></div>
            <div class="progress-bar"><div class="progress-fill" style="width: ${percent}%"></div></div>
            ${actionButton}
        `;
        goalsList.appendChild(card);
    });
    document.getElementById('goals-count').textContent = `${state.goals.length}/15`;

    // Категории
    const catList = document.getElementById('categories-list');
    catList.innerHTML = '';
    state.categories.forEach(cat => {
        const card = document.createElement('div');
        card.className = 'category-card';
        card.onclick = () => openCategoryModal(cat.id);
        card.innerHTML = `
            <div class="cat-icon">${cat.icon}</div>
            <div class="cat-info" style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 600; font-size: 15px;">${cat.name}</span>
                <span style="font-weight: 700; color: var(--purple-dark);">${formatMoney(cat.spent)}</span>
            </div>
        `;
        catList.appendChild(card);
    });

    if (!document.getElementById('screen-stats').classList.contains('hidden')) {
        updateChart();
    }
}

// --- Диаграмма ---
function updateChart() {
    const totalSpent = state.categories.reduce((sum, cat) => sum + cat.spent, 0);
    document.getElementById('chart-total').textContent = formatMoney(totalSpent);

    const chart = document.getElementById('donut-chart');
    chart.innerHTML = ''; 

    if (totalSpent === 0) return;

    const colors = ['#FF9B9B', '#B39DFF', '#85C1E9', '#F5B041', '#58D68D', '#EC7063', '#AAB7B8'];
    const data = state.categories.filter(c => c.spent > 0);

    let currentOffset = 0;
    const circumference = 2 * Math.PI * 15.9155;

    data.forEach((item, index) => {
        const percent = (item.spent / totalSpent) * 100;
        const dashArray = (percent / 100) * circumference;
        const color = colors[index % colors.length];
        
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '18');
        circle.setAttribute('cy', '18');
        circle.setAttribute('r', '15.9155');
        circle.setAttribute('stroke', color);
        circle.setAttribute('stroke-dasharray', `${dashArray} ${circumference - dashArray}`);
        circle.setAttribute('stroke-dashoffset', -currentOffset);
        
        chart.appendChild(circle);
        currentOffset += dashArray;
    });

    const legend = document.getElementById('chart-legend');
    legend.innerHTML = '';
    data.forEach((item, index) => {
        const percent = Math.round((item.spent / totalSpent) * 100);
        const color = colors[index % colors.length];
        const div = document.createElement('div');
        div.className = 'legend-item';
        div.innerHTML = `
            <div class="legend-color" style="background: ${color}"></div>
            <div class="legend-text">${item.name}</div>
            <div class="legend-val">${percent}%</div>
        `;
        legend.appendChild(div);
    });
}

function formatMoney(amount) {
    return new Intl.NumberFormat('ru-RU').format(amount) + ' ₽';
}

// --- Модалки ---
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const inputText = document.getElementById('modal-input-text');
const inputNumber = document.getElementById('modal-input-number');
const btnCancel = document.getElementById('modal-cancel');
const btnSave = document.getElementById('modal-save');
let currentAction = null;

function openModal(title, showText, showNumber, action, initialText = '', initialNumber = '') {
    modalTitle.textContent = title;
    inputText.classList.toggle('hidden', !showText);
    inputNumber.classList.toggle('hidden', !showNumber);
    inputText.value = initialText;
    inputNumber.value = initialNumber;
    currentAction = action;
    modalOverlay.classList.remove('hidden');
}

btnCancel.onclick = () => { modalOverlay.classList.add('hidden'); currentAction = null; };
btnSave.onclick = () => {
    if (currentAction) {
        const textVal = inputText.value.trim();
        const numVal = parseFloat(inputNumber.value) || 0;
        currentAction(textVal, numVal);
    }
    modalOverlay.classList.add('hidden');
};

// --- Кнопки ---
document.getElementById('edit-income-btn').onclick = () => openModal('Введите доход за месяц', false, true, (text, num) => { state.income = num; saveState(); }, '', state.income || '');
document.getElementById('add-essential-btn').onclick = () => openModal('Сумма обязательных трат (план)', false, true, (text, num) => { state.essentials = num; saveState(); }, '', state.essentials || '');

document.getElementById('add-goal-btn').onclick = () => {
    if (state.goals.length >= 15) return tg.showAlert('Максимум 15 целей!');
    openModal('Новая цель', true, true, (text, num) => {
        if (!text) return;
        state.goals.push({ id: Date.now(), title: text, target: num, saved: 0 });
        saveState();
    });
};

window.deleteGoal = (id) => { if (confirm('Удалить цель?')) { state.goals = state.goals.filter(g => g.id !== id); saveState(); } };
window.editGoal = (id) => {
    const goal = state.goals.find(g => g.id === id);
    if (!goal) return;
    openModal('Редактировать цель', true, true, (text, num) => { goal.title = text; goal.target = num; saveState(); }, goal.title, goal.target);
};
window.addToGoal = (id) => {
    const goal = state.goals.find(g => g.id === id);
    if (!goal) return;
    const remaining = goal.target - goal.saved;
    openModal('Сколько отложить?', false, true, (text, num) => {
        if (num > 0) {
            goal.saved += (num > remaining) ? remaining : num;
            if (num > remaining) tg.showAlert(`Отложено только ${formatMoney(remaining)}.`);
            saveState();
        }
    }, '', remaining > 0 ? remaining : '');
};

// Модалка категории
function openCategoryModal(catId) {
    const cat = state.categories.find(c => c.id === catId);
    if (!cat) return;

    openModal(`Потрачено на "${cat.name}"`, false, true, (text, num) => {
        if (num > 0) {
            cat.spent += num;
            saveState();
        }
    });
}

// Приглашения
document.getElementById('create-pair-btn').onclick = async () => {
    if (state.user2_id) return tg.showAlert('Партнер уже привязан!');
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    state.pair_code = code;
    await saveState();
    tg.showAlert(`Ваш код: ${code}`);
    navigator.clipboard.writeText(code);
};

document.getElementById('join-pair-btn').onclick = () => {
    openModal('Введите код партнера', true, false, async (text) => {
        if (!text) return;
        const code = text.toUpperCase();
        const data = await apiRequest(`budgets?pair_code=eq.${code}`);
        if (data && data.length > 0) {
            const targetBudget = data[0];
            if (targetBudget.user2_id) return tg.showAlert('Код уже использован!');
            if (targetBudget.user1_id === TG_ID) return tg.showAlert('Это ваш код!');
            
            targetBudget.user2_id = TG_ID;
            await apiRequest(`budgets?id=eq.${targetBudget.id}`, 'PATCH', { user2_id: TG_ID });
            if (state.id && !state.user2_id) await apiRequest(`budgets?id=eq.${state.id}`, 'DELETE');
            
            state = targetBudget;
            if (!state.categories) state.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
            saveState();
            tg.showAlert('Бюджеты объединены!');
        } else {
            tg.showAlert('Код не найден!');
        }
    });
};

initApp();
window.addEventListener('load', () => {
    setTimeout(() => document.getElementById('splash-screen').classList.add('hidden'), 2000);
});
