// ============================================================
// DRAG & DROP COMPONENT - SortableJS Integration
// ============================================================

/**
 * Компонент для управления drag & drop карточек между колонками
 */
const DragDropComponent = {
    sortableInstances: [],
    onMoveCardCallback: null,
    isDragging: false,

    /**
     * Инициализация drag & drop для всех колонок
     * @param {Function} onMoveCard - Callback функция при перемещении карточки (cardId, newColumnId, newPosition)
     */
    init(onMoveCard) {
        this.onMoveCardCallback = onMoveCard;

        // Проверить доступность SortableJS
        if (typeof Sortable === 'undefined') {
            console.warn('⚠️ SortableJS не загружен. Drag & Drop недоступен.');
            return;
        }

        // Найти все контейнеры с карточками
        const containers = document.querySelectorAll('.cards-container');

        if (containers.length === 0) {
            console.warn('⚠️ Контейнеры для карточек не найдены');
            return;
        }

        // Инициализировать SortableJS для каждого контейнера
        containers.forEach(container => {
            this.initializeContainer(container);
        });

        console.log(`✅ Drag & Drop инициализирован для ${containers.length} колонок`);
    },

    /**
     * Инициализация SortableJS для одного контейнера
     * @param {HTMLElement} container - DOM элемент контейнера
     */
    initializeContainer(container) {
        const sortable = new Sortable(container, {
            // Группировка: карточки могут перемещаться между всеми колонками
            group: 'kanban-board',

            // Анимация при перемещении (мс)
            animation: 150,

            // CSS класс для ghost элемента (элемент на оригинальной позиции)
            ghostClass: 'card-ghost',

            // CSS класс для перетаскиваемого элемента
            dragClass: 'card-dragging',

            // CSS класс для выбранного элемента
            chosenClass: 'card-chosen',

            // Поддержка touch устройств
            touchStartThreshold: 3, // Минимальное движение для начала drag (px)
            forceFallback: false,   // Использовать нативный HTML5 drag & drop где возможно

            // Фильтр: не дублировать перетаскивание на кнопках и заблокировать чужие карточки
            filter: function(evt, target) {
                // Блокировать кнопки и инпуты
                if (target.matches('.card-btn, button, input, select, textarea')) {
                    return true;
                }

                // Блокировать чужие карточки
                const card = target.closest('.card');
                if (card && card.dataset.isOwner === 'false') {
                    console.warn('⛔ Нельзя перемещать чужие карточки');
                    return true; // Блокировать drag
                }

                return false; // Разрешить drag
            },

            // Handle: вся карточка является областью для drag
            handle: '.card',

            // Задержка перед началом drag (для touch устройств)
            delay: 0,
            delayOnTouchOnly: true,

            // Курсор при drag
            cursor: 'grabbing',

            // События
            onStart: (evt) => {
                this.isDragging = true;
                console.log('🖱️ Начало перетаскивания');
            },

            onEnd: async (evt) => {
                this.isDragging = false;

                // Получить данные о перемещении
                const cardElement = evt.item;
                const cardId = cardElement.dataset.cardId;
                const newContainer = evt.to;
                const newColumnId = newContainer.id.replace('-cards', '');
                const newPosition = evt.newIndex;
                const oldColumnId = evt.from.id.replace('-cards', '');

                console.log(`🖱️ Карточка ${cardId} перемещена: ${oldColumnId} → ${newColumnId}, позиция ${newPosition}`);

                // Если карточка перемещена в другую колонку или изменилась позиция
                if (oldColumnId !== newColumnId || evt.oldIndex !== evt.newIndex) {
                    // Вызвать callback для обновления на сервере
                    if (this.onMoveCardCallback) {
                        await this.onMoveCardCallback(cardId, newColumnId, newPosition);
                    }
                }
            },

            // Дополнительные события для визуального feedback
            onChange: (evt) => {
                console.log('🔄 Позиция изменена');
            }
        });

        // Сохранить экземпляр для возможности destroy
        this.sortableInstances.push({
            container: container,
            sortable: sortable
        });
    },

    /**
     * Переинициализировать drag & drop (после рендеринга)
     */
    reinitialize() {
        // Уничтожить старые экземпляры
        this.destroy();

        // Создать новые
        if (this.onMoveCardCallback) {
            this.init(this.onMoveCardCallback);
        }
    },

    /**
     * Уничтожить все экземпляры SortableJS
     */
    destroy() {
        this.sortableInstances.forEach(({ sortable }) => {
            if (sortable) {
                sortable.destroy();
            }
        });

        this.sortableInstances = [];
        console.log('🗑️ Drag & Drop уничтожен');
    },

    /**
     * Включить drag & drop
     */
    enable() {
        this.sortableInstances.forEach(({ sortable }) => {
            if (sortable) {
                sortable.option('disabled', false);
            }
        });
        console.log('✅ Drag & Drop включен');
    },

    /**
     * Отключить drag & drop
     */
    disable() {
        this.sortableInstances.forEach(({ sortable }) => {
            if (sortable) {
                sortable.option('disabled', true);
            }
        });
        console.log('⏸️ Drag & Drop отключен');
    },

    /**
     * Проверить, идет ли сейчас перетаскивание
     * @returns {boolean}
     */
    isDraggingNow() {
        return this.isDragging;
    }
};
