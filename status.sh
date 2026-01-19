#!/bin/bash

#================================================================
# Kanban Local Server Status Script
# Проверка статуса локального HTTP сервера
#================================================================

PORT=8000
PID_FILE="server.pid"

echo "📊 Статус локального сервера:"
echo ""

# Проверить PID файл
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "✅ Сервер запущен"
        echo "   PID: $PID"
        echo "   Порт: $PORT"
        echo "   URL: http://localhost:$PORT"

        # Показать использование памяти
        MEM=$(ps -p $PID -o rss= 2>/dev/null)
        if [ -n "$MEM" ]; then
            MEM_MB=$((MEM / 1024))
            echo "   Память: ${MEM_MB} MB"
        fi

        # Проверить размер лога
        if [ -f "server.log" ]; then
            LOG_SIZE=$(stat -f%z "server.log" 2>/dev/null || stat -c%s "server.log" 2>/dev/null)
            LOG_SIZE_MB=$((LOG_SIZE / 1024 / 1024))
            echo "   Лог: server.log (${LOG_SIZE_MB} MB)"

            # Показать последние строки лога
            if [ -s "server.log" ]; then
                echo ""
                echo "📝 Последние записи в логе:"
                tail -n 5 server.log | sed 's/^/   /'
            fi
        fi
    else
        echo "❌ Сервер не запущен (устаревший PID файл)"
        echo "   PID файл указывает на: $PID (процесс не найден)"
    fi
else
    # Проверить порт на случай, если сервер запущен без PID файла
    if lsof -ti:$PORT > /dev/null 2>&1; then
        ACTUAL_PID=$(lsof -ti:$PORT)
        echo "⚠️  Сервер запущен, но без PID файла"
        echo "   PID: $ACTUAL_PID"
        echo "   Порт: $PORT"
        echo "   URL: http://localhost:$PORT"
        echo ""
        echo "💡 Используйте ./stop.sh для остановки"
    else
        echo "❌ Сервер не запущен"
        echo ""
        echo "💡 Используйте ./start.sh для запуска"
    fi
fi

echo ""
