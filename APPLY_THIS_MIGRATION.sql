-- ============================================================
-- МИГРАЦИЯ: Создание таблицы профилей пользователей
-- ============================================================
-- ИНСТРУКЦИЯ:
-- 1. Откройте Supabase Dashboard: https://supabase.com/dashboard
-- 2. Выберите ваш проект (kxnlthfsxtrdswqriaan)
-- 3. Перейдите в SQL Editor (левое меню)
-- 4. Скопируйте и вставьте ВЕСЬ этот код
-- 5. Нажмите "Run" или Ctrl+Enter
-- ============================================================

-- Создание таблицы профилей пользователей
CREATE TABLE IF NOT EXISTS kanban_user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Комментарии
COMMENT ON TABLE kanban_user_profiles IS 'Профили пользователей с никнеймами';
COMMENT ON COLUMN kanban_user_profiles.nickname IS 'Уникальный никнейм пользователя (3-50 символов)';

-- Включить RLS
ALTER TABLE kanban_user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Политики
-- Все могут читать профили
DROP POLICY IF EXISTS "Профили видны всем" ON kanban_user_profiles;
CREATE POLICY "Профили видны всем" ON kanban_user_profiles
  FOR SELECT USING (true);

-- Пользователь может создавать только свой профиль
DROP POLICY IF EXISTS "Создание только своего профиля" ON kanban_user_profiles;
CREATE POLICY "Создание только своего профиля" ON kanban_user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Пользователь может обновлять только свой профиль
DROP POLICY IF EXISTS "Обновление только своего профиля" ON kanban_user_profiles;
CREATE POLICY "Обновление только своего профиля" ON kanban_user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Индекс для поиска по nickname
CREATE INDEX IF NOT EXISTS idx_user_profiles_nickname ON kanban_user_profiles(nickname);

-- Триггер автообновления updated_at (используем существующую функцию)
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON kanban_user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON kanban_user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Готово!
SELECT 'Таблица kanban_user_profiles успешно создана!' AS status;
