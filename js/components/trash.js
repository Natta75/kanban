// ============================================================
// TRASH COMPONENT - UI для корзины удалённых карточек
// ============================================================

const TrashComponent = {
    trashItems: [],
    filters: {
        owner: 'all', // 'all', 'my', или конкретный user_id
        sortBy: 'deleted_at' // 'deleted_at', 'title'
    },

    /**
     * Инициализация компонента
     */
    init() {
        this.attachEventListeners();
    },

    /**
     * Прикрепить обработчики событий
     */
    attachEventListeners() {
        // Кнопка открытия корзины
        const trashBtn = document.getElementById('trashBtn');
        if (trashBtn) {
            trashBtn.addEventListener('click', () => this.open());
        }

        // Кнопка закрытия корзины
        const closeBtn = document.getElementById('closeTrash');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        // Закрытие по клику вне модального окна
        const modal = document.getElementById('trashModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.close();
                }
            });
        }

        // Фильтр по владельцу
        const ownerFilter = document.getElementById('trashOwnerFilter');
        if (ownerFilter) {
            ownerFilter.addEventListener('change', (e) => {
                this.filters.owner = e.target.value;
                this.render();
            });
        }

        // Сортировка
        const sortBy = document.getElementById('trashSortBy');
        if (sortBy) {
            sortBy.addEventListener('change', (e) => {
                this.filters.sortBy = e.target.value;
                this.render();
            });
        }

        // Кнопка массового удаления из корзины
        const bulkDeleteBtn = document.getElementById('bulk-delete-trash-btn');
        if (bulkDeleteBtn) {
            bulkDeleteBtn.addEventListener('click', () => this.openBulkDeleteModal());
        }

        // Модальное окно массового удаления из корзины
        const closeBulkDeleteTrash = document.getElementById('closeBulkDeleteTrash');
        if (closeBulkDeleteTrash) {
            closeBulkDeleteTrash.addEventListener('click', () => this.closeBulkDeleteModal());
        }

        const bulkDeleteTrashCancelBtn = document.getElementById('bulk-delete-trash-cancel-btn');
        if (bulkDeleteTrashCancelBtn) {
            bulkDeleteTrashCancelBtn.addEventListener('click', () => this.closeBulkDeleteModal());
        }

        const bulkDeleteTrashModal = document.getElementById('bulkDeleteTrashModal');
        if (bulkDeleteTrashModal) {
            bulkDeleteTrashModal.addEventListener('click', (e) => {
                if (e.target === bulkDeleteTrashModal) {
                    this.closeBulkDeleteModal();
                }
            });
        }

        // Форма массового удаления из корзины
        const bulkDeleteTrashForm = document.getElementById('bulk-delete-trash-form');
        if (bulkDeleteTrashForm) {
            bulkDeleteTrashForm.addEventListener('submit', (e) => this.handleBulkDeleteSubmit(e));
        }

        // Preset кнопки для корзины
        document.querySelectorAll('.date-preset-trash').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const days = parseInt(e.target.dataset.days);
                this.setDatePreset(days);
            });
        });

        // Изменение дат в корзине - обновить предпросмотр
        const startDateInput = document.getElementById('bulk-delete-trash-start-date');
        const endDateInput = document.getElementById('bulk-delete-trash-end-date');
        if (startDateInput && endDateInput) {
            startDateInput.addEventListener('change', () => this.updateBulkDeletePreview());
            endDateInput.addEventListener('change', () => this.updateBulkDeletePreview());
        }
    },

    /**
     * Открыть корзину
     */
    async open() {
        const modal = document.getElementById('trashModal');
        if (modal) {
            modal.classList.remove('hidden');
            await this.loadTrash();
        }
    },

    /**
     * Закрыть корзину
     */
    close() {
        const modal = document.getElementById('trashModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    },

    /**
     * Загрузить содержимое корзины
     */
    async loadTrash() {
        const { data, error } = await TrashService.getAllTrash();

        if (error) {
            console.error('Error loading trash:', error);
            this.showError('Ошибка загрузки корзины');
            return;
        }

        this.trashItems = data || [];
        this.render();
    },

    /**
     * Отобразить корзину
     */
    render() {
        const container = document.getElementById('trashList');
        if (!container) return;

        // Применить фильтры
        let filteredItems = this.applyFilters(this.trashItems);

        // Применить сортировку
        filteredItems = this.applySorting(filteredItems);

        // Если корзина пуста
        if (filteredItems.length === 0) {
            container.innerHTML = `
                <div class="trash-empty">
                    <p>Корзина пуста</p>
                </div>
            `;
            return;
        }

        // Отобразить карточки
        container.innerHTML = filteredItems.map(item => this.renderTrashItem(item)).join('');

        // Прикрепить обработчики для кнопок
        this.attachItemEventListeners();
    },

    /**
     * Применить фильтры
     */
    applyFilters(items) {
        let filtered = [...items];

        // Фильтр по владельцу
        if (this.filters.owner === 'my' && state.user) {
            filtered = filtered.filter(item => item.user_id === state.user.id);
        } else if (this.filters.owner !== 'all') {
            filtered = filtered.filter(item => item.user_id === this.filters.owner);
        }

        return filtered;
    },

    /**
     * Применить сортировку
     */
    applySorting(items) {
        const sorted = [...items];

        if (this.filters.sortBy === 'deleted_at') {
            sorted.sort((a, b) => new Date(b.deleted_at) - new Date(a.deleted_at));
        } else if (this.filters.sortBy === 'title') {
            sorted.sort((a, b) => a.title.localeCompare(b.title));
        }

        return sorted;
    },

    /**
     * Отобразить одну карточку в корзине
     */
    renderTrashItem(item) {
        const ownerNickname = state.profiles[item.user_id]?.nickname || 'Неизвестный';
        const deletedByNickname = state.profiles[item.deleted_by]?.nickname || 'Неизвестный';
        const daysLeft = TrashService.getDaysUntilAutoDelete(item.auto_delete_at);
        const deletedDate = TrashService.formatDeletedDate(item.deleted_at);

        const priorityClass = `priority-${item.priority}`;
        const canRestore = state.user && (item.user_id === state.user.id || item.deleted_by === state.user.id);

        return `
            <div class="trash-item ${priorityClass}" data-trash-id="${item.id}">
                <div class="trash-item-header">
                    <h3 class="trash-item-title">${this.escapeHtml(item.title)}</h3>
                    <span class="trash-item-priority">${this.getPriorityText(item.priority)}</span>
                </div>

                ${item.description ? `
                    <p class="trash-item-description">${this.escapeHtml(item.description)}</p>
                ` : ''}

                <div class="trash-item-meta">
                    <div class="trash-meta-row">
                        <span class="trash-meta-label">Владелец:</span>
                        <span class="trash-meta-value">${this.escapeHtml(ownerNickname)}</span>
                    </div>
                    <div class="trash-meta-row">
                        <span class="trash-meta-label">Удалил:</span>
                        <span class="trash-meta-value">${this.escapeHtml(deletedByNickname)}</span>
                    </div>
                    <div class="trash-meta-row">
                        <span class="trash-meta-label">Удалено:</span>
                        <span class="trash-meta-value">${deletedDate}</span>
                    </div>
                    <div class="trash-meta-row">
                        <span class="trash-meta-label">Автоудаление через:</span>
                        <span class="trash-meta-value ${daysLeft <= 7 ? 'text-warning' : ''}">${daysLeft} дн.</span>
                    </div>
                </div>

                ${canRestore ? `
                    <div class="trash-item-actions">
                        <button class="btn-restore" data-trash-id="${item.id}">
                            Восстановить
                        </button>
                        <button class="btn-permanent-delete" data-trash-id="${item.id}">
                            Удалить навсегда
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    },

    /**
     * Прикрепить обработчики для кнопок карточек
     */
    attachItemEventListeners() {
        // Кнопки восстановления
        document.querySelectorAll('.btn-restore').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const trashId = e.target.dataset.trashId;
                await this.handleRestore(trashId);
            });
        });

        // Кнопки окончательного удаления
        document.querySelectorAll('.btn-permanent-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const trashId = e.target.dataset.trashId;
                await this.handlePermanentDelete(trashId);
            });
        });
    },

    /**
     * Восстановить карточку
     */
    async handleRestore(trashId) {
        if (!confirm('Восстановить эту карточку?')) {
            return;
        }

        const { data, error } = await TrashService.restoreFromTrash(trashId);

        if (error) {
            console.error('Error restoring card:', error);
            alert('Ошибка восстановления: ' + error.message);
            return;
        }

        // Обновить корзину
        await this.loadTrash();

        console.log('✅ Карточка восстановлена');
    },

    /**
     * Окончательно удалить карточку
     */
    async handlePermanentDelete(trashId) {
        if (!confirm('Удалить карточку навсегда? Это действие нельзя отменить!')) {
            return;
        }

        const { error } = await TrashService.permanentDelete(trashId);

        if (error) {
            console.error('Error permanently deleting:', error);
            alert('Ошибка удаления: ' + error.message);
            return;
        }

        // Обновить корзину
        await this.loadTrash();

        console.log('✅ Карточка удалена навсегда');
    },

    /**
     * Показать ошибку
     */
    showError(message) {
        const container = document.getElementById('trashList');
        if (container) {
            container.innerHTML = `
                <div class="trash-error">
                    <p>${this.escapeHtml(message)}</p>
                </div>
            `;
        }
    },

    /**
     * Получить текст приоритета
     */
    getPriorityText(priority) {
        const priorities = {
            low: 'Низкий',
            medium: 'Средний',
            high: 'Высокий'
        };
        return priorities[priority] || priority;
    },

    /**
     * Экранировать HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Обработать realtime событие INSERT в корзину
     */
    handleRealtimeInsert(payload) {
        console.log('🗑️ Trash realtime INSERT:', payload);

        // Добавить новый элемент в начало массива
        this.trashItems.unshift(payload);

        // Если корзина открыта, обновить отображение
        const modal = document.getElementById('trashModal');
        if (modal && !modal.classList.contains('hidden')) {
            this.render();
        }
    },

    /**
     * Обработать realtime событие DELETE из корзины
     */
    handleRealtimeDelete(payload) {
        console.log('♻️ Trash realtime DELETE:', payload);

        // Удалить элемент из массива
        const index = this.trashItems.findIndex(item => item.id === payload.id);
        if (index !== -1) {
            this.trashItems.splice(index, 1);
        }

        // Если корзина открыта, обновить отображение
        const modal = document.getElementById('trashModal');
        if (modal && !modal.classList.contains('hidden')) {
            this.render();
        }
    },

    /**
     * Открыть модальное окно массового удаления из корзины
     */
    openBulkDeleteModal() {
        const modal = document.getElementById('bulkDeleteTrashModal');
        if (modal) {
            modal.classList.remove('hidden');
            // Сбросить форму
            document.getElementById('bulk-delete-trash-start-date').value = '';
            document.getElementById('bulk-delete-trash-end-date').value = '';
            document.getElementById('bulk-delete-trash-preview').classList.add('hidden');
        }
    },

    /**
     * Закрыть модальное окно массового удаления
     */
    closeBulkDeleteModal() {
        const modal = document.getElementById('bulkDeleteTrashModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    },

    /**
     * Установить preset диапазона дат для корзины
     */
    setDatePreset(days) {
        const now = new Date();
        const endDate = now.toISOString().split('T')[0];
        const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
            .toISOString().split('T')[0];

        document.getElementById('bulk-delete-trash-start-date').value = startDate;
        document.getElementById('bulk-delete-trash-end-date').value = endDate;
        this.updateBulkDeletePreview();
    },

    /**
     * Обновить предпросмотр массового удаления
     */
    updateBulkDeletePreview() {
        const startDate = document.getElementById('bulk-delete-trash-start-date').value;
        const endDate = document.getElementById('bulk-delete-trash-end-date').value;

        if (!startDate || !endDate) {
            document.getElementById('bulk-delete-trash-preview').classList.add('hidden');
            return;
        }

        const count = this.countTrashInDateRange(startDate, endDate);
        document.getElementById('bulk-delete-trash-count').textContent = count;
        document.getElementById('bulk-delete-trash-preview').classList.remove('hidden');
    },

    /**
     * Подсчитать количество карточек в корзине в диапазоне дат
     */
    countTrashInDateRange(startDate, endDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        return this.trashItems.filter(item => {
            if (!item.deleted_at) return false;

            // Проверяем права (владелец или удаливший)
            if (!state.user) return false;
            if (item.user_id !== state.user.id && item.deleted_by !== state.user.id) {
                return false;
            }

            const deletedDate = new Date(item.deleted_at);
            return deletedDate >= start && deletedDate <= end;
        }).length;
    },

    /**
     * Обработка отправки формы массового удаления
     */
    async handleBulkDeleteSubmit(e) {
        e.preventDefault();

        const startDate = document.getElementById('bulk-delete-trash-start-date').value;
        const endDate = document.getElementById('bulk-delete-trash-end-date').value;

        if (!startDate || !endDate) {
            alert('Пожалуйста, выберите диапазон дат');
            return;
        }

        const count = this.countTrashInDateRange(startDate, endDate);
        if (count === 0) {
            alert('Нет карточек для удаления в выбранном диапазоне');
            return;
        }

        const confirmed = confirm(
            `ВНИМАНИЕ! Удалить навсегда ${count} карточек из корзины?\n` +
            `Период: с ${startDate} по ${endDate}\n\n` +
            `Это действие нельзя отменить!`
        );

        if (!confirmed) return;

        // Получить карточки для удаления
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const itemsToDelete = this.trashItems.filter(item => {
            if (!item.deleted_at) return false;
            if (!state.user) return false;
            if (item.user_id !== state.user.id && item.deleted_by !== state.user.id) {
                return false;
            }

            const deletedDate = new Date(item.deleted_at);
            return deletedDate >= start && deletedDate <= end;
        });

        // Удалить карточки
        let successCount = 0;
        let failedCount = 0;

        for (const item of itemsToDelete) {
            const { error } = await TrashService.permanentDelete(item.id);
            if (error) {
                failedCount++;
                console.error('Error deleting:', error);
            } else {
                successCount++;
            }
        }

        if (failedCount > 0) {
            alert(
                `Удалено навсегда: ${successCount}\n` +
                `Ошибок: ${failedCount}\n\n` +
                `Некоторые карточки не удалось удалить.`
            );
        } else if (successCount > 0) {
            console.log(`✅ Успешно удалено навсегда ${successCount} карточек`);
        }

        // Закрыть модальное окно и обновить корзину
        this.closeBulkDeleteModal();
        await this.loadTrash();
    }
};
