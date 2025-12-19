-- ============================================================
-- Создание профиля для существующего пользователя
-- ============================================================
-- Выполните этот SQL в Supabase SQL Editor
-- ============================================================

-- Вставьте ваш user_id сюда (замените на свой!)
-- Ваш user_id: c325b153-13a5-4000-97de-681fb1c7ca0b

INSERT INTO kanban_user_profiles (user_id, nickname, email)
VALUES (
  'c325b153-13a5-4000-97de-681fb1c7ca0b',  -- ← ваш user_id
  'Наталья',  -- ← измените на желаемый никнейм
  'mizinatalya@yandex.ru'  -- ← ваш email
)
ON CONFLICT (user_id) DO NOTHING;

-- Проверка: посмотреть созданный профиль
SELECT * FROM kanban_user_profiles WHERE user_id = 'c325b153-13a5-4000-97de-681fb1c7ca0b';
