// ============================================================
// CARD SERVICE - Работа с карточками через Supabase
// ============================================================

/**
 * Сервис для управления карточками в Supabase
 */
const CardService = {
    /**
     * Получить все карточки с учётом фильтра
     * @param {boolean} showAll - Показывать все карточки или только свои
     * @returns {Promise<{data: Array|null, error: Error|null}>}
     */
    async getCards(showAll = false) {
        try {
            const client = getSupabaseClient();
            if (!client) {
                return { data: null, error: new Error('Supabase не настроен') };
            }

            const currentUser = await AuthService.getCurrentUser();
            if (!currentUser && !showAll) {
                // Если пользователь не авторизован и не showAll - вернуть пустой массив
                return { data: [], error: null };
            }

            let query = client
                .from(CONFIG.TABLES.CARDS)
                .select('*')
                .order('position', { ascending: true });

            // Фильтр: показывать только свои карточки
            if (!showAll && currentUser) {
                query = query.eq('user_id', currentUser.id);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching cards:', error);
                return { data: null, error };
            }

            console.log(`✅ Загружено карточек: ${data?.length || 0}`);
            return { data: data || [], error: null };

        } catch (error) {
            console.error('❌ Error in getCards:', error);
            return { data: null, error };
        }
    },

    /**
     * Создать новую карточку
     * @param {Object} cardData - Данные карточки {title, description, column_id, priority, start_date, end_date}
     * @returns {Promise<{data: Object|null, error: Error|null}>}
     */
    async createCard(cardData) {
        try {
            const client = getSupabaseClient();
            if (!client) {
                return { data: null, error: new Error('Supabase не настроен') };
            }

            const currentUser = await AuthService.getCurrentUser();
            if (!currentUser) {
                return { data: null, error: new Error('Необходима авторизация') };
            }

            // Получить максимальную позицию в колонке
            const { data: existingCards } = await client
                .from(CONFIG.TABLES.CARDS)
                .select('position')
                .eq('column_id', cardData.column_id)
                .order('position', { ascending: false })
                .limit(1);

            const maxPosition = existingCards?.[0]?.position || 0;

            // Подготовить данные для вставки
            const newCard = {
                title: cardData.title,
                description: cardData.description || '',
                column_id: cardData.column_id,
                priority: cardData.priority || 'medium',
                start_date: cardData.start_date || new Date().toISOString(),
                end_date: cardData.end_date || null,
                user_id: currentUser.id,
                position: maxPosition + 1
            };

            const { data, error } = await client
                .from(CONFIG.TABLES.CARDS)
                .insert([newCard])
                .select()
                .single();

            if (error) {
                console.error('Error creating card:', error);
                return { data: null, error };
            }

            console.log('✅ Карточка создана:', data.id);
            return { data, error: null };

        } catch (error) {
            console.error('❌ Error in createCard:', error);
            return { data: null, error };
        }
    },

    /**
     * Обновить карточку
     * @param {string} cardId - ID карточки
     * @param {Object} updates - Обновляемые поля
     * @returns {Promise<{data: Object|null, error: Error|null}>}
     */
    async updateCard(cardId, updates) {
        try {
            const client = getSupabaseClient();
            if (!client) {
                return { data: null, error: new Error('Supabase не настроен') };
            }

            const currentUser = await AuthService.getCurrentUser();
            if (!currentUser) {
                return { data: null, error: new Error('Необходима авторизация') };
            }

            const { data, error } = await client
                .from(CONFIG.TABLES.CARDS)
                .update(updates)
                .eq('id', cardId)
                .eq('user_id', currentUser.id) // Можно обновлять только свои карточки
                .select()
                .maybeSingle();

            if (error) {
                console.error('Error updating card:', error);
                return { data: null, error };
            }

            // Если карточка не найдена (RLS заблокировала или карточка не существует)
            if (!data) {
                console.error('Card not found or access denied:', cardId);
                return { data: null, error: new Error('Карточка не найдена или доступ запрещен') };
            }

            console.log('✅ Карточка обновлена:', cardId);
            return { data, error: null };

        } catch (error) {
            console.error('❌ Error in updateCard:', error);
            return { data: null, error };
        }
    },

    /**
     * Удалить карточку
     * @param {string} cardId - ID карточки
     * @returns {Promise<{error: Error|null}>}
     */
    async deleteCard(cardId) {
        try {
            const client = getSupabaseClient();
            if (!client) {
                return { error: new Error('Supabase не настроен') };
            }

            const currentUser = await AuthService.getCurrentUser();
            if (!currentUser) {
                return { error: new Error('Необходима авторизация') };
            }

            const { error } = await client
                .from(CONFIG.TABLES.CARDS)
                .delete()
                .eq('id', cardId)
                .eq('user_id', currentUser.id); // Можно удалять только свои карточки

            if (error) {
                console.error('Error deleting card:', error);
                return { error };
            }

            console.log('✅ Карточка удалена:', cardId);
            return { error: null };

        } catch (error) {
            console.error('❌ Error in deleteCard:', error);
            return { error };
        }
    },

    /**
     * Переместить карточку в другую колонку
     * @param {string} cardId - ID карточки
     * @param {string} newColumnId - ID новой колонки
     * @param {number} newPosition - Новая позиция
     * @returns {Promise<{data: Object|null, error: Error|null}>}
     */
    async moveCard(cardId, newColumnId, newPosition = 0) {
        try {
            const client = getSupabaseClient();
            if (!client) {
                return { data: null, error: new Error('Supabase не настроен') };
            }

            const currentUser = await AuthService.getCurrentUser();
            if (!currentUser) {
                return { data: null, error: new Error('Необходима авторизация') };
            }

            const { data, error } = await client
                .from(CONFIG.TABLES.CARDS)
                .update({
                    column_id: newColumnId,
                    position: newPosition
                })
                .eq('id', cardId)
                .eq('user_id', currentUser.id)
                .select()
                .maybeSingle();

            if (error) {
                console.error('Error moving card:', error);
                return { data: null, error };
            }

            // Если карточка не найдена (RLS заблокировала или карточка не существует)
            if (!data) {
                console.error('Card not found or access denied:', cardId);
                return { data: null, error: new Error('Карточка не найдена или доступ запрещен') };
            }

            console.log('✅ Карточка перемещена:', cardId, '→', newColumnId);
            return { data, error: null };

        } catch (error) {
            console.error('❌ Error in moveCard:', error);
            return { data: null, error };
        }
    },

    /**
     * Обновить позиции всех карточек в колонке
     * @param {string} columnId - ID колонки
     * @param {Array<{id: string, position: number}>} positions - Массив {id, position}
     * @returns {Promise<{error: Error|null}>}
     */
    async updatePositions(columnId, positions) {
        try {
            const client = getSupabaseClient();
            if (!client) {
                return { error: new Error('Supabase не настроен') };
            }

            const currentUser = await AuthService.getCurrentUser();
            if (!currentUser) {
                return { error: new Error('Необходима авторизация') };
            }

            // Обновляем позиции всех карточек
            const updates = positions.map(({ id, position }) =>
                client
                    .from(CONFIG.TABLES.CARDS)
                    .update({ position })
                    .eq('id', id)
                    .eq('user_id', currentUser.id)
            );

            await Promise.all(updates);

            console.log('✅ Позиции обновлены для колонки:', columnId);
            return { error: null };

        } catch (error) {
            console.error('❌ Error in updatePositions:', error);
            return { error };
        }
    },

    /**
     * Миграция данных из localStorage в Supabase
     * @param {Array} localCards - Карточки из localStorage
     * @returns {Promise<{success: boolean, migrated: number, error: Error|null}>}
     */
    async migrateFromLocalStorage(localCards) {
        try {
            const client = getSupabaseClient();
            if (!client) {
                return { success: false, migrated: 0, error: new Error('Supabase не настроен') };
            }

            const currentUser = await AuthService.getCurrentUser();
            if (!currentUser) {
                return { success: false, migrated: 0, error: new Error('Необходима авторизация') };
            }

            if (!localCards || localCards.length === 0) {
                return { success: true, migrated: 0, error: null };
            }

            // Преобразовать карточки из localStorage в формат Supabase
            const cardsToMigrate = localCards.map((card, index) => ({
                title: card.title,
                description: card.description || '',
                column_id: card.columnId,
                priority: card.priority || 'medium',
                start_date: card.createdAt ? new Date(card.createdAt).toISOString() : new Date().toISOString(),
                end_date: null,
                user_id: currentUser.id,
                position: index
            }));

            const { data, error } = await client
                .from(CONFIG.TABLES.CARDS)
                .insert(cardsToMigrate)
                .select();

            if (error) {
                console.error('Error migrating cards:', error);
                return { success: false, migrated: 0, error };
            }

            console.log(`✅ Мигрировано карточек: ${data.length}`);
            return { success: true, migrated: data.length, error: null };

        } catch (error) {
            console.error('❌ Error in migrateFromLocalStorage:', error);
            return { success: false, migrated: 0, error };
        }
    },

    /**
     * Получить список уникальных пользователей из карточек
     * @returns {Promise<{data: Array|null, error: Error|null}>}
     */
    async getUniqueUsers() {
        try {
            const client = getSupabaseClient();
            if (!client) {
                return { data: null, error: new Error('Supabase не настроен') };
            }

            // Получаем все карточки чтобы извлечь уникальных пользователей
            const { data: cards, error } = await client
                .from(CONFIG.TABLES.CARDS)
                .select('user_id');

            if (error) {
                console.error('Error fetching users:', error);
                return { data: null, error };
            }

            // Извлекаем уникальные user_id
            const uniqueUserIds = [...new Set(cards.map(card => card.user_id))];

            console.log(`✅ Найдено уникальных пользователей: ${uniqueUserIds.length}`);
            return { data: uniqueUserIds, error: null };

        } catch (error) {
            console.error('❌ Error in getUniqueUsers:', error);
            return { data: null, error };
        }
    }
};
