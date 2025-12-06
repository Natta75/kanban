// ============================================================
// FILTERS COMPONENT - Компонент фильтрации задач
// ============================================================

/**
 * Компонент для фильтрации задач по различным критериям
 */
const FiltersComponent = {
    // DOM элементы
    showAllTasksCheckbox: null,
    priorityFilter: null,
    sortSelect: null,
    resetFiltersBtn: null,

    // Callback функция
    onFilterChangeCallback: null,

    // Текущие фильтры
    currentFilters: {
        showAllTasks: false,
        priority: null,
        sortOrder: null
    },

    /**
     * Инициализация компонента фильтров
     * @param {Function} onFilterChange - Callback функция, вызываемая при изменении фильтров
     */
    init(onFilterChange) {
        this.showAllTasksCheckbox = document.getElementById('show-all-tasks');
        this.priorityFilter = document.getElementById('priority-filter');
        this.sortSelect = document.getElementById('sort-select');
        this.resetFiltersBtn = document.getElementById('reset-filters');

        this.onFilterChangeCallback = onFilterChange;

        if (!this.showAllTasksCheckbox || !this.priorityFilter || !this.sortSelect || !this.resetFiltersBtn) {
            console.warn('Некоторые элементы фильтров не найдены');
            return;
        }

        // Подписка на события
        this.showAllTasksCheckbox.addEventListener('change', () => {
            this.handleShowAllTasksChange();
        });

        this.priorityFilter.addEventListener('change', () => {
            this.handlePriorityFilterChange();
        });

        this.sortSelect.addEventListener('change', () => {
            this.handleSortChange();
        });

        this.resetFiltersBtn.addEventListener('click', () => {
            this.resetFilters();
        });

        console.log('✅ Filters component инициализирован');
    },

    /**
     * Обработка изменения чекбокса "Показать все задачи"
     */
    handleShowAllTasksChange() {
        this.currentFilters.showAllTasks = this.showAllTasksCheckbox.checked;

        console.log(`🔧 Показать все задачи: ${this.currentFilters.showAllTasks}`);

        this.notifyFilterChange();
    },

    /**
     * Обработка изменения фильтра приоритета
     */
    handlePriorityFilterChange() {
        const value = this.priorityFilter.value;
        this.currentFilters.priority = value === '' ? null : value;

        console.log(`🔧 Фильтр по приоритету: ${this.currentFilters.priority || 'все'}`);

        this.notifyFilterChange();
    },

    /**
     * Обработка изменения сортировки
     */
    handleSortChange() {
        const value = this.sortSelect.value;
        this.currentFilters.sortOrder = value === '' ? null : value;

        console.log(`🔧 Сортировка: ${this.currentFilters.sortOrder || 'нет'}`);

        this.notifyFilterChange();
    },

    /**
     * Уведомить о изменении фильтров
     */
    notifyFilterChange() {
        if (this.onFilterChangeCallback) {
            this.onFilterChangeCallback(this.currentFilters);
        }
    },

    /**
     * Сбросить все фильтры
     */
    resetFilters() {
        // Сбросить UI
        if (this.showAllTasksCheckbox) {
            this.showAllTasksCheckbox.checked = false;
        }

        if (this.priorityFilter) {
            this.priorityFilter.value = '';
        }

        if (this.sortSelect) {
            this.sortSelect.value = '';
        }

        // Сбросить состояние
        this.currentFilters = {
            showAllTasks: false,
            priority: null,
            sortOrder: null
        };

        console.log('🔧 Фильтры сброшены');

        this.notifyFilterChange();
    },

    /**
     * Получить текущие фильтры
     * @returns {Object}
     */
    getCurrentFilters() {
        return { ...this.currentFilters };
    },

    /**
     * Применить фильтры к массиву карточек
     * @param {Array} cards - Массив карточек
     * @param {Object} filters - Объект фильтров
     * @param {string|null} currentUserId - ID текущего пользователя
     * @returns {Array} Отфильтрованные карточки
     */
    applyFilters(cards, filters, currentUserId) {
        let filtered = [...cards];

        // Фильтр по пользователю (показать только свои или все)
        if (!filters.showAllTasks && currentUserId) {
            filtered = filtered.filter(card => card.user_id === currentUserId);
        }

        // Фильтр по приоритету
        if (filters.priority) {
            filtered = filtered.filter(card => card.priority === filters.priority);
        }

        // Сортировка
        if (filters.sortOrder) {
            filtered = this.sortCards(filtered, filters.sortOrder);
        }

        return filtered;
    },

    /**
     * Сортировка карточек
     * @param {Array} cards - Массив карточек
     * @param {string} sortOrder - Порядок сортировки
     * @returns {Array} Отсортированные карточки
     */
    sortCards(cards, sortOrder) {
        const sorted = [...cards];

        switch (sortOrder) {
            case 'deadline-asc':
                // Сначала ближайшие дедлайны
                return sorted.sort((a, b) => {
                    if (!a.end_date && !b.end_date) return 0;
                    if (!a.end_date) return 1; // Карточки без дедлайна в конец
                    if (!b.end_date) return -1;
                    return new Date(a.end_date) - new Date(b.end_date);
                });

            case 'deadline-desc':
                // Сначала дальние дедлайны
                return sorted.sort((a, b) => {
                    if (!a.end_date && !b.end_date) return 0;
                    if (!a.end_date) return 1; // Карточки без дедлайна в конец
                    if (!b.end_date) return -1;
                    return new Date(b.end_date) - new Date(a.end_date);
                });

            case 'priority':
                // По приоритету: высокий -> средний -> низкий
                const priorityOrder = { high: 0, medium: 1, low: 2 };
                return sorted.sort((a, b) => {
                    const aPriority = priorityOrder[a.priority] ?? 3;
                    const bPriority = priorityOrder[b.priority] ?? 3;
                    return aPriority - bPriority;
                });

            default:
                return sorted;
        }
    },

    /**
     * Установить состояние фильтра "Показать все задачи"
     * @param {boolean} showAll
     */
    setShowAllTasks(showAll) {
        this.currentFilters.showAllTasks = showAll;

        if (this.showAllTasksCheckbox) {
            this.showAllTasksCheckbox.checked = showAll;
        }
    },

    /**
     * Получить количество активных фильтров
     * @returns {number}
     */
    getActiveFiltersCount() {
        let count = 0;

        if (this.currentFilters.priority !== null) {
            count++;
        }

        // showAllTasks не считаем как фильтр, это переключатель режима

        return count;
    },

    /**
     * Обновить индикатор активных фильтров (badge)
     */
    updateFilterBadge() {
        const count = this.getActiveFiltersCount();
        const badge = document.getElementById('filter-badge');

        if (badge) {
            if (count > 0) {
                badge.textContent = count;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    }
};
