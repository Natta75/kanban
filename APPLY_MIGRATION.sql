-- ============================================================
-- МИГРАЦИЯ: Создание таблицы профилей пользователей
-- ============================================================
-- Скопируйте весь этот код и выполните в Supabase SQL Editor
-- ============================================================

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

-- Готово!
SELECT 'Миграция завершена успешно!' AS result;
