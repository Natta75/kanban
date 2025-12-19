// ============================================================
// SETTINGS COMPONENT - Компонент настроек пользователя
// ============================================================

/**
 * Компонент для управления настройками профиля пользователя
 */
const SettingsComponent = {
    // DOM элементы
    modal: null,
    form: null,
    nicknameInput: null,
    emailDisplay: null,
    submitBtn: null,
    cancelBtn: null,
    closeBtn: null,
    errorDiv: null,

    // Текущий пользователь
    currentUser: null,
    currentProfile: null,

    /**
     * Инициализация компонента
     */
    init() {
        this.cacheDOM();
        this.attachEventListeners();
        console.log('✅ Settings component инициализирован');
    },

    /**
     * Кэширование DOM элементов
     */
    cacheDOM() {
        this.modal = document.getElementById('settings-modal-overlay');
        this.form = document.getElementById('settings-form');
        this.nicknameInput = document.getElementById('settings-nickname');
        this.emailDisplay = document.getElementById('settings-email');
        this.submitBtn = document.getElementById('settings-submit-btn');
        this.cancelBtn = document.getElementById('settings-cancel-btn');
        this.closeBtn = document.getElementById('close-settings-modal');
        this.errorDiv = document.getElementById('settings-error');
    },

    /**
     * Подключение обработчиков событий
     */
    attachEventListeners() {
        if (!this.form || !this.modal) {
            console.warn('Settings elements not found, skipping event listeners');
            return;
        }

        // Закрыть модальное окно
        this.cancelBtn?.addEventListener('click', () => this.closeModal());
        this.closeBtn?.addEventListener('click', () => this.closeModal());

        // Клик вне модального окна
        this.modal?.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        });

        // Escape для закрытия
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.modal?.classList.contains('hidden')) {
                this.closeModal();
            }
        });

        // Отправка формы
        this.form?.addEventListener('submit', (e) => this.handleSubmit(e));

        // Валидация никнейма при вводе
        this.nicknameInput?.addEventListener('input', () => {
            this.clearError();
        });
    },

    /**
     * Открыть модальное окно настроек
     * @param {Object} user - Текущий пользователь
     */
    async openModal(user) {
        if (!user) {
            console.error('No user provided to settings modal');
            return;
        }

        this.currentUser = user;

        // Загрузить профиль пользователя
        const { data: profile, error } = await ProfileService.getProfile(user.id);

        if (error) {
            alert('Не удалось загрузить профиль: ' + error.message);
            return;
        }

        this.currentProfile = profile;

        // Заполнить форму
        if (this.emailDisplay) {
            this.emailDisplay.textContent = user.email;
        }

        if (this.nicknameInput) {
            this.nicknameInput.value = profile?.nickname || '';
        }

        this.clearError();
        this.modal?.classList.remove('hidden');
        this.nicknameInput?.focus();
    },

    /**
     * Закрыть модальное окно
     */
    closeModal() {
        this.modal?.classList.add('hidden');
        this.clearForm();
        this.clearError();
        this.currentUser = null;
        this.currentProfile = null;
    },

    /**
     * Обработка отправки формы
     */
    async handleSubmit(e) {
        e.preventDefault();

        if (!this.currentUser) {
            this.showError('Пользователь не авторизован');
            return;
        }

        const nickname = this.nicknameInput.value.trim();

        if (!nickname) {
            this.showError('Введите никнейм');
            this.nicknameInput?.focus();
            return;
        }

        // Валидация никнейма
        const validation = ProfileService.validateNickname(nickname);
        if (!validation.valid) {
            this.showError(validation.error);
            this.nicknameInput?.focus();
            return;
        }

        // Проверить, изменился ли никнейм
        if (this.currentProfile && this.currentProfile.nickname === nickname) {
            // Никнейм не изменился, просто закрыть
            this.closeModal();
            return;
        }

        // Проверить доступность никнейма
        const { available, error: availError } = await ProfileService.checkNicknameAvailability(
            nickname,
            this.currentUser.id
        );

        if (availError) {
            this.showError('Не удалось проверить доступность никнейма');
            return;
        }

        if (!available) {
            this.showError('Этот никнейм уже занят. Выберите другой.');
            this.nicknameInput?.focus();
            return;
        }

        this.setLoading(true);
        this.clearError();

        try {
            let result;

            if (this.currentProfile) {
                // Обновить существующий профиль
                result = await ProfileService.updateProfile(this.currentUser.id, nickname);
            } else {
                // Создать новый профиль
                result = await ProfileService.createProfile(
                    this.currentUser.id,
                    nickname,
                    this.currentUser.email
                );
            }

            if (result.error) {
                this.showError('Не удалось сохранить профиль: ' + result.error.message);
                this.setLoading(false);
                return;
            }

            // Успешно сохранено
            console.log('✅ Profile saved successfully');

            // Обновить профиль в глобальном state
            if (typeof window.reloadProfiles === 'function') {
                await window.reloadProfiles();
            }

            this.closeModal();

        } catch (error) {
            console.error('Settings save error:', error);
            this.showError('Произошла ошибка при сохранении');
            this.setLoading(false);
        }
    },

    /**
     * Показать ошибку
     */
    showError(message) {
        if (!this.errorDiv) return;
        this.errorDiv.textContent = message;
        this.errorDiv.classList.remove('hidden');
    },

    /**
     * Очистить ошибку
     */
    clearError() {
        if (!this.errorDiv) return;
        this.errorDiv.textContent = '';
        this.errorDiv.classList.add('hidden');
    },

    /**
     * Очистить форму
     */
    clearForm() {
        this.form?.reset();
    },

    /**
     * Установить состояние загрузки
     */
    setLoading(isLoading) {
        if (!this.submitBtn || !this.nicknameInput) return;

        this.submitBtn.disabled = isLoading;
        this.nicknameInput.disabled = isLoading;

        if (isLoading) {
            this.submitBtn.textContent = 'Сохранение...';
        } else {
            this.submitBtn.textContent = 'Сохранить';
        }
    }
};
