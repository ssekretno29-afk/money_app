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

let state = {
    id: null, pair_code: null, income: 0, essentials: 0, optional: 0, goals: []
};

let isSyncing = false;
let syncInterval = null;

// --- Навигация по экранам ---
const navItems = document.querySelectorAll('.nav-item');
const screens = document.querySelectorAll('.screen');

navItems.forEach(item => {
    item.onclick = () => {
        // Убираем активный класс у всех
        navItems.forEach(n => n.classList.remove('active'));
        screens.forEach(s => s.classList.add('hidden'));
        
        // Добавляем активный класс нажатой
        item.classList.add('active');
        const targetId = item.getAttribute('data-target');
        document.getElementById(targetId).classList.remove('hidden');
        
        // Если открыли статистику, обновляем график
        if (targetId === 'screen-stats') {
            updateChart();
        }
    };
});

// --- API Запросы к Supabase ---
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
        updateUI();
    } else {
        const newBudget = { user1_id: TG_ID, pair_code: null, income: 0, essentials: 0, optional: 0, goals: [] };
        const res = await apiRequest('budgets', 'POST', newBudget);
        if (res && res.length > 0) { state = res[0]; updateUI(); }
    }
    if (!syncInterval) syncInterval = setInterval(syncFromDB, 3000);
}

async function syncFromDB() {
    if (!state.id || isSyncing) return;
    isSyncing = true;
    const data = await apiRequest(`budgets?id=eq.${state.id}`);
    if (data && data.length > 0) { state = data[0]; updateUI(); }
    isSyncing = false;
}

async function saveState() {
    if (!state.id) return;
    const updateData = { income: state.income, essentials: state.essentials, optional: state.optional, goals: state.goals, pair_code: state.pair_code, user2_id: state.user2_id || null };
    await apiRequest(`budgets?id=eq.${state.id}`, 'PATCH', updateData);
    updateUI();
}

// --- Обновление интерфейса ---
function updateUI() {
    // 1. Обновляем Главный экран
    if (state.user2_id) {
        document.getElementById('pair-connected').classList.remove('hidden');
        document.getElementById('pair-disconnected').classList.add('hidden');
    } else {
        document.getElementById('pair-connected').classList.add('hidden');
        document.getElementById('pair-disconnected').classList.remove('hidden');
    }

    const totalSavedInGoals = state.goals.reduce((sum, goal) => sum + goal.saved, 0);
    const remainder = state.income - state.essentials - state.optional - totalSavedInGoals;
    
    document.getElementById('display-remainder').textContent = formatMoney(remainder);
    document.getElementById('display-income').textContent = formatMoney(state.income);
    document.getElementById('display-essentials').textContent = formatMoney(state.essentials);

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

    // 2. Обновляем экран Трат
    document.getElementById('cal-income').textContent = formatMoney(state.income);
    document.getElementById('cal-spent').textContent = formatMoney(state.essentials + state.optional);
    document.getElementById('cal-saved').textContent = formatMoney(totalSavedInGoals);
    document.getElementById('exp-essential-val').textContent = formatMoney(state.essentials);
    document.getElementById('exp-optional-val').textContent = formatMoney(state.optional);

    // 3. Если открыт экран статистики — перерисовываем
    if (!document.getElementById('screen-stats').classList.contains('hidden')) {
        updateChart();
    }
}

// --- Отрисовка Диаграммы (Статистика) ---
function updateChart() {
    const totalSavedInGoals = state.goals.reduce((sum, goal) => sum + goal.saved, 0);
    const totalSpent = state.essentials + state.optional;
    const totalAll = totalSpent + totalSavedInGoals;

    document.getElementById('chart-total').textContent = formatMoney(totalAll);

    const chart = document.getElementById('donut-chart');
    chart.innerHTML = ''; // Очищаем

    if (totalAll === 0) return;

    // Данные для диаграммы
    const data = [
        { label: 'Обязательные', value: state.essentials, color: 'var(--chart-1)' },
        { label: 'Необязательные', value: state.optional, color: 'var(--chart-3)' },
        { label: 'В цели', value: totalSavedInGoals, color: 'var(--chart-2)' }
    ].filter(d => d.value > 0);

    let currentOffset = 0;
    const circumference = 2 * Math.PI * 15.9155; // Радиус 15.9155 для 100%

    data.forEach(item => {
        const percent = (item.value / totalAll) * 100;
        const dashArray = (percent / 100) * circumference;
        const dashOffset = currentOffset;
        
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '18');
        circle.setAttribute('cy', '18');
        circle.setAttribute('r', '15.9155');
        circle.setAttribute('stroke', item.color);
        circle.setAttribute('stroke-dasharray', `${dashArray} ${circumference - dashArray}`);
        circle.setAttribute('stroke-dashoffset', -dashOffset);
        
        chart.appendChild(circle);
        currentOffset += dashArray;
    });

    // Легенда
    const legend = document.getElementById('chart-legend');
    legend.innerHTML = '';
    data.forEach(item => {
        const percent = Math.round((item.value / totalAll) * 100);
        const div = document.createElement('div');
        div.className = 'legend-item';
        div.innerHTML = `
            <div class="legend-color" style="background: ${item.color}"></div>
            <div class="legend-text">${item.label}</div>
            <div class="legend-val">${percent}%</div>
        `;
        legend.appendChild(div);
    });
}

function formatMoney(amount) {
    return new Intl.NumberFormat('ru-RU').format(amount) + ' ₽';
}

// --- Модальное окно ---
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

// --- Обработчики кнопок ---
document.getElementById('edit-income-btn').onclick = () => openModal('Введите доход за месяц', false, true, (text, num) => { state.income = num; saveState(); }, '', state.income || '');
document.getElementById('add-essential-btn').onclick = () => openModal('Добавить обязательные расходы', false, true, (text, num) => { state.essentials += num; saveState(); });
document.getElementById('add-optional-btn').onclick = () => openModal('Сколько потратили?', false, true, (text, num) => { state.optional += num; saveState(); });

document.getElementById('add-goal-btn').onclick = () => {
    if (state.goals.length >= 15) return tg.showAlert('Максимум 15 целей!');
    openModal('Новая цель', true, true, (text, num) => {
        if (!text) return;
        state.goals.push({ id: Date.now(), title: text, target: num, saved: 0 });
        saveState();
    });
};

window.deleteGoal = function(id) {
    if (confirm('Удалить эту цель?')) {
        state.goals = state.goals.filter(g => g.id !== id);
        saveState();
    }
};

window.editGoal = function(id) {
    const goal = state.goals.find(g => g.id === id);
    if (!goal) return;
    openModal('Редактировать цель', true, true, (text, num) => {
        if (!text) return;
        goal.title = text;
        goal.target = num;
        saveState();
    }, goal.title, goal.target);
};

window.addToGoal = function(id) {
    const goal = state.goals.find(g => g.id === id);
    if (!goal) return;
    const remaining = goal.target - goal.saved;
    openModal('Сколько отложить на цель?', false, true, (text, num) => {
        if (num > 0) {
            if (num > remaining) { goal.saved += remaining; tg.showAlert(`Отложено только ${formatMoney(remaining)}.`); }
            else { goal.saved += num; }
            saveState();
        }
    }, '', remaining > 0 ? remaining : '');
};

// --- Логика приглашений ---
document.getElementById('create-pair-btn').onclick = async () => {
    if (state.user2_id) return tg.showAlert('Партнер уже привязан!');
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    state.pair_code = code;
    await saveState();
    tg.showAlert(`Ваш код для приглашения: ${code}\n\nОтправьте его партнеру.`);
    navigator.clipboard.writeText(code);
};

document.getElementById('join-pair-btn').onclick
