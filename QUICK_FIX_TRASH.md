# Быстрое исправление: Корзина не появляется в Production

## Проблема
В тестовом режиме корзина работала отлично, но в реальном канбане не появилась.

## Причина
**Миграция базы данных НЕ была применена на production сервере Supabase.**

Весь код корзины уже загружен на GitHub и работает, но таблица `kanban_trash` не создана в БД.

---

## Решение (5 минут)

### Шаг 1: Откройте Supabase Dashboard
1. Перейдите: https://supabase.com/dashboard
2. Войдите в аккаунт
3. Выберите ваш проект

### Шаг 2: Откройте SQL Editor
1. В левом меню: **SQL Editor**
2. Нажмите **New Query**

### Шаг 3: Скопируйте и выполните SQL

Вставьте этот код в редактор и нажмите **Run**:

```sql
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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
```

### Шаг 4: Включите Realtime

В SQL Editor выполните ещё один запрос:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE kanban_trash;
```

### Шаг 5: Проверьте

1. Обновите страницу канбана с очисткой кэша: **Ctrl+Shift+R** (Windows/Linux) или **Cmd+Shift+R** (Mac)
2. Войдите в аккаунт
3. **Кнопка "🗑️ Корзина" должна появиться в header справа**
4. Нажмите на неё - откроется модальное окно корзины
5. Попробуйте удалить карточку - она должна попасть в корзину

---

## Проверка успешности

### ✅ Миграция выполнена успешно если:
- В SQL Editor появилось сообщение "Success"
- В Table Editor появилась таблица **kanban_trash**
- На странице канбана появилась кнопка "🗑️ Корзина"
- При клике на кнопку открывается модальное окно
- Удалённые карточки попадают в корзину

### ❌ Если что-то пошло не так:

**Ошибка: "relation kanban_trash already exists"**
- Это нормально! Таблица уже создана, всё работает.

**Ошибка: "column completed_at already exists"**
- Это нормально! Поле уже добавлено, всё работает.

**Кнопка корзины всё ещё не появляется:**
1. Проверьте, что вы вошли в аккаунт (кнопка видна только авторизованным)
2. Очистите кэш браузера полностью: Settings → Privacy → Clear browsing data
3. Откройте консоль браузера (F12) и проверьте ошибки
4. Убедитесь, что файлы с GitHub синхронизированы на production сервере

---

## Дополнительная информация

- Полная документация: `TRASH_FEATURE_README.md`
- Подробная инструкция: `MANUAL_MIGRATION_STEPS.md`
- Файл миграции: `migration.sql`

---

**Время выполнения**: 5 минут
**Сложность**: Низкая
**Результат**: Работающая корзина в production
