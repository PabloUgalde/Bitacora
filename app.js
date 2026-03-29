// --- app.js (VERSIÓN RESTAURADA Y CORREGIDA) ---

const app = {
    initialize: async () => {
        await api.loadInitialFlights();
        app.loadSettings();
        const licencias = Array.isArray(userProfile.licenses?.dgac) 
            ? userProfile.licenses.dgac 
            : [];
        const esUsuarioNuevo = licencias.length === 0 && flightData.length === 0;

        if (esUsuarioNuevo && !onboarding.isDone()) {
            ui.showView('view-dashboard');
            onboarding.show();
        } else {
            ui.showView('view-dashboard');
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
                            await render.detailedLog();
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

        // --- FUENTE DE DATOS ---
        const updateDataSourceView = () => {
            const dataSourceSelect = document.getElementById('data-source-select');
            if (!dataSourceSelect) return;
            document.getElementById('google-sheets-url-container').classList.toggle('hidden', dataSourceSelect.value !== 'google_sheets');
        };
        document.getElementById('data-source-select').addEventListener('change', (e) => {
            updateDataSourceView();
            if (userProfile.dataSource === 'local' && e.target.value === 'google_sheets') {
                const localData = JSON.parse(localStorage.getItem('flightLogData') || '[]');
                if (localData.length > 0) ui.showSyncPrompt(localData.length);
            }
        });

        // --- NAVEGACIÓN Y DROPDOWNS ---
        const navDropdownToggle = document.getElementById('summaries-dropdown-toggle');
        const navDropdownMenu = document.getElementById('summaries-dropdown-menu');
        const sortDropdownToggle = document.getElementById('sort-order-toggle');
        const sortDropdownMenu = document.getElementById('sort-order-menu');
        const bitacoraDropdownToggle = document.getElementById('bitacora-dropdown-toggle');
        const bitacoraDropdownMenu = document.getElementById('bitacora-dropdown-menu');
        const hamburgerBtn = document.getElementById('hamburger-btn');
        const mainNav = document.getElementById('main-nav');

        const closeAllDropdowns = () => {
            navDropdownMenu?.classList.remove('active');
            bitacoraDropdownMenu?.classList.remove('active');
            sortDropdownMenu?.classList.remove('active');
        };

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
            const licenciasProfile = Array.isArray(userProfile.licenses?.dgac) ? userProfile.licenses.dgac : [];
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
            logbookState.currentPage = 1;
            render.detailedLog();
            app.closeFilterModal();
        });

        document.getElementById('reset-filter-btn').addEventListener('click', () => {
            logbookState.filters = {};
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

        // --- CONFIGURACIÓN ---
        document.getElementById('save-settings-btn').addEventListener('click', app.saveSettings);
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
        document.getElementById('upload-excel-btn')?.addEventListener('click', () => {
        document.getElementById('excel-file-input').click();
        });

        document.getElementById('excel-file-input')?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const result = await dataImporter.processExcelFile(file);
            if (result.success) {
                for (const flight of result.data) {
                    await api.saveFlight(flight);
                }
                await api.loadInitialFlights();
                render.dashboard();
                ui.showNotification(`${result.data.length} vuelos importados correctamente.`, 'success');
            }
            e.target.value = '';
        });

        // --- SINCRONIZACIÓN ---
        document.getElementById('sync-action-merge').addEventListener('click', async () => {
            const syncModal = document.getElementById('sync-prompt-modal');
            ui.showNotification("Iniciando sincronización...", "info");
            const sheetsResult = await api.loadFlightsFromGoogleSheets(userProfile.googleSheetsUrl || document.getElementById('google-sheets-url').value);
            if (!sheetsResult.success) {
                alert(`Error al cargar datos de Google Sheets: ${sheetsResult.message}`);
                syncModal.classList.remove('open');
                return;
            }
            const sheetsFlights = sheetsResult.data;
            const localFlights = JSON.parse(localStorage.getItem('flightLogData') || '[]');
            const sheetsFlightIds = new Set(sheetsFlights.map(f => f.id));
            const flightsToUpload = localFlights.filter(f => !sheetsFlightIds.has(f.id));
            if (flightsToUpload.length > 0) {
                ui.showNotification(`Subiendo ${flightsToUpload.length} vuelos nuevos a Sheets...`, "info");
                const flightsAsArrays = flightsToUpload.reverse().map(flight => api._flightObjectToValuesArray(flight));
                const uploadResult = await api._postToSheets({ action: 'addMultipleFlights', flights: flightsAsArrays });
                if (!uploadResult.success) {
                    alert(`Error al subir vuelos a Google Sheets: ${uploadResult.message}`);
                    syncModal.classList.remove('open');
                    return;
                }
            }
            userProfile.dataSource = 'google_sheets';
            await api.saveProfile(userProfile);
            alert("¡Sincronización completada!");
            location.reload();
        });

        document.getElementById('sync-action-replace').addEventListener('click', async () => {
            userProfile.dataSource = 'google_sheets';
            await api.saveProfile(userProfile);
            location.reload();
        });

        document.getElementById('sync-action-cancel').addEventListener('click', () => {
            const syncModal = document.getElementById('sync-prompt-modal');
            document.getElementById('data-source-select').value = 'local';
            document.getElementById('google-sheets-url-container').classList.add('hidden');
            syncModal.classList.remove('open');
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

    openFilterModal: () => { document.getElementById('filter-modal').classList.add('open'); },
    closeFilterModal: () => { document.getElementById('filter-modal').classList.remove('open'); },

    updateSortButtonText: () => {
        const sortOptions = document.querySelectorAll('#sort-order-menu .sort-option');
        sortOptions.forEach(opt => {
            opt.classList.toggle('active', opt.dataset.sort === logbookState.sortOrder);
        });
    },

    saveSettings: async () => {
        const selectedCards = [];
        for (let i = 0; i < 7; i++) {
            const selectEl = document.getElementById(`card-slot-select-${i}`);
            if (selectEl) selectedCards.push(selectEl.value);
        }
        const profileToSave = {
            dataSource: document.getElementById('data-source-select').value,
            googleSheetsUrl: document.getElementById('google-sheets-url').value,
            personal: {},
            licenses: {},
            dashboardCards: selectedCards,
            backupRetentionDays: document.getElementById('backup-retention-select')?.value,
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
        ui.updateFormForRole();
        ui.showNotification("¡Configuración guardada!", "success");
        window.dispatchEvent(new CustomEvent('settings-saved'));
    },

    loadSettings: () => {
        const dataSourceSelect = document.getElementById('data-source-select');
        const googleUrlInput = document.getElementById('google-sheets-url');
        if (dataSourceSelect) {
            dataSourceSelect.value = userProfile.dataSource || 'local';
            document.getElementById('google-sheets-url-container').classList.toggle('hidden', dataSourceSelect.value !== 'google_sheets');
        }
        if (googleUrlInput) googleUrlInput.value = userProfile.googleSheetsUrl || '';
        if (userProfile.personal) {
            Object.keys(userProfile.personal).forEach(id => {
                const i = document.getElementById(id);
                if (i) i.value = userProfile.personal[id];
            });
        }
        const savedLicencias = userProfile.licenses?.dgac || [];
        licenseSystem.init('licenses-container', savedLicencias);

        const cardsContainer = document.getElementById('dashboard-cards-config-container');
        if (cardsContainer) {
            cardsContainer.innerHTML = '';
            DASHBOARD_CARDS.filter(c => c.isFixed).forEach((card, index) => {
                cardsContainer.innerHTML += `<div class="card-slot fixed"><label>Tarjeta Fija ${index + 1}</label><p>${card.label}</p></div>`;
            });
            const defaultSelection = ['picHours', 'totalLandings', 'ifrHours', 'soloHours', 'xcHours', 'nightHours', 'nightLandings'];
            const userSelection = userProfile.dashboardCards || defaultSelection;
            const availableOptions = DASHBOARD_CARDS.filter(c => !c.isFixed);
            for (let i = 0; i < 7; i++) {
                const slotEl = document.createElement('div');
                slotEl.className = 'card-slot';
                let optionsHtml = '';
                availableOptions.forEach(opt => {
                    const isSelected = userSelection[i] === opt.id;
                    optionsHtml += `<option value="${opt.id}" ${isSelected ? 'selected' : ''}>${opt.label}</option>`;
                });
                slotEl.innerHTML = `<label>Tarjeta ${i + 2}</label><select id="card-slot-select-${i}">${optionsHtml}</select>`;
                cardsContainer.appendChild(slotEl);
            }
        }
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
                    if (isEditing && userProfile.dataSource === 'google_sheets') {
                        alert("Vuelo actualizado. Recargando...");
                        location.reload();
                    } else {
                        ui.showNotification(`¡Vuelo ${isEditing ? 'actualizado' : 'guardado'}!`, "success");
                        const savedId = isEditing ? logbookState.editingFlightId : flightData[0]?.id;
                        ui.resetFlightForm();
                        addFlightModal.close();
                        setTimeout(() => {
                            ui.showView('view-logbook');
                            render.detailedLog();
                            if (savedId) addFlightModal.highlightRow(savedId);
                        }, 300);
                    }
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