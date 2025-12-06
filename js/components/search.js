// ============================================================
// SEARCH COMPONENT - Компонент поиска задач
// ============================================================

/**
 * Компонент для поиска задач по названию и описанию
 */
const SearchComponent = {
    searchInput: null,
    debounceTimer: null,
    onSearchCallback: null,

    /**
     * Инициализация компонента поиска
     * @param {Function} onSearch - Callback функция, вызываемая при поиске
     */
    init(onSearch) {
        this.searchInput = document.getElementById('search-input');
        this.onSearchCallback = onSearch;

        if (!this.searchInput) {
            console.warn('Search input не найден');
            return;
        }

        // Подписка на события ввода с debounce
        this.searchInput.addEventListener('input', (e) => {
            this.handleSearchInput(e.target.value);
        });

        // Подписка на событие очистки поля (для браузеров с кнопкой X)
        this.searchInput.addEventListener('search', (e) => {
            if (e.target.value === '') {
                this.clearSearch();
            }
        });

        console.log('✅ Search component инициализирован');
    },

    /**
     * Обработка ввода в поле поиска с debounce
     * @param {string} searchQuery - Поисковый запрос
     */
    handleSearchInput(searchQuery) {
        // Очистить предыдущий таймер
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Установить новый таймер с задержкой
        this.debounceTimer = setTimeout(() => {
            this.performSearch(searchQuery);
        }, CONFIG.SEARCH_DEBOUNCE_MS);
    },

    /**
     * Выполнить поиск
     * @param {string} searchQuery - Поисковый запрос
     */
    performSearch(searchQuery) {
        const query = searchQuery.trim().toLowerCase();

        console.log(`🔍 Поиск: "${query}"`);

        if (this.onSearchCallback) {
            this.onSearchCallback(query);
        }
    },

    /**
     * Очистить поиск
     */
    clearSearch() {
        if (this.searchInput) {
            this.searchInput.value = '';
        }

        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        console.log('🔍 Поиск очищен');

        if (this.onSearchCallback) {
            this.onSearchCallback('');
        }
    },

    /**
     * Получить текущее значение поиска
     * @returns {string}
     */
    getSearchQuery() {
        return this.searchInput ? this.searchInput.value.trim().toLowerCase() : '';
    },

    /**
     * Фильтрация карточек по поисковому запросу
     * @param {Array} cards - Массив карточек
     * @param {string} searchQuery - Поисковый запрос
     * @returns {Array} Отфильтрованные карточки
     */
    filterCards(cards, searchQuery) {
        if (!searchQuery) {
            return cards;
        }

        const query = searchQuery.toLowerCase();

        return cards.filter(card => {
            const titleMatch = card.title.toLowerCase().includes(query);
            const descriptionMatch = card.description && card.description.toLowerCase().includes(query);

            return titleMatch || descriptionMatch;
        });
    },

    /**
     * Установить фокус на поле поиска
     */
    focus() {
        if (this.searchInput) {
            this.searchInput.focus();
        }
    }
};
