// ============================================================
// DATE UTILITIES - Утилиты для работы с датами
// ============================================================

/**
 * Утилиты для форматирования и работы с датами задач
 */
const DateUtils = {
    /**
     * Форматирование даты в читаемый вид
     * @param {string|Date} date - Дата для форматирования
     * @returns {string} Отформатированная дата (например, "15 дек 2024")
     */
    formatDate(date) {
        if (!date) return '';

        const dateObj = typeof date === 'string' ? new Date(date) : date;

        // Проверка валидности даты
        if (isNaN(dateObj.getTime())) return '';

        const months = [
            'янв', 'фев', 'мар', 'апр', 'май', 'июн',
            'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'
        ];

        const day = dateObj.getDate();
        const month = months[dateObj.getMonth()];
        const year = dateObj.getFullYear();

        return `${day} ${month} ${year}`;
    },

    /**
     * Форматирование даты для input type="date" (YYYY-MM-DD)
     * @param {string|Date} date - Дата для форматирования
     * @returns {string} Дата в формате YYYY-MM-DD
     */
    formatDateForInput(date) {
        if (!date) return '';

        const dateObj = typeof date === 'string' ? new Date(date) : date;

        if (isNaN(dateObj.getTime())) return '';

        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    },

    /**
     * Проверка, просрочена ли задача
     * @param {string|Date} endDate - Дата окончания
     * @param {string|null} columnId - ID колонки (для проверки Done)
     * @returns {boolean} true если задача просрочена
     */
    isOverdue(endDate, columnId = null) {
        if (!endDate) return false;

        // Карточки в Done не просрочены
        if (columnId === CONFIG.COLUMNS.DONE) {
            return false;
        }

        const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
        const now = new Date();

        // Сбрасываем время для корректного сравнения дат
        end.setHours(0, 0, 0, 0);
        now.setHours(0, 0, 0, 0);

        return end < now;
    },

    /**
     * Количество дней до дедлайна
     * @param {string|Date} endDate - Дата окончания
     * @returns {number} Количество дней (отрицательное если просрочено)
     */
    daysUntilDeadline(endDate) {
        if (!endDate) return null;

        const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
        const now = new Date();

        // Сбрасываем время
        end.setHours(0, 0, 0, 0);
        now.setHours(0, 0, 0, 0);

        const diffTime = end - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return diffDays;
    },

    /**
     * Проверка, приближается ли дедлайн (1-3 дня)
     * @param {string|Date} endDate - Дата окончания
     * @returns {boolean} true если дедлайн приближается
     */
    isApproachingDeadline(endDate) {
        if (!endDate) return false;

        const days = this.daysUntilDeadline(endDate);

        // Дедлайн приближается если от 0 до 3 дней (включительно)
        return days !== null && days >= 0 && days <= CONFIG.NOTIFICATION_THRESHOLD_DAYS;
    },

    /**
     * Получить текстовое описание статуса дедлайна
     * @param {string|Date} endDate - Дата окончания
     * @param {string|null} columnId - ID колонки (для проверки Done)
     * @returns {string} Описание статуса ("Просрочено", "Сегодня", "Завтра", "3 дня")
     */
    getDeadlineStatus(endDate, columnId = null) {
        if (!endDate) return '';

        // Карточки в Done всегда "Выполнено"
        if (columnId === CONFIG.COLUMNS.DONE) {
            return 'Выполнено';
        }

        const days = this.daysUntilDeadline(endDate);

        if (days === null) return '';
        if (days < 0) return 'Просрочено';
        if (days === 0) return 'Сегодня';
        if (days === 1) return 'Завтра';
        if (days <= 7) return `${days} дн.`;

        return this.formatDate(endDate);
    },

    /**
     * Получить CSS класс для статуса дедлайна
     * @param {string|Date} endDate - Дата окончания
     * @param {string|null} columnId - ID колонки (для проверки Done)
     * @returns {string} CSS класс ('overdue', 'approaching', 'completed', '')
     */
    getDeadlineClass(endDate, columnId = null) {
        if (!endDate) return '';

        // Карточки в Done получают класс 'completed'
        if (columnId === CONFIG.COLUMNS.DONE) {
            return 'completed';
        }

        if (this.isOverdue(endDate, columnId)) {
            return 'overdue';
        }

        if (this.isApproachingDeadline(endDate)) {
            return 'approaching';
        }

        return '';
    },

    /**
     * Получить сегодняшнюю дату в формате для input
     * @returns {string} Сегодняшняя дата в формате YYYY-MM-DD
     */
    getTodayForInput() {
        return this.formatDateForInput(new Date());
    },

    /**
     * Валидация дат (начало должно быть до окончания)
     * @param {string|Date} startDate - Дата начала
     * @param {string|Date} endDate - Дата окончания
     * @returns {boolean} true если даты валидны
     */
    validateDates(startDate, endDate) {
        if (!startDate || !endDate) return true; // Если одна из дат не задана - ок

        const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
        const end = typeof endDate === 'string' ? new Date(endDate) : endDate;

        return start <= end;
    },

    /**
     * Получить иконку для даты в зависимости от статуса
     * @param {string|Date} endDate - Дата окончания
     * @param {string|null} columnId - ID колонки (для проверки Done)
     * @returns {string} HTML код иконки
     */
    getDateIcon(endDate, columnId = null) {
        if (!endDate) return '📅';

        // Карточки в Done получают зеленую метку
        if (columnId === CONFIG.COLUMNS.DONE) {
            return '🟢';
        }

        if (this.isOverdue(endDate, columnId)) {
            return '🔴';
        }

        if (this.isApproachingDeadline(endDate)) {
            return '⚠️';
        }

        return '📅';
    }
};
