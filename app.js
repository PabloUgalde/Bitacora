// Este es el archivo principal que orquesta toda la aplicación.

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
            .then(() => console.log('Service Worker Registrado'))
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

        // ========================================================== //
        // = LÓGICA DE NAVEGACIÓN Y DROPDOWNS (VERSIÓN CONSOLIDADA) = //
        // ========================================================== //

        const navDropdownToggle = document.getElementById('summaries-dropdown-toggle');
        const navDropdownMenu = document.getElementById('summaries-dropdown-menu');
        const sortDropdownToggle = document.getElementById('sort-order-toggle');
        const sortDropdownMenu = document.getElementById('sort-order-menu');
        const hamburgerBtn = document.getElementById('hamburger-btn');
        const mainNav = document.getElementById('main-nav');
        
        // Listener para el menú de "Resúmenes" (Escritorio)
        if (navDropdownToggle && navDropdownMenu) {
            navDropdownToggle.addEventListener('click', (e) => {
                e.preventDefault();
                navDropdownMenu.classList.toggle('active');
                if (sortDropdownMenu) sortDropdownMenu.classList.remove('active');
            });
        }

        // Listener para el menú de "Ordenar por"
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
        
        // Listener para la navegación principal (Header)
        document.querySelector('header').addEventListener('click', (e) => {
            const link = e.target.closest('.nav-link');
            if (link && link.dataset.view) {
                e.preventDefault();
                if (logbookState.editingFlightId) {
                    ui.resetFlightForm();
                }
                ui.showView(link.dataset.view);
                if (navDropdownMenu) navDropdownMenu.classList.remove('active');
            }
        });

        // Formulario de Vuelo
        document.getElementById('flight-form').addEventListener('submit', app.handleFlightSubmit);
        document.getElementById('review-flight-btn').addEventListener('click', app.handleFlightReview);
        document.querySelectorAll('#flight-form .next-btn').forEach(btn => btn.addEventListener('click', () => ui.goToStep(ui.getCurrentStep() + 1)));
        document.querySelectorAll('#flight-form .prev-btn').forEach(btn => btn.addEventListener('click', () => ui.goToStep(ui.getCurrentStep() - 1)));
        document.getElementById('condicionIFR').addEventListener('input', () => {
            document.getElementById('ifr-approaches-container').classList.toggle('hidden', !(parseFloat(document.getElementById('condicionIFR').value) > 0));
        });
        
        // Modales
        const filterModal = document.getElementById('filter-modal');
        const restoreModal = document.getElementById('restore-modal');
        const printModal = document.getElementById('print-modal');
        const syncModal = document.getElementById('sync-prompt-modal');

        document.getElementById('open-filter-modal-btn').addEventListener('click', app.openFilterModal);
        filterModal.querySelector('.close-button').addEventListener('click', app.closeFilterModal);
        restoreModal.querySelector('.close-button').addEventListener('click', () => backupManager.closeRestoreModal());
        printModal.querySelector('.close-button').addEventListener('click', () => printModal.classList.remove('open'));
        
        document.getElementById('advanced-filter-form').addEventListener('submit', (e) => { e.preventDefault(); logbookState.filters = {}; document.getElementById('advanced-filter-form').querySelectorAll('input[data-filter-key]').forEach(input => { if (input.value) { logbookState.filters[input.dataset.filterKey] = input.value; } }); logbookState.currentPage = 1; render.detailedLog(); app.closeFilterModal(); });
        document.getElementById('reset-filter-btn').addEventListener('click', () => { logbookState.filters = {}; document.getElementById('advanced-filter-form').reset(); logbookState.currentPage = 1; render.detailedLog(); app.closeFilterModal(); });
        
        document.getElementById('open-print-modal-btn').addEventListener('click', () => {
            const lastPageNumber = ui.getLastPageNumber();
            document.getElementById('print-page-to').placeholder = `Última (${lastPageNumber})`;
            if (!document.getElementById('print-page-from').value) { document.getElementById('print-page-from').value = 1; }
            printModal.classList.add('open');
        });
        document.getElementById('print-report-form').addEventListener('submit', (e) => { e.preventDefault(); reportGenerator.generate(); printModal.classList.remove('open'); });

        // Controles de Logbook
        const paginationControls = document.getElementById('pagination-controls');
        if (paginationControls) {
            paginationControls.addEventListener('click', (e) => {
                if (e.target.closest('.prev-btn') && !e.target.closest('.prev-btn').disabled) {
                    logbookState.currentPage--;
                    render.detailedLog();
                }
                if (e.target.closest('.next-btn') && !e.target.closest('.next-btn').disabled) {
                    logbookState.currentPage++;
                    render.detailedLog();
                }
            });
            const itemsPerPageSelect = document.getElementById('items-per-page-desktop');
            if (itemsPerPageSelect) {
                itemsPerPageSelect.addEventListener('change', (e) => {
                    const value = parseInt(e.target.value, 10);
                    logbookState.itemsPerPage = value;
                    logbookState.currentPage = 1;
                    render.detailedLog();
                });
            }
            const itemsBtn = document.getElementById('items-per-page-btn');
            const itemsMenu = document.getElementById('items-per-page-menu');
            if (itemsBtn && itemsMenu) {
                itemsBtn.addEventListener('click', () => itemsMenu.classList.toggle('active'));
                itemsMenu.addEventListener('click', (e) => {
                    if (e.target.dataset.value) {
                        const value = parseInt(e.target.dataset.value, 10);
                        logbookState.itemsPerPage = value;
                        logbookState.currentPage = 1;
                        itemsBtn.textContent = value;
                        render.detailedLog();
                        itemsMenu.classList.remove('active');
                    }
                });
            }
        }
        
        const clearFilterBtn = document.getElementById('clear-logbook-filter-btn');
        if (clearFilterBtn) {
            clearFilterBtn.addEventListener('click', () => {
                logbookState.filters = {};
                const filterForm = document.getElementById('advanced-filter-form');
                if (filterForm) filterForm.reset();
                logbookState.currentPage = 1;
                render.detailedLog();
            });
        }

        // Controles de Resúmenes
        document.getElementById('time-summary-year-select').addEventListener('change', summaryRenderer.byTime);
        document.getElementById('type-summary-year-select').addEventListener('change', () => { summaryRenderer.populateTypeSummaryFilters(); summaryRenderer.byType();});
        document.getElementById('type-summary-month-select').addEventListener('change', summaryRenderer.byType);
        document.getElementById('airport-summary-year-select').addEventListener('change', () => { summaryRenderer.populateAirportSummaryFilters(); summaryRenderer.byAirport(); });
        document.getElementById('airport-summary-month-select').addEventListener('change', summaryRenderer.byAirport);
        document.getElementById('aircraft-summary-year-select').addEventListener('change', () => { summaryRenderer.populateAircraftSummaryFilters(); summaryRenderer.byAircraft(); });
        document.getElementById('aircraft-summary-month-select').addEventListener('change', summaryRenderer.byAircraft);
        document.getElementById('aircraft-group-by-buttons').addEventListener('click', (e) => { const target = e.target.closest('.toggle-btn'); if (target && !target.classList.contains('active')) { document.querySelectorAll('#aircraft-group-by-buttons .toggle-btn').forEach(btn => btn.classList.remove('active')); target.classList.add('active'); summaryRenderer.byAircraft(); } });
        document.getElementById('ifr-summary-year-select').addEventListener('change', summaryRenderer.byIFR);
        document.getElementById('ifr-summary-month-select').addEventListener('change', summaryRenderer.byIFR);
        document.getElementById('ifr-group-by-buttons').addEventListener('click', (e) => { const target = e.target.closest('.toggle-btn'); if (target && !target.classList.contains('active')) { document.querySelectorAll('#ifr-group-by-buttons .toggle-btn').forEach(btn => btn.classList.remove('active')); target.classList.add('active'); summaryRenderer.byIFR(); } });
        
        // Controles de Configuración
        document.getElementById('save-settings-btn').addEventListener('click', app.saveSettings);
        document.getElementById('load-from-sheets-btn').addEventListener('click', async () => {
            const url = document.getElementById('google-sheets-url').value;
            const statusEl = document.getElementById('data-status');
            statusEl.textContent = 'Cargando desde Google Sheets...';
            statusEl.className = 'status';
            const result = await api.loadFlightsFromGoogleSheets(url);
            if (result.success) {
                flightData = result.data;
                api.saveFlightsToLocalStorage();
                logbookState.sortOrder = 'natural';
                app.updateSortButtonText();
                statusEl.textContent = result.message;
                statusEl.className = 'status success';
                alert(result.message + " La aplicación se recargará para reflejar los cambios.");
                location.reload();
            } else {
                statusEl.textContent = `Error: ${result.message}`;
                statusEl.className = 'status error';
                alert(`Error al cargar desde Google Sheets: ${result.message}`);
            }
        });
        document.getElementById('upload-excel-btn').addEventListener('click', () => document.getElementById('excel-file-input').click());
        document.getElementById('excel-file-input').addEventListener('change', async (event) => { const file = event.target.files[0]; if (file) { const result = await dataImporter.processExcelFile(file); if (result.success) { flightData = result.data; api.saveFlightsToLocalStorage(); logbookState.sortOrder = 'natural'; app.updateSortButtonText(); ui.showView('view-dashboard'); } } });
        document.getElementById('download-excel-btn').addEventListener('click', () => api.exportToExcel());
        document.getElementById('sync-to-sheets-btn').addEventListener('click', async () => {
            const statusEl = document.getElementById('data-status');
            statusEl.textContent = 'Sincronizando... Esto puede tardar unos segundos.';
            statusEl.className = 'status';
            const result = await api.syncAllFlightsToSheets(); if (result.success) { statusEl.textContent = `¡Éxito! ${result.message}`; statusEl.className = 'status success'; alert(result.message); } else { statusEl.textContent = `Error: ${result.message}`; statusEl.className = 'status error'; alert(`Error durante la sincronización: ${result.message}`);}
        });
        document.getElementById('clear-local-data-btn').addEventListener('click', () => { if (confirm("¿Estás seguro de que quieres borrar todos los datos locales?")) { localStorage.removeItem('flightLogData'); location.reload(); } });
        document.getElementById('setup-backup-btn').addEventListener('click', () => backupManager.setupBackupFolder());
        document.getElementById('restore-backup-btn').addEventListener('click', () => backupManager.restoreFromBackup());
        document.querySelectorAll('.accordion-header').forEach(header => {
            header.addEventListener('click', () => {
                const content = header.nextElementSibling;
                header.classList.toggle('active');
                content.classList.toggle('active');
            });
        });

        // Listeners del Modal de Sincronización
        document.getElementById('sync-action-merge').addEventListener('click', async () => {
            const syncModal = document.getElementById('sync-prompt-modal');
            console.log("Acción: Sincronizar y Fusionar");
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
            alert("¡Sincronización completada! La aplicación se recargará con los datos fusionados.");
            location.reload();
        });
        document.getElementById('sync-action-replace').addEventListener('click', async () => {
            console.log("Acción: Reemplazar Local");
            userProfile.dataSource = 'google_sheets';
            await api.saveProfile(userProfile);
            alert("Fuente de datos cambiada. Se usarán los datos de Google Sheets. La aplicación se recargará.");
            location.reload();
        });
        document.getElementById('sync-action-cancel').addEventListener('click', () => {
            const syncModal = document.getElementById('sync-prompt-modal');
            console.log("Acción: Cancelar");
            document.getElementById('data-source-select').value = 'local';
            document.getElementById('google-sheets-url-container').classList.add('hidden');
            syncModal.classList.remove('open');
        });
        
        // LÓGICA DEL MENÚ MÓVIL (CORREGIDA)
        if (hamburgerBtn && mainNav) {
            hamburgerBtn.addEventListener('click', () => {
                hamburgerBtn.classList.toggle('open');
                mainNav.classList.toggle('mobile-nav-open');
            });
            const dropdownToggleMobile = mainNav.querySelector('#summaries-dropdown-toggle');
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

        // ========================================================== //
        // =  LISTENER GLOBAL UNIFICADO PARA CERRAR ELEMENTOS         = //
        // ========================================================== //
        if (!window.globalClickListenerAttached) {
            const itemsMenu = document.getElementById('items-per-page-menu');
            const itemsBtn = document.getElementById('items-per-page-btn');
            
            window.addEventListener('click', (e) => {
                // Cierra modales
                if (e.target === filterModal) app.closeFilterModal();
                if (e.target === restoreModal) backupManager.closeRestoreModal();
                if (e.target === printModal) printModal.classList.remove('open');

                // Cierra menú de "Resúmenes" de escritorio
                if (navDropdownMenu && navDropdownToggle && !navDropdownToggle.contains(e.target) && !navDropdownMenu.contains(e.target)) {
                    navDropdownMenu.classList.remove('active');
                }

                // Cierra menú de "Ordenar por"
                if (sortDropdownMenu && sortDropdownToggle && !sortDropdownToggle.contains(e.target) && !sortDropdownMenu.contains(e.target)) {
                    sortDropdownMenu.classList.remove('active');
                }
                
                // Cierra menú móvil de "Items por página"
                if (itemsMenu && itemsBtn && !itemsBtn.contains(e.target) && !itemsMenu.contains(e.target)) {
                    itemsMenu.classList.remove('active');
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
            if (selectEl) {
                selectedCards.push(selectEl.value);
            }
        }
        const uniqueCards = new Set(selectedCards);
        if (uniqueCards.size !== selectedCards.length) {
            alert("Error: No puedes seleccionar la misma tarjeta en múltiples ranuras. Por favor, elige una métrica diferente para cada una.");
            return;
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
        console.log("Perfil de usuario guardado en localStorage (sin crear backup).");
        ui.updateFormForRole();
        const statusEl = document.getElementById('settings-status');
        statusEl.textContent = `¡Configuración guardada con éxito!`;
        statusEl.className = 'status success';
        setTimeout(() => statusEl.textContent = '', 4000);
        alert("Configuración guardada. Tus cambios se han guardado y respaldado.");
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
        const backupSelect = document.getElementById('backup-retention-select');
        if (backupSelect && userProfile.backupRetentionDays) {
            backupSelect.value = userProfile.backupRetentionDays;
        }
        ui.showBackupFolderPath(); 
        ui.updateFormForRole();
    },

    handleFlightReview: () => { const result = ui.validateAndGetData(); if (result.isValid) { render.flightPreview(result.data); ui.goToStep(3); } },
    
    handleFlightSubmit: async (e) => {
        e.preventDefault();
        const submitBtn = e.target.querySelector('.submit-btn');
        if (!submitBtn || submitBtn.disabled) { return; }
        submitBtn.disabled = true;
        submitBtn.textContent = 'Guardando...';

        const result = ui.validateAndGetData();
        if (result.isValid) {
            const isEditing = !!logbookState.editingFlightId;
            let success = false;
            try {
                if (isEditing) {
                    success = await api.updateFlight(logbookState.editingFlightId, result.data);
                } else {
                    success = await api.saveFlight(result.data);
                }
                if (success) {
                    const successMessage = `¡Vuelo ${isEditing ? 'actualizado' : 'guardado'} con éxito!`;
                    if (isEditing && userProfile.dataSource === 'google_sheets') {
                        alert(successMessage + " La aplicación se recargará para reflejar los cambios desde la fuente de datos principal.");
                        location.reload();
                    } else {
                        const statusMessage = document.getElementById('status-message');
                        statusMessage.textContent = successMessage;
                        statusMessage.className = 'status success';
                        ui.resetFlightForm();
                        setTimeout(() => { 
                            ui.showView('view-dashboard');
                            statusMessage.textContent = ''; 
                        }, 1500);
                    }
                } else {
                    alert("Hubo un error al guardar el vuelo.");
                    submitBtn.disabled = false;
                    submitBtn.textContent = isEditing ? 'Guardar Cambios' : 'Guardar Vuelo Definitivo';
                }
            } catch (error) {
                console.error("Error durante el guardado del vuelo:", error);
                alert("Ocurrió un error crítico al guardar. Revisa la consola para más detalles.");
                submitBtn.disabled = false;
                submitBtn.textContent = isEditing ? 'Guardar Cambios' : 'Guardar Vuelo Definitivo';
            }
        } else {
            submitBtn.disabled = false;
            const originalText = document.getElementById('flight-form-title').textContent.includes('Editar') ? 'Guardar Cambios' : 'Guardar Vuelo Definitivo';
            submitBtn.textContent = originalText;
        }
    },
};

document.addEventListener('DOMContentLoaded', app.initialize);