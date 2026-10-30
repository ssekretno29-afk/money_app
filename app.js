// Инициализация Telegram WebApp
const tg = window.Telegram.WebApp;
tg.expand(); // Разворачиваем на весь экран

// Получаем имя пользователя
const userName = tg.initDataUnsafe?.user?.first_name || "друг";
document.getElementById('user-name').textContent = userName;

// Устанавливаем текущую дату
const now = new Date();
const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
document.getElementById('current-date').textContent = `${months[now.getMonth()]} ${now.getFullYear()}`;

// --- Состояние приложения ---
let state = {
    income: 0,
    essentials: 0,
    optional: 0,
    goals: [] // { id, title, target, saved }
};

// Загрузка из localStorage
function loadState() {
    const saved = localStorage.getItem('money_app_state');
    if (saved) {
        state = JSON.parse(saved);
    }
    updateUI();
}

// Сохранение в localStorage
function saveState() {
    localStorage.setItem('money_app_state', JSON.stringify(state));
    updateUI();
}

// Обновление интерфейса
function updateUI() {
    // Расчет остатка
    const remainder = state.income - state.essentials - state.optional;
    document.getElementById('display-remainder').textContent = formatMoney(remainder);
    document.getElementById('display-income').textContent = formatMoney(state.income);
    document.getElementById('display-essentials').textContent = formatMoney(state.essentials);

    // Отрисовка целей
    const goalsList = document.getElementById('goals-list');
    goalsList.innerHTML = '';
    
    state.goals.forEach(goal => {
        const percent = goal.target > 0 ? Math.min((goal.saved / goal.target) * 100, 100) : 0;
        
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
            <button class="goal-btn-add" onclick="addToGoal(${goal.id})">+ Добавить</button>
        `;
        goalsList.appendChild(card);
    });

    document.getElementById('goals-count').textContent = `${state.goals.length}/15`;
}

// Форматирование денег
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

// --- Обработчики кнопок ---

// Изменить доход
document.getElementById('edit-income-btn').onclick = () => {
    openModal('Введите доход за месяц', false, true, (text, num) => {
        state.income = num;
        saveState();
    });
};

// Обязательные расходы
document.getElementById('add-essential-btn').onclick = () => {
    openModal('Добавить обязательные расходы', false, true, (text, num) => {
        state.essentials += num;
        saveState();
    });
};

// Необязательные расходы (вычитание)
document.getElementById('add-optional-btn').onclick = () => {
    openModal('Сколько потратили?', false, true, (text, num) => {
        state.optional += num;
        saveState();
    });
};

// Добавить цель
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

// Глобальные функции для кнопок внутри карточек
window.deleteGoal = function(id) {
    if (confirm('Удалить эту цель?')) {
        state.goals = state.goals.filter(g => g.id !== id);
        saveState();
    }
};

window.addToGoal = function(id) {
    const goal = state.goals.find(g => g.id === id);
    if (!goal) return;
    
    openModal('Сколько отложить на цель?', false, true, (text, num) => {
        if (num > 0) {
            goal.saved += num;
            saveState();
        }
    });
};

// Кнопка FAB (плюсик внизу справа)
document.getElementById('fab-btn').onclick = () => {
    // Для простоты она вызывает добавление цели
    document.getElementById('add-goal-btn').click();
};

// --- Запуск ---
loadState();

// Логика заставки
window.addEventListener('load', () => {
    const splash = document.getElementById('splash-screen');
    // Ждем 2 секунды и скрываем
    setTimeout(() => {
        splash.classList.add('hidden');
    }, 2000);
});
