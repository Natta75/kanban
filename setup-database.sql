-- ============================================================
-- KANBAN BOARD - DATABASE SETUP
-- ============================================================
-- Этот скрипт создаёт все необходимые таблицы, индексы,
-- Row Level Security политики и настраивает Realtime
-- ============================================================

-- ============================================================
-- 1. ТАБЛИЦА: kanban_cards
-- ============================================================

CREATE TABLE kanban_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Основные поля
  title VARCHAR(100) NOT NULL,
  description TEXT,

  -- Колонка на доске
  column_id VARCHAR(20) NOT NULL CHECK (column_id IN ('todo', 'inProgress', 'done')),

  -- Приоритет
  priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),

  -- Даты
  start_date TIMESTAMPTZ DEFAULT NOW(),
  end_date TIMESTAMPTZ,

  -- Владелец карточки
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Позиция для drag & drop
  position INTEGER NOT NULL DEFAULT 0,

  -- Метаданные
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Проверка корректности дат
  CONSTRAINT valid_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

-- Комментарии к таблице
COMMENT ON TABLE kanban_cards IS 'Карточки для Kanban доски';
COMMENT ON COLUMN kanban_cards.column_id IS 'Колонка: todo, inProgress, done';
COMMENT ON COLUMN kanban_cards.priority IS 'Приоритет: low, medium, high';
COMMENT ON COLUMN kanban_cards.position IS 'Позиция карточки в колонке для сортировки';


-- ============================================================
-- 2. ИНДЕКСЫ для производительности
-- ============================================================

-- Быстрый поиск карточек по пользователю
CREATE INDEX idx_kanban_cards_user_id ON kanban_cards(user_id);

-- Быстрый поиск по колонке
CREATE INDEX idx_kanban_cards_column_id ON kanban_cards(column_id);

-- Сортировка по позиции внутри колонки
CREATE INDEX idx_kanban_cards_position ON kanban_cards(column_id, position);

-- Поиск по приоритету
CREATE INDEX idx_kanban_cards_priority ON kanban_cards(priority);

-- Поиск просроченных задач
CREATE INDEX idx_kanban_cards_end_date ON kanban_cards(end_date) WHERE end_date IS NOT NULL;


-- ============================================================
-- 3. ТАБЛИЦА: kanban_user_preferences
-- ============================================================

CREATE TABLE kanban_user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Настройки отображения
  show_all_tasks BOOLEAN DEFAULT false,

  -- Настройки уведомлений
  notifications_enabled BOOLEAN DEFAULT true,

  -- Метаданные
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE kanban_user_preferences IS 'Пользовательские настройки для Kanban доски';
COMMENT ON COLUMN kanban_user_preferences.show_all_tasks IS 'Показывать все задачи (true) или только свои (false)';


-- ============================================================
-- 4. ROW LEVEL SECURITY (RLS) - Безопасность
-- ============================================================

-- Включить RLS для таблицы kanban_cards
ALTER TABLE kanban_cards ENABLE ROW LEVEL SECURITY;

-- Политика: Пользователи могут видеть все карточки
-- (необходимо для функции "показать все задачи")
CREATE POLICY "Users can view all kanban cards"
  ON kanban_cards FOR SELECT
  USING (true);

-- Политика: Пользователи могут создавать только свои карточки
CREATE POLICY "Users can insert own kanban cards"
  ON kanban_cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Политика: Пользователи могут обновлять только свои карточки
CREATE POLICY "Users can update own kanban cards"
  ON kanban_cards FOR UPDATE
  USING (auth.uid() = user_id);

-- Политика: Пользователи могут удалять только свои карточки
CREATE POLICY "Users can delete own kanban cards"
  ON kanban_cards FOR DELETE
  USING (auth.uid() = user_id);


-- Включить RLS для таблицы kanban_user_preferences
ALTER TABLE kanban_user_preferences ENABLE ROW LEVEL SECURITY;

-- Политика: Пользователи могут управлять только своими настройками
CREATE POLICY "Users can manage own kanban preferences"
  ON kanban_user_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- 5. REALTIME - Синхронизация в реальном времени
-- ============================================================

-- Включить Realtime для таблицы kanban_cards
ALTER PUBLICATION supabase_realtime ADD TABLE kanban_cards;

-- Включить Realtime для таблицы kanban_user_preferences (опционально)
-- ALTER PUBLICATION supabase_realtime ADD TABLE kanban_user_preferences;


-- ============================================================
-- 6. ТРИГГЕРЫ для автоматического обновления updated_at
-- ============================================================

-- Функция для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для kanban_cards
CREATE TRIGGER update_kanban_cards_updated_at
  BEFORE UPDATE ON kanban_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Триггер для kanban_user_preferences
CREATE TRIGGER update_kanban_user_preferences_updated_at
  BEFORE UPDATE ON kanban_user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 7. ТАБЛИЦА: kanban_user_profiles (ЭТАП 1)
-- ============================================================
-- Профили пользователей с никнеймами

CREATE TABLE kanban_user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE kanban_user_profiles IS 'Профили пользователей с никнеймами';
COMMENT ON COLUMN kanban_user_profiles.nickname IS 'Уникальный никнейм пользователя (3-50 символов)';


-- ============================================================
-- 8. RLS ПОЛИТИКИ для kanban_user_profiles
-- ============================================================

-- Включить RLS
ALTER TABLE kanban_user_profiles ENABLE ROW LEVEL SECURITY;

-- Все могут читать профили
CREATE POLICY "Профили видны всем" ON kanban_user_profiles
  FOR SELECT USING (true);

-- Пользователь может создавать только свой профиль
CREATE POLICY "Создание только своего профиля" ON kanban_user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Пользователь может обновлять только свой профиль
CREATE POLICY "Обновление только своего профиля" ON kanban_user_profiles
  FOR UPDATE USING (auth.uid() = user_id);


-- ============================================================
-- 9. ИНДЕКСЫ для kanban_user_profiles
-- ============================================================

-- Индекс для поиска по nickname
CREATE INDEX idx_user_profiles_nickname ON kanban_user_profiles(nickname);


-- ============================================================
-- 10. ТРИГГЕР для kanban_user_profiles
-- ============================================================

-- Триггер автообновления updated_at
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON kanban_user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 11. ТЕСТОВЫЕ ДАННЫЕ (опционально - закомментировано)
-- ============================================================

-- Раскомментируйте, если хотите добавить тестовые данные
-- ВАЖНО: Замените 'YOUR_USER_ID' на реальный UUID пользователя

/*
INSERT INTO kanban_cards (title, description, column_id, priority, user_id) VALUES
  ('Первая задача', 'Описание первой задачи', 'todo', 'high', 'YOUR_USER_ID'),
  ('Вторая задача', 'Описание второй задачи', 'inProgress', 'medium', 'YOUR_USER_ID'),
  ('Третья задача', 'Описание третьей задачи', 'done', 'low', 'YOUR_USER_ID');
*/


-- ============================================================
-- ГОТОВО! ✅
-- ============================================================
-- Таблицы созданы с префиксом kanban_ для изоляции
-- RLS политики обеспечивают безопасность данных
-- Realtime включен для синхронизации
-- Индексы обеспечивают быструю работу
-- ЭТАП 1: Добавлена таблица профилей пользователей с никнеймами
-- ============================================================
