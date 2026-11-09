const tg = window.Telegram.WebApp;
tg.expand();

const userName = tg.initDataUnsafe?.user?.first_name || "друг";
document.getElementById('user-name').textContent = userName;

const now = new Date();
const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
document.getElementById('current-date').textContent = `${months[now.getMonth()]} ${now.getFullYear()}`;

// --- Состояние ---
let state = {
    month: now.getMonth(),
    year: now.getFullYear(),
    income: 0,
    spent: 0,
    goals: [],
    currentPet: 'pet.gif' // По умолчанию пингвин
};

function loadState() {
    const saved = localStorage.getItem('fat_kopilka_state');
    if (saved) {
        state = JSON.parse(saved);
    }
    
    // Сброс раз в месяц
    if (state.month !== now.getMonth() || state.year !== now.getFullYear()) {
        state.month = now.getMonth();
        state.year = now.getFullYear();
        state.income = 0; 
        state.spent = 0;  
        saveState();
    } else {
        updateUI();
    }
}

function saveState() {
    localStorage.setItem('fat_kopilka_state', JSON.stringify(state));
    updateUI();
}

// --- Обновление UI ---
function updateUI() {
    const totalSavedInGoals = state.goals.reduce((sum, goal) => sum + goal.saved, 0);
    const remainder = state.income - state.spent - totalSavedInGoals;

    document.getElementById('display-remainder').textContent = formatMoney(remainder);
    document.getElementById('display-income').textContent = formatMoney(state.income);
    document.getElementById('display-spent').textContent = formatMoney(state.spent);

    // Ставим нужную картинку питомца
    const petImg = document.getElementById('main-pet-img');
    if (petImg.src !== state.currentPet) {
        petImg.src = state.currentPet;
    }

    // Рисуем цели
    const goalsList = document.getElementById('goals-list');
    goalsList.innerHTML = '';
    
    state.goals.forEach(goal => {
        const actualSaved = Math.min(goal.saved, goal.target);
        const percent = goal.target > 0 ? Math.min((actualSaved / goal.target) * 100, 100) : 0;
        const isCompleted = goal.saved >= goal.target;
        
        const actionButton = isCompleted 
            ? `<div class="goal-completed">Цель достигнута! 🎉</div>`
            : `<button class="goal-btn-add" onclick="addToGoal(${goal.id})">+ Добавить</button>`;

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

    // Подсвечиваем выбранного питомца в настройках
    document.querySelectorAll('.pet-option').forEach(opt => {
        if (opt.getAttribute('data-pet') === state.currentPet) {
            opt.classList.add('active');
        } else {
            opt.classList.remove('active');
        }
    });
}

function formatMoney(amount) {
    return new Intl.NumberFormat('ru-RU').format(amount) + ' ₽';
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
    };
});

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

// 1. Добавление дохода
document.getElementById('add-income-btn').onclick = () => {
    openModal('Сколько добавить?', false, true, (text, num) => {
        if (num > 0) {
            state.income += num;
            saveState();
        }
    });
};

// 1.1. Вычитание дохода
document.getElementById('subtract-income-btn').onclick = () => {
    openModal('Сколько вычесть?', false, true, (text, num) => {
        if (num > 0) {
            state.income -= num;
            saveState();
        }
    });
};

// 2. Новая цель
document.getElementById('add-goal-btn').onclick = () => {
    if (state.goals.length >= 15) return tg.showAlert('Максимум 15 целей!');
    openModal('Новая цель', true, true, (text, num) => {
        if (!text || num <= 0) return;
        state.goals.push({ id: Date.now(), title: text, target: num, saved: 0 });
        saveState();
    });
};

// 3. Удалить цель
window.deleteGoal = function(id) {
    if (confirm('Удалить эту цель? Деньги, отложенные на неё, сгорят.')) {
        state.goals = state.goals.filter(g => g.id !== id);
        saveState();
    }
};

// 4. Редактировать цель
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

// 5. Отложить на цель
window.addToGoal = function(id) {
    const goal = state.goals.find(g => g.id === id);
    if (!goal) return;
    
    const remaining = goal.target - goal.saved;
    
    openModal('Сколько отложить?', false, true, (text, num) => {
        if (num > 0) {
            if (num > remaining) {
                goal.saved = goal.target;
                tg.showAlert(`Цель заполнена! Отложено ${formatMoney(remaining)}.`);
            } else {
                goal.saved += num;
            }
            saveState();
        }
    });
};

// --- Смена питомца ---
document.querySelectorAll('.pet-option').forEach(option => {
    option.onclick = () => {
        const petFile = option.getAttribute('data-pet');
        state.currentPet = petFile;
        saveState();
    };
});

// Запуск
loadState();
window.addEventListener('load', () => {
    setTimeout(() => document.getElementById('splash-screen').classList.add('hidden'), 2000);
});
