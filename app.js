// ============================================================
// STATE MANAGEMENT
// ============================================================

const state = {
    cards: [],
    selectedCard: null,
    editMode: false,
    currentColumnForNewCard: null
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
    return state.cards.filter(card => card.columnId === columnId);
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
// CARD CRUD OPERATIONS
// ============================================================

function addCard(columnId, title, description) {
    const newCard = {
        id: generateId(),
        title: title.trim(),
        description: description.trim(),
        columnId,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    state.cards.push(newCard);
    saveToStorage();
    renderColumn(columnId);
    updateCardCount(columnId);
}

function updateCard(cardId, title, description) {
    const card = findCardById(cardId);
    if (!card) return;

    card.title = title.trim();
    card.description = description.trim();
    card.updatedAt = Date.now();

    saveToStorage();
    renderColumn(card.columnId);
}

function deleteCard(cardId) {
    const card = findCardById(cardId);
    if (!card) return;

    const confirmed = confirm('Вы уверены, что хотите удалить эту задачу?');
    if (!confirmed) return;

    const columnId = card.columnId;
    state.cards = state.cards.filter(c => c.id !== cardId);

    saveToStorage();
    renderColumn(columnId);
    updateCardCount(columnId);
}

function moveCard(cardId, direction) {
    const card = findCardById(cardId);
    if (!card) return;

    const currentIndex = getColumnIndex(card.columnId);
    const newIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;

    if (newIndex < 0 || newIndex >= COLUMN_ORDER.length) return;

    const oldColumnId = card.columnId;
    const newColumnId = COLUMN_ORDER[newIndex];

    card.columnId = newColumnId;
    card.updatedAt = Date.now();

    saveToStorage();
    renderColumn(oldColumnId);
    renderColumn(newColumnId);
    updateCardCount(oldColumnId);
    updateCardCount(newColumnId);
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

    const titleDiv = document.createElement('div');
    titleDiv.className = 'card-title';
    titleDiv.textContent = card.title;

    const descriptionDiv = document.createElement('div');
    descriptionDiv.className = 'card-description';
    descriptionDiv.textContent = card.description;

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
    moveLeftBtn.disabled = !canMoveLeft(card.columnId);

    // Кнопка перемещения вправо
    const moveRightBtn = document.createElement('button');
    moveRightBtn.className = 'card-btn btn-move';
    moveRightBtn.textContent = 'Далее →';
    moveRightBtn.onclick = () => moveCard(card.id, 'right');
    moveRightBtn.disabled = !canMoveRight(card.columnId);

    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(deleteBtn);
    if (canMoveLeft(card.columnId)) {
        actionsDiv.appendChild(moveLeftBtn);
    }
    if (canMoveRight(card.columnId)) {
        actionsDiv.appendChild(moveRightBtn);
    }

    cardDiv.appendChild(titleDiv);
    cardDiv.appendChild(descriptionDiv);
    cardDiv.appendChild(actionsDiv);

    return cardDiv;
}

function renderBoard() {
    COLUMN_ORDER.forEach(columnId => {
        renderColumn(columnId);
    });
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

    modalTitle.textContent = 'Новая задача';
    titleInput.value = '';
    descriptionInput.value = '';

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

    modalTitle.textContent = 'Редактировать задачу';
    titleInput.value = card.title;
    descriptionInput.value = card.description;

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

    const title = titleInput.value.trim();
    const description = descriptionInput.value.trim();

    if (!title) {
        alert('Пожалуйста, введите название задачи');
        titleInput.focus();
        return;
    }

    if (state.editMode && state.selectedCard) {
        updateCard(state.selectedCard, title, description);
    } else if (state.currentColumnForNewCard) {
        addCard(state.currentColumnForNewCard, title, description);
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
// INITIALIZATION
// ============================================================

function initializeApp() {
    loadFromStorage();
    renderBoard();
    initializeEventListeners();

    console.log('Kanban Board инициализирован');
    console.log(`Загружено карточек: ${state.cards.length}`);
}

// Запуск приложения при загрузке страницы
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
