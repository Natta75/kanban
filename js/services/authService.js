// ============================================================
// AUTHENTICATION SERVICE
// ============================================================

/**
 * Сервис для работы с аутентификацией через Supabase
 */

const AuthService = {
    /**
     * Регистрация нового пользователя
     * @param {string} email - Email пользователя
     * @param {string} password - Пароль
     * @returns {Promise<{user: Object|null, error: Error|null}>}
     */
    async signUp(email, password) {
        try {
            const client = getSupabaseClient();
            if (!client) {
                return {
                    user: null,
                    error: new Error('Supabase не настроен. Проверьте конфигурацию.')
                };
            }

            const { data, error } = await client.auth.signUp({
                email,
                password
            });

            if (error) {
                console.error('Sign up error:', error);

                // Обработка сетевых ошибок
                if (error.message.includes('Failed to fetch') ||
                    error.message.includes('NetworkError')) {
                    return {
                        user: null,
                        error: new Error('Не удается подключиться к серверу. Supabase может быть заблокирован. Попробуйте VPN.')
                    };
                }

                return { user: null, error };
            }

            console.log('✅ User registered successfully:', data.user?.email);
            return { user: data.user, error: null };

        } catch (error) {
            console.error('❌ Sign up failed:', error);

            if (error.message.includes('Failed to fetch') ||
                error.message.includes('NetworkError')) {
                return {
                    user: null,
                    error: new Error('Не удается подключиться к серверу. Возможно, сервис заблокирован в вашем регионе.')
                };
            }

            return { user: null, error };
        }
    },

    /**
     * Вход пользователя
     * @param {string} email - Email пользователя
     * @param {string} password - Пароль
     * @returns {Promise<{user: Object|null, error: Error|null}>}
     */
    async signIn(email, password) {
        try {
            const client = getSupabaseClient();
            if (!client) {
                return {
                    user: null,
                    error: new Error('Supabase не настроен. Проверьте конфигурацию.')
                };
            }

            const { data, error } = await client.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                console.error('Sign in error:', error);

                // Обработка сетевых ошибок
                if (error.message.includes('Failed to fetch') ||
                    error.message.includes('NetworkError')) {
                    return {
                        user: null,
                        error: new Error('Не удается подключиться к серверу. Supabase может быть заблокирован. Попробуйте VPN.')
                    };
                }

                return { user: null, error };
            }

            console.log('✅ User signed in:', data.user?.email);
            return { user: data.user, error: null };

        } catch (error) {
            console.error('❌ Sign in failed:', error);

            if (error.message.includes('Failed to fetch') ||
                error.message.includes('NetworkError')) {
                return {
                    user: null,
                    error: new Error('Не удается подключиться к серверу. Возможно, сервис заблокирован в вашем регионе.')
                };
            }

            return { user: null, error };
        }
    },

    /**
     * Выход пользователя
     * @returns {Promise<{error: Error|null}>}
     */
    async signOut() {
        try {
            const client = getSupabaseClient();
            if (!client) {
                return { error: new Error('Supabase не настроен') };
            }

            const { error } = await client.auth.signOut();

            if (error) {
                console.error('Sign out error:', error);
                return { error };
            }

            console.log('✅ User signed out successfully');
            return { error: null };

        } catch (error) {
            console.error('❌ Sign out failed:', error);
            return { error };
        }
    },

    /**
     * Получить текущего пользователя
     * @returns {Promise<Object|null>}
     */
    async getCurrentUser() {
        try {
            const client = getSupabaseClient();
            if (!client) {
                return null;
            }

            const { data: { user } } = await client.auth.getUser();
            return user;

        } catch (error) {
            console.error('❌ Error getting current user:', error);
            return null;
        }
    },

    /**
     * Получить текущую сессию
     * @returns {Promise<Object|null>}
     */
    async getSession() {
        try {
            const client = getSupabaseClient();
            if (!client) {
                return null;
            }

            const { data: { session } } = await client.auth.getSession();
            return session;

        } catch (error) {
            console.error('❌ Error getting session:', error);
            return null;
        }
    },

    /**
     * Подписка на изменения состояния аутентификации
     * @param {Function} callback - Функция, вызываемая при изменении состояния
     * @returns {Object} Subscription object для отписки
     */
    onAuthStateChange(callback) {
        const client = getSupabaseClient();
        if (!client) {
            console.warn('Supabase не настроен, auth state change недоступен');
            return { unsubscribe: () => {} };
        }

        const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
            console.log('Auth state changed:', event, session?.user?.email);
            callback(event, session);
        });

        return subscription;
    },

    /**
     * Проверка, авторизован ли пользователь
     * @returns {Promise<boolean>}
     */
    async isAuthenticated() {
        const user = await this.getCurrentUser();
        return user !== null;
    },

    /**
     * Получить email текущего пользователя
     * @returns {Promise<string|null>}
     */
    async getUserEmail() {
        const user = await this.getCurrentUser();
        return user?.email || null;
    }
};
