-- ============================================================
-- ЭТАП 2: КОРЗИНА ДЛЯ УДАЛЁННЫХ КАРТОЧЕК
-- ============================================================

-- Добавить поле completed_at в kanban_cards
ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

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

DROP TRIGGER IF EXISTS update_completed_at ON kanban_cards;
CREATE TRIGGER update_completed_at
  BEFORE UPDATE ON kanban_cards
  FOR EACH ROW
  EXECUTE FUNCTION set_completed_at();

-- Таблица корзины
CREATE TABLE IF NOT EXISTS kanban_trash (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL,
  title VARCHAR(100) NOT NULL,
  description TEXT,
  column_id VARCHAR(20) NOT NULL,
  priority VARCHAR(10) NOT NULL,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deleted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deleted_at TIMESTAMPTZ DEFAULT NOW(),
  auto_delete_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '40 days'),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

-- RLS политики для корзины
ALTER TABLE kanban_trash ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Корзина видна всем" ON kanban_trash;
CREATE POLICY "Корзина видна всем" ON kanban_trash
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Перемещение в корзину" ON kanban_trash;
CREATE POLICY "Перемещение в корзину" ON kanban_trash
  FOR INSERT WITH CHECK (auth.uid() = deleted_by);

DROP POLICY IF EXISTS "Восстановление карточек" ON kanban_trash;
CREATE POLICY "Восстановление карточек" ON kanban_trash
  FOR DELETE USING (auth.uid() = user_id OR auth.uid() = deleted_by);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_trash_auto_delete_at ON kanban_trash(auto_delete_at);
CREATE INDEX IF NOT EXISTS idx_trash_deleted_by ON kanban_trash(deleted_by);
CREATE INDEX IF NOT EXISTS idx_trash_user_id ON kanban_trash(user_id);
CREATE INDEX IF NOT EXISTS idx_trash_deleted_at ON kanban_trash(deleted_at);

-- Функция автоудаления старых карточек из корзины
CREATE OR REPLACE FUNCTION auto_delete_old_trash()
RETURNS void AS $$
BEGIN
  DELETE FROM kanban_trash WHERE auto_delete_at <= NOW();
END;
$$ LANGUAGE plpgsql;
