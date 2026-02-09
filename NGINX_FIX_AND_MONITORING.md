# Исправление проблемы с Nginx и настройка мониторинга

**Дата:** 2026-02-09

## Проблема

### Симптомы
При попытке открыть сайт https://kanban.75vibe-coding.ru возникали ошибки:

**Firefox:**
```
PR_END_OF_FILE_ERROR
Ошибка при установлении защищённого соединения
```

**Yandex Browser:**
```
ERR_CONNECTION_CLOSED
Не удаётся установить соединение с сайтом
Соединение было неожиданно прервано
```

### Причина
**Nginx на сервере был остановлен**, поэтому сервер не отвечал на порты 80 (HTTP) и 443 (HTTPS).

## Решение

### Что было сделано

```bash
# 1. Запуск nginx
ssh -i ~/.ssh/kanban_deploy root@88.218.168.98 "systemctl start nginx"

# 2. Включение автозапуска при перезагрузке сервера
ssh -i ~/.ssh/kanban_deploy root@88.218.168.98 "systemctl enable nginx"
```

### Проверка работы

```bash
# Проверить статус nginx
ssh -i ~/.ssh/kanban_deploy root@88.218.168.98 "systemctl status nginx"

# Проверить доступность сайта
curl -I https://kanban.75vibe-coding.ru
```

**Результат:** Сайт работает нормально, HTTP 200 OK

## Текущий статус

- ✅ Nginx запущен
- ✅ Nginx настроен на автозапуск при перезагрузке сервера
- ✅ Сайт доступен: https://kanban.75vibe-coding.ru
- ✅ SSL сертификат действителен до **2026-05-06** (86 дней)
- ✅ Изменения в коде не требовались

## Настройка автоматического мониторинга

Чтобы получать уведомления, если сайт упадет в будущем, рекомендуется настроить один из сервисов мониторинга:

### Вариант 1: UptimeRobot (Рекомендуется)

**Преимущества:**
- Бесплатный
- Простой в настройке
- Уведомления на email, Telegram, SMS
- Проверка каждые 5 минут

**Настройка:**

1. **Регистрация:**
   - Перейдите на https://uptimerobot.com
   - Нажмите "Sign Up" (бесплатная регистрация)
   - Подтвердите email

2. **Добавление монитора:**
   - Нажмите "+ Add New Monitor"
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** Kanban Board
   - **URL:** `https://kanban.75vibe-coding.ru`
   - **Monitoring Interval:** 5 minutes
   - Нажмите "Create Monitor"

3. **Настройка уведомлений:**
   - Перейдите в "My Settings" → "Alert Contacts"
   - Добавьте email (уже добавлен по умолчанию)
   - **Опционально:** Добавьте Telegram:
     - Нажмите "Add Alert Contact"
     - Выберите "Telegram"
     - Следуйте инструкциям (нужно написать боту @uptimerobot_bot)
   - Сохраните настройки

4. **Готово!**
   - Теперь вы получите уведомление на email/Telegram, если сайт упадет
   - UptimeRobot будет проверять сайт каждые 5 минут

### Вариант 2: Better Uptime (Альтернатива)

**Преимущества:**
- Бесплатный тариф: до 10 мониторов
- Красивый интерфейс
- Интеграция со Slack, Discord, Telegram
- Проверка каждые 3 минуты

**Настройка:**

1. Регистрация: https://betteruptime.com
2. "Create Monitor" → "HTTP Monitor"
3. URL: `https://kanban.75vibe-coding.ru`
4. Настроить уведомления в разделе "Incidents"

### Вариант 3: Простой скрипт проверки (ручная проверка)

Создайте файл `check-site.sh` в корне проекта:

```bash
#!/bin/bash

echo "Проверка статуса kanban.75vibe-coding.ru..."
echo ""

# Проверка nginx на сервере
echo "1. Nginx на сервере:"
NGINX_STATUS=$(ssh -i ~/.ssh/kanban_deploy root@88.218.168.98 "systemctl is-active nginx" 2>&1)
if [ "$NGINX_STATUS" = "active" ]; then
    echo "   ✅ Запущен"
else
    echo "   ❌ НЕ запущен"
fi

# Проверка доступности сайта
echo "2. Доступность сайта:"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://kanban.75vibe-coding.ru)
if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Доступен (HTTP $HTTP_CODE)"
else
    echo "   ❌ Недоступен (HTTP $HTTP_CODE)"
fi

echo ""
echo "Проверка завершена!"
```

Сделайте скрипт исполняемым:
```bash
chmod +x check-site.sh
```

Запуск:
```bash
./check-site.sh
```

## Полезные команды

### Управление nginx на сервере

```bash
# Проверить статус
ssh -i ~/.ssh/kanban_deploy root@88.218.168.98 "systemctl status nginx"

# Запустить nginx
ssh -i ~/.ssh/kanban_deploy root@88.218.168.98 "systemctl start nginx"

# Остановить nginx
ssh -i ~/.ssh/kanban_deploy root@88.218.168.98 "systemctl stop nginx"

# Перезапустить nginx
ssh -i ~/.ssh/kanban_deploy root@88.218.168.98 "systemctl restart nginx"

# Перезагрузить конфигурацию (без остановки)
ssh -i ~/.ssh/kanban_deploy root@88.218.168.98 "systemctl reload nginx"

# Проверить, включен ли автозапуск
ssh -i ~/.ssh/kanban_deploy root@88.218.168.98 "systemctl is-enabled nginx"
```

### Проверка сайта

```bash
# Быстрая проверка доступности
curl -I https://kanban.75vibe-coding.ru

# Детальная проверка с таймингами
curl -w "@-" -o /dev/null -s https://kanban.75vibe-coding.ru <<'EOF'
    time_namelookup:  %{time_namelookup}\n
       time_connect:  %{time_connect}\n
    time_appconnect:  %{time_appconnect}\n
      time_redirect:  %{time_redirect}\n
   time_pretransfer:  %{time_pretransfer}\n
 time_starttransfer:  %{time_starttransfer}\n
                    ----------\n
         time_total:  %{time_total}\n
         http_code:  %{http_code}\n
EOF
```

### Логи nginx

```bash
# Последние ошибки
ssh -i ~/.ssh/kanban_deploy root@88.218.168.98 "tail -50 /var/log/nginx/error.log"

# Последние запросы
ssh -i ~/.ssh/kanban_deploy root@88.218.168.98 "tail -50 /var/log/nginx/access.log"

# Следить за логами в реальном времени
ssh -i ~/.ssh/kanban_deploy root@88.218.168.98 "tail -f /var/log/nginx/error.log"
```

### Проверка SSL сертификата

```bash
# Список всех сертификатов
ssh -i ~/.ssh/kanban_deploy root@88.218.168.98 "certbot certificates"

# Проверка конкретного сертификата
ssh -i ~/.ssh/kanban_deploy root@88.218.168.98 "certbot certificates | grep -A 5 'kanban.75vibe-coding.ru'"

# Обновление сертификатов (если скоро истекают)
ssh -i ~/.ssh/kanban_deploy root@88.218.168.98 "certbot renew"

# Тест обновления (dry-run)
ssh -i ~/.ssh/kanban_deploy root@88.218.168.98 "certbot renew --dry-run"
```

## Если проблема повторится

### Шаг 1: Диагностика

```bash
# 1. Проверить статус nginx
ssh -i ~/.ssh/kanban_deploy root@88.218.168.98 "systemctl status nginx"

# 2. Проверить ошибки nginx
ssh -i ~/.ssh/kanban_deploy root@88.218.168.98 "tail -100 /var/log/nginx/error.log"

# 3. Проверить конфигурацию nginx
ssh -i ~/.ssh/kanban_deploy root@88.218.168.98 "nginx -t"
```

### Шаг 2: Решение

**Если nginx остановлен:**
```bash
ssh -i ~/.ssh/kanban_deploy root@88.218.168.98 "systemctl start nginx"
```

**Если ошибка в конфигурации:**
```bash
# Проверить конфигурацию
ssh -i ~/.ssh/kanban_deploy root@88.218.168.98 "nginx -t"

# Посмотреть конфигурацию
ssh -i ~/.ssh/kanban_deploy root@88.218.168.98 "cat /etc/nginx/sites-available/kanban.75vibe-coding.ru"
```

**Если проблема с сертификатом:**
```bash
# Обновить сертификаты
ssh -i ~/.ssh/kanban_deploy root@88.218.168.98 "certbot renew --force-renewal"

# Перезапустить nginx после обновления
ssh -i ~/.ssh/kanban_deploy root@88.218.168.98 "systemctl restart nginx"
```

### Шаг 3: Проверка

```bash
# Проверить, что сайт доступен
curl -I https://kanban.75vibe-coding.ru

# Ожидаемый результат: HTTP/1.1 200 OK
```

## Профилактика

### Автоматическое обновление SSL сертификатов

SSL сертификаты от Let's Encrypt действуют 90 дней. Certbot автоматически обновляет их через cron.

**Проверить настройку автообновления:**
```bash
ssh -i ~/.ssh/kanban_deploy root@88.218.168.98 "systemctl status certbot.timer"
```

Если таймер не активен:
```bash
ssh -i ~/.ssh/kanban_deploy root@88.218.168.98 "systemctl enable --now certbot.timer"
```

### Регулярные проверки (опционально)

Рекомендуется раз в неделю проверять:
1. Статус nginx: `systemctl status nginx`
2. Логи на ошибки: `tail -50 /var/log/nginx/error.log`
3. Срок действия SSL: `certbot certificates`

Или просто настройте UptimeRobot - и забудьте об этом!

## Важные файлы на сервере

```
/etc/nginx/sites-available/kanban.75vibe-coding.ru  # Конфигурация nginx
/etc/nginx/sites-enabled/kanban.75vibe-coding.ru    # Символическая ссылка (активная конфигурация)
/var/www/kanban.75vibe-coding.ru/                   # Файлы сайта
/etc/letsencrypt/live/kanban.75vibe-coding.ru/      # SSL сертификаты
/var/log/nginx/error.log                            # Логи ошибок
/var/log/nginx/access.log                           # Логи доступа
```

## Контакты и ссылки

- **Сайт:** https://kanban.75vibe-coding.ru
- **Сервер:** 88.218.168.98
- **UptimeRobot:** https://uptimerobot.com
- **Better Uptime:** https://betteruptime.com
- **SSL сертификат действителен до:** 2026-05-06

## История

- **2026-02-09:** Nginx был остановлен, запущен вручную и настроен автозапуск
- SSL сертификат обновлен **2026-02-05**
- Следующее обновление SSL: автоматически до **2026-05-06**

---

**Рекомендация:** Настройте UptimeRobot (5 минут) и больше не беспокойтесь о проверках вручную!
