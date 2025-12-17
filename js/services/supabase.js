// ============================================================
// SUPABASE CLIENT INITIALIZATION
// ============================================================

/**
 * Инициализация и экспорт Supabase клиента
 * Использует credentials из CONFIG
 */

let supabaseClient = null;

/**
 * Проверить доступность Supabase
 */
async function checkSupabaseAccessibility() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(CONFIG.SUPABASE_URL + '/rest/v1/', {
            method: 'HEAD',
            signal: controller.signal,
            headers: { 'apikey': CONFIG.SUPABASE_ANON_KEY }
        });

        clearTimeout(timeoutId);

        if (response.ok || response.status === 401) {
            return { accessible: true, error: null };
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('Supabase недоступен:', error);

        let errorType = 'unknown';
        if (error.name === 'AbortError') {
            errorType = 'timeout';
        } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            errorType = 'network';
        }

        return { accessible: false, error, errorType };
    }
}

/**
 * Показать уведомление о проблемах с подключением
 */
function showConnectionError(errorType) {
    const banner = document.getElementById('notification-banner');
    if (!banner) return;

    let message = '';

    if (errorType === 'network') {
        message = '🔴 Не удается подключиться к Supabase. Сервис может быть заблокирован в России. Попробуйте использовать VPN.';
    } else if (errorType === 'timeout') {
        message = '⏱️ Превышено время ожидания подключения. Проверьте интернет-соединение.';
    } else if (errorType === 'library') {
        message = '❌ Библиотека Supabase не загружена. Обновите страницу.';
    } else {
        message = '❌ Ошибка подключения к серверу. Попробуйте позже.';
    }

    banner.textContent = message;
    banner.className = 'notification-banner error';
    banner.classList.remove('hidden');
}

/**
 * Обертка для retry запросов с exponential backoff
 */
async function withRetry(asyncFn, maxRetries = 3) {
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await asyncFn();
        } catch (error) {
            lastError = error;
            console.warn(`Попытка ${attempt + 1}/${maxRetries} не удалась:`, error);

            if (attempt < maxRetries - 1) {
                const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError;
}

/**
 * Инициализирует Supabase клиент
 * @returns {Object|null} Инициализированный клиент Supabase или null при ошибке
 */
async function initializeSupabase() {
    try {
        // Проверяем наличие библиотеки Supabase
        if (typeof supabase === 'undefined') {
            console.error('Supabase library not loaded');
            showConnectionError('library');
            return null;
        }

        // Проверяем наличие credentials
        if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
            console.warn('Supabase credentials not configured');
            return null;
        }

        // Проверить доступность
        const { accessible, errorType } = await checkSupabaseAccessibility();

        if (!accessible) {
            console.error('❌ Supabase недоступен');
            showConnectionError(errorType);
        }

        // Создать клиент с расширенными настройками
        supabaseClient = supabase.createClient(
            CONFIG.SUPABASE_URL,
            CONFIG.SUPABASE_ANON_KEY,
            {
                auth: {
                    autoRefreshToken: true,
                    persistSession: true,
                    detectSessionInUrl: true
                },
                realtime: {
                    params: {
                        eventsPerSecond: 10
                    },
                    // Таймауты для более быстрого восстановления соединения
                    timeout: 10000,
                    heartbeatIntervalMs: 15000
                },
                global: {
                    headers: {
                        'X-Client-Info': 'kanban-app'
                    }
                }
            }
        );

        console.log('✅ Supabase client initialized');
        return supabaseClient;

    } catch (error) {
        console.error('❌ Error initializing Supabase:', error);
        showConnectionError('unknown');
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
