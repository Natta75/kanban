# Пошаговая инструкция по применению миграции

## Важно!
К сожалению, прямое подключение к Supabase заблокировано на уровне сети. Миграцию нужно выполнить вручную через веб-интерфейс Supabase Dashboard.

## Шаги выполнения:

### Шаг 1: Откройте Supabase Dashboard
1. Перейдите по ссылке: **https://supabase.com/dashboard**
2. Войдите в свой аккаунт
3. Выберите проект **kxnlthfsxtrdswqrian**

### Шаг 2: Откройте SQL Editor
1. В левом меню найдите раздел **SQL Editor** (иконка с символом `</>`)
2. Нажмите на него
3. Нажмите кнопку **New Query** (или "Новый запрос")

### Шаг 3: Скопируйте SQL код
Откройте файл `migration.sql` в этой директории и скопируйте весь его содержимый.

Или скопируйте SQL код отсюда:

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
```

### Шаг 4: Вставьте код и выполните
1. Вставьте скопированный SQL код в редактор запросов
2. Нажмите кнопку **Run** (или `Ctrl+Enter` / `Cmd+Enter`)
3. Дождитесь выполнения (может занять несколько секунд)

### Шаг 5: Проверьте успешность выполнения
После выполнения вы должны увидеть сообщение "Success" внизу редактора.

Проверьте создание таблицы:
1. В левом меню откройте **Table Editor**
2. Найдите таблицу **kanban_trash** в списке таблиц
3. Если таблица появилась - миграция прошла успешно!

### Шаг 6: Включите Realtime для таблицы корзины
1. В Table Editor выберите таблицу **kanban_trash**
2. Справа найдите кнопку с тремя точками (⋮) или шестерёнку
3. Выберите **Edit table**
4. Найдите опцию **Enable Realtime** и включите её
5. Сохраните изменения

**ИЛИ** выполните этот SQL в SQL Editor:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE kanban_trash;
```

### Шаг 7: Тестирование
1. Обновите страницу вашего Kanban приложения (`Ctrl+F5` или `Cmd+Shift+R`)
2. Войдите в аккаунт (если не вошли)
3. В header должна появиться кнопка **🗑️ Корзина**
4. Попробуйте:
   - Нажать на кнопку корзины (должно открыться модальное окно)
   - Удалить карточку (она должна попасть в корзину, а не удалиться полностью)
   - Открыть корзину и увидеть удалённую карточку
   - Восстановить карточку из корзины

## Что делать если возникли ошибки?

### Ошибка: "relation kanban_trash already exists"
Это нормально! Таблица уже создана. Пропустите создание таблицы.

### Ошибка: "column completed_at already exists"
Это нормально! Поле уже добавлено. Пропустите добавление поля.

### Ошибка: "syntax error"
Проверьте, что скопировали весь SQL код целиком без изменений.

### Другие ошибки
Напишите текст ошибки - я помогу разобраться!

## Откат миграции (если нужно)

Если что-то пошло не так и нужно откатить изменения:

```sql
-- Удалить триггер
DROP TRIGGER IF EXISTS update_completed_at ON kanban_cards;
DROP FUNCTION IF EXISTS set_completed_at();

-- Удалить функцию автоудаления
DROP FUNCTION IF EXISTS auto_delete_old_trash();

-- Удалить таблицу корзины
DROP TABLE IF EXISTS kanban_trash;

-- Отключить Realtime для корзины
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS kanban_trash;
```

**Внимание**: Откат удалит все данные из корзины!

---

## После успешного выполнения миграции

✅ Таблица `kanban_trash` создана
✅ Поле `completed_at` добавлено в `kanban_cards`
✅ Триггеры настроены
✅ RLS политики активны
✅ Индексы созданы
✅ Realtime включен

Теперь ваш Kanban поддерживает корзину для удалённых карточек! 🎉
