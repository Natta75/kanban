// ============================================================
// STATE MANAGEMENT
// ============================================================

const state = {
    cards: [],
    user: null,
    selectedCard: null,
    editMode: false,
    currentColumnForNewCard: null,
    // Профили пользователей (для отображения никнеймов)
    profiles: {}, // { userId: { nickname, email } }
    // Фильтры и поиск
    filters: {
        selectedUser: 'my', // 'my', 'all', или конкретный user_id
        priority: null,
        sortOrder: null
    },
    searchQuery: ''
};

const COLUMNS = {
    TODO: 'todo',
    IN_PROGRESS: 'inProgress',
    DONE: 'done'
};

const COLUMN_ORDER = [COLUMNS.TODO, COLUMNS.IN_PROGRESS, COLUMNS.DONE];

// Состояние раскрытых чеклистов
const expandedChecklists = {
    expanded: new Set(), // Set cardId для раскрытых чеклистов
    timers: {} // { cardId: timeoutId } для автосворачивания
};

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

    // Добавить карточку в локальное состояние сразу после успешного создания
    if (data) {
        // Сохранить временные пункты чеклиста, если они есть
        if (typeof ChecklistComponent !== 'undefined') {
            const tempItems = ChecklistComponent.getTempItems();
            if (tempItems && tempItems.length > 0) {
                console.log(`Сохранение ${tempItems.length} пунктов чеклиста для карточки ${data.id}`);
                const { error: checklistError } = await ChecklistService.addBulkChecklistItems(data.id, tempItems);
                if (checklistError) {
                    console.error('Не удалось сохранить пункты чеклиста:', checklistError);
                    // Не блокируем создание карточки из-за ошибки чеклиста
                }
            }
        }

        // Проверить, соответствует ли карточка текущим фильтрам
        const shouldShow =
            state.filters.selectedUser === 'all' ||
            (state.filters.selectedUser === 'my' && data.user_id === state.user.id) ||
            state.filters.selectedUser === data.user_id;

        if (shouldShow) {
            state.cards.push(data);
            renderColumn(data.column_id);
            updateCardCount(data.column_id);
            // Обновить уведомления
            NotificationsComponent.checkDeadlines(state.cards);
        }
    }
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

    // Обновить карточку в локальном состоянии сразу после успешного обновления
    if (data) {
        const index = state.cards.findIndex(c => c.id === cardId);
        if (index !== -1) {
            const oldColumnId = state.cards[index].column_id;
            state.cards[index] = data;

            // Перерендерить обе колонки если карточка переместилась
            if (oldColumnId !== data.column_id) {
                renderColumn(oldColumnId);
                updateCardCount(oldColumnId);
            }
            renderColumn(data.column_id);
            updateCardCount(data.column_id);

            // Обновить уведомления
            const urgentCards = NotificationsComponent.getUrgentCards(state.cards);
            if (urgentCards.length > 0) {
                NotificationsComponent.updateNotificationBanner(urgentCards);
            } else {
                NotificationsComponent.hideNotificationBanner();
            }
        }
    }
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

    // Удалить карточку из локального состояния сразу после успешного удаления
    const columnId = card.column_id;
    const index = state.cards.findIndex(c => c.id === cardId);
    if (index !== -1) {
        state.cards.splice(index, 1);
        renderColumn(columnId);
        updateCardCount(columnId);
        // Обновить уведомления
        NotificationsComponent.checkDeadlines(state.cards);
    }
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

    // Добавить атрибут владельца для проверки прав на drag
    const isOwner = state.user && card.user_id === state.user.id;
    cardDiv.dataset.isOwner = isOwner;

    // Добавить класс приоритета для цветной границы
    if (card.priority) {
        cardDiv.classList.add(`priority-${card.priority}`);
    }

    // Добавить класс для статуса дедлайна
    const deadlineClass = DateUtils.getDeadlineClass(card.end_date, card.column_id, card.completed_at);
    if (deadlineClass) {
        cardDiv.classList.add(deadlineClass);
    }

    const titleDiv = document.createElement('div');
    titleDiv.className = 'card-title';
    titleDiv.textContent = card.title;

    // Зачеркивание для выполненных задач
    if (card.column_id === CONFIG.COLUMNS.DONE) {
        titleDiv.style.textDecoration = 'line-through';
    }

    const descriptionDiv = document.createElement('div');
    descriptionDiv.className = 'card-description';

    if (card.description) {
        const contentFragment = URLUtils.renderDescriptionWithLinks(card.description);
        descriptionDiv.appendChild(contentFragment);
    }

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

    // Дата начала
    if (card.start_date) {
        const startDateDiv = document.createElement('div');
        startDateDiv.className = 'card-start-date';
        startDateDiv.textContent = `📅 ${DateUtils.formatDate(card.start_date)}`;
        metaDiv.appendChild(startDateDiv);
    }

    // Дата окончания (дедлайн)
    if (card.end_date) {
        const deadlineDiv = document.createElement('div');
        deadlineDiv.className = 'card-deadline';
        const deadlineClass = DateUtils.getDeadlineClass(card.end_date, card.column_id, card.completed_at);
        if (deadlineClass) {
            deadlineDiv.classList.add(deadlineClass);
        }
        const icon = DateUtils.getDateIcon(card.end_date, card.column_id, card.completed_at);
        const formattedDate = DateUtils.formatDate(card.end_date);
        const status = DateUtils.getDeadlineStatus(card.end_date, card.column_id, card.completed_at);

        // Показываем точную дату и статус для срочных задач
        if (deadlineClass) {
            deadlineDiv.textContent = `${icon} Дедлайн: ${formattedDate} (${status})`;
        } else {
            deadlineDiv.textContent = `${icon} Дедлайн: ${formattedDate}`;
        }
        metaDiv.appendChild(deadlineDiv);
    }

    // Placeholder для прогресса чеклиста (будет загружен асинхронно)
    // Вынесен в отдельный блок для консистентной позиции
    const checklistProgressDiv = document.createElement('div');
    checklistProgressDiv.className = 'card-checklist-progress-container';
    checklistProgressDiv.id = `checklist-progress-${card.id}`;

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'card-actions';

    // Показывать кнопки только для своих карточек
    if (isOwner) {
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

        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(deleteBtn);
    } else {
        // Для чужих карточек показать автора
        const ownerLabel = document.createElement('span');
        ownerLabel.className = 'card-owner-label';

        // Попытаться показать никнейм владельца
        const ownerProfile = state.profiles[card.user_id];
        if (ownerProfile && ownerProfile.nickname) {
            ownerLabel.textContent = `👤 Автор: ${ownerProfile.nickname}`;
        } else {
            ownerLabel.textContent = '👤 Карточка другого пользователя';
        }

        ownerLabel.style.fontSize = '0.875rem';
        ownerLabel.style.color = '#666';
        actionsDiv.appendChild(ownerLabel);
    }

    cardDiv.appendChild(titleDiv);
    cardDiv.appendChild(descriptionDiv);
    cardDiv.appendChild(metaDiv);
    cardDiv.appendChild(checklistProgressDiv); // Чеклист как отдельный блок
    cardDiv.appendChild(actionsDiv);

    // Загрузить прогресс чеклиста асинхронно
    if (typeof ChecklistService !== 'undefined') {
        loadChecklistProgress(card.id);
    }

    return cardDiv;
}

function renderBoard() {
    COLUMN_ORDER.forEach(columnId => {
        renderColumn(columnId);
    });

    // Переинициализировать drag & drop ТОЛЬКО если еще не инициализирован
    if (typeof DragDropComponent !== 'undefined' && state.user) {
        if (DragDropComponent.sortableInstances.length === 0) {
            // Небольшая задержка, чтобы DOM успел обновиться
            setTimeout(() => {
                DragDropComponent.reinitialize();
            }, 50);
        }
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

    // Показать чеклист для новой карточки
    const checklistContainer = document.getElementById('card-checklist-container');
    if (checklistContainer && typeof ChecklistComponent !== 'undefined') {
        checklistContainer.classList.remove('hidden');
        ChecklistComponent.render(null, checklistContainer, true); // true = новая карточка
    }

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

    // Показать чеклист в режиме редактирования
    const checklistContainer = document.getElementById('card-checklist-container');
    if (checklistContainer && typeof ChecklistComponent !== 'undefined') {
        checklistContainer.classList.remove('hidden');
        ChecklistComponent.render(cardId, checklistContainer);
    }

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

    // Скрыть и очистить чеклист
    const checklistContainer = document.getElementById('card-checklist-container');
    if (checklistContainer) {
        checklistContainer.classList.add('hidden');
        if (typeof ChecklistComponent !== 'undefined') {
            ChecklistComponent.clear();
        }
    }
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

    // Определяем нужно ли загружать все карточки
    const loadAll = state.filters.selectedUser !== 'my';

    const { data, error } = await CardService.getCards(loadAll);

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

// Debouncing для массового удаления
let deleteDebounceTimer = null;
let columnsToUpdate = new Set();

function setupRealtimeSubscription() {
    if (!state.user) {
        console.log('Пользователь не авторизован, Realtime не подключается');
        return;
    }

    // Отписаться от старой подписки, если существует
    RealtimeService.unsubscribe();

    RealtimeService.subscribe({
        onInsert: (newCard) => {
            // Проверить, не добавлена ли уже карточка локально (чтобы избежать дублирования)
            const exists = state.cards.some(c => c.id === newCard.id);
            if (exists) {
                console.log('Карточка уже существует локально, пропускаем INSERT событие');
                return;
            }

            // Добавить карточку если она соответствует фильтру пользователя
            const shouldShow =
                state.filters.selectedUser === 'all' ||
                (state.filters.selectedUser === 'my' && newCard.user_id === state.user.id) ||
                state.filters.selectedUser === newCard.user_id;

            if (shouldShow) {
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
                // Обновить только banner уведомлений (без Browser notification)
                const urgentCards = NotificationsComponent.getUrgentCards(state.cards);
                if (urgentCards.length > 0) {
                    NotificationsComponent.updateNotificationBanner(urgentCards);
                } else {
                    NotificationsComponent.hideNotificationBanner();
                }
            }
        },
        onDelete: (deletedCard) => {
            // Удалить карточку из state
            const index = state.cards.findIndex(c => c.id === deletedCard.id);
            if (index !== -1) {
                state.cards.splice(index, 1);

                // Добавить колонку в список для обновления
                columnsToUpdate.add(deletedCard.column_id);

                // Отложить обновление UI (debouncing)
                if (deleteDebounceTimer) {
                    clearTimeout(deleteDebounceTimer);
                }

                deleteDebounceTimer = setTimeout(() => {
                    // Обновить все затронутые колонки
                    columnsToUpdate.forEach(columnId => {
                        renderColumn(columnId);
                        updateCardCount(columnId);
                    });

                    // Обновить уведомления
                    NotificationsComponent.checkDeadlines(state.cards);

                    // Очистить список колонок
                    columnsToUpdate.clear();
                    deleteDebounceTimer = null;
                }, 100); // Ждем 100мс перед обновлением UI
            }
        }
    });

    // Подписка на события корзины
    RealtimeService.subscribeToTrash({
        onInsert: (trashItem) => {
            console.log('Trash insert:', trashItem);
            // Передать событие в компонент корзины
            if (typeof TrashComponent !== 'undefined') {
                TrashComponent.handleRealtimeInsert(trashItem);
            }
        },
        onDelete: (trashItem) => {
            console.log('Trash delete:', trashItem);
            // Передать событие в компонент корзины
            if (typeof TrashComponent !== 'undefined') {
                TrashComponent.handleRealtimeDelete(trashItem);
            }
        }
    });

    // Подписка на события чеклистов
    RealtimeService.subscribeToChecklist({
        onInsert: (checklistItem) => {
            console.log('Checklist insert:', checklistItem);
            // Обновить прогресс чеклиста на карточке
            if (typeof window.updateCardChecklistProgress === 'function') {
                window.updateCardChecklistProgress(checklistItem.card_id);
            }
            // Обновить чеклист в модальном окне, если открыт
            if (state.editMode && state.selectedCard === checklistItem.card_id) {
                if (typeof ChecklistComponent !== 'undefined') {
                    ChecklistComponent.loadItems();
                }
            }
        },
        onUpdate: (checklistItem) => {
            console.log('Checklist update:', checklistItem);
            // Обновить прогресс чеклиста на карточке
            if (typeof window.updateCardChecklistProgress === 'function') {
                window.updateCardChecklistProgress(checklistItem.card_id);
            }
            // Обновить чеклист в модальном окне, если открыт
            if (state.editMode && state.selectedCard === checklistItem.card_id) {
                if (typeof ChecklistComponent !== 'undefined') {
                    ChecklistComponent.loadItems();
                }
            }
        },
        onDelete: (checklistItem) => {
            console.log('Checklist delete:', checklistItem);
            // Обновить прогресс чеклиста на карточке
            if (typeof window.updateCardChecklistProgress === 'function') {
                window.updateCardChecklistProgress(checklistItem.card_id);
            }
            // Обновить чеклист в модальном окне, если открыт
            if (state.editMode && state.selectedCard === checklistItem.card_id) {
                if (typeof ChecklistComponent !== 'undefined') {
                    ChecklistComponent.loadItems();
                }
            }
        }
    });
}

// ============================================================
// INITIALIZATION
// ============================================================

// ============================================================
// LOAD PROFILES
// ============================================================

async function loadProfiles() {
    if (!state.user) {
        console.log('Пользователь не авторизован, профили не загружаются');
        return;
    }

    if (typeof ProfileService === 'undefined') {
        console.warn('ProfileService not available');
        return;
    }

    const { data: profiles, error } = await ProfileService.getAllProfiles();

    if (error) {
        console.error('Ошибка загрузки профилей:', error);
        return;
    }

    // Преобразовать массив профилей в объект { userId: profile }
    state.profiles = {};
    if (profiles && profiles.length > 0) {
        profiles.forEach(profile => {
            state.profiles[profile.user_id] = {
                nickname: profile.nickname,
                email: profile.email
            };
        });
    }

    console.log(`✅ Загружено профилей: ${profiles.length}`);
}

// Глобальная функция для перезагрузки профилей (используется из SettingsComponent)
window.reloadProfiles = async function() {
    await loadProfiles();

    // Обновить UI после загрузки профилей
    if (state.user && typeof AuthUI !== 'undefined') {
        await AuthUI.updateUIForAuthState(state.user);
    }

    // Перерендерить доску чтобы обновить никнеймы на карточках
    renderBoard();

    // Обновить фильтр пользователей
    await loadAndPopulateUsers();
};

// ============================================================
// LOAD AND POPULATE USERS
// ============================================================

async function loadAndPopulateUsers() {
    if (!state.user) {
        console.log('Пользователь не авторизован, список пользователей не загружается');
        return;
    }

    const { data: userIds, error } = await CardService.getUniqueUsers();

    if (error) {
        console.error('Ошибка загрузки пользователей:', error);
        return;
    }

    if (userIds && userIds.length > 0) {
        // Передать также профили для отображения никнеймов
        FiltersComponent.populateUserFilter(userIds, state.user.id, state.profiles);
    }

    console.log(`✅ Пользователи добавлены в фильтр`);
}

// ============================================================
// CHECKLIST PROGRESS
// ============================================================

/**
 * Загрузить прогресс чеклиста для карточки и отобразить его
 */
async function loadChecklistProgress(cardId) {
    if (typeof ChecklistService === 'undefined') return;
    if (!cardId || cardId === 'undefined') {
        console.warn('⚠️ loadChecklistProgress called with invalid cardId:', cardId);
        return;
    }

    const { data: items, error } = await ChecklistService.getChecklistItems(cardId);

    if (error) {
        console.error('Failed to load checklist items:', error);
        return;
    }

    updateChecklistProgressUI(cardId, items || []);
}

/**
 * Раскрыть чеклист карточки
 */
function expandChecklist(cardId) {
    expandedChecklists.expanded.add(cardId);

    // Очистить существующий таймер, если есть
    if (expandedChecklists.timers[cardId]) {
        clearTimeout(expandedChecklists.timers[cardId]);
    }

    // Установить таймер автосворачивания на 3 минуты
    expandedChecklists.timers[cardId] = setTimeout(() => {
        collapseChecklist(cardId);
    }, 3 * 60 * 1000); // 3 минуты

    // Перерисовать чеклист
    loadChecklistProgress(cardId);
}

/**
 * Свернуть чеклист карточки
 */
function collapseChecklist(cardId) {
    expandedChecklists.expanded.delete(cardId);

    // Очистить таймер
    if (expandedChecklists.timers[cardId]) {
        clearTimeout(expandedChecklists.timers[cardId]);
        delete expandedChecklists.timers[cardId];
    }

    // Перерисовать чеклист
    loadChecklistProgress(cardId);
}

/**
 * Переключить состояние раскрытия чеклиста
 */
function toggleChecklistExpansion(cardId) {
    if (expandedChecklists.expanded.has(cardId)) {
        collapseChecklist(cardId);
    } else {
        expandChecklist(cardId);
    }
}

/**
 * Обновить UI прогресса чеклиста на карточке
 */
function updateChecklistProgressUI(cardId, items) {
    const progressContainer = document.getElementById(`checklist-progress-${cardId}`);
    if (!progressContainer) return;

    // Очистить контейнер
    progressContainer.innerHTML = '';

    // Не показывать если нет пунктов
    if (!items || items.length === 0) return;

    const checklistWrapper = document.createElement('div');
    checklistWrapper.className = 'card-checklist-wrapper';

    // Проверить, раскрыт ли чеклист
    const isExpanded = expandedChecklists.expanded.has(cardId);

    // Заголовок с прогрессом
    const completed = items.filter(item => item.is_completed).length;
    const total = items.length;

    const headerDiv = document.createElement('div');
    headerDiv.className = 'card-checklist-header';
    if (completed === total) {
        headerDiv.classList.add('completed');
    }
    headerDiv.textContent = `✓ Чеклист: ${completed}/${total}`;
    checklistWrapper.appendChild(headerDiv);

    // Список пунктов
    const listDiv = document.createElement('div');
    listDiv.className = 'card-checklist-items';

    // Если раскрыто - показать все пункты с ограничением высоты
    if (isExpanded) {
        listDiv.classList.add('expanded');
    }

    // Определить какие пункты показывать
    const visibleItems = isExpanded ? items : items.slice(0, 3);

    visibleItems.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'card-checklist-item';
        if (item.is_completed) {
            itemDiv.classList.add('completed');
        }

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = item.is_completed;
        checkbox.className = 'checklist-checkbox';

        // Переключение статуса при клике
        checkbox.onclick = async (e) => {
            e.stopPropagation(); // Предотвратить открытие модального окна
            const newStatus = e.target.checked;
            await ChecklistService.toggleChecklistItem(item.id, newStatus);
            // UI обновится через Realtime подписку
        };

        const textSpan = document.createElement('span');
        textSpan.className = 'checklist-item-text';
        textSpan.textContent = item.text;

        itemDiv.appendChild(checkbox);
        itemDiv.appendChild(textSpan);
        listDiv.appendChild(itemDiv);
    });

    checklistWrapper.appendChild(listDiv);

    // Кнопка "Показать все" или "Свернуть"
    if (items.length > 3) {
        const toggleDiv = document.createElement('div');
        toggleDiv.className = 'card-checklist-toggle';

        if (isExpanded) {
            toggleDiv.textContent = '▲ Свернуть';
            toggleDiv.classList.add('collapse');
        } else {
            toggleDiv.textContent = `▼ Показать все (${items.length})`;
            toggleDiv.classList.add('expand');
        }

        toggleDiv.onclick = (e) => {
            e.stopPropagation(); // Предотвратить открытие модального окна
            toggleChecklistExpansion(cardId);
        };

        checklistWrapper.appendChild(toggleDiv);
    }

    progressContainer.appendChild(checklistWrapper);
}

/**
 * Глобальная функция для обновления прогресса чеклиста (вызывается из ChecklistComponent)
 */
window.updateCardChecklistProgress = async function(cardId) {
    await loadChecklistProgress(cardId);
};

// ============================================================
// APP INITIALIZATION
// ============================================================

async function initializeApp() {
    // Инициализация Supabase
    await initializeSupabase();

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
        const previousSelectedUser = state.filters.selectedUser;
        state.filters = filters;

        // Если изменился фильтр пользователя, перезагрузить карточки
        if (state.filters.selectedUser !== previousSelectedUser) {
            loadCardsFromSupabase();
        } else {
            // Просто перерендерить с новыми фильтрами/сортировкой
            renderBoard();
        }
    });

    // 3. Настройки профиля
    if (typeof SettingsComponent !== 'undefined') {
        SettingsComponent.init();
    }

    // 3.5. Корзина
    if (typeof TrashComponent !== 'undefined') {
        TrashComponent.init();
    }

    // 3.6. Массовое удаление
    if (typeof BulkDeleteComponent !== 'undefined') {
        BulkDeleteComponent.init();
    }

    // 4. Уведомления
    await NotificationsComponent.init();

    // Показать баннер если уведомления не включены
    if (!NotificationsComponent.notificationsEnabled &&
        'Notification' in window &&
        Notification.permission === 'default') {

        const banner = document.getElementById('notification-banner');
        if (banner) {
            banner.innerHTML = `
                <span>📢 Включите уведомления, чтобы не пропустить важные дедлайны</span>
                <button id="enable-notifications-btn" class="btn btn-primary"
                        style="margin-left: 12px; padding: 6px 12px; font-size: 0.875rem;">
                    Включить
                </button>
            `;
            banner.className = 'notification-banner info';
            banner.classList.remove('hidden');

            document.getElementById('enable-notifications-btn')?.addEventListener('click', async () => {
                const granted = await NotificationsComponent.requestPermission();
                if (granted) {
                    banner.classList.add('hidden');
                }
            });
        }
    }

    // 5. Drag & Drop
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
                return;
            }

            // Обновить локальное состояние немедленно (не ждать Realtime)
            if (data) {
                const index = state.cards.findIndex(c => c.id === cardId);
                if (index !== -1) {
                    const oldColumnId = state.cards[index].column_id;
                    state.cards[index] = data;

                    // Перерендерить обе колонки если карточка переместилась
                    if (oldColumnId !== newColumnId) {
                        renderColumn(oldColumnId);
                        updateCardCount(oldColumnId);
                    }
                    renderColumn(newColumnId);
                    updateCardCount(newColumnId);

                    // Обновить уведомления
                    const urgentCards = NotificationsComponent.getUrgentCards(state.cards);
                    if (urgentCards.length > 0) {
                        NotificationsComponent.updateNotificationBanner(urgentCards);
                    } else {
                        NotificationsComponent.hideNotificationBanner();
                    }
                }
            }
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
                    await loadProfiles();
                    await loadCardsFromSupabase();
                    await loadAndPopulateUsers();
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
        await loadProfiles();
        await loadCardsFromSupabase();
        await loadAndPopulateUsers();
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
