// ============================================================
// REALTIME SERVICE - Синхронизация в реальном времени
// ============================================================

/**
 * Сервис для управления Realtime подписками Supabase
 */
const RealtimeService = {
    subscription: null,
    trashSubscription: null,
    checklistSubscription: null,
    callbacks: {
        onInsert: null,
        onUpdate: null,
        onDelete: null
    },
    trashCallbacks: {
        onInsert: null,
        onDelete: null
    },
    checklistCallbacks: {
        onInsert: null,
        onUpdate: null,
        onDelete: null
    },

    connectionStatus: 'disconnected',
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    reconnectDelay: 1000,
    reconnectTimer: null,

    updateConnectionIndicator(status) {
        this.connectionStatus = status;

        let indicator = document.getElementById('realtime-status');

        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'realtime-status';
            indicator.className = 'realtime-status';
            document.body.appendChild(indicator);
        }

        indicator.className = `realtime-status ${status}`;

        const statusMessages = {
            'disconnected': '⚫ Realtime отключен',
            'connecting': '🟡 Realtime подключается...',
            'connected': '🟢 Realtime подключен',
            'error': '🔴 Realtime ошибка'
        };

        indicator.textContent = statusMessages[status] || status;

        if (status === 'connected') {
            setTimeout(() => {
                indicator.style.opacity = '0';
                setTimeout(() => indicator.style.display = 'none', 300);
            }, 2000);
        } else {
            indicator.style.display = 'block';
            indicator.style.opacity = '1';
        }

        console.log(`📡 Realtime статус: ${status}`);
    },

    /**
     * Подписаться на изменения таблицы kanban_cards
     * @param {Object} handlers - Обработчики событий {onInsert, onUpdate, onDelete}
     * @returns {Object} Subscription объект
     */
    subscribe(handlers = {}) {
        const client = getSupabaseClient();
        if (!client) {
            console.warn('Supabase не настроен, Realtime недоступен');
            this.updateConnectionIndicator('error');
            return null;
        }

        // Сохранить обработчики
        this.callbacks = {
            onInsert: handlers.onInsert || null,
            onUpdate: handlers.onUpdate || null,
            onDelete: handlers.onDelete || null
        };

        // Отписаться от предыдущей подписки, если есть
        if (this.subscription) {
            this.unsubscribe();
        }

        this.updateConnectionIndicator('connecting');

        // Создать новую подписку
        this.subscription = client
            .channel('kanban_cards_changes')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: CONFIG.TABLES.CARDS
                },
                (payload) => {
                    console.log('🔵 Realtime INSERT:', payload.new);
                    if (this.callbacks.onInsert) {
                        this.callbacks.onInsert(payload.new);
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: CONFIG.TABLES.CARDS
                },
                (payload) => {
                    console.log('🟡 Realtime UPDATE:', payload.new);
                    if (this.callbacks.onUpdate) {
                        this.callbacks.onUpdate(payload.new, payload.old);
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: CONFIG.TABLES.CARDS
                },
                (payload) => {
                    console.log('🔴 Realtime DELETE:', payload.old);
                    if (this.callbacks.onDelete) {
                        this.callbacks.onDelete(payload.old);
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Realtime подписка активна');
                    this.updateConnectionIndicator('connected');
                    this.reconnectAttempts = 0;
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('❌ Ошибка Realtime подписки:', status);
                    this.updateConnectionIndicator('error');
                    this.scheduleReconnect();
                } else if (status === 'TIMED_OUT') {
                    console.warn('⚠️ Realtime timeout');
                    this.updateConnectionIndicator('error');
                    this.scheduleReconnect();
                } else if (status === 'CLOSED') {
                    console.warn('📡 Realtime закрыт');
                    this.updateConnectionIndicator('disconnected');
                    this.scheduleReconnect();
                }
            });

        console.log('📡 Realtime подписка создана');
        return this.subscription;
    },

    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error(`❌ Превышено макс. попыток переподключения (${this.maxReconnectAttempts})`);
            console.warn('💡 Realtime отключен. Обновления будут синхронизироваться при перезагрузке страницы.');
            this.updateConnectionIndicator('error');

            // Показать уведомление пользователю
            const banner = document.getElementById('notification-banner');
            if (banner && !banner.textContent.includes('подключения')) {
                const existingContent = banner.textContent;
                if (existingContent && !existingContent.includes('Realtime')) {
                    banner.textContent = existingContent + ' | ⚠️ Realtime отключен - обновления не синхронизируются автоматически.';
                    banner.className = 'notification-banner warning';
                    banner.classList.remove('hidden');
                }
            }
            return;
        }

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }

        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
        this.reconnectAttempts++;

        console.log(`🔄 Переподключение через ${delay/1000}s (попытка ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        this.reconnectTimer = setTimeout(() => {
            console.log('🔄 Попытка переподключения...');
            this.subscribe(this.callbacks);
        }, delay);
    },

    /**
     * Отписаться от изменений
     */
    unsubscribe() {
        if (this.subscription) {
            const client = getSupabaseClient();
            if (client) {
                client.removeChannel(this.subscription);
            }
            this.subscription = null;
            this.callbacks = {
                onInsert: null,
                onUpdate: null,
                onDelete: null
            };
            this.updateConnectionIndicator('disconnected');

            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }

            console.log('📡 Realtime подписка отменена');
        }
    },

    /**
     * Проверить статус подписки
     * @returns {boolean} true если подписка активна
     */
    isSubscribed() {
        return this.subscription !== null;
    },

    /**
     * Подписаться на изменения таблицы kanban_trash
     * @param {Object} handlers - Обработчики событий {onInsert, onDelete}
     * @returns {Object} Subscription объект
     */
    subscribeToTrash(handlers = {}) {
        const client = getSupabaseClient();
        if (!client) {
            console.warn('Supabase не настроен, Realtime для корзины недоступен');
            return null;
        }

        // Сохранить обработчики
        this.trashCallbacks = {
            onInsert: handlers.onInsert || null,
            onDelete: handlers.onDelete || null
        };

        // Отписаться от предыдущей подписки, если есть
        if (this.trashSubscription) {
            this.unsubscribeFromTrash();
        }

        // Создать новую подписку
        this.trashSubscription = client
            .channel('kanban_trash_changes')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: CONFIG.TABLES.TRASH
                },
                (payload) => {
                    console.log('🗑️ Trash INSERT:', payload.new);
                    if (this.trashCallbacks.onInsert) {
                        this.trashCallbacks.onInsert(payload.new);
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: CONFIG.TABLES.TRASH
                },
                (payload) => {
                    console.log('♻️ Trash DELETE:', payload.old);
                    if (this.trashCallbacks.onDelete) {
                        this.trashCallbacks.onDelete(payload.old);
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Realtime подписка на корзину активна');
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('❌ Ошибка Realtime подписки на корзину:', status);
                }
            });

        console.log('📡 Realtime подписка на корзину создана');
        return this.trashSubscription;
    },

    /**
     * Отписаться от изменений корзины
     */
    unsubscribeFromTrash() {
        if (this.trashSubscription) {
            const client = getSupabaseClient();
            if (client) {
                client.removeChannel(this.trashSubscription);
            }
            this.trashSubscription = null;
            this.trashCallbacks = {
                onInsert: null,
                onDelete: null
            };
            console.log('📡 Realtime подписка на корзину отменена');
        }
    },

    /**
     * Подписаться на изменения таблицы kanban_checklist_items
     * @param {Object} handlers - Обработчики событий {onInsert, onUpdate, onDelete}
     * @returns {Object} Subscription объект
     */
    subscribeToChecklist(handlers = {}) {
        const client = getSupabaseClient();
        if (!client) {
            console.warn('Supabase не настроен, Realtime для чеклистов недоступен');
            return null;
        }

        // Сохранить обработчики
        this.checklistCallbacks = {
            onInsert: handlers.onInsert || null,
            onUpdate: handlers.onUpdate || null,
            onDelete: handlers.onDelete || null
        };

        // Отписаться от предыдущей подписки, если есть
        if (this.checklistSubscription) {
            this.unsubscribeFromChecklist();
        }

        // Создать новую подписку
        this.checklistSubscription = client
            .channel('kanban_checklist_changes')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'kanban_checklist_items'
                },
                (payload) => {
                    console.log('✓ Checklist INSERT:', payload.new);
                    if (this.checklistCallbacks.onInsert) {
                        this.checklistCallbacks.onInsert(payload.new);
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'kanban_checklist_items'
                },
                (payload) => {
                    console.log('✓ Checklist UPDATE:', payload.new);
                    if (this.checklistCallbacks.onUpdate) {
                        this.checklistCallbacks.onUpdate(payload.new, payload.old);
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'kanban_checklist_items'
                },
                (payload) => {
                    console.log('✓ Checklist DELETE:', payload.old);
                    if (this.checklistCallbacks.onDelete) {
                        this.checklistCallbacks.onDelete(payload.old);
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Realtime подписка на чеклисты активна');
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('❌ Ошибка Realtime подписки на чеклисты:', status);
                }
            });

        console.log('📡 Realtime подписка на чеклисты создана');
        return this.checklistSubscription;
    },

    /**
     * Отписаться от изменений чеклистов
     */
    unsubscribeFromChecklist() {
        if (this.checklistSubscription) {
            const client = getSupabaseClient();
            if (client) {
                client.removeChannel(this.checklistSubscription);
            }
            this.checklistSubscription = null;
            this.checklistCallbacks = {
                onInsert: null,
                onUpdate: null,
                onDelete: null
            };
            console.log('📡 Realtime подписка на чеклисты отменена');
        }
    }
};
