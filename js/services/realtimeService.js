// ============================================================
// REALTIME SERVICE - Синхронизация в реальном времени
// ============================================================

/**
 * Сервис для управления Realtime подписками Supabase
 */
const RealtimeService = {
    subscription: null,
    callbacks: {
        onInsert: null,
        onUpdate: null,
        onDelete: null
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
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('❌ Ошибка Realtime подписки');
                } else if (status === 'TIMED_OUT') {
                    console.warn('⚠️ Realtime подписка истекла');
                }
            });

        console.log('📡 Realtime подписка создана');
        return this.subscription;
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
            console.log('📡 Realtime подписка отменена');
        }
    },

    /**
     * Проверить статус подписки
     * @returns {boolean} true если подписка активна
     */
    isSubscribed() {
        return this.subscription !== null;
    }
};
