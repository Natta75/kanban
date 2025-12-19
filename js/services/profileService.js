// ============================================================
// PROFILE SERVICE
// ============================================================

/**
 * Сервис для работы с профилями пользователей (никнеймы)
 */

const ProfileService = {
    /**
     * Создать профиль пользователя
     * @param {string} userId - ID пользователя
     * @param {string} nickname - Никнейм
     * @param {string} email - Email пользователя
     * @returns {Promise<{data: Object|null, error: Error|null}>}
     */
    async createProfile(userId, nickname, email) {
        try {
            const client = getSupabaseClient();
            if (!client) {
                return {
                    data: null,
                    error: new Error('Supabase не настроен')
                };
            }

            const { data, error } = await client
                .from('kanban_user_profiles')
                .insert([
                    {
                        user_id: userId,
                        nickname: nickname.trim(),
                        email: email
                    }
                ])
                .select()
                .single();

            if (error) {
                console.error('Error creating profile:', error);
                return { data: null, error };
            }

            console.log('✅ Profile created:', data);
            return { data, error: null };

        } catch (error) {
            console.error('❌ Create profile failed:', error);
            return { data: null, error };
        }
    },

    /**
     * Получить профиль пользователя по ID
     * @param {string} userId - ID пользователя
     * @returns {Promise<{data: Object|null, error: Error|null}>}
     */
    async getProfile(userId) {
        try {
            const client = getSupabaseClient();
            if (!client) {
                return {
                    data: null,
                    error: new Error('Supabase не настроен')
                };
            }

            const { data, error } = await client
                .from('kanban_user_profiles')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error) {
                // Если профиль не найден - это не ошибка, вернем null
                if (error.code === 'PGRST116') {
                    return { data: null, error: null };
                }
                console.error('Error getting profile:', error);
                return { data: null, error };
            }

            return { data, error: null };

        } catch (error) {
            console.error('❌ Get profile failed:', error);
            return { data: null, error };
        }
    },

    /**
     * Получить все профили пользователей
     * @returns {Promise<{data: Array|null, error: Error|null}>}
     */
    async getAllProfiles() {
        try {
            const client = getSupabaseClient();
            if (!client) {
                return {
                    data: null,
                    error: new Error('Supabase не настроен')
                };
            }

            const { data, error } = await client
                .from('kanban_user_profiles')
                .select('*')
                .order('created_at', { ascending: true });

            if (error) {
                console.error('Error getting all profiles:', error);
                return { data: null, error };
            }

            console.log(`✅ Loaded ${data.length} profiles`);
            return { data, error: null };

        } catch (error) {
            console.error('❌ Get all profiles failed:', error);
            return { data: null, error };
        }
    },

    /**
     * Обновить профиль пользователя
     * @param {string} userId - ID пользователя
     * @param {string} nickname - Новый никнейм
     * @returns {Promise<{data: Object|null, error: Error|null}>}
     */
    async updateProfile(userId, nickname) {
        try {
            const client = getSupabaseClient();
            if (!client) {
                return {
                    data: null,
                    error: new Error('Supabase не настроен')
                };
            }

            const { data, error } = await client
                .from('kanban_user_profiles')
                .update({
                    nickname: nickname.trim()
                })
                .eq('user_id', userId)
                .select()
                .single();

            if (error) {
                console.error('Error updating profile:', error);
                return { data: null, error };
            }

            console.log('✅ Profile updated:', data);
            return { data, error: null };

        } catch (error) {
            console.error('❌ Update profile failed:', error);
            return { data: null, error };
        }
    },

    /**
     * Проверить доступность никнейма
     * @param {string} nickname - Никнейм для проверки
     * @param {string} excludeUserId - ID пользователя, которого нужно исключить из проверки (для обновления)
     * @returns {Promise<{available: boolean, error: Error|null}>}
     */
    async checkNicknameAvailability(nickname, excludeUserId = null) {
        try {
            const client = getSupabaseClient();
            if (!client) {
                return {
                    available: false,
                    error: new Error('Supabase не настроен')
                };
            }

            let query = client
                .from('kanban_user_profiles')
                .select('user_id')
                .eq('nickname', nickname.trim());

            // Исключить текущего пользователя при проверке
            if (excludeUserId) {
                query = query.neq('user_id', excludeUserId);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error checking nickname availability:', error);
                return { available: false, error };
            }

            // Никнейм доступен, если не найдено совпадений
            const available = !data || data.length === 0;
            return { available, error: null };

        } catch (error) {
            console.error('❌ Check nickname availability failed:', error);
            return { available: false, error };
        }
    },

    /**
     * Получить никнейм из email (часть до @)
     * @param {string} email - Email пользователя
     * @returns {string} - Никнейм, сгенерированный из email
     */
    generateNicknameFromEmail(email) {
        if (!email || !email.includes('@')) {
            return 'user' + Math.random().toString(36).substr(2, 6);
        }

        // Взять часть до @
        let nickname = email.split('@')[0];

        // Убрать недопустимые символы (оставить только буквы, цифры, _, -)
        nickname = nickname.replace(/[^a-zA-Z0-9_-]/g, '');

        // Ограничить длину до 50 символов
        if (nickname.length > 50) {
            nickname = nickname.substring(0, 50);
        }

        // Минимум 3 символа
        if (nickname.length < 3) {
            nickname = nickname + Math.random().toString(36).substr(2, 3);
        }

        return nickname;
    },

    /**
     * Валидация никнейма
     * @param {string} nickname - Никнейм для валидации
     * @returns {{valid: boolean, error: string|null}}
     */
    validateNickname(nickname) {
        if (!nickname || nickname.trim().length === 0) {
            return { valid: false, error: 'Никнейм не может быть пустым' };
        }

        const trimmed = nickname.trim();

        if (trimmed.length < 3) {
            return { valid: false, error: 'Никнейм должен содержать минимум 3 символа' };
        }

        if (trimmed.length > 50) {
            return { valid: false, error: 'Никнейм не может быть длиннее 50 символов' };
        }

        // Проверка на допустимые символы (буквы, цифры, _, -, пробелы)
        const validPattern = /^[a-zA-Zа-яА-ЯёЁ0-9_\- ]+$/;
        if (!validPattern.test(trimmed)) {
            return {
                valid: false,
                error: 'Никнейм может содержать только буквы, цифры, пробелы, _ и -'
            };
        }

        return { valid: true, error: null };
    }
};
