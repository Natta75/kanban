// ============================================================
// BULK DELETE COMPONENT - Массовое удаление карточек по датам
// ============================================================

const BulkDeleteComponent = {
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
        // Кнопка открытия модального окна для Done
        const bulkDeleteDoneBtn = document.getElementById('bulk-delete-done-btn');
        if (bulkDeleteDoneBtn) {
            bulkDeleteDoneBtn.addEventListener('click', () => this.openDoneModal());
        }

        // Кнопка закрытия модального окна Done
        const closeBulkDelete = document.getElementById('closeBulkDelete');
        if (closeBulkDelete) {
            closeBulkDelete.addEventListener('click', () => this.closeDoneModal());
        }

        // Кнопка отмены Done
        const cancelBtn = document.getElementById('bulk-delete-cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeDoneModal());
        }

        // Закрытие по клику вне модального окна Done
        const modal = document.getElementById('bulkDeleteModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeDoneModal();
                }
            });
        }

        // Форма удаления из Done
        const form = document.getElementById('bulk-delete-form');
        if (form) {
            form.addEventListener('submit', (e) => this.handleDoneSubmit(e));
        }

        // Preset кнопки для Done
        document.querySelectorAll('.date-preset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const days = parseInt(e.target.dataset.days);
                this.setDatePreset('done', days);
            });
        });

        // Изменение дат в Done - обновить предпросмотр
        const startDateInput = document.getElementById('bulk-delete-start-date');
        const endDateInput = document.getElementById('bulk-delete-end-date');
        if (startDateInput && endDateInput) {
            startDateInput.addEventListener('change', () => this.updateDonePreview());
            endDateInput.addEventListener('change', () => this.updateDonePreview());
        }
    },

    /**
     * Открыть модальное окно для Done
     */
    openDoneModal() {
        const modal = document.getElementById('bulkDeleteModal');
        if (modal) {
            modal.classList.remove('hidden');
            // Сбросить форму
            document.getElementById('bulk-delete-start-date').value = '';
            document.getElementById('bulk-delete-end-date').value = '';
            document.getElementById('bulk-delete-preview').classList.add('hidden');
        }
    },

    /**
     * Закрыть модальное окно Done
     */
    closeDoneModal() {
        const modal = document.getElementById('bulkDeleteModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    },

    /**
     * Установить preset диапазона дат
     */
    setDatePreset(type, days) {
        const now = new Date();
        const endDate = now.toISOString().split('T')[0];
        const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
            .toISOString().split('T')[0];

        if (type === 'done') {
            document.getElementById('bulk-delete-start-date').value = startDate;
            document.getElementById('bulk-delete-end-date').value = endDate;
            this.updateDonePreview();
        } else if (type === 'trash') {
            document.getElementById('bulk-delete-trash-start-date').value = startDate;
            document.getElementById('bulk-delete-trash-end-date').value = endDate;
            this.updateTrashPreview();
        }
    },

    /**
     * Обновить предпросмотр для Done
     */
    updateDonePreview() {
        const startDate = document.getElementById('bulk-delete-start-date').value;
        const endDate = document.getElementById('bulk-delete-end-date').value;

        if (!startDate || !endDate) {
            document.getElementById('bulk-delete-preview').classList.add('hidden');
            return;
        }

        const count = this.countCardsInDateRange('done', startDate, endDate);
        document.getElementById('bulk-delete-count').textContent = count;
        document.getElementById('bulk-delete-preview').classList.remove('hidden');
    },

    /**
     * Подсчитать количество карточек в диапазоне дат
     */
    countCardsInDateRange(columnId, startDate, endDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        return state.cards.filter(card => {
            if (card.column_id !== columnId) return false;
            if (!card.completed_at) return false;

            // Проверяем, что это карточка текущего пользователя
            if (!state.user || card.user_id !== state.user.id) return false;

            const completedDate = new Date(card.completed_at);
            return completedDate >= start && completedDate <= end;
        }).length;
    },

    /**
     * Обработка отправки формы Done
     */
    async handleDoneSubmit(e) {
        e.preventDefault();

        const startDate = document.getElementById('bulk-delete-start-date').value;
        const endDate = document.getElementById('bulk-delete-end-date').value;

        if (!startDate || !endDate) {
            alert('Пожалуйста, выберите диапазон дат');
            return;
        }

        const count = this.countCardsInDateRange('done', startDate, endDate);
        if (count === 0) {
            alert('Нет карточек для удаления в выбранном диапазоне');
            return;
        }

        const confirmed = confirm(
            `Удалить ${count} карточек из колонки Done?\n` +
            `Период: с ${startDate} по ${endDate}\n\n` +
            `Карточки будут перемещены в корзину.`
        );

        if (!confirmed) return;

        // Получить карточки для удаления
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const cardsToDelete = state.cards.filter(card => {
            if (card.column_id !== 'done') return false;
            if (!card.completed_at) return false;
            if (!state.user || card.user_id !== state.user.id) return false;

            const completedDate = new Date(card.completed_at);
            return completedDate >= start && completedDate <= end;
        });

        // Удалить карточки
        const cardIds = cardsToDelete.map(card => card.id);
        const results = await TrashService.bulkMoveToTrash(cardIds);

        if (results.failed > 0) {
            alert(
                `Удалено: ${results.success}\n` +
                `Ошибок: ${results.failed}\n\n` +
                `Некоторые карточки не удалось удалить.`
            );
        } else {
            NotificationsComponent.show(
                `Успешно удалено ${results.success} карточек`,
                'success'
            );
        }

        this.closeDoneModal();
    }
};
