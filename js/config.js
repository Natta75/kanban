// ============================================================
// CONFIGURATION
// ============================================================

const CONFIG = {
    // Supabase credentials (будут заполнены пользователем)
    SUPABASE_URL: '', // Заполните из вашего Supabase проекта
    SUPABASE_ANON_KEY: '', // Заполните из вашего Supabase проекта

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
    MAX_DESCRIPTION_LENGTH: 500
};

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
