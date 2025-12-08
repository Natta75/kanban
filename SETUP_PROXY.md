# Настройка Reverse Proxy для обхода блокировки Supabase

Эта инструкция описывает как настроить reverse proxy на сервере для обхода блокировки Supabase в России.

## Проблема

Supabase (*.supabase.co) заблокирован некоторыми российскими провайдерами, что делает невозможным прямой доступ к API.

## Решение

Настройка reverse proxy на собственном сервере, который перенаправляет запросы на Supabase.

```
Браузер → https://api.ваш-домен.ru → Ваш сервер (proxy) → Supabase ✅
```

---

## Требования

- VPS/VDS сервер (например, Timeweb, DigitalOcean, и т.д.)
- Ubuntu 20.04+ или Debian 10+
- Nginx
- Домен или поддомен
- SSH доступ к серверу

---

## Шаг 1: Подключение к серверу

```bash
ssh root@ваш-ip-адрес
```

---

## Шаг 2: Установка Nginx (если не установлен)

```bash
# Обновить пакеты
apt update

# Установить Nginx
apt install -y nginx

# Проверить что Nginx запущен
systemctl status nginx
```

---

## Шаг 3: Создание конфигурации Nginx

Создайте файл конфигурации для вашего поддомена:

```bash
nano /etc/nginx/sites-available/api.ваш-домен.ru
```

Вставьте следующую конфигурацию:

```nginx
server {
    listen 80;
    server_name api.ваш-домен.ru;

    # Логи
    access_log /var/log/nginx/supabase-proxy-access.log;
    error_log /var/log/nginx/supabase-proxy-error.log;

    # Проксирование на Supabase
    location / {
        # ВАЖНО: Замените на ваш URL Supabase проекта
        proxy_pass https://ваш-проект.supabase.co;

        # Заголовки для корректной работы
        proxy_set_header Host ваш-проект.supabase.co;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Передача заголовков авторизации
        proxy_pass_request_headers on;

        # Таймауты
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Буферизация
        proxy_buffering off;

        # WebSocket поддержка (для Supabase Realtime)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # SSL проверка
        proxy_ssl_verify off;
        proxy_ssl_server_name on;
    }
}
```

**ВАЖНО:** Замените:
- `api.ваш-домен.ru` на ваш реальный поддомен
- `ваш-проект.supabase.co` на URL вашего Supabase проекта

---

## Шаг 4: Активация конфигурации

```bash
# Создать симлинк
ln -s /etc/nginx/sites-available/api.ваш-домен.ru /etc/nginx/sites-enabled/

# Проверить конфигурацию на ошибки
nginx -t

# Перезагрузить Nginx
systemctl reload nginx
```

---

## Шаг 5: Настройка DNS

В панели управления доменом создайте A-запись:

```
Тип:  A
Имя:  api
Значение: IP-адрес вашего сервера
TTL: 300 (или по умолчанию)
```

Подождите 5-30 минут пока DNS обновится.

Проверить можно командой:
```bash
ping api.ваш-домен.ru
```

---

## Шаг 6: Установка SSL сертификата

```bash
# Установить certbot (если не установлен)
apt install -y certbot python3-certbot-nginx

# Получить SSL сертификат
certbot --nginx -d api.ваш-домен.ru --non-interactive --agree-tos --email ваш-email@example.com --redirect
```

Certbot автоматически:
- Получит бесплатный SSL сертификат от Let's Encrypt
- Настроит HTTPS в конфигурации Nginx
- Настроит автоматическое продление сертификата

---

## Шаг 7: Проверка работы

### Проверка REST API:
```bash
curl -I https://api.ваш-домен.ru/rest/v1/
```

Должен вернуться ответ с кодом 401 (это нормально, значит proxy работает).

### Проверка с API ключом:
```bash
curl https://api.ваш-домен.ru/rest/v1/your_table \
  -H "apikey: ваш-anon-key" \
  -H "Authorization: Bearer ваш-anon-key"
```

Если получен JSON ответ - всё работает! ✅

---

## Шаг 8: Обновление кода приложения

В файле `js/config.js` измените:

```javascript
const CONFIG = {
    // Было:
    // SUPABASE_URL: 'https://ваш-проект.supabase.co',

    // Стало:
    SUPABASE_URL: 'https://api.ваш-домен.ru',

    SUPABASE_ANON_KEY: 'ваш-ключ', // не меняется
    // ...
};
```

Загрузите обновленный файл на сервер и всё готово!

---

## Обслуживание

### Проверка логов Nginx:
```bash
# Логи доступа
tail -f /var/log/nginx/supabase-proxy-access.log

# Логи ошибок
tail -f /var/log/nginx/supabase-proxy-error.log
```

### Проверка статуса Nginx:
```bash
systemctl status nginx
```

### Перезапуск Nginx:
```bash
systemctl restart nginx
```

### Проверка SSL сертификата:
```bash
certbot certificates
```

### Продление SSL сертификата вручную (обычно не требуется):
```bash
certbot renew
```

---

## Текущие настройки проекта

### Сервер:
- **IP:** 88.218.168.98
- **ОС:** Ubuntu 24.04.3 LTS
- **Nginx:** 1.24.0

### Домены:
- **API Proxy:** https://api.75vibe-coding.ru
- **Приложение:** https://kanban.75vibe-coding.ru

### Supabase:
- **Оригинальный URL:** https://kxnlthfsxtrdswqriaan.supabase.co
- **Proxy URL:** https://api.75vibe-coding.ru

### Файлы на сервере:
- **Nginx конфиг:** `/etc/nginx/sites-available/api.75vibe-coding.ru`
- **Файлы сайта:** `/var/www/kanban.75vibe-coding.ru/`
- **SSL сертификат:** `/etc/letsencrypt/live/api.75vibe-coding.ru/`

### SSL сертификат:
- **Срок действия:** До 2026-03-08
- **Автопродление:** Настроено

---

## Устранение неполадок

### Ошибка 502 Bad Gateway
- Проверьте что URL Supabase указан правильно в конфигурации Nginx
- Проверьте логи: `tail -f /var/log/nginx/supabase-proxy-error.log`

### Ошибка SSL сертификата
- Проверьте что DNS настроен правильно
- Попробуйте переполучить сертификат: `certbot --nginx -d api.ваш-домен.ru --force-renewal`

### Приложение не работает после настройки
- Убедитесь что обновили `SUPABASE_URL` в `js/config.js`
- Очистите кеш браузера (Ctrl+Shift+R)
- Проверьте консоль браузера на наличие ошибок

### WebSocket (Realtime) не работает
- Убедитесь что в конфигурации Nginx присутствуют строки:
  ```nginx
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  ```

---

## Альтернативные решения

Если по каким-то причинам reverse proxy не подходит:

1. **VPN** - использовать VPN для обхода блокировки
2. **Cloudflare Workers** - настроить proxy через Cloudflare
3. **Переезд на другой Backend** - использовать альтернативы Supabase (Firebase, AWS Amplify)

---

## Безопасность

**Рекомендации:**
- Регулярно обновляйте сервер: `apt update && apt upgrade`
- Настройте firewall (ufw):
  ```bash
  ufw allow 22    # SSH
  ufw allow 80    # HTTP
  ufw allow 443   # HTTPS
  ufw enable
  ```
- Используйте fail2ban для защиты от брутфорса SSH
- Регулярно проверяйте логи на подозрительную активность

---

**Документация создана:** 2025-12-08
**Версия:** 1.0
