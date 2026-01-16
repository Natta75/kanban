-- ============================================================
-- Миграция: Установить completed_at для карточек в Done
-- ============================================================
-- Эта миграция устанавливает completed_at = updated_at для всех
-- карточек в колонке Done, у которых completed_at = null

UPDATE kanban_cards
SET completed_at = updated_at
WHERE column_id = 'done'
  AND completed_at IS NULL;

-- Проверить результат
SELECT
    id,
    title,
    column_id,
    completed_at,
    updated_at
FROM kanban_cards
WHERE column_id = 'done'
ORDER BY updated_at DESC
LIMIT 10;
