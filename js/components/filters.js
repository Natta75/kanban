// ============================================================
// FILTERS COMPONENT - Компонент фильтрации задач
// ============================================================

/**
 * Компонент для фильтрации задач по различным критериям
 */
const FiltersComponent = {
    // DOM элементы
    userFilter: null,
    priorityFilter: null,
    sortSelect: null,
    resetFiltersBtn: null,

    // Callback функция
    onFilterChangeCallback: null,

    // Текущие фильтры
    currentFilters: {
        selectedUser: 'my', // 'my', 'all', или конкретный user_id
        priority: null,
        sortOrder: null
    },

    /**
     * Инициализация компонента фильтров
     * @param {Function} onFilterChange - Callback функция, вызываемая при изменении фильтров
     */
    init(onFilterChange) {
        this.userFilter = document.getElementById('user-filter');
        this.priorityFilter = document.getElementById('priority-filter');
        this.sortSelect = document.getElementById('sort-select');
        this.resetFiltersBtn = document.getElementById('reset-filters');

        this.onFilterChangeCallback = onFilterChange;

        if (!this.userFilter || !this.priorityFilter || !this.sortSelect || !this.resetFiltersBtn) {
            console.warn('Некоторые элементы фильтров не найдены');
            return;
        }

        // Подписка на события
        this.userFilter.addEventListener('change', () => {
            this.handleUserFilterChange();
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
     * Обработка изменения фильтра пользователей
     */
    handleUserFilterChange() {
        this.currentFilters.selectedUser = this.userFilter.value;

        console.log(`🔧 Фильтр пользователей: ${this.currentFilters.selectedUser}`);

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
        if (this.userFilter) {
            this.userFilter.value = 'my';
        }

        if (this.priorityFilter) {
            this.priorityFilter.value = '';
        }

        if (this.sortSelect) {
            this.sortSelect.value = '';
        }

        // Сбросить состояние
        this.currentFilters = {
            selectedUser: 'my',
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

        // Фильтр по пользователю
        if (filters.selectedUser === 'my' && currentUserId) {
            // Показать только свои задачи
            filtered = filtered.filter(card => card.user_id === currentUserId);
        } else if (filters.selectedUser !== 'all') {
            // Показать задачи конкретного пользователя
            filtered = filtered.filter(card => card.user_id === filters.selectedUser);
        }
        // Если 'all' - показываем все, не фильтруем

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
     * Добавить пользователей в выпадающий список
     * @param {Array} userIds - Массив ID пользователей
     * @param {string} currentUserId - ID текущего пользователя
     */
    populateUserFilter(userIds, currentUserId) {
        if (!this.userFilter) return;

        // Сохраняем текущее значение
        const currentValue = this.userFilter.value;

        // Очищаем опции кроме базовых
        this.userFilter.innerHTML = `
            <option value="my">👤 Только мои задачи</option>
            <option value="all">👥 Все задачи</option>
        `;

        // Добавляем других пользователей
        userIds.forEach(userId => {
            if (userId !== currentUserId) {
                const option = document.createElement('option');
                option.value = userId;
                // Показываем первые 8 символов ID для идентификации
                option.textContent = `👨‍💼 Пользователь ${userId.substring(0, 8)}...`;
                this.userFilter.appendChild(option);
            }
        });

        // Восстанавливаем выбранное значение если оно еще существует
        if (Array.from(this.userFilter.options).some(opt => opt.value === currentValue)) {
            this.userFilter.value = currentValue;
        }

        console.log(`✅ Добавлено пользователей в фильтр: ${userIds.length}`);
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
