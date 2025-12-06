// ============================================================
// SUPABASE CLIENT INITIALIZATION
// ============================================================

/**
 * Инициализация и экспорт Supabase клиента
 * Использует credentials из CONFIG
 */

let supabaseClient = null;

/**
 * Инициализирует Supabase клиент
 * @returns {Object|null} Инициализированный клиент Supabase или null при ошибке
 */
function initializeSupabase() {
    try {
        // Проверяем наличие библиотеки Supabase
        if (typeof supabase === 'undefined') {
            console.error('Supabase library not loaded. Make sure to include the CDN script.');
            return null;
        }

        // Проверяем наличие credentials
        if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
            console.warn('Supabase credentials not configured in CONFIG');
            return null;
        }

        // Создаём клиент
        supabaseClient = supabase.createClient(
            CONFIG.SUPABASE_URL,
            CONFIG.SUPABASE_ANON_KEY
        );

        console.log('✅ Supabase client initialized successfully');
        return supabaseClient;

    } catch (error) {
        console.error('❌ Error initializing Supabase:', error);
        return null;
    }
}

/**
 * Получить Supabase клиент
 * @returns {Object|null} Supabase клиент
 */
function getSupabaseClient() {
    if (!supabaseClient) {
        return initializeSupabase();
    }
    return supabaseClient;
}

/**
 * Проверка подключения к Supabase
 * @returns {Promise<boolean>} true если подключение успешно
 */
async function testSupabaseConnection() {
    try {
        const client = getSupabaseClient();
        if (!client) {
            console.error('Supabase client not initialized');
            return false;
        }

        // Простой запрос для проверки подключения к таблице kanban_cards
        const { data, error } = await client
            .from(CONFIG.TABLES.CARDS)
            .select('count')
            .limit(1);

        if (error) {
            console.error('Supabase connection test failed:', error.message);
            return false;
        }

        console.log('✅ Supabase connection test successful');
        return true;

    } catch (error) {
        console.error('❌ Error testing Supabase connection:', error);
        return false;
    }
}
