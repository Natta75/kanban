// ============================================================
// CHECKLIST SERVICE
// ============================================================

/**
 * Сервис для работы с чеклистами карточек
 */

const ChecklistService = {
    /**
     * Получить все пункты чеклиста для карточки
     * @param {string} cardId - ID карточки
     * @returns {Promise<{data: Array|null, error: Error|null}>}
     */
    async getChecklistItems(cardId) {
        try {
            const client = getSupabaseClient();
            if (!client) {
                return {
                    data: null,
                    error: new Error('Supabase не настроен')
                };
            }

            const { data, error } = await client
                .from('kanban_checklist_items')
                .select('*')
                .eq('card_id', cardId)
                .order('position', { ascending: true });

            if (error) {
                console.error('Error getting checklist items:', error);
                return { data: null, error };
            }

            return { data, error: null };

        } catch (error) {
            console.error('❌ Get checklist items failed:', error);
            return { data: null, error };
        }
    },

    /**
     * Добавить пункт в чеклист
     * @param {string} cardId - ID карточки
     * @param {string} text - Текст пункта
     * @returns {Promise<{data: Object|null, error: Error|null}>}
     */
    async addChecklistItem(cardId, text) {
        try {
            const client = getSupabaseClient();
            if (!client) {
                return {
                    data: null,
                    error: new Error('Supabase не настроен')
                };
            }

            // Получить максимальную позицию
            const { data: items } = await client
                .from('kanban_checklist_items')
                .select('position')
                .eq('card_id', cardId)
                .order('position', { ascending: false })
                .limit(1);

            const maxPosition = items && items.length > 0 ? items[0].position : -1;

            const { data, error } = await client
                .from('kanban_checklist_items')
                .insert([
                    {
                        card_id: cardId,
                        text: text.trim(),
                        is_completed: false,
                        position: maxPosition + 1
                    }
                ])
                .select()
                .single();

            if (error) {
                console.error('Error adding checklist item:', error);
                return { data: null, error };
            }

            console.log('✅ Checklist item added:', data);
            return { data, error: null };

        } catch (error) {
            console.error('❌ Add checklist item failed:', error);
            return { data: null, error };
        }
    },

    /**
     * Обновить пункт чеклиста
     * @param {string} itemId - ID пункта
     * @param {Object} updates - Объект с обновлениями { text?, is_completed? }
     * @returns {Promise<{data: Object|null, error: Error|null}>}
     */
    async updateChecklistItem(itemId, updates) {
        try {
            const client = getSupabaseClient();
            if (!client) {
                return {
                    data: null,
                    error: new Error('Supabase не настроен')
                };
            }

            const updateData = {};
            if (updates.text !== undefined) {
                updateData.text = updates.text.trim();
            }
            if (updates.is_completed !== undefined) {
                updateData.is_completed = updates.is_completed;
            }

            const { data, error } = await client
                .from('kanban_checklist_items')
                .update(updateData)
                .eq('id', itemId)
                .select()
                .single();

            if (error) {
                console.error('Error updating checklist item:', error);
                return { data: null, error };
            }

            console.log('✅ Checklist item updated:', data);
            return { data, error: null };

        } catch (error) {
            console.error('❌ Update checklist item failed:', error);
            return { data: null, error };
        }
    },

    /**
     * Переключить статус выполнения пункта
     * @param {string} itemId - ID пункта
     * @param {boolean} isCompleted - Новый статус
     * @returns {Promise<{data: Object|null, error: Error|null}>}
     */
    async toggleChecklistItem(itemId, isCompleted) {
        return this.updateChecklistItem(itemId, { is_completed: isCompleted });
    },

    /**
     * Удалить пункт чеклиста
     * @param {string} itemId - ID пункта
     * @returns {Promise<{error: Error|null}>}
     */
    async deleteChecklistItem(itemId) {
        try {
            const client = getSupabaseClient();
            if (!client) {
                return {
                    error: new Error('Supabase не настроен')
                };
            }

            const { error } = await client
                .from('kanban_checklist_items')
                .delete()
                .eq('id', itemId);

            if (error) {
                console.error('Error deleting checklist item:', error);
                return { error };
            }

            console.log('✅ Checklist item deleted');
            return { error: null };

        } catch (error) {
            console.error('❌ Delete checklist item failed:', error);
            return { error };
        }
    },

    /**
     * Получить статистику чеклиста (количество выполненных/всего)
     * @param {string} cardId - ID карточки
     * @returns {Promise<{completed: number, total: number, error: Error|null}>}
     */
    async getChecklistStats(cardId) {
        try {
            const { data, error } = await this.getChecklistItems(cardId);

            if (error) {
                return { completed: 0, total: 0, error };
            }

            if (!data || data.length === 0) {
                return { completed: 0, total: 0, error: null };
            }

            const total = data.length;
            const completed = data.filter(item => item.is_completed).length;

            return { completed, total, error: null };

        } catch (error) {
            console.error('❌ Get checklist stats failed:', error);
            return { completed: 0, total: 0, error };
        }
    },

    /**
     * Массовое добавление пунктов чеклиста (для новых карточек)
     * @param {string} cardId - ID карточки
     * @param {Array} items - Массив пунктов [{text, is_completed, position}]
     * @returns {Promise<{data: Array|null, error: Error|null}>}
     */
    async addBulkChecklistItems(cardId, items) {
        try {
            const client = getSupabaseClient();
            if (!client) {
                return {
                    data: null,
                    error: new Error('Supabase не настроен')
                };
            }

            if (!items || items.length === 0) {
                return { data: [], error: null };
            }

            // Подготовить данные для вставки
            const insertData = items.map(item => ({
                card_id: cardId,
                text: item.text.trim(),
                is_completed: item.is_completed || false,
                position: item.position || 0
            }));

            const { data, error } = await client
                .from('kanban_checklist_items')
                .insert(insertData)
                .select();

            if (error) {
                console.error('Error adding bulk checklist items:', error);
                return { data: null, error };
            }

            console.log(`✅ Added ${data.length} checklist items`);
            return { data, error: null };

        } catch (error) {
            console.error('❌ Add bulk checklist items failed:', error);
            return { data: null, error };
        }
    },

    /**
     * Валидация текста пункта чеклиста
     * @param {string} text - Текст пункта
     * @returns {{valid: boolean, error: string|null}}
     */
    validateItemText(text) {
        if (!text || text.trim().length === 0) {
            return { valid: false, error: 'Текст пункта не может быть пустым' };
        }

        const trimmed = text.trim();

        if (trimmed.length > 200) {
            return { valid: false, error: 'Текст пункта не может быть длиннее 200 символов' };
        }

        return { valid: true, error: null };
    }
};
