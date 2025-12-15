// ============================================================
// URL UTILITIES - Утилиты для работы с URL в тексте
// ============================================================

/**
 * Утилиты для детекции и преобразования URL в кликабельные ссылки
 */
const URLUtils = {
    /**
     * Regex паттерн для поиска URL с протоколами http:// и https://
     * Детектирует:
     * - https://example.com
     * - http://example.com
     *
     * НЕ детектирует (требуется явный протокол):
     * - www.example.com
     * - example.com
     */
    URL_PATTERN: /(https?:\/\/[^\s<>"{|}\\^`\[\]]+)/gi,

    /**
     * Детектирует URL в тексте и разбивает текст на сегменты
     * @param {string} text - Текст для анализа
     * @returns {Array<{type: string, content: string}>} Массив сегментов (text или url)
     */
    detectURLs(text) {
        if (!text) return [];

        const segments = [];
        let lastIndex = 0;

        // Создаем новый RegExp для каждого вызова, чтобы сбросить lastIndex
        const regex = new RegExp(this.URL_PATTERN.source, this.URL_PATTERN.flags);
        let match;

        while ((match = regex.exec(text)) !== null) {
            // Добавляем текст перед URL (если есть)
            if (match.index > lastIndex) {
                segments.push({
                    type: 'text',
                    content: text.slice(lastIndex, match.index)
                });
            }

            // Добавляем найденный URL
            segments.push({
                type: 'url',
                content: match[0]
            });

            lastIndex = regex.lastIndex;
        }

        // Добавляем оставшийся текст после последнего URL
        if (lastIndex < text.length) {
            segments.push({
                type: 'text',
                content: text.slice(lastIndex)
            });
        }

        return segments;
    },

    /**
     * Валидация URL - проверяет безопасность и корректность
     * @param {string} url - URL для валидации
     * @returns {boolean} true если URL безопасен и валиден
     */
    isValidURL(url) {
        if (!url || typeof url !== 'string') return false;

        try {
            const urlObj = new URL(url);

            // Разрешаем только http и https протоколы
            // Блокируем javascript:, data:, file:, и другие опасные протоколы
            if (!['http:', 'https:'].includes(urlObj.protocol)) {
                return false;
            }

            return true;
        } catch (error) {
            // Невалидный URL
            return false;
        }
    },

    /**
     * Создает безопасный элемент <a> для URL
     * @param {string} url - URL для создания ссылки
     * @returns {HTMLAnchorElement|null} Элемент ссылки или null если URL небезопасен
     */
    createSafeURLElement(url) {
        // Валидация URL перед созданием ссылки
        if (!this.isValidURL(url)) {
            return null;
        }

        // Создаем элемент через DOM API (безопасно, не использует innerHTML)
        const link = document.createElement('a');

        // Устанавливаем атрибуты через свойства элемента
        link.href = url;
        link.textContent = url; // Показываем оригинальный URL как текст
        link.target = '_blank'; // Открывать в новой вкладке
        link.rel = 'noopener noreferrer'; // Безопасность: предотвращает доступ через window.opener

        return link;
    },

    /**
     * Преобразует текст с URL в DocumentFragment с кликабельными ссылками
     * @param {string} text - Текст описания карточки
     * @returns {DocumentFragment} Fragment с текстом и ссылками для вставки в DOM
     */
    renderDescriptionWithLinks(text) {
        const fragment = document.createDocumentFragment();

        // Если текст пустой, возвращаем пустой fragment
        if (!text) {
            return fragment;
        }

        // Детектируем URL и разбиваем текст на сегменты
        const segments = this.detectURLs(text);

        // Если URL не найдены, возвращаем просто текстовый узел
        if (segments.length === 0) {
            fragment.appendChild(document.createTextNode(text));
            return fragment;
        }

        // Создаем узлы для каждого сегмента
        segments.forEach(segment => {
            if (segment.type === 'url') {
                // Создаем безопасную ссылку
                const linkElement = this.createSafeURLElement(segment.content);

                if (linkElement) {
                    fragment.appendChild(linkElement);
                } else {
                    // Если URL оказался небезопасным, показываем как обычный текст
                    fragment.appendChild(document.createTextNode(segment.content));
                }
            } else {
                // Обычный текст
                fragment.appendChild(document.createTextNode(segment.content));
            }
        });

        return fragment;
    }
};
