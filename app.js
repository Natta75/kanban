// ============================================================
// STATE MANAGEMENT
// ============================================================

const state = {
    cards: [],
    user: null,
    showAllTasks: false,
    selectedCard: null,
    editMode: false,
    currentColumnForNewCard: null,
    // Фильтры и поиск
    filters: {
        showAllTasks: false,
        priority: null
    },
    searchQuery: ''
};

const COLUMNS = {
    TODO: 'todo',
    IN_PROGRESS: 'inProgress',
    DONE: 'done'
};

const COLUMN_ORDER = [COLUMNS.TODO, COLUMNS.IN_PROGRESS, COLUMNS.DONE];

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function generateId() {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function getCardsByColumn(columnId) {
    let cards = state.cards.filter(card => card.column_id === columnId);

    // Применить фильтры
    cards = FiltersComponent.applyFilters(cards, state.filters, state.user?.id);

    // Применить поиск
    cards = SearchComponent.filterCards(cards, state.searchQuery);

    return cards;
}

function findCardById(cardId) {
    return state.cards.find(card => card.id === cardId);
}

function getColumnIndex(columnId) {
    return COLUMN_ORDER.indexOf(columnId);
}

function canMoveLeft(columnId) {
    return getColumnIndex(columnId) > 0;
}

function canMoveRight(columnId) {
    return getColumnIndex(columnId) < COLUMN_ORDER.length - 1;
}

// ============================================================
// LOCAL STORAGE
// ============================================================

function saveToStorage() {
    try {
        localStorage.setItem('kanbanCards', JSON.stringify(state.cards));
    } catch (error) {
        console.error('Ошибка при сохранении данных:', error);
    }
}

function loadFromStorage() {
    try {
        const saved = localStorage.getItem('kanbanCards');
        if (saved) {
            state.cards = JSON.parse(saved);
        }
    } catch (error) {
        console.error('Ошибка при загрузке данных:', error);
        state.cards = [];
    }
}

// ============================================================
// CARD CRUD OPERATIONS (через Supabase)
// ============================================================

async function addCard(columnId, title, description, priority, startDate, endDate) {
    console.log('addCard called, state.user:', state.user);

    if (!state.user) {
        console.error('❌ state.user is null!');
        alert('Необходима авторизация для создания карточек');
        return;
    }

    const { data, error } = await CardService.createCard({
        title: title.trim(),
        description: description.trim(),
        column_id: columnId,
        priority: priority || 'medium',
        start_date: startDate || new Date().toISOString(),
        end_date: endDate || null
    });

    if (error) {
        console.error('Ошибка создания карточки:', error);
        alert('Не удалось создать карточку: ' + error.message);
        return;
    }

    // Карточка автоматически добавится через Realtime событие INSERT
    // Не нужно добавлять локально, чтобы избежать дублирования
}

async function updateCard(cardId, title, description, priority, startDate, endDate) {
    if (!state.user) {
        alert('Необходима авторизация');
        return;
    }

    const updates = {
        title: title.trim(),
        description: description.trim(),
        priority: priority || 'medium'
    };

    // Добавляем даты только если они заданы
    if (startDate) updates.start_date = startDate;
    if (endDate) updates.end_date = endDate;

    const { data, error } = await CardService.updateCard(cardId, updates);

    if (error) {
        console.error('Ошибка обновления карточки:', error);
        alert('Не удалось обновить карточку: ' + error.message);
        return;
    }

    // Карточка автоматически обновится через Realtime событие UPDATE
    // Не нужно обновлять локально, чтобы избежать дублирования
}

async function deleteCard(cardId) {
    const card = findCardById(cardId);
    if (!card) return;

    if (!state.user) {
        alert('Необходима авторизация');
        return;
    }

    const confirmed = confirm('Вы уверены, что хотите удалить эту задачу?');
    if (!confirmed) return;

    const { error } = await CardService.deleteCard(cardId);

    if (error) {
        console.error('Ошибка удаления карточки:', error);
        alert('Не удалось удалить карточку: ' + error.message);
        return;
    }

    // Карточка автоматически удалится через Realtime событие DELETE
    // Не нужно удалять локально, чтобы избежать дублирования
}

async function moveCard(cardId, direction) {
    const card = findCardById(cardId);
    if (!card) return;

    if (!state.user) {
        alert('Необходима авторизация');
        return;
    }

    const currentIndex = getColumnIndex(card.column_id);
    const newIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;

    if (newIndex < 0 || newIndex >= COLUMN_ORDER.length) return;

    const oldColumnId = card.column_id;
    const newColumnId = COLUMN_ORDER[newIndex];

    const { data, error } = await CardService.moveCard(cardId, newColumnId, 0);

    if (error) {
        console.error('Ошибка перемещения карточки:', error);
        alert('Не удалось переместить карточку: ' + error.message);
        return;
    }

    // Карточка автоматически обновится через Realtime событие UPDATE
    // Не нужно обновлять локально, чтобы избежать дублирования
}

// ============================================================
// DOM RENDERING
// ============================================================

function renderColumn(columnId) {
    const container = document.getElementById(`${columnId}-cards`);
    if (!container) return;

    const cards = getCardsByColumn(columnId);

    container.innerHTML = '';

    if (cards.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem 1rem; font-size: 0.875rem;">Нет задач</p>';
        return;
    }

    cards.forEach(card => {
        const cardElement = createCardElement(card);
        container.appendChild(cardElement);
    });

    updateCardCount(columnId);
}

function createCardElement(card) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card';
    cardDiv.dataset.cardId = card.id;

    // Добавить класс приоритета для цветной границы
    if (card.priority) {
        cardDiv.classList.add(`priority-${card.priority}`);
    }

    // Добавить класс для статуса дедлайна
    const deadlineClass = DateUtils.getDeadlineClass(card.end_date);
    if (deadlineClass) {
        cardDiv.classList.add(deadlineClass);
    }

    const titleDiv = document.createElement('div');
    titleDiv.className = 'card-title';
    titleDiv.textContent = card.title;

    const descriptionDiv = document.createElement('div');
    descriptionDiv.className = 'card-description';
    descriptionDiv.textContent = card.description;

    // Метаданные карточки (приоритет и даты)
    const metaDiv = document.createElement('div');
    metaDiv.className = 'card-meta';

    // Приоритет
    if (card.priority) {
        const priorityBadge = document.createElement('span');
        priorityBadge.className = `card-priority-badge priority-${card.priority}`;
        const priorityLabels = { low: 'Низкий', medium: 'Средний', high: 'Высокий' };
        priorityBadge.textContent = priorityLabels[card.priority] || card.priority;
        metaDiv.appendChild(priorityBadge);
    }

    // Дата окончания
    if (card.end_date) {
        const deadlineDiv = document.createElement('div');
        deadlineDiv.className = 'card-deadline';
        const deadlineClass = DateUtils.getDeadlineClass(card.end_date);
        if (deadlineClass) {
            deadlineDiv.classList.add(deadlineClass);
        }
        const icon = DateUtils.getDateIcon(card.end_date);
        const status = DateUtils.getDeadlineStatus(card.end_date);
        deadlineDiv.textContent = `${icon} ${status}`;
        metaDiv.appendChild(deadlineDiv);
    }

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'card-actions';

    // Кнопка редактирования
    const editBtn = document.createElement('button');
    editBtn.className = 'card-btn btn-edit';
    editBtn.textContent = 'Редактировать';
    editBtn.onclick = () => openEditModal(card.id);

    // Кнопка удаления
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'card-btn btn-delete';
    deleteBtn.textContent = 'Удалить';
    deleteBtn.onclick = () => deleteCard(card.id);

    // Кнопка перемещения влево
    const moveLeftBtn = document.createElement('button');
    moveLeftBtn.className = 'card-btn btn-move';
    moveLeftBtn.textContent = '← Назад';
    moveLeftBtn.onclick = () => moveCard(card.id, 'left');
    moveLeftBtn.disabled = !canMoveLeft(card.column_id);

    // Кнопка перемещения вправо
    const moveRightBtn = document.createElement('button');
    moveRightBtn.className = 'card-btn btn-move';
    moveRightBtn.textContent = 'Далее →';
    moveRightBtn.onclick = () => moveCard(card.id, 'right');
    moveRightBtn.disabled = !canMoveRight(card.column_id);

    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(deleteBtn);
    if (canMoveLeft(card.column_id)) {
        actionsDiv.appendChild(moveLeftBtn);
    }
    if (canMoveRight(card.column_id)) {
        actionsDiv.appendChild(moveRightBtn);
    }

    cardDiv.appendChild(titleDiv);
    cardDiv.appendChild(descriptionDiv);
    cardDiv.appendChild(metaDiv);
    cardDiv.appendChild(actionsDiv);

    return cardDiv;
}

function renderBoard() {
    COLUMN_ORDER.forEach(columnId => {
        renderColumn(columnId);
    });

    // Переинициализировать drag & drop после рендеринга
    if (typeof DragDropComponent !== 'undefined' && state.user) {
        // Небольшая задержка, чтобы DOM успел обновиться
        setTimeout(() => {
            DragDropComponent.reinitialize();
        }, 50);
    }
}

function updateCardCount(columnId) {
    const column = document.querySelector(`[data-column-id="${columnId}"]`);
    if (!column) return;

    const countElement = column.querySelector('.card-count');
    if (!countElement) return;

    const count = getCardsByColumn(columnId).length;
    countElement.textContent = count;
}

// ============================================================
// MODAL MANAGEMENT
// ============================================================

function openAddModal(columnId) {
    state.editMode = false;
    state.selectedCard = null;
    state.currentColumnForNewCard = columnId;

    const modal = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const form = document.getElementById('card-form');
    const titleInput = document.getElementById('card-title');
    const descriptionInput = document.getElementById('card-description');
    const priorityInput = document.getElementById('card-priority');
    const startDateInput = document.getElementById('card-start-date');
    const endDateInput = document.getElementById('card-end-date');

    modalTitle.textContent = 'Новая задача';
    titleInput.value = '';
    descriptionInput.value = '';
    priorityInput.value = 'medium';
    startDateInput.value = DateUtils.getTodayForInput();
    endDateInput.value = '';

    modal.classList.remove('hidden');
    titleInput.focus();
}

function openEditModal(cardId) {
    const card = findCardById(cardId);
    if (!card) return;

    state.editMode = true;
    state.selectedCard = cardId;

    const modal = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const titleInput = document.getElementById('card-title');
    const descriptionInput = document.getElementById('card-description');
    const priorityInput = document.getElementById('card-priority');
    const startDateInput = document.getElementById('card-start-date');
    const endDateInput = document.getElementById('card-end-date');

    modalTitle.textContent = 'Редактировать задачу';
    titleInput.value = card.title;
    descriptionInput.value = card.description;
    priorityInput.value = card.priority || 'medium';
    startDateInput.value = card.start_date ? DateUtils.formatDateForInput(card.start_date) : '';
    endDateInput.value = card.end_date ? DateUtils.formatDateForInput(card.end_date) : '';

    modal.classList.remove('hidden');
    titleInput.focus();
}

function closeModal() {
    const modal = document.getElementById('modal-overlay');
    modal.classList.add('hidden');

    state.editMode = false;
    state.selectedCard = null;
    state.currentColumnForNewCard = null;

    const form = document.getElementById('card-form');
    form.reset();
}

function saveCard(event) {
    event.preventDefault();

    const titleInput = document.getElementById('card-title');
    const descriptionInput = document.getElementById('card-description');
    const priorityInput = document.getElementById('card-priority');
    const startDateInput = document.getElementById('card-start-date');
    const endDateInput = document.getElementById('card-end-date');

    const title = titleInput.value.trim();
    const description = descriptionInput.value.trim();
    const priority = priorityInput.value;
    const startDate = startDateInput.value ? new Date(startDateInput.value).toISOString() : null;
    const endDate = endDateInput.value ? new Date(endDateInput.value).toISOString() : null;

    if (!title) {
        alert('Пожалуйста, введите название задачи');
        titleInput.focus();
        return;
    }

    // Валидация дат
    if (startDate && endDate && !DateUtils.validateDates(startDate, endDate)) {
        alert('Дата окончания должна быть позже даты начала');
        endDateInput.focus();
        return;
    }

    if (state.editMode && state.selectedCard) {
        updateCard(state.selectedCard, title, description, priority, startDate, endDate);
    } else if (state.currentColumnForNewCard) {
        addCard(state.currentColumnForNewCard, title, description, priority, startDate, endDate);
    }

    closeModal();
}

// ============================================================
// EVENT LISTENERS
// ============================================================

function initializeEventListeners() {
    // Кнопки "Добавить карточку"
    const addCardButtons = document.querySelectorAll('.add-card-btn');
    addCardButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const columnId = e.currentTarget.dataset.columnId;
            openAddModal(columnId);
        });
    });

    // Закрытие модального окна
    const closeBtn = document.getElementById('close-modal');
    closeBtn.addEventListener('click', closeModal);

    const cancelBtn = document.getElementById('cancel-btn');
    cancelBtn.addEventListener('click', closeModal);

    const modalOverlay = document.getElementById('modal-overlay');
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });

    // Обработка формы
    const form = document.getElementById('card-form');
    form.addEventListener('submit', saveCard);

    // Закрытие модального окна по Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('modal-overlay');
            if (!modal.classList.contains('hidden')) {
                closeModal();
            }
        }
    });
}

// ============================================================
// SUPABASE DATA LOADING
// ============================================================

async function loadCardsFromSupabase() {
    if (!state.user) {
        console.log('Пользователь не авторизован, карточки не загружаются');
        state.cards = [];
        renderBoard();
        return;
    }

    // Проверить наличие данных в localStorage для миграции
    await checkAndMigrateLocalStorage();

    const { data, error } = await CardService.getCards(state.filters.showAllTasks);

    if (error) {
        console.error('Ошибка загрузки карточек:', error);
        alert('Не удалось загрузить карточки');
        return;
    }

    state.cards = data || [];
    renderBoard();

    // Проверить дедлайны и показать уведомления
    NotificationsComponent.checkDeadlines(state.cards);

    console.log(`✅ Загружено карточек из Supabase: ${state.cards.length}`);
}

async function checkAndMigrateLocalStorage() {
    try {
        const saved = localStorage.getItem('kanbanCards');
        if (!saved) {
            return; // Нет данных для миграции
        }

        const localCards = JSON.parse(saved);
        if (!localCards || localCards.length === 0) {
            return; // Пустой массив
        }

        // Спросить пользователя о миграции
        const shouldMigrate = confirm(
            `Найдено ${localCards.length} карточек в локальном хранилище.\n\n` +
            `Хотите перенести их в облако?\n\n` +
            `(После переноса локальные данные будут удалены)`
        );

        if (!shouldMigrate) {
            return;
        }

        console.log('🔄 Миграция данных из localStorage...');

        const { success, migrated, error } = await CardService.migrateFromLocalStorage(localCards);

        if (error) {
            console.error('Ошибка миграции:', error);
            alert('Не удалось перенести данные: ' + error.message);
            return;
        }

        console.log(`✅ Мигрировано карточек: ${migrated}`);
        alert(`✅ Успешно перенесено ${migrated} карточек в облако!`);

        // Удалить локальные данные после успешной миграции
        localStorage.removeItem('kanbanCards');

    } catch (error) {
        console.error('Ошибка проверки миграции:', error);
    }
}

function setupRealtimeSubscription() {
    if (!state.user) {
        console.log('Пользователь не авторизован, Realtime не подключается');
        return;
    }

    // Отписаться от старой подписки, если существует
    RealtimeService.unsubscribe();

    RealtimeService.subscribe({
        onInsert: (newCard) => {
            // Добавить карточку если она соответствует фильтру
            if (state.filters.showAllTasks || newCard.user_id === state.user.id) {
                state.cards.push(newCard);
                renderColumn(newCard.column_id);
                updateCardCount(newCard.column_id);
                // Обновить уведомления
                NotificationsComponent.checkDeadlines(state.cards);
            }
        },
        onUpdate: (updatedCard) => {
            // Обновить карточку
            const index = state.cards.findIndex(c => c.id === updatedCard.id);
            if (index !== -1) {
                const oldColumnId = state.cards[index].column_id;
                state.cards[index] = updatedCard;

                // Перерендерить обе колонки если карточка переместилась
                if (oldColumnId !== updatedCard.column_id) {
                    renderColumn(oldColumnId);
                    updateCardCount(oldColumnId);
                }
                renderColumn(updatedCard.column_id);
                updateCardCount(updatedCard.column_id);
                // Обновить уведомления
                NotificationsComponent.checkDeadlines(state.cards);
            }
        },
        onDelete: (deletedCard) => {
            // Удалить карточку
            const index = state.cards.findIndex(c => c.id === deletedCard.id);
            if (index !== -1) {
                state.cards.splice(index, 1);
                renderColumn(deletedCard.column_id);
                updateCardCount(deletedCard.column_id);
                // Обновить уведомления
                NotificationsComponent.checkDeadlines(state.cards);
            }
        }
    });
}

// ============================================================
// INITIALIZATION
// ============================================================

async function initializeApp() {
    // Инициализация Supabase
    initializeSupabase();

    // Тестирование подключения к Supabase
    if (typeof testSupabaseConnection === 'function') {
        const connected = await testSupabaseConnection();
        if (!connected) {
            console.warn('⚠️ Не удалось подключиться к Supabase. Проверьте, что таблицы созданы.');
            console.info('📖 Инструкция: откройте SETUP_INSTRUCTIONS.md');
        }
    }

    // Инициализация компонентов
    // 1. Поиск
    SearchComponent.init((searchQuery) => {
        state.searchQuery = searchQuery;
        renderBoard();
    });

    // 2. Фильтры
    FiltersComponent.init((filters) => {
        state.filters = filters;

        // Если изменился фильтр "Показать все задачи", перезагрузить карточки
        if (state.filters.showAllTasks !== state.showAllTasks) {
            state.showAllTasks = state.filters.showAllTasks;
            loadCardsFromSupabase();
        } else {
            // Просто перерендерить с новыми фильтрами
            renderBoard();
        }
    });

    // 3. Уведомления
    await NotificationsComponent.init();

    // 4. Drag & Drop
    if (typeof DragDropComponent !== 'undefined') {
        DragDropComponent.init(async (cardId, newColumnId, newPosition) => {
            // Callback при перемещении карточки через drag & drop
            console.log(`📦 Drag & Drop: карточка ${cardId} → колонка ${newColumnId}, позиция ${newPosition}`);

            if (!state.user) {
                alert('Необходима авторизация');
                // Перерендерить чтобы вернуть карточку на место
                renderBoard();
                return;
            }

            // Обновить на сервере
            const { data, error } = await CardService.moveCard(cardId, newColumnId, newPosition);

            if (error) {
                console.error('Ошибка перемещения карточки:', error);
                alert('Не удалось переместить карточку: ' + error.message);
                // Перерендерить чтобы вернуть карточку на место
                renderBoard();
            }
            // Обновление через Realtime произойдет автоматически
        });
    }

    // Инициализация Auth UI
    if (typeof AuthUI !== 'undefined') {
        AuthUI.init();

        // Подписка на изменения состояния аутентификации
        if (typeof AuthService !== 'undefined') {
            AuthService.onAuthStateChange(async (event, session) => {
                console.log('Auth state changed in app:', event);
                console.log('Session:', session);
                console.log('User from session:', session?.user);

                // Обновить user в state
                state.user = session?.user || null;
                console.log('state.user updated to:', state.user);

                // Обновить UI
                AuthUI.updateUIForAuthState(state.user);

                // При входе - загрузить карточки и подключить Realtime
                if (event === 'SIGNED_IN' && state.user) {
                    console.log('✅ Пользователь вошёл, загружаем карточки...');
                    await loadCardsFromSupabase();
                    // Подключить Realtime только если еще не подключен
                    if (!RealtimeService.isSubscribed()) {
                        setupRealtimeSubscription();
                    }
                }

                // При выходе - очистить карточки и отключить Realtime
                if (event === 'SIGNED_OUT') {
                    console.log('👋 Пользователь вышел');
                    state.cards = [];
                    renderBoard();
                    RealtimeService.unsubscribe();
                }
            });
        }
    }

    // Проверить текущую сессию
    const currentUser = await AuthService.getCurrentUser();
    state.user = currentUser;

    // Если пользователь авторизован - загрузить карточки
    if (state.user) {
        console.log('✅ Пользователь авторизован:', state.user.email);
        await loadCardsFromSupabase();
        setupRealtimeSubscription();
    } else {
        // Если не авторизован - показать пустую доску
        console.log('ℹ️ Пользователь не авторизован');
        state.cards = [];
        renderBoard();
    }

    initializeEventListeners();

    console.log('✅ Kanban Board инициализирован');
    console.log(`📋 Загружено карточек: ${state.cards.length}`);
}

// Запуск приложения при загрузке страницы
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
