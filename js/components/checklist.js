// ============================================================
// CHECKLIST COMPONENT - Компонент чеклиста
// ============================================================

/**
 * Компонент для управления чеклистом в карточке
 */
const ChecklistComponent = {
    // Текущая карточка
    currentCardId: null,
    items: [],

    // Режим новой карточки (пункты хранятся локально)
    isNewCard: false,
    tempItems: [], // Временные пункты для новой карточки

    // DOM элементы
    container: null,
    listElement: null,
    inputElement: null,
    addButton: null,

    /**
     * Инициализация компонента
     * @param {string} containerId - ID контейнера для чеклиста
     */
    init(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Checklist container ${containerId} not found`);
            return;
        }
        console.log('✅ Checklist component инициализирован');
    },

    /**
     * Отрендерить чеклист для карточки
     * @param {string|null} cardId - ID карточки (null для новой карточки)
     * @param {HTMLElement} container - Контейнер для чеклиста
     * @param {boolean} isNewCard - Флаг новой карточки
     */
    async render(cardId, container, isNewCard = false) {
        this.currentCardId = cardId;
        this.container = container;
        this.isNewCard = isNewCard;

        if (!this.container) {
            console.error('Container not provided');
            return;
        }

        // Если новая карточка - инициализировать пустой массив
        if (this.isNewCard) {
            this.tempItems = [];
        }

        // Очистить контейнер
        this.container.innerHTML = '';

        // Создать структуру чеклиста
        const checklistWrapper = document.createElement('div');
        checklistWrapper.className = 'checklist-wrapper';

        // Заголовок
        const header = document.createElement('div');
        header.className = 'checklist-header';
        header.innerHTML = '<h3>Чеклист</h3>';
        checklistWrapper.appendChild(header);

        // Список пунктов
        this.listElement = document.createElement('div');
        this.listElement.className = 'checklist-items';
        checklistWrapper.appendChild(this.listElement);

        // Форма добавления нового пункта
        const addForm = document.createElement('div');
        addForm.className = 'checklist-add-form';

        this.inputElement = document.createElement('input');
        this.inputElement.type = 'text';
        this.inputElement.className = 'checklist-input';
        this.inputElement.placeholder = 'Добавить пункт...';
        this.inputElement.maxLength = 200;

        this.addButton = document.createElement('button');
        this.addButton.className = 'btn btn-primary checklist-add-btn';
        this.addButton.textContent = 'Добавить';
        this.addButton.onclick = () => this.handleAddItem();

        // Enter для добавления
        this.inputElement.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleAddItem();
            }
        });

        addForm.appendChild(this.inputElement);
        addForm.appendChild(this.addButton);
        checklistWrapper.appendChild(addForm);

        this.container.appendChild(checklistWrapper);

        // Загрузить и отобразить пункты
        await this.loadItems();
    },

    /**
     * Загрузить пункты чеклиста
     */
    async loadItems() {
        // Для новой карточки использовать временные пункты
        if (this.isNewCard) {
            this.items = this.tempItems;
            this.renderItems();
            return;
        }

        if (!this.currentCardId) return;

        const { data, error } = await ChecklistService.getChecklistItems(this.currentCardId);

        if (error) {
            console.error('Failed to load checklist items:', error);
            return;
        }

        this.items = data || [];
        this.renderItems();
    },

    /**
     * Отрендерить список пунктов
     */
    renderItems() {
        if (!this.listElement) return;

        this.listElement.innerHTML = '';

        if (this.items.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'checklist-empty';
            emptyMessage.textContent = 'Нет пунктов в чеклисте';
            this.listElement.appendChild(emptyMessage);
            return;
        }

        this.items.forEach(item => {
            const itemElement = this.createItemElement(item);
            this.listElement.appendChild(itemElement);
        });
    },

    /**
     * Создать элемент пункта чеклиста
     * @param {Object} item - Пункт чеклиста
     * @returns {HTMLElement}
     */
    createItemElement(item) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'checklist-item';
        if (item.is_completed) {
            itemDiv.classList.add('completed');
        }

        // Чекбокс
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'checklist-checkbox';
        checkbox.checked = item.is_completed;
        checkbox.onchange = () => this.handleToggleItem(item.id, checkbox.checked);

        // Текст пункта
        const textSpan = document.createElement('span');
        textSpan.className = 'checklist-item-text';
        textSpan.textContent = item.text;

        // Кнопка удаления
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'checklist-delete-btn';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.title = 'Удалить пункт';
        deleteBtn.onclick = () => this.handleDeleteItem(item.id);

        itemDiv.appendChild(checkbox);
        itemDiv.appendChild(textSpan);
        itemDiv.appendChild(deleteBtn);

        return itemDiv;
    },

    /**
     * Обработка добавления нового пункта
     */
    async handleAddItem() {
        if (!this.inputElement) return;

        const text = this.inputElement.value.trim();

        if (!text) {
            return;
        }

        // Валидация
        const validation = ChecklistService.validateItemText(text);
        if (!validation.valid) {
            alert(validation.error);
            return;
        }

        // Для новой карточки - добавить в временный массив
        if (this.isNewCard) {
            const tempItem = {
                id: 'temp-' + Date.now(),
                text: text,
                is_completed: false,
                position: this.tempItems.length
            };
            this.tempItems.push(tempItem);
            this.items = this.tempItems;
            this.inputElement.value = '';
            this.renderItems();
            return;
        }

        // Для существующей карточки - сохранить в БД
        if (!this.currentCardId) return;

        // Отключить кнопку
        this.setAddButtonLoading(true);

        const { data, error } = await ChecklistService.addChecklistItem(this.currentCardId, text);

        if (error) {
            alert('Не удалось добавить пункт: ' + error.message);
            this.setAddButtonLoading(false);
            return;
        }

        // Очистить поле ввода
        this.inputElement.value = '';

        // Обновить список
        this.items.push(data);
        this.renderItems();
        this.setAddButtonLoading(false);

        // Обновить прогресс на карточке
        this.notifyProgressUpdate();
    },

    /**
     * Обработка переключения статуса пункта
     * @param {string} itemId - ID пункта
     * @param {boolean} isCompleted - Новый статус
     */
    async handleToggleItem(itemId, isCompleted) {
        // Для новой карточки - обновить локально
        if (this.isNewCard) {
            const item = this.tempItems.find(i => i.id === itemId);
            if (item) {
                item.is_completed = isCompleted;
                // Пересортировать локально
                this.tempItems = [
                    ...this.tempItems.filter(i => !i.is_completed),
                    ...this.tempItems.filter(i => i.is_completed)
                ];
                this.items = this.tempItems;
                this.renderItems();
            }
            return;
        }

        const { error } = await ChecklistService.toggleChecklistItem(itemId, isCompleted);

        if (error) {
            console.error('Failed to toggle checklist item:', error);
            // Перезагрузить список для отката изменений
            await this.loadItems();
            return;
        }

        // Обновить локальный список
        const item = this.items.find(i => i.id === itemId);
        if (item) {
            item.is_completed = isCompleted;
        }

        // Перерендерить (триггер на БД автоматически пересортирует)
        // Небольшая задержка для корректной сортировки
        setTimeout(() => this.loadItems(), 300);

        // Обновить прогресс на карточке
        this.notifyProgressUpdate();
    },

    /**
     * Обработка удаления пункта
     * @param {string} itemId - ID пункта
     */
    async handleDeleteItem(itemId) {
        const confirmed = confirm('Удалить этот пункт?');
        if (!confirmed) return;

        // Для новой карточки - удалить локально
        if (this.isNewCard) {
            this.tempItems = this.tempItems.filter(i => i.id !== itemId);
            this.items = this.tempItems;
            this.renderItems();
            return;
        }

        const { error } = await ChecklistService.deleteChecklistItem(itemId);

        if (error) {
            alert('Не удалось удалить пункт: ' + error.message);
            return;
        }

        // Удалить из локального списка
        this.items = this.items.filter(i => i.id !== itemId);
        this.renderItems();

        // Обновить прогресс на карточке
        this.notifyProgressUpdate();
    },

    /**
     * Установить состояние загрузки для кнопки добавления
     * @param {boolean} isLoading
     */
    setAddButtonLoading(isLoading) {
        if (!this.addButton || !this.inputElement) return;

        this.addButton.disabled = isLoading;
        this.inputElement.disabled = isLoading;

        if (isLoading) {
            this.addButton.textContent = 'Добавление...';
        } else {
            this.addButton.textContent = 'Добавить';
        }
    },

    /**
     * Уведомить о изменении прогресса чеклиста
     */
    notifyProgressUpdate() {
        // Отправить событие для обновления карточки на доске
        if (this.currentCardId && typeof window.updateCardChecklistProgress === 'function') {
            window.updateCardChecklistProgress(this.currentCardId);
        }
    },

    /**
     * Получить прогресс чеклиста
     * @returns {{completed: number, total: number}}
     */
    getProgress() {
        const total = this.items.length;
        const completed = this.items.filter(item => item.is_completed).length;
        return { completed, total };
    },

    /**
     * Получить временные пункты для новой карточки
     * @returns {Array} Массив временных пунктов
     */
    getTempItems() {
        return this.tempItems.map(item => ({
            text: item.text,
            is_completed: item.is_completed,
            position: item.position
        }));
    },

    /**
     * Очистить компонент
     */
    clear() {
        this.currentCardId = null;
        this.items = [];
        this.isNewCard = false;
        this.tempItems = [];
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
};
