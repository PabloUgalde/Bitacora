// --- app.js (VERSIÓN RESTAURADA Y CORREGIDA) ---

const app = {
    initialize: async () => {
        await api.loadInitialFlights();
        app.loadSettings();
        app.updateDataLists();
        const licencias = userProfile.licenses?.dgac?.licencias || [];
        const esUsuarioNuevo = licencias.length === 0 && flightData.length === 0;

        if (esUsuarioNuevo && !onboarding.isDone()) {
            onboarding.show();
        }
        if (licencias.length === 0 && flightData.length === 0) {
            ui.showView('view-settings');
            setTimeout(() => {
                const licPanel = document.querySelector('[data-panel="panel-licencias"]');
                if (licPanel) licPanel.click();
                ui.showNotification('👋 Bienvenido. Agrega tu primera licencia para comenzar.', 'info');
            }, 300);
        } else {
            ui.showView('view-dashboard');
        }
        plan.apply();
        await backupManager.initialize();
        app.updateSortButtonText();
        app.updateOfflineBar();
        app.setupOfflineListeners();
        // Sincronizar pendientes si hay señal al abrir (ej: se guardaron offline y se reabrió con conexión)
        if (navigator.onLine && api._getPendingQueue().length > 0) {
            await api.syncPendingFlights();
            app.updateOfflineBar();
        }
        anotaciones.injectStyles();
        await anotaciones.load();
        setTimeout(async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const checkout = urlParams.get('checkout');
            if (checkout === 'success') {
                const updatedProfile = await api.loadProfile();
                if (updatedProfile) userProfile = { ...userProfile, ...updatedProfile };
                plan.apply();
                app.loadSettings();
                ui.showCheckoutResult('success');
                window.history.replaceState({}, '', window.location.pathname);
            } else if (checkout === 'cancelled') {
                ui.showCheckoutResult('cancelled');
                window.history.replaceState({}, '', window.location.pathname);
            }
        }, 500);
        app.setupEventListeners();
        app.setupLogbookActionsListener();
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js')
                .then((reg) => console.log('Service Worker Registrado. Scope:', reg.scope))
                .catch(error => console.error('Error al registrar Service Worker:', error));
        }
    },

    setupLogbookActionsListener: () => {
        const container = document.getElementById('view-logbook');
        if (!container) return; 
        if (container.dataset.listenerAttached) return;
        container.dataset.listenerAttached = 'true';

        container.addEventListener('click', async (e) => {
            const editButton = e.target.closest('.edit-flight-btn');
            if (editButton) {
                const flightId = editButton.dataset.flightId;
                const flightToEdit = flightData.find(f => f && f.id == flightId);
                if (flightToEdit) {
                    logbookState.editingFlightId = flightId;
                    addFlightModal.open(flightId);
                    ui.populateFlightForm(flightToEdit);
                    ui.setFlightFormMode('edit');
                }
                return;
            }

            const deleteButton = e.target.closest('.delete-flight-btn');
            if (deleteButton) {
                const flightId = deleteButton.dataset.flightId;
                const flightToDelete = flightData.find(f => f && f.id == flightId);
                if (flightToDelete) {
                    const flightInfo = `${new Date(flightToDelete.Fecha).toLocaleDateString()} | ${flightToDelete['Aeronave Marca y Modelo']} | ${flightToDelete.Desde}-${flightToDelete.Hasta}`;
                    if (confirm(`¿Estás seguro de que quieres borrar este vuelo?\n\n${flightInfo}`)) {
                        const success = await api.deleteFlight(flightId);
                        if (success) {
                            ui.showNotification("Vuelo borrado con éxito.", "success");
                            render.detailedLog();
                        } else {
                            alert("No se pudo encontrar el vuelo para borrar.");
                        }
                    }
                }
                return;
            }

            const detailsButton = e.target.closest('.toggle-details-btn');
            if (detailsButton) {
                const card = detailsButton.closest('.flight-card');
                const details = card.querySelector('.flight-card-details');
                if (details) {
                    const isHidden = details.style.display === 'none' || !details.style.display;
                    details.style.display = isHidden ? 'block' : 'none';
                    detailsButton.textContent = isHidden ? 'Ocultar Detalles' : 'Ver Detalles';
                }
            }
        });
    },

    setupEventListeners: () => {
        if (document.body.dataset.listenersAttached) return;
        document.body.dataset.listenersAttached = 'true';

        // --- NAVEGACIÓN Y DROPDOWNS ---
        const navDropdownToggle = document.getElementById('summaries-dropdown-toggle');
        const navDropdownMenu = document.getElementById('summaries-dropdown-menu');
        // Inicializar validación de campos de tiempo
        ui.setupRealTimeValidation();
        const sortDropdownToggle = document.getElementById('sort-order-toggle');
        const sortDropdownMenu = document.getElementById('sort-order-menu');
        const bitacoraDropdownToggle = document.getElementById('bitacora-dropdown-toggle');
        const bitacoraDropdownMenu = document.getElementById('bitacora-dropdown-menu');
        const hamburgerBtn = document.getElementById('hamburger-btn');
        const mainNav = document.getElementById('main-nav');

        const colVisibilityPanel = document.getElementById('col-visibility-panel');
        const closeAllDropdowns = () => {
            navDropdownMenu?.classList.remove('active');
            bitacoraDropdownMenu?.classList.remove('active');
            sortDropdownMenu?.classList.remove('active');
            if (colVisibilityPanel) colVisibilityPanel.style.display = 'none';
        };

        document.getElementById('col-visibility-toggle')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = colVisibilityPanel.style.display === 'block';
            closeAllDropdowns();
            colVisibilityPanel.style.display = isOpen ? 'none' : 'block';
        });
        document.addEventListener('click', (e) => {
            if (colVisibilityPanel && colVisibilityPanel.style.display === 'block' && !colVisibilityPanel.contains(e.target) && e.target.id !== 'col-visibility-toggle') {
                colVisibilityPanel.style.display = 'none';
            }
        });

        const closeMobileNav = () => {
            hamburgerBtn?.classList.remove('open');
            mainNav?.classList.remove('mobile-nav-open');
            navDropdownMenu?.classList.remove('mobile-submenu-open');
            bitacoraDropdownMenu?.classList.remove('mobile-submenu-open');
        };

        // Dropdown Resúmenes (solo desktop)
        if (navDropdownToggle) {
            navDropdownToggle.addEventListener('click', (e) => {
                if (window.innerWidth <= 800) return;
                e.preventDefault();
                const isOpen = navDropdownMenu.classList.contains('active');
                closeAllDropdowns();
                if (!isOpen) navDropdownMenu.classList.add('active');
            });
        }

        // Dropdown Bitácora (solo desktop)
        if (bitacoraDropdownToggle) {
            bitacoraDropdownToggle.addEventListener('click', (e) => {
                if (window.innerWidth <= 800) return;
                e.preventDefault();
                const isOpen = bitacoraDropdownMenu.classList.contains('active');
                closeAllDropdowns();
                if (!isOpen) bitacoraDropdownMenu.classList.add('active');
            });
        }

        // Dropdown Ordenar
        if (sortDropdownToggle && sortDropdownMenu) {
            sortDropdownToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = sortDropdownMenu.classList.contains('active');
                closeAllDropdowns();
                if (!isOpen) sortDropdownMenu.classList.add('active');
            });
            sortDropdownMenu.addEventListener('click', (e) => {
                e.preventDefault();
                const target = e.target.closest('.sort-option');
                if (target) {
                    logbookState.sortOrder = target.dataset.sort;
                    app.updateSortButtonText();
                    render.detailedLog();
                    sortDropdownMenu.classList.remove('active');
                }
            });
        }

        // Clicks en links con data-view (desktop y mobile comparten este handler)
        document.querySelector('header').addEventListener('click', (e) => {
            const link = e.target.closest('a.nav-link[data-view]');
            if (!link) return;
            e.preventDefault();
            const licenciasGuardadas = licenseSystem.getData()?.licencias || [];
            const licenciasProfile = userProfile.licenses?.dgac?.licencias || [];
            const sinLicencias = licenciasGuardadas.length === 0 && licenciasProfile.length === 0;
            if (sinLicencias && flightData.length === 0 && link.dataset.view !== 'view-settings') {
                ui.showNotification('Agrega al menos una licencia antes de continuar.', 'error');
                return;
            }
            if (logbookState.editingFlightId) ui.resetFlightForm();
            closeAllDropdowns();
            closeMobileNav();
            ui.showView(link.dataset.view);
        });

        // --- MENÚ MÓVIL ---
        if (hamburgerBtn && mainNav) {
            hamburgerBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                hamburgerBtn.classList.toggle('open');
                mainNav.classList.toggle('mobile-nav-open');
            });

            mainNav.addEventListener('click', (e) => {
                const link = e.target.closest('.nav-link');
                if (!link) return;

                const isMobile = window.innerWidth <= 800;

                if (link.id === 'bitacora-dropdown-toggle') {
                    e.preventDefault();
                    if (isMobile) {
                        bitacoraDropdownMenu.classList.toggle('mobile-submenu-open');
                        navDropdownMenu?.classList.remove('mobile-submenu-open');
                    }
                } else if (link.id === 'summaries-dropdown-toggle') {
                    e.preventDefault();
                    if (isMobile) {
                        navDropdownMenu.classList.toggle('mobile-submenu-open');
                        bitacoraDropdownMenu?.classList.remove('mobile-submenu-open');
                    }
                } else {
                    if (isMobile) {
                        hamburgerBtn.classList.remove('open');
                        mainNav.classList.remove('mobile-nav-open');
                        bitacoraDropdownMenu?.classList.remove('mobile-submenu-open');
                        navDropdownMenu?.classList.remove('mobile-submenu-open');
                    }
                }
            });
        }

        // --- FORMULARIO DE VUELO ---
        document.getElementById('flight-form').addEventListener('submit', app.handleFlightSubmit);

        // Clonar ANTES de añadir listeners, para limpiar cualquier listener previo
        document.querySelectorAll('#flight-form .next-btn').forEach(btn => {
            btn.replaceWith(btn.cloneNode(true));
        });
        document.querySelectorAll('#flight-form .prev-btn').forEach(btn => {
            btn.replaceWith(btn.cloneNode(true));
        });

        // Ahora añadir listeners sobre los nodos frescos
        document.querySelectorAll('#flight-form .next-btn').forEach(btn => {
            if (btn.id === 'review-flight-btn') {
                btn.addEventListener('click', app.handleFlightReview);
            } else {
                btn.addEventListener('click', () => ui.goToStep(ui.getCurrentStep() + 1));
            }
        });
        document.querySelectorAll('#flight-form .prev-btn').forEach(btn => {
            btn.addEventListener('click', () => ui.goToStep(ui.getCurrentStep() - 1));
        });
        document.getElementById('condicionIFR').addEventListener('input', (e) => {
            const val = parseFloat(e.target.value) || 0;
            document.getElementById('ifr-approaches-container').classList.toggle('hidden', val <= 0);
        });

        // --- MODALES ---
        const filterModal = document.getElementById('filter-modal');
        const restoreModal = document.getElementById('restore-modal');
        const printModal = document.getElementById('print-modal');

        document.getElementById('open-filter-modal-btn').addEventListener('click', app.openFilterModal);
        filterModal.querySelector('.close-button').addEventListener('click', app.closeFilterModal);
        printModal.querySelector('.close-button').addEventListener('click', () => printModal.classList.remove('open'));
        restoreModal.querySelector('.close-button').addEventListener('click', () => backupManager.closeRestoreModal());

        document.getElementById('advanced-filter-form').addEventListener('submit', (e) => {
            e.preventDefault();
            logbookState.filters = {};
            document.getElementById('advanced-filter-form').querySelectorAll('input[data-filter-key]').forEach(input => {
                if (input.value) logbookState.filters[input.dataset.filterKey] = input.value;
            });
            const hidden = new Set();
            document.querySelectorAll('[data-hide-col]').forEach(cb => {
                if (!cb.checked) hidden.add(cb.dataset.hideCol);
            });
            logbookState.hiddenColumns = hidden;
            userProfile.hiddenColumns = [...hidden];
            logbookState.currentPage = 1;
            render.detailedLog();
            app.closeFilterModal();
        });

        document.getElementById('reset-filter-btn').addEventListener('click', () => {
            logbookState.filters = {};
            logbookState.hiddenColumns = new Set();
            userProfile.hiddenColumns = [];
            document.getElementById('advanced-filter-form').reset();
            logbookState.currentPage = 1;
            render.detailedLog();
            app.closeFilterModal();
        });

        document.getElementById('open-print-modal-btn').addEventListener('click', () => {
            const lastPageNumber = ui.getLastPageNumber();
            document.getElementById('print-page-to').placeholder = `Última (${lastPageNumber})`;
            if (!document.getElementById('print-page-from').value) document.getElementById('print-page-from').value = 1;
            printModal.classList.add('open');
        });

        document.getElementById('print-report-form').addEventListener('submit', (e) => {
            e.preventDefault();
            reportGenerator.generate();
            printModal.classList.remove('open');
        });

        // --- PAGINACIÓN Y LOGBOOK ---
        const paginationControls = document.getElementById('pagination-controls');
        if (paginationControls) {
            paginationControls.addEventListener('click', (e) => {
                if (e.target.closest('.prev-btn') && !e.target.closest('.prev-btn').disabled) {
                    logbookState.currentPage--; render.detailedLog();
                }
                if (e.target.closest('.next-btn') && !e.target.closest('.next-btn').disabled) {
                    logbookState.currentPage++; render.detailedLog();
                }
            });
            const itemsPerPageSelect = document.getElementById('items-per-page-desktop');
            if (itemsPerPageSelect) {
                itemsPerPageSelect.addEventListener('change', (e) => {
                    logbookState.itemsPerPage = parseInt(e.target.value, 10);
                    logbookState.currentPage = 1;
                    render.detailedLog();
                });
            }
        }

        document.getElementById('clear-logbook-filter-btn').addEventListener('click', () => {
            logbookState.filters = {};
            document.getElementById('advanced-filter-form').reset();
            logbookState.currentPage = 1;
            render.detailedLog();
        });

        // --- RESÚMENES ---
        document.getElementById('time-summary-year-select').addEventListener('change', summaryRenderer.byTime);
        document.getElementById('type-summary-year-select').addEventListener('change', summaryRenderer.byType);
        document.getElementById('type-summary-month-select').addEventListener('change', summaryRenderer.byType);
        document.getElementById('airport-summary-year-select').addEventListener('change', summaryRenderer.byAirport);
        document.getElementById('airport-summary-month-select').addEventListener('change', summaryRenderer.byAirport);
        document.getElementById('aircraft-summary-year-select').addEventListener('change', summaryRenderer.byAircraft);
        document.getElementById('aircraft-summary-month-select').addEventListener('change', summaryRenderer.byAircraft);

        document.getElementById('aircraft-group-by-buttons').addEventListener('click', (e) => {
            const target = e.target.closest('.toggle-btn');
            if (target && !target.classList.contains('active')) {
                document.querySelectorAll('#aircraft-group-by-buttons .toggle-btn').forEach(btn => btn.classList.remove('active'));
                target.classList.add('active');
                summaryRenderer.byAircraft();
            }
        });

        document.getElementById('page-summary-filter-btn').addEventListener('click', summaryRenderer.byPage);
        document.getElementById('page-summary-reset-btn').addEventListener('click', () => {
            document.getElementById('page-summary-from').value = '';
            document.getElementById('page-summary-to').value = '';
            summaryRenderer.byPage();
        });

        // Resumen IFR
        const ifrFilterMode = document.getElementById('ifr-filter-mode');
        if (ifrFilterMode) {
            ifrFilterMode.addEventListener('change', (e) => {
                const isRecency = e.target.value === 'recency';
                document.getElementById('ifr-recency-group').style.display = isRecency ? 'flex' : 'none';
                document.getElementById('ifr-calendar-group').style.display = isRecency ? 'none' : 'flex';
                summaryRenderer.byIFR();
            });
        }
        document.getElementById('ifr-period-select')?.addEventListener('change', summaryRenderer.byIFR);
        document.getElementById('ifr-summary-year-select')?.addEventListener('change', summaryRenderer.byIFR);
        document.getElementById('ifr-summary-month-select')?.addEventListener('change', summaryRenderer.byIFR);
        document.getElementById('ifr-group-by-buttons')?.addEventListener('click', (e) => {
            const target = e.target.closest('.toggle-btn');
            if (target && !target.classList.contains('active')) {
                document.querySelectorAll('#ifr-group-by-buttons .toggle-btn').forEach(btn => btn.classList.remove('active'));
                target.classList.add('active');
                summaryRenderer.byIFR();
            }
        });

        // --- FORMATO DE HORAS ---
        document.querySelectorAll('input[name="hoursFormat"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                userProfile.hoursFormat = e.target.value;
                api.saveProfile(userProfile);
                const activeView = document.querySelector('.view.active');
                const renderFn = activeView ? ui.renderMap[activeView.id] : null;
                if (renderFn) renderFn();
            });
        });

        // Soporte para selector dropdown si se usa en lugar de radios
        const hoursSelector = document.getElementById('hoursFormatSelector');
        if (hoursSelector) {
            hoursSelector.addEventListener('change', (e) => {
                userProfile.hoursFormat = e.target.value;
                api.saveProfile(userProfile);
                const activeView = document.querySelector('.view.active');
                const renderFn = activeView ? ui.renderMap[activeView.id] : null;
                if (renderFn) renderFn();
            });
        }

        // --- CONFIGURACIÓN ---
        document.getElementById('save-settings-btn').addEventListener('click', app.saveSettings);

        // Detectar cambios en cualquier input/select del panel de configuración
        const settingsView = document.getElementById('view-settings');
        if (settingsView) {
            settingsView.addEventListener('change', () => app._setSettingsDirty(true));
            settingsView.addEventListener('input',  () => app._setSettingsDirty(true));
        }
        document.getElementById('download-excel-btn')?.addEventListener('click', () => api.exportToExcel());
        document.getElementById('download-csv-btn')?.addEventListener('click', () => api.exportToCSV());
        document.getElementById('clear-local-data-btn')?.addEventListener('click', () => backupManager.clearLocalCache());
        document.getElementById('open-saldo-inicial-btn')?.addEventListener('click', () => saldoInicial.open());

        document.querySelectorAll('.settings-nav-item, .settings-tab-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const panelId = btn.dataset.panel;
                document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
                document.querySelectorAll('.settings-nav-item, .settings-tab-item').forEach(b => b.classList.remove('active'));
                document.querySelectorAll(`[data-panel="${panelId}"]`).forEach(b => b.classList.add('active'));
                document.getElementById(panelId)?.classList.add('active');
                if (panelId === 'panel-cuenta') miCuenta.init();
            });
        });
        document.getElementById('download-template-btn')?.addEventListener('click', () => api.downloadTemplate());
        document.getElementById('upload-excel-btn')?.addEventListener('click', () => {
        document.getElementById('excel-file-input').click();
        });

        document.getElementById('excel-file-input')?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const result = await dataImporter.processExcelFile(file);
            if (result.success) {
                const confirmed = await dataImporter.showValidationModal(result.data);
                if (confirmed) {
                    const dataStatus = document.getElementById('data-status');
                    dataStatus.textContent = 'Iniciando importación...';
                    dataStatus.className = 'status info';

                    const importBar = document.getElementById('import-bar');
                    const importBarText = document.getElementById('import-bar-text');
                    const progressBar = document.getElementById('import-progress-bar');

                    if (importBar) importBar.classList.remove('hidden');

                    // Bloquear recarga accidental del navegador
                    const warnUnload = (event) => { event.preventDefault(); event.returnValue = ''; };
                    window.addEventListener('beforeunload', warnUnload);

                    try {
                        const total = result.data.length;
                        const chunkSize = 50; // Procesamos en bloques de 50 para balancear velocidad y feedback
                        let processed = 0;

                        for (let i = 0; i < total; i += chunkSize) {
                            const chunk = result.data.slice(i, i + chunkSize);
                            const success = await api.saveFlightsBatch(chunk);
                            
                            if (!success) throw new Error("Error al guardar lote de vuelos.");
                            
                            processed += chunk.length;
                            const progressMsg = `Importando: ${processed} de ${total} vuelos (${Math.round((processed/total)*100)}%)`;
                            dataStatus.textContent = progressMsg;
                            if (importBarText) {
                                importBarText.textContent = progressMsg;
                            }
                            if (progressBar) progressBar.value = Math.round((processed / total) * 100);
                        }

                        ui.showNotification(`${total} vuelos importados correctamente.`, 'success');
                        dataStatus.textContent = 'Importación completada con éxito.';
                        dataStatus.className = 'status success';
                        
                        await api.loadInitialFlights();
                        render.dashboard();
                    } catch (error) {
                        console.error(error);
                        ui.showNotification("Error durante la importación: " + error.message, 'error');
                        dataStatus.textContent = 'Error en la importación.';
                        dataStatus.className = 'status error';
                    } finally {
                        // Liberar el bloqueo de recarga
                        window.removeEventListener('beforeunload', warnUnload);
                        if (importBar) importBar.classList.add('hidden');
                    }
                } else {
                    const dataStatus = document.getElementById('data-status');
                    dataStatus.textContent = 'Importación cancelada.';
                    dataStatus.className = 'status';
                }
            }
            e.target.value = '';
        });

        // --- CIERRE GLOBAL AL HACER CLICK FUERA ---
        if (!window.globalClickListenerAttached) {
            let mousedownTarget = null;
            window.addEventListener('mousedown', (e) => { mousedownTarget = e.target; });
            window.addEventListener('click', (e) => {
                if (e.target === mousedownTarget) {
                    if (filterModal && e.target === filterModal) app.closeFilterModal();
                    if (restoreModal && e.target === restoreModal) backupManager.closeRestoreModal();
                    if (printModal && e.target === printModal) printModal.classList.remove('open');
                }
                // Cerrar dropdowns al hacer click fuera
                if (navDropdownMenu && navDropdownToggle && !navDropdownToggle.contains(e.target) && !navDropdownMenu.contains(e.target)) {
                    navDropdownMenu.classList.remove('active');
                }
                if (bitacoraDropdownMenu && bitacoraDropdownToggle && !bitacoraDropdownToggle.contains(e.target) && !bitacoraDropdownMenu.contains(e.target)) {
                    bitacoraDropdownMenu.classList.remove('active');
                }
                if (sortDropdownMenu && sortDropdownToggle && !sortDropdownToggle.contains(e.target) && !sortDropdownMenu.contains(e.target)) {
                    sortDropdownMenu.classList.remove('active');
                }
            });
            window.globalClickListenerAttached = true;
        }
    },

    updateOfflineBar: () => {
        const bar     = document.getElementById('offline-bar');
        const label   = document.getElementById('offline-pending-label');
        if (!bar) return;
        const pending = api._getPendingQueue().length;
        const offline = !navigator.onLine;
        if (offline || pending > 0) {
            bar.style.display = 'flex';
            if (pending > 0) {
                label.textContent = `— ${pending} vuelo(s) pendiente(s) de sincronizar`;
            } else {
                label.textContent = '— Los vuelos se guardarán localmente hasta recuperar señal.';
            }
        } else {
            bar.style.display = 'none';
        }
    },

    setupOfflineListeners: () => {
        window.addEventListener('offline', () => {
            app.updateOfflineBar();
        });
        window.addEventListener('online', async () => {
            const pending = api._getPendingQueue().length;
            if (pending > 0) {
                await api.syncPendingFlights();
                await api.loadInitialFlights();
                render.dashboard();
                render.detailedLog();
            }
            app.updateOfflineBar();
        });
    },

    openFilterModal: () => { document.getElementById('filter-modal').classList.add('open'); },
    closeFilterModal: () => { document.getElementById('filter-modal').classList.remove('open'); },

    toggleColGroup: (labelEl, childrenId) => {
        // preventDefault evita que el click en el label marque/desmarque el checkbox del grupo dos veces
        const groupCb = labelEl.querySelector('[data-group-toggle]');
        const childrenDiv = document.getElementById(childrenId);
        if (!groupCb || !childrenDiv) return;
        // El estado del checkbox ya fue actualizado por el click nativo — propagamos a los hijos
        setTimeout(() => {
            childrenDiv.querySelectorAll('[data-hide-col]').forEach(cb => { cb.checked = groupCb.checked; });
        }, 0);
    },

    applyColVisibility: () => {
        const hidden = new Set();
        document.querySelectorAll('#col-visibility-panel [data-hide-col]').forEach(cb => {
            if (!cb.checked) hidden.add(cb.dataset.hideCol);
        });
        logbookState.hiddenColumns = hidden;
        userProfile.hiddenColumns = [...hidden];
        document.getElementById('col-visibility-panel').style.display = 'none';
        render.detailedLog();
    },

    resetColVisibility: () => {
        document.querySelectorAll('#col-visibility-panel [data-hide-col]').forEach(cb => { cb.checked = true; });
        document.querySelectorAll('#col-visibility-panel [data-group-toggle]').forEach(cb => { cb.checked = true; });
        logbookState.hiddenColumns = new Set();
        userProfile.hiddenColumns = [];
        document.getElementById('col-visibility-panel').style.display = 'none';
        render.detailedLog();
    },

    refreshDashboardSlots: () => {
        // count = total de tiles (incluyendo la fija "Horas Totales")
        // → slots seleccionables = count - 1
        const count = parseInt(document.getElementById('dashboard-card-count')?.value) || 8;
        const slotsCount = count - 1;
        const container = document.getElementById('dashboard-cards-config-container');
        if (!container) return;
        container.innerHTML = '';
        DASHBOARD_CARDS.filter(c => c.isFixed).forEach(card => {
            container.innerHTML += `<div class="card-slot fixed"><label>Tile 1 (Fija)</label><p>${card.label}</p></div>`;
        });
        const defaultSelection = ['picHours', 'totalLandings', 'ifrHours', 'soloHours', 'xcHours', 'nightHours', 'nightLandings'];
        const userSelection = userProfile.dashboardCards?.length ? userProfile.dashboardCards : defaultSelection;
        const availableOptions = DASHBOARD_CARDS.filter(c => !c.isFixed);
        for (let i = 0; i < slotsCount; i++) {
            const slotEl = document.createElement('div');
            slotEl.className = 'card-slot';
            const optionsHtml = availableOptions.map(opt => `<option value="${opt.id}" ${userSelection[i] === opt.id ? 'selected' : ''}>${opt.label}</option>`).join('');
            slotEl.innerHTML = `<label>Tile ${i + 2}</label><select id="card-slot-select-${i}">${optionsHtml}</select>`;
            container.appendChild(slotEl);
        }
    },

    trackFlightValues: (data) => {
        const stored = JSON.parse(localStorage.getItem('flightLogFrequentValues') || '{}');
        const textFields = [['aeronave', data.aeronave], ['matricula', data.matricula], ['desde', data.desde], ['hasta', data.hasta], ['approaches-tip', data.approaches?.tipo]];
        textFields.forEach(([field, val]) => {
            if (!val) return;
            const key = val.toUpperCase();
            if (!stored[field]) stored[field] = {};
            stored[field][key] = (stored[field][key] || 0) + 1;
        });
        if (data.observaciones?.trim()) {
            const obs = data.observaciones.trim();
            if (!stored['observaciones']) stored['observaciones'] = {};
            stored['observaciones'][obs] = (stored['observaciones'][obs] || 0) + 1;
        }
        localStorage.setItem('flightLogFrequentValues', JSON.stringify(stored));
        app.updateDataLists();
    },

    updateDataLists: () => {
        const stored = JSON.parse(localStorage.getItem('flightLogFrequentValues') || '{}');
        [['aeronave', 'datalist-aeronave'], ['matricula', 'datalist-matricula'], ['desde', 'datalist-desde'], ['hasta', 'datalist-hasta'], ['approaches-tip', 'datalist-approaches-tip']].forEach(([field, listId]) => {
            const dl = document.getElementById(listId);
            if (!dl) return;
            const values = Object.entries(stored[field] || {}).sort((a, b) => b[1] - a[1]).slice(0, 10);
            dl.innerHTML = values.map(([v]) => `<option value="${v}">`).join('');
        });
        // Dropdown de observaciones (textarea)
        const obsArea = document.getElementById('observaciones');
        const obsSug = document.getElementById('obs-suggestions');
        if (obsArea && obsSug && !obsArea.dataset.acBound) {
            obsArea.dataset.acBound = '1';
            const obsValues = () => Object.entries(stored['observaciones'] || {}).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([v]) => v);
            obsArea.addEventListener('input', () => {
                const q = obsArea.value.toLowerCase();
                const matches = obsValues().filter(v => v.toLowerCase().includes(q));
                if (!q || matches.length === 0) { obsSug.style.display = 'none'; return; }
                obsSug.innerHTML = matches.map(v => `<div class="obs-suggestion-item" style="padding:8px 12px; cursor:pointer; font-size:13px; border-bottom:1px solid var(--border-color,#222);">${v}</div>`).join('');
                obsSug.style.display = 'block';
                obsSug.querySelectorAll('.obs-suggestion-item').forEach(item => {
                    item.addEventListener('mousedown', (e) => { e.preventDefault(); obsArea.value = item.textContent; obsSug.style.display = 'none'; });
                });
            });
            obsArea.addEventListener('blur', () => setTimeout(() => { obsSug.style.display = 'none'; }, 150));
        }
    },

    updateSortButtonText: () => {
        const sortOptions = document.querySelectorAll('#sort-order-menu .sort-option');
        sortOptions.forEach(opt => {
            opt.classList.toggle('active', opt.dataset.sort === logbookState.sortOrder);
        });
    },

    _setSettingsDirty: (dirty) => {
        document.querySelectorAll('.settings-save-btn').forEach(btn => {
            btn.disabled = !dirty;
        });
    },

    saveSettings: async () => {
        const cardCount = parseInt(document.getElementById('dashboard-card-count')?.value) || 8;
        const selectedCards = [];
        for (let i = 0; i < cardCount - 1; i++) {
            const selectEl = document.getElementById(`card-slot-select-${i}`);
            if (selectEl) selectedCards.push(selectEl.value);
        }
        const profileToSave = {
            dataSource: 'supabase',
            personal: {},
            licenses: {},
            dashboardCards: selectedCards,
            dashboardCardCount: cardCount,
            hiddenColumns: [...(logbookState.hiddenColumns || [])],
            backupRetentionDays: document.getElementById('backup-retention-select')?.value,
            hoursFormat: document.querySelector('input[name="hoursFormat"]:checked')?.value || 'decimal',
        };
        if (!profileValidator.validateProfileForm()) {
            ui.showNotification("Corrige los errores en Datos Personales.", "error");
            return;
        }
        document.querySelectorAll('#pilot-data-form .personal-data-item input, #pilot-data-form .personal-data-item select').forEach(input => {
            profileToSave.personal[input.id] = input.value;
        });
        profileToSave.licenses = { dgac: licenseSystem.getData() };
        profileToSave.userRole = licenseSystem.getUserRole();
        userProfile = profileToSave;
        await api.saveProfile(userProfile);
        app._setSettingsDirty(false);
        ui.updateFormForRole();
        render.dashboard();
        ui.showNotification("¡Configuración guardada!", "success");
        window.dispatchEvent(new CustomEvent('settings-saved'));
    },

    loadSettings: () => {
        if (userProfile.personal) {
            Object.keys(userProfile.personal).forEach(id => {
                const i = document.getElementById(id);
                if (i) i.value = userProfile.personal[id];
            });
        }
        const savedLicencias = userProfile.licenses?.dgac || [];
        licenseSystem._onDataChange = () => app._setSettingsDirty(true);
        licenseSystem.init('licenses-container', savedLicencias);
        app._setSettingsDirty(false);

        const countSelect = document.getElementById('dashboard-card-count');
        if (countSelect) countSelect.value = userProfile.dashboardCardCount || 8;
        app.refreshDashboardSlots();

        // Email auto-fill desde cuenta autenticada
        const emailInput = document.getElementById('profile-email');
        if (emailInput && !emailInput.value && currentUser?.email) {
            emailInput.value = currentUser.email;
        }

        // Init formato de horas
        const hoursFormat = userProfile.hoursFormat || 'decimal';
        const hoursRadio = document.querySelector(`input[name="hoursFormat"][value="${hoursFormat}"]`);
        if (hoursRadio) hoursRadio.checked = true;
        const hoursSelect = document.getElementById('hoursFormatSelector');
        if (hoursSelect) hoursSelect.value = hoursFormat;

        // Init columnas ocultas
        logbookState.hiddenColumns = new Set(userProfile.hiddenColumns || []);
        document.querySelectorAll('[data-hide-col]').forEach(cb => {
            cb.checked = !logbookState.hiddenColumns.has(cb.dataset.hideCol);
        });
        if (userProfile.backupRetentionDays) document.getElementById('backup-retention-select').value = userProfile.backupRetentionDays;
        ui.showBackupFolderPath();
        ui.updateFormForRole();
        profileValidator.initProfileForm();

        const planDisplay = document.getElementById('plan-status-display');
        miCuenta.init();
        if (planDisplay) {
            if (plan.isPro()) {
                const expires = userProfile.planExpiresAt
                    ? `Vence: ${new Date(userProfile.planExpiresAt).toLocaleDateString('es-CL')}`
                    : 'Sin vencimiento';
                planDisplay.innerHTML = `
                    <div style="display:flex; align-items:center; gap:12px; padding:12px 16px; background:#1c1a10; border:1px solid #c9a84c; border-radius:8px;">
                        <span style="font-size:20px;">✈</span>
                        <div>
                            <div style="color:#c9a84c; font-weight:700; font-size:15px;">Plan Pro</div>
                            <div style="color:#888; font-size:12px;">${expires}</div>
                        </div>
                    </div>`;
            } else {
                planDisplay.innerHTML = `
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 16px; background:#1a1a1a; border:1px solid #333; border-radius:8px;">
                        <div>
                            <div style="color:#aaa; font-weight:600; font-size:15px;">Plan Lite</div>
                            <div style="color:#666; font-size:12px;">Funciones limitadas</div>
                        </div>
                        <button onclick="plan.showUpgradeScreen()" style="background:#c9a84c; color:#000; border:none; border-radius:6px; padding:8px 16px; font-weight:700; font-size:13px; cursor:pointer;">Actualizar a Pro</button>
                    </div>`;
            }
        }
    },

    handleFlightReview: () => {
        const result = ui.validateAndGetData();
        if (result.isValid) { render.flightPreview(result.data); ui.goToStep(3); }
    },

    handleFlightSubmit: async (e) => {
        e.preventDefault();
        const submitBtn = e.target.querySelector('.submit-btn');
        if (!submitBtn || submitBtn.disabled) return;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Guardando...';

        const result = ui.validateAndGetData();
        if (result.isValid) {
            const isEditing = !!logbookState.editingFlightId;
            try {
                const success = isEditing
                    ? await api.updateFlight(logbookState.editingFlightId, result.data)
                    : await api.saveFlight(result.data);
                if (success) {
                    ui.showNotification(`¡Vuelo ${isEditing ? 'actualizado' : 'guardado'}!`, "success");
                    app.trackFlightValues(result.data);
                    const savedId = isEditing ? logbookState.editingFlightId : flightData[0]?.id;
                    ui.resetFlightForm();
                    addFlightModal.close();
                    setTimeout(() => {
                        ui.showView('view-logbook');
                        render.detailedLog();
                        if (savedId) addFlightModal.highlightRow(savedId);
                    }, 300);
                }
            } catch (error) {
                console.error(error);
                alert("Error: " + error.message);
                submitBtn.disabled = false;
            }
        } else {
            submitBtn.disabled = false;
        }
    },
};

window.addEventListener('load', async () => {
    const ok = await auth.init();
    if (ok) await app.initialize();
});