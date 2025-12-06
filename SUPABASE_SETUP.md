# Настройка Supabase для Kanban Board

## Шаг 1: Создание проекта Supabase

1. Перейдите на https://supabase.com
2. Нажмите "Start your project" или "New Project"
3. Войдите через GitHub (или создайте аккаунт)
4. Создайте новую организацию (если у вас её нет)
5. Создайте новый проект:
   - **Name**: kanban-board (или любое другое название)
   - **Database Password**: создайте надёжный пароль (сохраните его!)
   - **Region**: выберите ближайший регион
6. Нажмите "Create new project" и подождите ~2 минуты

## Шаг 2: Получение API ключей

1. В левом меню выберите **Settings** (⚙️)
2. Выберите **API**
3. Найдите секцию **Project API keys**
4. Скопируйте:
   - **Project URL** (например: `https://xxxxx.supabase.co`)
   - **anon/public** ключ (длинная строка)

## Шаг 3: Настройка credentials в проекте

Откройте файл `js/config.js` и заполните:

```javascript
const CONFIG = {
    // Замените на ваши данные
    SUPABASE_URL: 'https://ваш-проект.supabase.co',
    SUPABASE_ANON_KEY: 'ваш-anon-ключ',
    // ...остальные настройки
};
```

## Шаг 4: Создание таблиц в базе данных

1. В Supabase перейдите в **SQL Editor** (левое меню)
2. Нажмите **New query**
3. Скопируйте и вставьте SQL код ниже
4. Нажмите **Run** или `Ctrl+Enter`

### SQL код для создания таблиц:

```sql
-- Таблица для карточек
CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(100) NOT NULL,
  description TEXT,
  column_id VARCHAR(20) NOT NULL CHECK (column_id IN ('todo', 'inProgress', 'done')),
  priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  start_date TIMESTAMPTZ DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

-- Индексы для производительности
CREATE INDEX idx_cards_user_id ON cards(user_id);
CREATE INDEX idx_cards_column_id ON cards(column_id);
CREATE INDEX idx_cards_position ON cards(column_id, position);

-- Таблица для настроек пользователей
CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  show_all_tasks BOOLEAN DEFAULT false,
  notifications_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Шаг 5: Настройка Row Level Security (RLS)

В том же SQL Editor выполните:

```sql
-- Включить RLS для таблицы cards
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

-- Политики для cards
-- Пользователи могут видеть все карточки (для функции "показать все задачи")
CREATE POLICY "Users can view all cards"
  ON cards FOR SELECT
  USING (true);

-- Пользователи могут создавать только свои карточки
CREATE POLICY "Users can insert own cards"
  ON cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Пользователи могут обновлять только свои карточки
CREATE POLICY "Users can update own cards"
  ON cards FOR UPDATE
  USING (auth.uid() = user_id);

-- Пользователи могут удалять только свои карточки
CREATE POLICY "Users can delete own cards"
  ON cards FOR DELETE
  USING (auth.uid() = user_id);

-- Включить RLS для user_preferences
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Политика для user_preferences
CREATE POLICY "Users can manage own preferences"
  ON user_preferences FOR ALL
  USING (auth.uid() = user_id);
```

## Шаг 6: Включение Realtime

```sql
-- Включить Realtime для таблицы cards
ALTER PUBLICATION supabase_realtime ADD TABLE cards;
```

## Шаг 7: Настройка Email Authentication (опционально)

1. Перейдите в **Authentication** → **Providers**
2. Включите **Email** provider (обычно включен по умолчанию)
3. В секции **Email Templates** можно настроить шаблоны писем

## Шаг 8: Проверка подключения

1. Откройте `index.html` в браузере
2. Откройте консоль браузера (F12)
3. Вы должны увидеть:
   ```
   ✅ Supabase client initialized successfully
   ```

Если видите ошибку - проверьте:
- Правильность URL и API ключа в `js/config.js`
- Что таблицы созданы (проверьте в Supabase → Table Editor)
- Что RLS политики настроены

## Готово! 🎉

Ваш Supabase проект настроен и готов к использованию.

---

## Полезные ссылки

- [Supabase Documentation](https://supabase.com/docs)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Realtime Documentation](https://supabase.com/docs/guides/realtime)
