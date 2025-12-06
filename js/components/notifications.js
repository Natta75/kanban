// ============================================================
// NOTIFICATIONS COMPONENT - Компонент уведомлений о дедлайнах
// ============================================================

/**
 * Компонент для отслеживания дедлайнов и показа уведомлений
 */
const NotificationsComponent = {
    // Интервал проверки (1 час = 3600000 мс)
    checkInterval: 3600000,
    intervalId: null,

    // Разрешение на Browser Notifications
    notificationsEnabled: false,

    /**
     * Инициализация компонента уведомлений
     */
    async init() {
        // Проверить поддержку Browser Notification API
        if ('Notification' in window) {
            // Проверить текущее разрешение
            if (Notification.permission === 'granted') {
                this.notificationsEnabled = true;
            } else if (Notification.permission !== 'denied') {
                // Запросить разрешение (только если не было отказано)
                const permission = await Notification.requestPermission();
                this.notificationsEnabled = permission === 'granted';
            }
        }

        console.log('✅ Notifications component инициализирован');
        console.log(`📢 Browser notifications: ${this.notificationsEnabled ? 'включены' : 'выключены'}`);
    },

    /**
     * Начать периодическую проверку дедлайнов
     * @param {Array} cards - Массив карточек
     */
    startPeriodicCheck(cards) {
        // Проверить сразу
        this.checkDeadlines(cards);

        // Установить интервал для периодической проверки
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }

        this.intervalId = setInterval(() => {
            this.checkDeadlines(cards);
        }, this.checkInterval);

        console.log('📢 Периодическая проверка дедлайнов запущена');
    },

    /**
     * Остановить периодическую проверку
     */
    stopPeriodicCheck() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('📢 Периодическая проверка дедлайнов остановлена');
        }
    },

    /**
     * Проверить дедлайны всех карточек
     * @param {Array} cards - Массив карточек
     */
    checkDeadlines(cards) {
        if (!cards || cards.length === 0) {
            return;
        }

        const urgentCards = this.getUrgentCards(cards);

        if (urgentCards.length > 0) {
            console.log(`⚠️ Найдено ${urgentCards.length} задач с приближающимися дедлайнами`);

            // Показать уведомление
            this.showNotification(urgentCards);

            // Обновить banner в интерфейсе
            this.updateNotificationBanner(urgentCards);
        } else {
            // Скрыть banner если нет срочных задач
            this.hideNotificationBanner();
        }
    },

    /**
     * Получить карточки с приближающимися или просроченными дедлайнами
     * @param {Array} cards - Массив карточек
     * @returns {Array} Срочные карточки
     */
    getUrgentCards(cards) {
        return cards.filter(card => {
            if (!card.end_date) return false;

            const isOverdue = DateUtils.isOverdue(card.end_date);
            const isApproaching = DateUtils.isApproachingDeadline(card.end_date);

            return isOverdue || isApproaching;
        });
    },

    /**
     * Получить количество просроченных карточек
     * @param {Array} cards - Массив карточек
     * @returns {number}
     */
    getOverdueCount(cards) {
        return cards.filter(card => {
            return card.end_date && DateUtils.isOverdue(card.end_date);
        }).length;
    },

    /**
     * Показать Browser Notification
     * @param {Array} urgentCards - Срочные карточки
     */
    showNotification(urgentCards) {
        if (!this.notificationsEnabled || urgentCards.length === 0) {
            return;
        }

        const overdueCount = urgentCards.filter(card => DateUtils.isOverdue(card.end_date)).length;
        const approachingCount = urgentCards.length - overdueCount;

        let title = '';
        let body = '';

        if (overdueCount > 0 && approachingCount > 0) {
            title = '⚠️ Важные задачи требуют внимания';
            body = `Просрочено: ${overdueCount}, Приближаются: ${approachingCount}`;
        } else if (overdueCount > 0) {
            title = '🔴 Просроченные задачи';
            body = `У вас ${overdueCount} просроченных ${this.pluralize(overdueCount, 'задача', 'задачи', 'задач')}`;
        } else {
            title = '⚠️ Приближающиеся дедлайны';
            body = `У вас ${approachingCount} ${this.pluralize(approachingCount, 'задача', 'задачи', 'задач')} с приближающимся дедлайном`;
        }

        new Notification(title, {
            body: body,
            icon: '/favicon.ico',
            tag: 'kanban-deadline',
            requireInteraction: false
        });

        console.log('📢 Browser notification показано');
    },

    /**
     * Обновить banner уведомлений в интерфейсе
     * @param {Array} urgentCards - Срочные карточки
     */
    updateNotificationBanner(urgentCards) {
        const banner = document.getElementById('notification-banner');

        if (!banner) {
            console.warn('Notification banner не найден');
            return;
        }

        const overdueCount = urgentCards.filter(card => DateUtils.isOverdue(card.end_date)).length;
        const approachingCount = urgentCards.length - overdueCount;

        let message = '';
        let className = 'notification-banner';

        if (overdueCount > 0) {
            message = `🔴 Просрочено задач: ${overdueCount}`;
            className += ' overdue';
        } else {
            message = `⚠️ Приближаются дедлайны: ${approachingCount}`;
            className += ' approaching';
        }

        banner.textContent = message;
        banner.className = className;
        banner.classList.remove('hidden');

        console.log('📢 Notification banner обновлён');
    },

    /**
     * Скрыть banner уведомлений
     */
    hideNotificationBanner() {
        const banner = document.getElementById('notification-banner');

        if (banner) {
            banner.classList.add('hidden');
        }
    },

    /**
     * Обновить счётчик просроченных задач в UI
     * @param {number} count - Количество просроченных задач
     */
    updateOverdueCounter(count) {
        const counter = document.getElementById('overdue-counter');

        if (counter) {
            if (count > 0) {
                counter.textContent = count;
                counter.classList.remove('hidden');
            } else {
                counter.classList.add('hidden');
            }
        }
    },

    /**
     * Вспомогательная функция для правильного склонения слов
     * @param {number} count - Число
     * @param {string} one - Форма для 1 (задача)
     * @param {string} few - Форма для 2-4 (задачи)
     * @param {string} many - Форма для 5+ (задач)
     * @returns {string}
     */
    pluralize(count, one, few, many) {
        const mod10 = count % 10;
        const mod100 = count % 100;

        if (mod10 === 1 && mod100 !== 11) {
            return one;
        } else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
            return few;
        } else {
            return many;
        }
    }
};
