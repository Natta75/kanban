// ============================================================
// CONFIGURATION
// ============================================================

const CONFIG = {
    // Supabase credentials (через reverse proxy для обхода блокировок)
    SUPABASE_URL: 'https://api.75vibe-coding.ru',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bmx0aGZzeHRyZHN3cXJpYWFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NzcxNzUsImV4cCI6MjA4MDI1MzE3NX0.amhB5yNMbrPUn3D0WtYQXwh65t4dFMt4SeUnk8QSRWI',

    // Префикс для таблиц (для изоляции от других приложений в том же проекте)
    TABLE_PREFIX: 'kanban_',

    // Колонки канбан-доски
    COLUMNS: {
        TODO: 'todo',
        IN_PROGRESS: 'inProgress',
        DONE: 'done'
    },

    // Порядок колонок
    COLUMN_ORDER: ['todo', 'inProgress', 'done'],

    // Названия колонок
    COLUMN_NAMES: {
        todo: 'To Do',
        inProgress: 'In Progress',
        done: 'Done'
    },

    // Приоритеты задач
    PRIORITIES: {
        LOW: 'low',
        MEDIUM: 'medium',
        HIGH: 'high'
    },

    // Цвета приоритетов
    PRIORITY_COLORS: {
        low: '#4CAF50',    // Зелёный
        medium: '#FF9800', // Оранжевый
        high: '#f44336'    // Красный
    },

    // Настройки уведомлений
    NOTIFICATION_THRESHOLD_DAYS: 1, // За сколько дней до дедлайна показывать уведомления

    // Настройки поиска
    SEARCH_DEBOUNCE_MS: 300, // Задержка перед поиском (мс)

    // Настройки realtime
    REALTIME_THROTTLE_MS: 1000, // Минимальный интервал между обновлениями (мс)

    // Лимиты
    MAX_TITLE_LENGTH: 100,
    MAX_DESCRIPTION_LENGTH: 500,

    // Имена таблиц (с префиксом)
    TABLES: {
        CARDS: 'kanban_cards',
        USER_PREFERENCES: 'kanban_user_preferences',
        TRASH: 'kanban_trash'
    }
};

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
