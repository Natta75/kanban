// ============================================================
// AUTHENTICATION UI COMPONENT
// ============================================================

/**
 * Компонент управления UI аутентификации
 */

const AuthUI = {
    // DOM элементы
    modal: null,
    form: null,
    emailInput: null,
    passwordInput: null,
    submitBtn: null,
    cancelBtn: null,
    toggleBtn: null,
    toggleText: null,
    modalTitle: null,
    errorDiv: null,
    authButtons: null,
    userProfile: null,
    userEmail: null,
    logoutBtn: null,
    showLoginBtn: null,

    // Состояние
    isLoginMode: true, // true = вход, false = регистрация

    /**
     * Инициализация компонента
     */
    init() {
        this.cacheDOM();
        this.attachEventListeners();
        this.updateUIForAuthState();
    },

    /**
     * Кэширование DOM элементов
     */
    cacheDOM() {
        this.modal = document.getElementById('auth-modal-overlay');
        this.form = document.getElementById('auth-form');
        this.emailInput = document.getElementById('auth-email');
        this.passwordInput = document.getElementById('auth-password');
        this.submitBtn = document.getElementById('auth-submit-btn');
        this.cancelBtn = document.getElementById('auth-cancel-btn');
        this.toggleBtn = document.getElementById('auth-toggle-btn');
        this.toggleText = document.getElementById('auth-toggle-text');
        this.modalTitle = document.getElementById('auth-modal-title');
        this.errorDiv = document.getElementById('auth-error');
        this.authButtons = document.getElementById('auth-buttons');
        this.userProfile = document.getElementById('user-profile');
        this.userEmail = document.getElementById('user-email');
        this.logoutBtn = document.getElementById('logout-btn');
        this.showLoginBtn = document.getElementById('show-login-btn');
    },

    /**
     * Подключение обработчиков событий
     */
    attachEventListeners() {
        // Открыть модальное окно входа
        this.showLoginBtn?.addEventListener('click', () => this.openLoginModal());

        // Закрыть модальное окно
        this.cancelBtn?.addEventListener('click', () => this.closeModal());
        document.getElementById('close-auth-modal')?.addEventListener('click', () => this.closeModal());

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

        // Переключение между входом и регистрацией
        this.toggleBtn?.addEventListener('click', () => this.toggleMode());

        // Отправка формы
        this.form?.addEventListener('submit', (e) => this.handleSubmit(e));

        // Выход
        this.logoutBtn?.addEventListener('click', () => this.handleLogout());
    },

    /**
     * Открыть модальное окно входа
     */
    openLoginModal() {
        this.isLoginMode = true;
        this.updateModalContent();
        this.clearForm();
        this.clearError();
        this.modal?.classList.remove('hidden');
        this.emailInput?.focus();
    },

    /**
     * Открыть модальное окно регистрации
     */
    openRegisterModal() {
        this.isLoginMode = false;
        this.updateModalContent();
        this.clearForm();
        this.clearError();
        this.modal?.classList.remove('hidden');
        this.emailInput?.focus();
    },

    /**
     * Закрыть модальное окно
     */
    closeModal() {
        this.modal?.classList.add('hidden');
        this.clearForm();
        this.clearError();
    },

    /**
     * Переключение между режимами вход/регистрация
     */
    toggleMode() {
        this.isLoginMode = !this.isLoginMode;
        this.updateModalContent();
        this.clearError();
    },

    /**
     * Обновить содержимое модального окна
     */
    updateModalContent() {
        if (this.isLoginMode) {
            this.modalTitle.textContent = 'Вход';
            this.submitBtn.textContent = 'Войти';
            this.toggleText.textContent = 'Нет аккаунта?';
            this.toggleBtn.textContent = 'Зарегистрироваться';
        } else {
            this.modalTitle.textContent = 'Регистрация';
            this.submitBtn.textContent = 'Зарегистрироваться';
            this.toggleText.textContent = 'Уже есть аккаунт?';
            this.toggleBtn.textContent = 'Войти';
        }
    },

    /**
     * Обработка отправки формы
     */
    async handleSubmit(e) {
        e.preventDefault();

        const email = this.emailInput.value.trim();
        const password = this.passwordInput.value;

        if (!email || !password) {
            this.showError('Заполните все поля');
            return;
        }

        this.setLoading(true);
        this.clearError();

        try {
            let result;
            if (this.isLoginMode) {
                result = await AuthService.signIn(email, password);
            } else {
                result = await AuthService.signUp(email, password);
            }

            if (result.error) {
                this.showError(this.getErrorMessage(result.error));
                this.setLoading(false);
                return;
            }

            // Успешная аутентификация
            this.closeModal();
            this.updateUIForAuthState(result.user);

        } catch (error) {
            console.error('Auth error:', error);
            this.showError('Произошла ошибка. Попробуйте снова.');
            this.setLoading(false);
        }
    },

    /**
     * Обработка выхода
     */
    async handleLogout() {
        const confirmed = confirm('Вы уверены, что хотите выйти?');
        if (!confirmed) return;

        const { error } = await AuthService.signOut();

        if (error) {
            alert('Ошибка при выходе: ' + error.message);
            return;
        }

        this.updateUIForAuthState(null);
    },

    /**
     * Обновить UI в зависимости от состояния авторизации
     */
    async updateUIForAuthState(user = null) {
        // Если user не передан, получаем текущего пользователя
        if (user === null) {
            user = await AuthService.getCurrentUser();
        }

        if (user) {
            // Пользователь авторизован
            this.authButtons?.classList.add('hidden');
            this.userProfile?.classList.remove('hidden');
            this.userEmail.textContent = user.email;
        } else {
            // Пользователь не авторизован
            this.authButtons?.classList.remove('hidden');
            this.userProfile?.classList.add('hidden');
            this.userEmail.textContent = '';
        }
    },

    /**
     * Показать ошибку
     */
    showError(message) {
        this.errorDiv.textContent = message;
        this.errorDiv.classList.remove('hidden');
    },

    /**
     * Очистить ошибку
     */
    clearError() {
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
        this.submitBtn.disabled = isLoading;
        this.emailInput.disabled = isLoading;
        this.passwordInput.disabled = isLoading;

        if (isLoading) {
            this.submitBtn.textContent = 'Загрузка...';
        } else {
            this.updateModalContent();
        }
    },

    /**
     * Получить понятное сообщение об ошибке
     */
    getErrorMessage(error) {
        const message = error.message || error.toString();

        // Типичные ошибки Supabase
        if (message.includes('Invalid login credentials')) {
            return 'Неверный email или пароль';
        }
        if (message.includes('User already registered')) {
            return 'Пользователь с таким email уже существует';
        }
        if (message.includes('Email not confirmed')) {
            return 'Подтвердите email перед входом';
        }
        if (message.includes('Password should be at least 6 characters')) {
            return 'Пароль должен содержать минимум 6 символов';
        }
        if (message.includes('не настроен')) {
            return 'Supabase не настроен. Обратитесь к администратору.';
        }

        return message;
    }
};
