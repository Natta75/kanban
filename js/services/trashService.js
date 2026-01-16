// ============================================================
// TRASH SERVICE - Работа с корзиной через Supabase
// ============================================================

/**
 * Сервис для управления корзиной удалённых карточек
 */
const TrashService = {
    /**
     * Переместить карточку в корзину (soft delete)
     * @param {string} cardId - ID карточки
     * @returns {Promise<{data: Object|null, error: Error|null}>}
     */
    async moveToTrash(cardId) {
        try {
            const client = getSupabaseClient();
            if (!client) {
                return { data: null, error: new Error('Supabase не настроен') };
            }

            const currentUser = await AuthService.getCurrentUser();
            if (!currentUser) {
                return { data: null, error: new Error('Необходима авторизация') };
            }

            // Получить данные карточки перед удалением
            const { data: card, error: fetchError } = await client
                .from(CONFIG.TABLES.CARDS)
                .select('*')
                .eq('id', cardId)
                .single();

            if (fetchError || !card) {
                console.error('Error fetching card:', fetchError);
                return { data: null, error: fetchError || new Error('Карточка не найдена') };
            }

            // Проверить, что текущий пользователь - владелец карточки
            if (card.user_id !== currentUser.id) {
                return { data: null, error: new Error('Вы можете удалять только свои карточки') };
            }

            // Переместить карточку в корзину
            const { data: trashData, error: insertError } = await client
                .from(CONFIG.TABLES.TRASH)
                .insert([{
                    card_id: card.id,
                    title: card.title,
                    description: card.description,
                    column_id: card.column_id,
                    priority: card.priority,
                    start_date: card.start_date,
                    end_date: card.end_date,
                    completed_at: card.completed_at,
                    user_id: card.user_id,
                    deleted_by: currentUser.id,
                    created_at: card.created_at,
                    updated_at: card.updated_at
                }])
                .select()
                .single();

            if (insertError) {
                console.error('Error inserting to trash:', insertError);
                return { data: null, error: insertError };
            }

            // Удалить карточку из основной таблицы
            const { error: deleteError } = await client
                .from(CONFIG.TABLES.CARDS)
                .delete()
                .eq('id', cardId)
                .eq('user_id', currentUser.id);

            if (deleteError) {
                console.error('Error deleting card:', deleteError);
                // Попытаться откатить вставку в корзину
                await client.from(CONFIG.TABLES.TRASH).delete().eq('id', trashData.id);
                return { data: null, error: deleteError };
            }

            console.log('✅ Карточка перемещена в корзину:', cardId);
            return { data: trashData, error: null };

        } catch (error) {
            console.error('❌ Error in moveToTrash:', error);
            return { data: null, error };
        }
    },

    /**
     * Восстановить карточку из корзины
     * @param {string} trashId - ID записи в корзине
     * @returns {Promise<{data: Object|null, error: Error|null}>}
     */
    async restoreFromTrash(trashId) {
        try {
            const client = getSupabaseClient();
            if (!client) {
                return { data: null, error: new Error('Supabase не настроен') };
            }

            const currentUser = await AuthService.getCurrentUser();
            if (!currentUser) {
                return { data: null, error: new Error('Необходима авторизация') };
            }

            // Получить данные из корзины
            const { data: trashItem, error: fetchError } = await client
                .from(CONFIG.TABLES.TRASH)
                .select('*')
                .eq('id', trashId)
                .single();

            if (fetchError || !trashItem) {
                console.error('Error fetching trash item:', fetchError);
                return { data: null, error: fetchError || new Error('Запись в корзине не найдена') };
            }

            // Проверить права (владелец или удаливший)
            if (trashItem.user_id !== currentUser.id && trashItem.deleted_by !== currentUser.id) {
                return { data: null, error: new Error('Нет прав на восстановление этой карточки') };
            }

            // Восстановить карточку в основную таблицу
            const { data: restoredCard, error: insertError } = await client
                .from(CONFIG.TABLES.CARDS)
                .insert([{
                    id: trashItem.card_id,
                    title: trashItem.title,
                    description: trashItem.description,
                    column_id: trashItem.column_id,
                    priority: trashItem.priority,
                    start_date: trashItem.start_date,
                    end_date: trashItem.end_date,
                    completed_at: trashItem.completed_at,
                    user_id: trashItem.user_id,
                    position: 0, // Восстановить в начало колонки
                    created_at: trashItem.created_at,
                    updated_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (insertError) {
                console.error('Error restoring card:', insertError);
                return { data: null, error: insertError };
            }

            // Удалить из корзины
            const { error: deleteError } = await client
                .from(CONFIG.TABLES.TRASH)
                .delete()
                .eq('id', trashId);

            if (deleteError) {
                console.error('Error deleting from trash:', deleteError);
                // Попытаться откатить восстановление
                await client.from(CONFIG.TABLES.CARDS).delete().eq('id', restoredCard.id);
                return { data: null, error: deleteError };
            }

            console.log('✅ Карточка восстановлена из корзины:', trashItem.card_id);
            return { data: restoredCard, error: null };

        } catch (error) {
            console.error('❌ Error in restoreFromTrash:', error);
            return { data: null, error };
        }
    },

    /**
     * Получить все карточки из корзины
     * @returns {Promise<{data: Array|null, error: Error|null}>}
     */
    async getAllTrash() {
        try {
            const client = getSupabaseClient();
            if (!client) {
                return { data: null, error: new Error('Supabase не настроен') };
            }

            const { data, error } = await client
                .from(CONFIG.TABLES.TRASH)
                .select('*')
                .order('deleted_at', { ascending: false });

            if (error) {
                console.error('Error fetching trash:', error);
                return { data: null, error };
            }

            console.log(`✅ Загружено записей в корзине: ${data?.length || 0}`);
            return { data: data || [], error: null };

        } catch (error) {
            console.error('❌ Error in getAllTrash:', error);
            return { data: null, error };
        }
    },

    /**
     * Окончательно удалить карточку из корзины
     * @param {string} trashId - ID записи в корзине
     * @returns {Promise<{error: Error|null}>}
     */
    async permanentDelete(trashId) {
        try {
            const client = getSupabaseClient();
            if (!client) {
                return { error: new Error('Supabase не настроен') };
            }

            const currentUser = await AuthService.getCurrentUser();
            if (!currentUser) {
                return { error: new Error('Необходима авторизация') };
            }

            // Проверить права (владелец или удаливший)
            const { data: trashItem, error: fetchError } = await client
                .from(CONFIG.TABLES.TRASH)
                .select('user_id, deleted_by')
                .eq('id', trashId)
                .single();

            if (fetchError || !trashItem) {
                return { error: fetchError || new Error('Запись не найдена') };
            }

            if (trashItem.user_id !== currentUser.id && trashItem.deleted_by !== currentUser.id) {
                return { error: new Error('Нет прав на окончательное удаление') };
            }

            // Удалить из корзины
            const { error } = await client
                .from(CONFIG.TABLES.TRASH)
                .delete()
                .eq('id', trashId);

            if (error) {
                console.error('Error permanently deleting:', error);
                return { error };
            }

            console.log('✅ Карточка окончательно удалена:', trashId);
            return { error: null };

        } catch (error) {
            console.error('❌ Error in permanentDelete:', error);
            return { error };
        }
    },

    /**
     * Массовое перемещение карточек в корзину
     * @param {Array<string>} cardIds - Массив ID карточек
     * @returns {Promise<{success: number, failed: number, errors: Array}>}
     */
    async bulkMoveToTrash(cardIds) {
        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        // Выполнить все удаления параллельно для ускорения
        const promises = cardIds.map(cardId =>
            this.moveToTrash(cardId)
                .then(result => ({ cardId, result }))
                .catch(error => ({ cardId, result: { error } }))
        );

        const settled = await Promise.all(promises);

        // Подсчитать результаты
        for (const { cardId, result } of settled) {
            if (result.error) {
                results.failed++;
                results.errors.push({ cardId, error: result.error.message || String(result.error) });
            } else {
                results.success++;
            }
        }

        console.log(`✅ Массовое удаление: успешно ${results.success}, ошибок ${results.failed}`);
        return results;
    },

    /**
     * Получить количество дней до автоудаления
     * @param {string} autoDeleteAt - Дата автоудаления (ISO string)
     * @returns {number} - Количество дней
     */
    getDaysUntilAutoDelete(autoDeleteAt) {
        if (!autoDeleteAt) return 0;
        const now = new Date();
        const deleteDate = new Date(autoDeleteAt);
        const diffTime = deleteDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : 0;
    },

    /**
     * Форматировать дату удаления
     * @param {string} deletedAt - Дата удаления (ISO string)
     * @returns {string} - Форматированная дата
     */
    formatDeletedDate(deletedAt) {
        if (!deletedAt) return '';
        const date = new Date(deletedAt);
        const now = new Date();
        const diffTime = now - date;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Сегодня';
        if (diffDays === 1) return 'Вчера';
        if (diffDays < 7) return `${diffDays} дн. назад`;

        return date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }
};
