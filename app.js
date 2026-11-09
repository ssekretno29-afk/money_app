const tg = window.Telegram.WebApp;
tg.expand();

// Получаем имя
const userName = tg.initDataUnsafe?.user?.first_name || "друг";
document.getElementById('user-name').textContent = userName;

// Устанавливаем текущую дату
const now = new Date();
const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
document.getElementById('current-date').textContent = `${months[now.getMonth()]} ${now.getFullYear()}`;

// --- Состояние приложения ---
let state = {
    income: 0,
    goals: []
};

// Загрузка из памяти телефона
function loadState() {
    const saved = localStorage.getItem('fat_kopilka_state');
    if (saved) {
        state = JSON.parse(saved);
    }
    updateUI();
}

// Сохранение в память телефона
function saveState() {
    localStorage.setItem('fat_kopilka_state', JSON.stringify(state));
    updateUI();
}

// --- Обновление экрана ---
function updateUI() {
    // 1. Обновляем доход
    document.getElementById('display-income').textContent = formatMoney(state.income);

    // 2. Отрисовываем цели
    const goalsList = document.getElementById('goals-list');
    goalsList.innerHTML = '';
    
    state.goals.forEach(goal => {
        const percent = goal.target > 0 ? Math.min((goal.saved / goal.target) * 100, 100) : 0;
        const isCompleted = goal.saved >= goal.target;
        
        const actionButton = isCompleted 
            ? `<div class="goal-completed">Цель достигнута! 🎉</div>`
            : `<button class="goal-btn-add" onclick="addToGoal(${goal.id})">+ Добавить</button>`;

        const card = document.createElement('div');
        card.className = 'goal-card';
        card.innerHTML = `
            <button class="delete-goal" onclick="deleteGoal(${goal.id})">×</button>
            <div class="goal-title">${goal.title}</div>
            <div class="goal-sums">
                <span>${formatMoney(goal.saved)} из ${formatMoney(goal.target)}</span>
                <span class="goal-percent">${Math.round(percent)}%</span>
            </div>
            <div class="progress-bar"><div class="progress-fill" style="width: ${percent}%"></div></div>
            ${actionButton}
        `;
        goalsList.appendChild(card);
    });

    document.getElementById('goals-count').textContent = `${state.goals.length}/15`;
}

function formatMoney(amount) {
    return new Intl.NumberFormat('ru-RU').format(amount) + ' ₽';
}

// --- Навигация по экранам ---
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

// --- Модальное окно ---
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const inputText = document.getElementById('modal-input-text');
const inputNumber = document.getElementById('modal-input-number');
const btnCancel = document.getElementById('modal-cancel');
const btnSave = document.getElementById('modal-save');

let currentAction = null;

function openModal(title, showText, showNumber, action) {
    modalTitle.textContent = title;
    inputText.classList.toggle('hidden', !showText);
    inputNumber.classList.toggle('hidden', !showNumber);
    inputText.value = '';
    inputNumber.value = '';
    currentAction = action;
    modalOverlay.classList.remove('hidden');
}

btnCancel.onclick = () => {
    modalOverlay.classList.add('hidden');
    currentAction = null;
};

btnSave.onclick = () => {
    if (currentAction) {
        const textVal = inputText.value.trim();
        const numVal = parseFloat(inputNumber.value) || 0;
        currentAction(textVal, numVal);
    }
    modalOverlay.classList.add('hidden');
};

// --- Кнопки на главной ---

// 1. Добавление денег в копилку дохода
document.getElementById('add-income-btn').onclick = () => {
    openModal('Сколько добавить в доход?', false, true, (text, num) => {
        if (num > 0) {
            state.income += num;
            saveState();
        }
    });
};

// 2. Добавление новой цели
document.getElementById('add-goal-btn').onclick = () => {
    if (state.goals.length >= 15) {
        tg.showAlert('Максимум 15 целей!');
        return;
    }
    openModal('Новая цель', true, true, (text, num) => {
        if (!text) return;
        const newGoal = {
            id: Date.now(),
            title: text,
            target: num,
            saved: 0
        };
        state.goals.push(newGoal);
        saveState();
    });
};

// 3. Удаление цели
window.deleteGoal = function(id) {
    if (confirm('Удалить эту цель?')) {
        state.goals = state.goals.filter(g => g.id !== id);
        saveState();
    }
};

// 4. Отложить деньги в цель
window.addToGoal = function(id) {
    const goal = state.goals.find(g => g.id === id);
    if (!goal) return;
    
    const remaining = goal.target - goal.saved;
    
    openModal('Сколько отложить на цель?', false, true, (text, num) => {
        if (num > 0) {
            if (num > remaining) {
                goal.saved += remaining;
                tg.showAlert(`Отложено только ${formatMoney(remaining)}.`);
            } else {
                goal.saved += num;
            }
            saveState();
        }
    });
};

// --- Запуск ---
loadState();

// Прячем заставку через 2 секунды
window.addEventListener('load', () => {
    setTimeout(() => {
        document.getElementById('splash-screen').classList.add('hidden');
    }, 2000);
});
