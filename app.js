// --- app.js (VERSIÓN RESTAURADA Y CORREGIDA) ---

const app = {
    initialize: async () => {
        await api.loadInitialFlights(); // CARGA PRIMERO EL PERFIL Y LOS DATOS
        app.loadSettings(); // LUEGO, POBLA LA UI CON ESOS DATOS
        await backupManager.initialize();
        app.updateSortButtonText();
        ui.showView('view-dashboard');
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

        if (container.dataset.listenerAttached) {
            return;
        }
        container.dataset.listenerAttached = 'true';

        container.addEventListener('click', async (e) => {
            const editButton = e.target.closest('.edit-flight-btn');
            if (editButton) {
                const flightId = editButton.dataset.flightId;
                const flightToEdit = flightData.find(f => f && f.id == flightId);
                if (flightToEdit) {
                    logbookState.editingFlightId = flightId;
                    ui.showView('view-add-flight');
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
        // Lógica de Fuente de Datos
        const updateDataSourceView = () => {
            const dataSourceSelect = document.getElementById('data-source-select');
            if (!dataSourceSelect) return;
            const dataSource = dataSourceSelect.value;
            const isGoogle = dataSource === 'google_sheets';
            document.getElementById('google-sheets-url-container').classList.toggle('hidden', !isGoogle);
        };

        document.getElementById('data-source-select').addEventListener('change', (e) => {
            const selectedValue = e.target.value;
            updateDataSourceView();
            if (userProfile.dataSource === 'local' && selectedValue === 'google_sheets') {
                const localData = JSON.parse(localStorage.getItem('flightLogData') || '[]');
                if (localData.length > 0) { ui.showSyncPrompt(localData.length); }
            }
        });

        // NAVEGACIÓN Y DROPDOWNS
        const navDropdownToggle = document.getElementById('summaries-dropdown-toggle');
        const navDropdownMenu = document.getElementById('summaries-dropdown-menu');
        const sortDropdownToggle = document.getElementById('sort-order-toggle');
        const sortDropdownMenu = document.getElementById('sort-order-menu');
        const hamburgerBtn = document.getElementById('hamburger-btn');
        const mainNav = document.getElementById('main-nav');
        
        if (navDropdownToggle && navDropdownMenu) {
            navDropdownToggle.addEventListener('click', (e) => {
                e.preventDefault();
                navDropdownMenu.classList.toggle('active');
                if (sortDropdownMenu) sortDropdownMenu.classList.remove('active');
            });
        }

        if (sortDropdownToggle && sortDropdownMenu) {
            sortDropdownToggle.addEventListener('click', () => {
                sortDropdownMenu.classList.toggle('active');
                if (navDropdownMenu) navDropdownMenu.classList.remove('active');
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
        
        document.querySelector('header').addEventListener('click', (e) => {
            const link = e.target.closest('.nav-link');
            if (link && link.dataset.view) {
                e.preventDefault();
                if (logbookState.editingFlightId) ui.resetFlightForm();
                ui.showView(link.dataset.view);
                if (navDropdownMenu) navDropdownMenu.classList.remove('active');
            }
        });

        // FORMULARIO DE VUELO
        document.getElementById('flight-form').addEventListener('submit', app.handleFlightSubmit);
        document.getElementById('review-flight-btn').addEventListener('click', app.handleFlightReview);
        document.querySelectorAll('#flight-form .next-btn').forEach(btn => btn.addEventListener('click', () => ui.goToStep(ui.getCurrentStep() + 1)));
        document.querySelectorAll('#flight-form .prev-btn').forEach(btn => btn.addEventListener('click', () => ui.goToStep(ui.getCurrentStep() - 1)));
        document.getElementById('condicionIFR').addEventListener('input', (e) => {
            const val = parseFloat(e.target.value) || 0;
            document.getElementById('ifr-approaches-container').classList.toggle('hidden', val <= 0);
        });
        
        // MODALES
        const filterModal = document.getElementById('filter-modal');
        const restoreModal = document.getElementById('restore-modal');
        const printModal = document.getElementById('print-modal');

        document.getElementById('open-filter-modal-btn').addEventListener('click', app.openFilterModal);
        
        // --- RESTAURADO: Listeners de cierre (X) de los modales ---
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

        // --- RESTAURADO: Botón reset dentro del modal de filtro ---
        document.getElementById('reset-filter-btn').addEventListener('click', () => {
            logbookState.filters = {};
            document.getElementById('advanced-filter-form').reset();
            logbookState.currentPage = 1;
            render.detailedLog();
            app.closeFilterModal();
        });

        // REPORTE DE IMPRESIÓN
        document.getElementById('open-print-modal-btn').addEventListener('click', () => {
            const lastPageNumber = ui.getLastPageNumber();
            document.getElementById('print-page-to').placeholder = `Última (${lastPageNumber})`;
            if (!document.getElementById('print-page-from').value) document.getElementById('print-page-from').value = 1;
            printModal.classList.add('open');
        });

        // --- RESTAURADO: Listener del formulario de impresión (Este era el error) ---
        document.getElementById('print-report-form').addEventListener('submit', (e) => {
            e.preventDefault();
            reportGenerator.generate();
            printModal.classList.remove('open');
        });

        // PAGINACIÓN Y LOGBOOK
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
            // Listener para selector de items por página
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

        // === LISTENERS DE TODOS LOS RESÚMENES ===
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

        // === LISTENERS RESUMEN IFR ===
        const ifrFilterMode = document.getElementById('ifr-filter-mode');
        if (ifrFilterMode) {
            ifrFilterMode.addEventListener('change', (e) => {
                const isRecency = e.target.value === 'recency';
                document.getElementById('ifr-recency-group').style.display = isRecency ? 'flex' : 'none';
                document.getElementById('ifr-calendar-group').style.display = isRecency ? 'none' : 'flex';
                summaryRenderer.byIFR(); 
            });
        }

        const ifrPeriod = document.getElementById('ifr-period-select');
        if (ifrPeriod) ifrPeriod.addEventListener('change', summaryRenderer.byIFR);

        const ifrYear = document.getElementById('ifr-summary-year-select');
        if (ifrYear) ifrYear.addEventListener('change', summaryRenderer.byIFR);

        const ifrMonth = document.getElementById('ifr-summary-month-select');
        if (ifrMonth) ifrMonth.addEventListener('change', summaryRenderer.byIFR);

        const ifrGroup = document.getElementById('ifr-group-by-buttons');
        if (ifrGroup) {
            ifrGroup.addEventListener('click', (e) => {
                const target = e.target.closest('.toggle-btn');
                if (target && !target.classList.contains('active')) {
                    document.querySelectorAll('#ifr-group-by-buttons .toggle-btn').forEach(btn => btn.classList.remove('active'));
                    target.classList.add('active');
                    summaryRenderer.byIFR();
                }
            });
        }
        
        // CONFIGURACIÓN Y OTROS
        document.getElementById('save-settings-btn').addEventListener('click', app.saveSettings);
        document.getElementById('setup-backup-btn').addEventListener('click', () => backupManager.setupBackupFolder());
        document.getElementById('restore-backup-btn').addEventListener('click', () => backupManager.restoreFromBackup());
        
        document.querySelectorAll('.accordion-header').forEach(header => {
            header.addEventListener('click', () => {
                header.classList.toggle('active');
                header.nextElementSibling.classList.toggle('active');
            });
        });

        // Listeners del Modal de Sincronización
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
        
        // MENÚ MÓVIL
        if (hamburgerBtn && mainNav) {
            hamburgerBtn.addEventListener('click', () => {
                hamburgerBtn.classList.toggle('open');
                mainNav.classList.toggle('mobile-nav-open');
            });
            const dropdownMenuMobile = mainNav.querySelector('#summaries-dropdown-menu');
            mainNav.addEventListener('click', (e) => {
                const link = e.target.closest('.nav-link');
                if (!link) return;
                if (link.id === 'summaries-dropdown-toggle') {
                    e.preventDefault();
                    dropdownMenuMobile.classList.toggle('mobile-submenu-open');
                } else if (link.dataset.view) {
                    hamburgerBtn.classList.remove('open');
                    mainNav.classList.remove('mobile-nav-open');
                    dropdownMenuMobile.classList.remove('mobile-submenu-open');
                }
            });
        }

        // CIERRE GLOBAL DE ELEMENTOS AL HACER CLICK FUERA
        if (!window.globalClickListenerAttached) {
            // Variable para rastrear dónde empezó el clic
            let mousedownTarget = null;

            window.addEventListener('mousedown', (e) => {
                mousedownTarget = e.target;
            });

            window.addEventListener('click', (e) => {
                // Solo cerramos si el clic EMPEZÓ y TERMINÓ en el mismo elemento de fondo
                // Esto evita cierres accidentales al seleccionar texto o arrastrar el mouse
                if (e.target === mousedownTarget) {
                    if (filterModal && e.target === filterModal) app.closeFilterModal();
                    if (restoreModal && e.target === restoreModal) backupManager.closeRestoreModal();
                    if (printModal && e.target === printModal) printModal.classList.remove('open');
                }

                // Lógica de menús desplegables (estos no se ven afectados por el arrastre)
                if (navDropdownMenu && navDropdownToggle && !navDropdownToggle.contains(e.target) && !navDropdownMenu.contains(e.target)) {
                    navDropdownMenu.classList.remove('active');
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
            backupRetentionDays: document.getElementById('backup-retention-select').value,
            userRole: ui.determineUserRole()
        };
        document.querySelectorAll('#pilot-data-form .personal-data-item input').forEach(input => {
            profileToSave.personal[input.id] = input.value;
        });
        document.querySelectorAll('#licenses-data-form .license-item input').forEach(input => {
            profileToSave.licenses[input.id] = input.value;
        });
        userProfile = profileToSave;
        localStorage.setItem('flightLogUserProfile', JSON.stringify(userProfile));
        ui.updateFormForRole();
        ui.showNotification("¡Configuración guardada!", "success");
    },

    loadSettings: () => {
        const dataSourceSelect = document.getElementById('data-source-select');
        const googleUrlInput = document.getElementById('google-sheets-url');
        if (dataSourceSelect) {
            dataSourceSelect.value = userProfile.dataSource || 'local';
            const isGoogle = dataSourceSelect.value === 'google_sheets';
            document.getElementById('google-sheets-url-container').classList.toggle('hidden', !isGoogle);
        }
        if (googleUrlInput) { googleUrlInput.value = userProfile.googleSheetsUrl || ''; }
        if (userProfile.personal) { Object.keys(userProfile.personal).forEach(id => { const i = document.getElementById(id); if (i) i.value = userProfile.personal[id]; }); }
        if (userProfile.licenses) { Object.keys(userProfile.licenses).forEach(id => { const i = document.getElementById(id); if (i) i.value = userProfile.licenses[id]; }); }
        
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
    },

    handleFlightReview: () => { const result = ui.validateAndGetData(); if (result.isValid) { render.flightPreview(result.data); ui.goToStep(3); } },
    
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
                const success = isEditing ? await api.updateFlight(logbookState.editingFlightId, result.data) : await api.saveFlight(result.data);
                if (success) {
                    if (isEditing && userProfile.dataSource === 'google_sheets') {
                        alert("Vuelo actualizado. Recargando...");
                        location.reload();
                    } else {
                        ui.showNotification(`¡Vuelo ${isEditing ? 'actualizado' : 'guardado'}!`, "success");
                        ui.resetFlightForm();
                        setTimeout(() => ui.showView('view-dashboard'), 1000);
                    }
                }
            } catch (error) {
                console.error(error);
                submitBtn.disabled = false;
            }
        } else {
            submitBtn.disabled = false;
        }
    },
};

document.addEventListener('DOMContentLoaded', app.initialize);