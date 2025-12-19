-- ============================================================
-- АВТОМАТИЧЕСКОЕ СОЗДАНИЕ ПРОФИЛЕЙ ДЛЯ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ
-- ============================================================
-- Выполните ОДИН РАЗ в Supabase SQL Editor
-- Этот скрипт создаст профили для всех существующих пользователей
-- ============================================================

-- Создать профили для всех пользователей из auth.users
INSERT INTO kanban_user_profiles (user_id, nickname, email)
SELECT
  id,
  -- Генерируем никнейм из email (часть до @)
  SPLIT_PART(email, '@', 1),
  email
FROM auth.users
WHERE NOT EXISTS (
  -- Пропускаем тех, у кого уже есть профиль
  SELECT 1 FROM kanban_user_profiles WHERE kanban_user_profiles.user_id = auth.users.id
);

-- Проверка: показать все созданные профили
SELECT
  user_id,
  nickname,
  email,
  created_at
FROM kanban_user_profiles
ORDER BY created_at DESC;
