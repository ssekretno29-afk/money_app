const tg = window.Telegram.WebApp;
tg.expand();

const userName = tg.initDataUnsafe?.user?.first_name || "друг";
document.getElementById('user-name').textContent = userName;

const now = new Date();
const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
document.getElementById('current-date').textContent = `${months[now.getMonth()]} ${now.getFullYear()}`;

const DEFAULT_CATEGORIES = [
    { id: 'housing', name: 'Жилье', icon: '🛒', sum: 0 },
    { id: 'utilities', name: 'ЖКХ', icon: '🔌', sum: 0 },
    { id: 'food', name: 'Продукты', icon: '🍔', sum: 0 },
    { id: 'hobbies', name: 'Увлечения', icon: '🎮', sum: 0 },
    { id: 'education', name: 'Обучение', icon: '📚', sum: 0 },
    { id: 'credits', name: 'Кредиты', icon: '💳', sum: 0 },
    { id: 'other', name: 'Прочее', icon: '📦', sum: 0 }
];

const CHART_COLORS = ['#FF9B9B', '#B39DFF', '#85C1E9', '#F5B041', '#58D68D', '#EC7063', '#AAB7B8'];

let state = {
    month: now.getMonth(),
    year: now.getFullYear(),
    income: 0,
    spent: 0,
    goals: [],
    categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
    currentPet: 'pet.gif',
    theme: 'theme-light',
    style: 'style-purple'
};

function loadState() {
    const saved = localStorage.getItem('fat_kopilka_state');
    if (saved) {
        state = JSON.parse(saved);
        if (!state.categories || state.categories.length === 0) {
            state.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
        }
    }
    
    if (state.month !== now.getMonth() || state.year !== now.getFullYear()) {
        state.month = now.getMonth();
        state.year = now.getFullYear();
        state.income = 0; 
        state.spent = 0;  
        state.categories.forEach(c => c.sum = 0);
        saveState();
    } else {
        updateUI();
    }
}

function saveState() {
    localStorage.setItem('fat_kopilka_state', JSON.stringify(state));
    updateUI();
}

function updateUI() {
    document.body.className = `${state.theme} ${state.style}`;

    const totalSavedInGoals = state.goals.reduce((sum, goal) => sum + goal.saved, 0);
    const totalSpentInCategories = state.categories.reduce((sum, cat) => sum + cat.sum, 0);
    const remainder = state.income - totalSpentInCategories - totalSavedInGoals;

    document.getElementById('display-remainder').textContent = formatMoney(remainder);
    document.getElementById('display-income').textContent = formatMoney(state.income);
    document.getElementById('display-spent').textContent = formatMoney(totalSpentInCategories);

    const petImg = document.getElementById('main-pet-img');
    if (petImg.src !== state.currentPet) petImg.src = state.currentPet;

    // Цели
    const goalsList = document.getElementById('goals-list');
    goalsList.innerHTML = '';
    state.goals.forEach(goal => {
        const actualSaved = Math.min(goal.saved, goal.target);
        const percent = goal.target > 0 ? Math.min((actualSaved / goal.target) * 100, 100) : 0;
        const isCompleted = goal.saved >= goal.target;
        const actionButton = isCompleted ? `<div class="goal-completed">Цель достигнута! 🎉</div>` : `<button class="goal-btn-add" onclick="addToGoal(${goal.id})">+ Добавить</button>`;
        const remainingToGoal = goal.target - actualSaved;
        const remainingText = isCompleted ? '' : `<div class="goal-remaining">Осталось собрать: ${formatMoney(remainingToGoal)}</div>`;

        const card = document.createElement('div');
        card.className = 'goal-card';
        card.innerHTML = `
            <div class="goal-actions">
                <button class="edit-goal" onclick="editGoal(${goal.id})">✏️</button>
                <button class="delete-goal" onclick="deleteGoal(${goal.id})">×</button>
            </div>
            <div class="goal-title">${goal.title}</div>
            <div class="goal-sums">
                <span>${formatMoney(actualSaved)} из ${formatMoney(goal.target)}</span>
                <span class="goal-percent">${Math.round(percent)}%</span>
            </div>
            <div class="progress-bar"><div class="progress-fill" style="width: ${percent}%"></div></div>
            ${remainingText}
            ${actionButton}
        `;
        goalsList.appendChild(card);
    });
    document.getElementById('goals-count').textContent = `${state.goals.length}/15`;

    // Категории
    const catList = document.getElementById('categories-list');
    catList.innerHTML = '';
    state.categories.forEach(cat => {
        const div = document.createElement('div');
        div.className = 'category-card';
        div.innerHTML = `
            <div class="cat-icon-box">${cat.icon}</div>
            <div class="cat-info-box">
                <div class="cat-title">${cat.name}</div>
                <div class="cat-sum">${formatMoney(cat.sum)}</div>
            </div>
            <button class="cat-add-btn" onclick="addExpense('${cat.id}')">+</button>
        `;
        catList.appendChild(div);
    });

    // Статистика
    if (!document.getElementById('screen-stats').classList.contains('hidden')) {
        updateChart();
    }

    // Настройки
    document.querySelectorAll('.pet-select-btn').forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-pet') === state.currentPet));
    document.querySelectorAll('.theme-select-btn').forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-theme') === state.theme));
    document.querySelectorAll('.style-select-btn').forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-style') === state.style));
}

function formatMoney(amount) {
    return new Intl.NumberFormat('ru-RU').format(amount) + ' ₽';
}

// --- Отрисовка диаграммы ---
function updateChart() {
    const totalSpent = state.categories.reduce((sum, cat) => sum + cat.sum, 0);
    const chart = document.getElementById('donut-chart');
    const legend = document.getElementById('chart-legend');
    
    chart.innerHTML = '';
    legend.innerHTML = '';
    document.getElementById('chart-total').textContent = formatMoney(totalSpent);

    if (totalSpent === 0) return;

    let currentOffset = 0;
    const circumference = 2 * Math.PI * 15.9155;
    const activeCategories = state.categories.filter(c => c.sum > 0);

    activeCategories.forEach((cat, index) => {
        const percent = (cat.sum / totalSpent) * 100;
        const color = CHART_COLORS[index % CHART_COLORS.length];

        if (activeCategories.length === 1) {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', '18');
            circle.setAttribute('cy', '18');
            circle.setAttribute('r', '15.9155');
            circle.setAttribute('stroke', color);
            circle.setAttribute('class', 'full-circle');
            chart.appendChild(circle);
        } else {
            const dashArray = (percent / 100) * circumference;
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', '18');
            circle.setAttribute('cy', '18');
            circle.setAttribute('r', '15.9155');
            circle.setAttribute('stroke', color);
            circle.setAttribute('stroke-dasharray', `${dashArray} ${circumference - dashArray}`);
            circle.setAttribute('stroke-dashoffset', -currentOffset);
            chart.appendChild(circle);
            currentOffset += dashArray;
        }

        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item';
        legendItem.innerHTML = `
            <div class="legend-color" style="background: ${color}"></div>
            <div class="legend-text">${cat.name}</div>
            <div class="legend-percent">${Math.round(percent)}%</div>
        `;
        legend.appendChild(legendItem);
    });
}

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

// --- МОДАЛЬНЫЕ ОКНА И ПРОВЕРКА ---
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const inputText = document.getElementById('modal-input-text');
const inputNumber = document.getElementById('modal-input-number');
const btnCancel = document.getElementById('modal-cancel');
const btnSave = document.getElementById('modal-save');
let currentAction = null;

function openModal(title, showText, showNumber, action, initialText = '', initialNumber = '', maxLimit = null) {
    modalTitle.textContent = title;
    inputText.classList.toggle('hidden', !showText);
    inputNumber.classList.toggle('hidden', !showNumber);
    inputText.value = initialText;
    inputNumber.value = initialNumber;
    currentAction = action;
    modalOverlay.classList.remove('hidden');

    setupValidation(maxLimit);
}

function setupValidation(maxLimit) {
    const inputEl = document.getElementById('modal-input-number');
    const saveBtn = document.getElementById('modal-save');
    const errorMsg = document.getElementById('modal-error-msg');

    inputEl.classList.remove('input-error');
    errorMsg.style.display = 'none';
    saveBtn.disabled = false;

    if (maxLimit === null) {
        inputEl.oninput = null; 
        return;
    }

    inputEl.oninput = () => {
        const val = parseFloat(inputEl.value) || 0;
        
        if (val > maxLimit) {
            inputEl.classList.add('input-error');
            errorMsg.textContent = `Максимум доступно: ${formatMoney(maxLimit)}`;
            errorMsg.style.display = 'block';
            saveBtn.disabled = true;
        } else {
            inputEl.classList.remove('input-error');
            errorMsg.style.display = 'none';
            saveBtn.disabled = false;
        }
    };
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
window.addExpense = function(catId) {
    const cat = state.categories.find(c => c.id === catId);
    if (!cat) return;
    
    const totalSavedInGoals = state.goals.reduce((sum, goal) => sum + goal.saved, 0);
    const totalSpentInCategories = state.categories.reduce((sum, cat) => sum + cat.sum, 0);
    const currentBalance = state.income - totalSpentInCategories - totalSavedInGoals;

    openModal(`Траты на "${cat.name}"`, false, true, (text, num) => {
        if (num > 0) { cat.sum += num; saveState(); }
    }, '', '', currentBalance);
};

document.getElementById('add-income-btn').onclick = () => {
    openModal('Сколько добавить?', false, true, (text, num) => {
        if (num > 0) { state.income += num; saveState(); }
    });
};

document.getElementById('subtract-income-btn').onclick = () => {
    openModal('Сколько вычесть?', false, true, (text, num) => {
        if (num > 0) { state.income -= num; saveState(); }
    });
};

document.getElementById('add-goal-btn').onclick = () => {
    if (state.goals.length >= 15) return tg.showAlert('Максимум 15 целей!');
    openModal('Новая цель', true, true, (text, num) => {
        if (!text || num <= 0) return;
        state.goals.push({ id: Date.now(), title: text, target: num, saved: 0 });
        saveState();
    });
};

window.deleteGoal = function(id) {
    if (confirm('Удалить эту цель? Деньги, отложенные на неё, сгорят.')) {
        state.goals = state.goals.filter(g => g.id !== id);
        saveState();
    }
};

window.editGoal = function(id) {
    const goal = state.goals.find(g => g.id === id);
    if (!goal) return;
    openModal('Редактировать цель', true, true, (text, num) => {
        if (!text || num <= 0) return;
        goal.title = text;
        goal.target = num;
        if (goal.saved > goal.target) goal.saved = goal.target;
        saveState();
    }, goal.title, goal.target);
};

window.addToGoal = function(id) {
    const goal = state.goals.find(g => g.id === id);
    if (!goal) return;

    const totalSavedInGoals = state.goals.reduce((sum, goal) => sum + goal.saved, 0);
    const totalSpentInCategories = state.categories.reduce((sum, cat) => sum + cat.sum, 0);
    const currentBalance = state.income - totalSpentInCategories - totalSavedInGoals;

    const remainingToGoal = goal.target - goal.saved;
    const maxAllowed = Math.min(remainingToGoal, currentBalance);
    
    openModal('Сколько отложить?', false, true, (text, num) => {
        if (num > 0) {
            goal.saved += num;
            saveState();
            if (goal.saved >= goal.target) {
                goal.saved = goal.target;
                saveState();
            }
        }
    }, '', '', maxAllowed);
};

// --- Настройки ---
const petModalOverlay = document.getElementById('pet-modal-overlay');
document.getElementById('open-pet-selector').onclick = () => petModalOverlay.classList.remove('hidden');
document.getElementById('pet-modal-close').onclick = () => petModalOverlay.classList.add('hidden');
document.querySelectorAll('.pet-select-btn').forEach(btn => {
    btn.onclick = () => { state.currentPet = btn.getAttribute('data-pet'); saveState(); petModalOverlay.classList.add('hidden'); };
});

const themeModalOverlay = document.getElementById('theme-modal-overlay');
document.getElementById('open-theme-selector').onclick = () => themeModalOverlay.classList.remove('hidden');
document.getElementById('theme-modal-close').onclick = () => themeModalOverlay.classList.add('hidden');
document.querySelectorAll('.theme-select-btn').forEach(btn => {
    btn.onclick = () => { state.theme = btn.getAttribute('data-theme'); saveState(); themeModalOverlay.classList.add('hidden'); };
});

const styleModalOverlay = document.getElementById('style-modal-overlay');
document.getElementById('open-style-selector').onclick = () => styleModalOverlay.classList.remove('hidden');
document.getElementById('style-modal-close').onclick = () => styleModalOverlay.classList.add('hidden');
document.querySelectorAll('.style-select-btn').forEach(btn => {
    btn.onclick = () => { state.style = btn.getAttribute('data-style'); saveState(); styleModalOverlay.classList.add('hidden'); };
});

// Запуск
loadState();
window.addEventListener('load', () => {
    setTimeout(() => document.getElementById('splash-screen').classList.add('hidden'), 2000);
});
