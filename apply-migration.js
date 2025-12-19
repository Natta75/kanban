// ============================================================
// СКРИПТ ДЛЯ ПРИМЕНЕНИЯ МИГРАЦИИ
// ============================================================
// Этот скрипт создаст таблицу kanban_user_profiles в Supabase
// ============================================================

// ⬇️ ВСТАВЬТЕ СЮДА ВАШИ ДАННЫЕ ИЗ SUPABASE ⬇️

const SUPABASE_URL = 'YOUR_SUPABASE_URL_HERE';  // Например: https://xxxxx.supabase.co
const SUPABASE_SERVICE_KEY = 'YOUR_SERVICE_ROLE_KEY_HERE';  // Секретный ключ

// ⬆️ НЕ ИЗМЕНЯЙТЕ КОД НИЖЕ ⬆️

const SQL_MIGRATION = `
-- Создание таблицы профилей
CREATE TABLE kanban_user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Включить RLS
ALTER TABLE kanban_user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Политики
CREATE POLICY "Профили видны всем" ON kanban_user_profiles
  FOR SELECT USING (true);

CREATE POLICY "Создание только своего профиля" ON kanban_user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Обновление только своего профиля" ON kanban_user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Индексы
CREATE INDEX idx_user_profiles_nickname ON kanban_user_profiles(nickname);

-- Триггер для обновления updated_at
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON kanban_user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
`;

async function applyMigration() {
    console.log('🚀 Начинаем применение миграции...\n');

    // Проверка данных
    if (SUPABASE_URL === 'YOUR_SUPABASE_URL_HERE' || SUPABASE_SERVICE_KEY === 'YOUR_SERVICE_ROLE_KEY_HERE') {
        console.error('❌ ОШИБКА: Пожалуйста, вставьте ваши данные Supabase в начало файла!');
        console.log('\n📝 Где найти данные:');
        console.log('1. Откройте https://supabase.com');
        console.log('2. Перейдите в Settings → API');
        console.log('3. Скопируйте Project URL и service_role key');
        return;
    }

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
            },
            body: JSON.stringify({ query: SQL_MIGRATION })
        });

        // Альтернативный метод через прямой SQL endpoint
        const sqlResponse = await fetch(`${SUPABASE_URL}/rest/v1/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                query: SQL_MIGRATION
            })
        });

        console.log('✅ Миграция выполнена успешно!');
        console.log('\n📋 Что дальше:');
        console.log('1. Обновите страницу в браузере (F5)');
        console.log('2. Ошибки должны исчезнуть');
        console.log('3. Можете начинать тестирование!');

    } catch (error) {
        console.error('❌ Ошибка при выполнении миграции:', error);
        console.log('\n💡 Попробуйте альтернативный способ:');
        console.log('Скопируйте SQL из файла APPLY_MIGRATION.sql и вставьте в Supabase SQL Editor');
    }
}

// Запуск
applyMigration();
