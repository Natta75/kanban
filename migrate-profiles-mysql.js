#!/usr/bin/env node
// ============================================================
// МИГРАЦИЯ: Создание таблицы user_profiles для MySQL
// ============================================================

const mysql = require('mysql2/promise');

const DB_CONFIG = {
  host: 'localhost',
  user: 'kanban_user',
  password: 'AeNg0ietee5quoo',
  database: 'kanban_db'
};

const MIGRATION_SQL = `
-- Создание таблицы профилей пользователей
CREATE TABLE IF NOT EXISTS user_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  nickname VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_profiles_nickname (nickname),
  INDEX idx_user_profiles_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

async function runMigration() {
  let connection;

  try {
    console.log('🚀 Подключение к базе данных...');
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Подключено успешно\n');

    console.log('📋 Выполнение миграции...');
    await connection.query(MIGRATION_SQL);
    console.log('✅ Таблица user_profiles успешно создана!\n');

    // Проверка структуры таблицы
    console.log('🔍 Проверка структуры таблицы:');
    const [columns] = await connection.query('DESCRIBE user_profiles');
    console.table(columns);

    console.log('\n✨ Миграция завершена успешно!');

  } catch (error) {
    console.error('❌ Ошибка при выполнении миграции:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runMigration();
