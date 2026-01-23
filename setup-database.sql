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
-- 12. ЭТАП 2: КОРЗИНА ДЛЯ УДАЛЁННЫХ КАРТОЧЕК
-- ============================================================

-- Добавить поле completed_at в kanban_cards
ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

COMMENT ON COLUMN kanban_cards.completed_at IS 'Дата перемещения карточки в колонку Done';

-- Триггер для автоматического заполнения completed_at
CREATE OR REPLACE FUNCTION set_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.column_id = 'done' AND (OLD.column_id IS NULL OR OLD.column_id != 'done') THEN
    NEW.completed_at = NOW();
  ELSIF NEW.column_id != 'done' AND OLD.column_id = 'done' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_completed_at
  BEFORE UPDATE ON kanban_cards
  FOR EACH ROW
  EXECUTE FUNCTION set_completed_at();


-- ============================================================
-- 13. ТАБЛИЦА: kanban_trash (КОРЗИНА)
-- ============================================================

CREATE TABLE kanban_trash (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Оригинальный ID карточки
  card_id UUID NOT NULL,

  -- Копия данных карточки
  title VARCHAR(100) NOT NULL,
  description TEXT,
  column_id VARCHAR(20) NOT NULL,
  priority VARCHAR(10) NOT NULL,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Владелец карточки
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Кто удалил карточку
  deleted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Даты удаления
  deleted_at TIMESTAMPTZ DEFAULT NOW(),
  auto_delete_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '40 days'),

  -- Метаданные карточки
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

COMMENT ON TABLE kanban_trash IS 'Корзина для удалённых карточек (хранение 40 дней)';
COMMENT ON COLUMN kanban_trash.card_id IS 'Оригинальный ID удалённой карточки';
COMMENT ON COLUMN kanban_trash.deleted_by IS 'Кто удалил карточку';
COMMENT ON COLUMN kanban_trash.auto_delete_at IS 'Дата автоматического окончательного удаления';


-- ============================================================
-- 14. RLS ПОЛИТИКИ для kanban_trash
-- ============================================================

-- Включить RLS
ALTER TABLE kanban_trash ENABLE ROW LEVEL SECURITY;

-- Все могут видеть все удалённые карточки
CREATE POLICY "Корзина видна всем" ON kanban_trash
  FOR SELECT USING (true);

-- Вставлять могут все авторизованные пользователи
CREATE POLICY "Перемещение в корзину" ON kanban_trash
  FOR INSERT WITH CHECK (auth.uid() = deleted_by);

-- Восстанавливать может владелец или удаливший
CREATE POLICY "Восстановление карточек" ON kanban_trash
  FOR DELETE USING (auth.uid() = user_id OR auth.uid() = deleted_by);


-- ============================================================
-- 15. ИНДЕКСЫ для kanban_trash
-- ============================================================

-- Индекс для автоудаления старых карточек
CREATE INDEX idx_trash_auto_delete_at ON kanban_trash(auto_delete_at);

-- Индекс для поиска по удалившему
CREATE INDEX idx_trash_deleted_by ON kanban_trash(deleted_by);

-- Индекс для поиска по владельцу
CREATE INDEX idx_trash_user_id ON kanban_trash(user_id);

-- Индекс для поиска по дате удаления
CREATE INDEX idx_trash_deleted_at ON kanban_trash(deleted_at);


-- ============================================================
-- 16. ФУНКЦИЯ автоудаления старых карточек из корзины
-- ============================================================

CREATE OR REPLACE FUNCTION auto_delete_old_trash()
RETURNS void AS $$
BEGIN
  DELETE FROM kanban_trash WHERE auto_delete_at <= NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_delete_old_trash IS 'Удаляет карточки из корзины, у которых истёк срок хранения (40 дней)';


-- ============================================================
-- 17. REALTIME для kanban_trash
-- ============================================================

-- Включить Realtime для таблицы корзины
ALTER PUBLICATION supabase_realtime ADD TABLE kanban_trash;


-- ============================================================
-- 18. ЭТАП 4: ДИНАМИЧНЫЙ ЧЕКЛИСТ В КАРТОЧКАХ
-- ============================================================

-- Таблица чеклистов
CREATE TABLE kanban_checklist_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    card_id UUID NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
    text VARCHAR(200) NOT NULL,
    is_completed BOOLEAN DEFAULT false,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE kanban_checklist_items IS 'Чеклисты для карточек с автоматической сортировкой';
COMMENT ON COLUMN kanban_checklist_items.position IS 'Позиция пункта в чеклисте';
COMMENT ON COLUMN kanban_checklist_items.is_completed IS 'Статус выполнения пункта';


-- ============================================================
-- 19. RLS ПОЛИТИКИ для kanban_checklist_items
-- ============================================================

-- Включить RLS
ALTER TABLE kanban_checklist_items ENABLE ROW LEVEL SECURITY;

-- Видны всем (как и карточки)
CREATE POLICY "Чеклисты видны всем" ON kanban_checklist_items
    FOR SELECT USING (true);

-- CRUD только для владельца карточки
CREATE POLICY "Управление чеклистами" ON kanban_checklist_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM kanban_cards
            WHERE kanban_cards.id = card_id
            AND kanban_cards.user_id = auth.uid()
        )
    );


-- ============================================================
-- 20. ИНДЕКСЫ для kanban_checklist_items
-- ============================================================

-- Индекс для быстрого поиска по карточке
CREATE INDEX idx_checklist_card_id ON kanban_checklist_items(card_id);

-- Индекс для сортировки пунктов
CREATE INDEX idx_checklist_position ON kanban_checklist_items(card_id, position);

-- Индекс для фильтрации по статусу
CREATE INDEX idx_checklist_completed ON kanban_checklist_items(card_id, is_completed);


-- ============================================================
-- 21. ТРИГГЕРЫ для kanban_checklist_items
-- ============================================================

-- Триггер автообновления updated_at
CREATE TRIGGER update_checklist_items_updated_at
    BEFORE UPDATE ON kanban_checklist_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Триггер автопересортировки выполненных пунктов
CREATE OR REPLACE FUNCTION reorder_completed_items()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_completed = true AND OLD.is_completed = false THEN
        -- Переместить выполненный пункт в конец
        UPDATE kanban_checklist_items
        SET position = position - 1
        WHERE card_id = NEW.card_id
        AND position > OLD.position;

        NEW.position = (
            SELECT COALESCE(MAX(position), 0) + 1
            FROM kanban_checklist_items
            WHERE card_id = NEW.card_id
        );
    ELSIF NEW.is_completed = false AND OLD.is_completed = true THEN
        -- Переместить невыполненный пункт в начало невыполненных
        NEW.position = (
            SELECT COALESCE(MIN(position), 0)
            FROM kanban_checklist_items
            WHERE card_id = NEW.card_id AND is_completed = false
        );

        UPDATE kanban_checklist_items
        SET position = position + 1
        WHERE card_id = NEW.card_id
        AND position >= NEW.position
        AND id != NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reorder_checklist_on_complete
    BEFORE UPDATE ON kanban_checklist_items
    FOR EACH ROW
    WHEN (OLD.is_completed IS DISTINCT FROM NEW.is_completed)
    EXECUTE FUNCTION reorder_completed_items();


-- ============================================================
-- 22. REALTIME для kanban_checklist_items
-- ============================================================

-- Включить Realtime для таблицы чеклистов
ALTER PUBLICATION supabase_realtime ADD TABLE kanban_checklist_items;


-- ============================================================
-- ГОТОВО! ✅
-- ============================================================
-- Таблицы созданы с префиксом kanban_ для изоляции
-- RLS политики обеспечивают безопасность данных
-- Realtime включен для синхронизации
-- Индексы обеспечивают быструю работу
-- ЭТАП 1: Добавлена таблица профилей пользователей с никнеймами ✅
-- ЭТАП 2: Добавлена корзина для удалённых карточек со сроком хранения 40 дней ✅
-- ЭТАП 4: Добавлена таблица чеклистов с автоматической сортировкой ✅
-- ============================================================
