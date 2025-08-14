// Este archivo contiene funciones de ayuda y lógica para la interfaz de usuario.

const ui = {

    showView: (viewId) => {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        const activeView = document.getElementById(viewId);
        const activeLink = document.querySelector(`.nav-link[data-view="${viewId}"]`);
        if(activeView) activeView.classList.add('active');
        if(activeLink) {
            activeLink.classList.add('active');
            if(activeLink.closest('.nav-dropdown-menu')) {
                document.getElementById('summaries-dropdown-toggle').classList.add('active');
            }
        }
        if (viewId === 'view-add-flight') { // Simplificamos la condición
            if (!logbookState.editingFlightId) {
                ui.resetFlightForm();
            }
            ui.populateAircraftTypes(); // <<< ¡AQUÍ ESTÁ LA LLAMADA CLAVE!
            ui.updateFormForRole();
        } else if (viewId !== 'view-add-flight') {
             ui.resetFlightForm();
        }
        
        const renderFunction = ui.renderMap[viewId];
        if (renderFunction) {
            renderFunction();
        }
    },

    populateAircraftTypes: () => {
    const select = document.getElementById('tipoAvion');
    if (!select || select.options.length > 1) return; // Si no existe o ya está poblado, no hacer nada

    // Limpiamos y añadimos la opción por defecto
    select.innerHTML = '<option value="" disabled selected>Selecciona un tipo...</option>';
    
    // AIRCRAFT_TYPE_HEADERS es una variable global que ya tienes en state.js
    AIRCRAFT_TYPE_HEADERS.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        select.appendChild(option);
    });
    },

    renderMap: { 
        'view-dashboard': render.dashboard, 
        'view-logbook': render.detailedLog, // Llama a la función de escritorio original (intacta)
        'view-summaries-by-page': summaryRenderer.byPage, 
        'view-summary-by-time': summaryRenderer.byTime, 
        'view-summary-by-type': summaryRenderer.byType,
        'view-summary-by-airport': summaryRenderer.byAirport, 
        'view-summary-by-aircraft': summaryRenderer.byAircraft,
        'view-summary-ifr': summaryRenderer.byIFR,
        'view-settings': () => app.loadSettings() 
    },

    getTodayString: () => { const today = new Date(); const year = today.getFullYear(); const month = String(today.getMonth() + 1).padStart(2, '0'); const day = String(today.getDate()).padStart(2, '0'); return `${year}-${month}-${day}`; },
    getLastPageNumber: () => { if (!flightData || flightData.length === 0) { return 1; // Si no hay vuelos, devuelve 1 por defecto
        }
        // Usamos Math.max para encontrar el número de página más alto
        const lastPage = Math.max(...flightData.map(flight => flight["Pagina Bitacora a Replicar"] || 0));
        return lastPage > 0 ? lastPage : 1;
    },
    getCurrentStep: () => { const steps = Array.from(document.querySelectorAll('#flight-form .form-step')); return steps.findIndex(s => s.classList.contains('active')); },
    goToStep: (index) => { const steps = Array.from(document.querySelectorAll('#flight-form .form-step')); let currentStep = ui.getCurrentStep(); if (index < 0 || index >= steps.length) return; if (currentStep > -1) steps[currentStep].classList.remove('active'); steps[index].classList.add('active'); },
    handleValidationError: (message, fieldIds = [], stepIndex = -1) => { const statusMessage = document.getElementById('status-message'); statusMessage.textContent = `Error: ${message}`; statusMessage.className = 'status error'; if (Array.isArray(fieldIds)) { fieldIds.forEach(id => { const field = document.getElementById(id); if (field) field.classList.add('error'); }); } if (stepIndex !== -1) { ui.goToStep(stepIndex); } return { isValid: false, data: null }; },
    
    determineUserRole: () => { const pilotLicenseInputs = document.querySelectorAll('input[data-license-type="pilot"]'); return Array.from(pilotLicenseInputs).some(input => input.value.trim() !== '') ? 'pilot' : 'student'; },
    updateFormForRole: () => {
        const pilotRolesContainer = document.getElementById('pilot-roles-container');
        const studentRolesContainer = document.getElementById('student-roles-container');
        if(!pilotRolesContainer || !studentRolesContainer) return;
        const picInput = document.getElementById('rol-pic'); const sicInput = document.getElementById('rol-sic');
        const instruccionInput = document.getElementById('rol-instruccion');
        const instructorInput = document.getElementById('rol-instructor');
        if (userProfile.userRole === 'pilot') {
            pilotRolesContainer.classList.remove('hidden'); 
            studentRolesContainer.classList.add('hidden');

            picInput.disabled = false; 
            sicInput.disabled = false; 
            instruccionInput.disabled = false; 
            instructorInput.disabled = false; } 
            else {
            pilotRolesContainer.classList.add('hidden'); 
            studentRolesContainer.classList.remove('hidden');

            picInput.disabled = true; 
            picInput.value = ''; 
            sicInput.disabled = true; 
            sicInput.value = ''; 
            instruccionInput.disabled = false; 
            instructorInput.disabled = true; 
            instructorInput.value = ''; }
    },

    updateSortButtonText: () => {
        const sortButton = document.getElementById('sort-order-toggle');
        const sortOptions = document.querySelectorAll('#sort-order-menu .sort-option');
        const sortLabels = { natural: 'Carga ⇕', desc: 'Reciente ▼', asc: 'Antiguo ▲' };
        if (sortButton) { sortButton.innerHTML = `Ordenar por: ${sortLabels[logbookState.sortOrder]}`; }
        sortOptions.forEach(opt => {
            if (opt.dataset.sort === logbookState.sortOrder) { opt.classList.add('active'); } 
            else { opt.classList.remove('active'); }
        });
    },

    populateFlightForm: (flight) => {
        if (!flight) return;
        document.getElementById('fecha').value = flight.Fecha && !isNaN(flight.Fecha.getTime()) ? flight.Fecha.toISOString().split('T')[0] : '';
        document.getElementById('aeronave').value = flight['Aeronave Marca y Modelo'] || '';
        document.getElementById('matricula').value = flight['Matricula Aeronave'] || '';
        document.getElementById('desde').value = flight.Desde || '';
        document.getElementById('hasta').value = flight.Hasta || '';
        document.getElementById('duracion').value = flight['Duracion Total de Vuelo'] || '';
        document.getElementById('condicionDiurno').value = flight.Diurno || '';
        document.getElementById('condicionNocturno').value = flight.Nocturno || '';
        document.getElementById('condicionIFR').value = flight.IFR || '';
        document.getElementById('approaches-no').value = flight.NO || '';
        document.getElementById('approaches-tip').value = flight.Tipo || '';
        document.getElementById('aterrizajesDia').value = flight['Aterrizajes Dia'] || '';
        document.getElementById('aterrizajesNoche').value = flight['Aterrizajes Noche'] || '';
        document.getElementById('rol-pic').value = flight['Piloto al Mando (PIC)'] || '';
        document.getElementById('rol-sic').value = flight['Copiloto (SIC)'] || '';
        document.getElementById('rol-instruccion').value = flight['Instruccion Recibida'] || '';
        document.getElementById('rol-instructor').value = flight['Como Instructor'] || '';
        document.getElementById('rol-solo').value = flight.Solo || '';
        document.getElementById('rol-travesia').value = flight.Travesia || '';
        document.getElementById('rol-simulador').value = flight['Simulador o Entrenador de Vuelo'] || '';
        document.getElementById('observaciones').value = flight.Observaciones || '';
        const tipoAvionSelect = document.getElementById('tipoAvion');
        let tipoAvion = '';
        for (const header of AIRCRAFT_TYPE_HEADERS) {
            if (flight[header] > 0) {
                tipoAvion = header;
                break;
            }
        }
        tipoAvionSelect.value = tipoAvion;
        document.getElementById('ifr-approaches-container').classList.toggle('hidden', !(flight.IFR > 0));
    },

createFlightObject: (data) => {
    // --- INICIO DE LA LÓGICA DE PAGINACIÓN CORREGIDA ---
    let pageNumber;

    if (logbookState.editingFlightId) {
        // Si estamos editando, mantenemos el número de página original del vuelo.
        const originalFlight = flightData.find(f => f.id == logbookState.editingFlightId);
        pageNumber = originalFlight ? originalFlight["Pagina Bitacora a Replicar"] : 1;
    } else {
        // Si estamos creando un nuevo vuelo, calculamos la nueva página.
        if (flightData.length === 0) {
            // Si es el primer vuelo de la bitácora, la página es la 1.
            pageNumber = 1;
        } else {
            // Obtenemos el número de la última página existente.
            const lastPageNumber = flightData[0]["Pagina Bitacora a Replicar"] || 1;
            
            // Contamos cuántos vuelos ya existen en esa última página.
            const flightsOnLastPage = flightData.filter(f => f["Pagina Bitacora a Replicar"] === lastPageNumber).length;
            
            // Verificamos si la última página ya está llena (8 registros).
            if (flightsOnLastPage >= 8) {
                // Si está llena, el nuevo vuelo va en la siguiente página.
                pageNumber = lastPageNumber + 1;
            } else {
                // Si no está llena, el nuevo vuelo va en la misma página.
                pageNumber = lastPageNumber;
            }
        }
    }
    // --- FIN DE LA LÓGICA DE PAGINACIÓN CORREGIDA ---

    const newFlight = {
        id: logbookState.editingFlightId || Date.now().toString() + Math.random().toString().slice(2),
        "Fecha": new Date(data.fecha + 'T00:00:00Z'),
        "Aeronave Marca y Modelo": data.aeronave.toUpperCase(), "Matricula Aeronave": data.matricula.toUpperCase(),
        "Desde": data.desde.toUpperCase(), "Hasta": data.hasta.toUpperCase(),
        "Duracion Total de Vuelo": data.duracion,
        "Aterrizajes Dia": parseInt(data.aterrizajesDia) || 0, "Aterrizajes Noche": parseInt(data.aterrizajesNoche) || 0,
        "Diurno": data.condiciones.Diurno, "Nocturno": data.condiciones.Nocturno, "IFR": data.condiciones.IFR,
        "NO": parseInt(data.approaches.no) || 0, "Tipo": data.approaches.tipo.toUpperCase(),
        "Simulador o Entrenador de Vuelo": data.roles.simulador, "Travesia": data.roles.travesia, "Solo": data.roles.solo,
        "Piloto al Mando (PIC)": data.roles.pic, "Copilo-to (SIC)": data.roles.sic,
        "Instruccion Recibida": data.roles.instruccion, "Como Instructor": data.roles.instructor,
        "Observaciones": data.observaciones,
        "Pagina Bitacora a Replicar": pageNumber, // Usamos el número de página calculado.
    };
    AIRCRAFT_TYPE_HEADERS.forEach(type => { newFlight[type] = 0; });
    if (data.roles.simulador <= 0 && data.tipoAvion && AIRCRAFT_TYPE_HEADERS.includes(data.tipoAvion)) {
        newFlight[data.tipoAvion] = data.duracion;
    }
    return newFlight;
},

    validateAndGetData: () => {
        document.querySelectorAll('input.error, select.error').forEach(el => el.classList.remove('error'));
        document.getElementById('status-message').textContent = '';
        const data = { fecha: document.getElementById('fecha').value || ui.getTodayString(), aeronave: document.getElementById('aeronave').value, matricula: document.getElementById('matricula').value, desde: document.getElementById('desde').value, hasta: document.getElementById('hasta').value, duracion: parseFloat(document.getElementById('duracion').value) || 0, tipoAvion: document.getElementById('tipoAvion').value, condiciones: { Diurno: parseFloat(document.getElementById('condicionDiurno').value) || 0, Nocturno: parseFloat(document.getElementById('condicionNocturno').value) || 0, IFR: parseFloat(document.getElementById('condicionIFR').value) || 0, }, approaches: { no: document.getElementById('approaches-no').value, tipo: document.getElementById('approaches-tip').value }, aterrizajesDia: document.getElementById('aterrizajesDia').value, aterrizajesNoche: document.getElementById('aterrizajesNoche').value, roles: { simulador: parseFloat(document.getElementById('rol-simulador').value) || 0, travesia: parseFloat(document.getElementById('rol-travesia').value) || 0, solo: parseFloat(document.getElementById('rol-solo').value) || 0, pic: parseFloat(document.getElementById('rol-pic').value) || 0, sic: parseFloat(document.getElementById('rol-sic').value) || 0, instruccion: parseFloat(document.getElementById('rol-instruccion').value) || 0, instructor: parseFloat(document.getElementById('rol-instructor').value) || 0 }, observaciones: document.getElementById('observaciones').value, };
        if (!data.aeronave) return ui.handleValidationError('El campo "Aeronave" es obligatorio.', ['aeronave'], 0);
        if (!data.matricula) return ui.handleValidationError('El campo "Matrícula" es obligatorio.', ['matricula'], 0);
        if (!data.desde) return ui.handleValidationError('El campo "Desde" es obligatorio.', ['desde'], 0);
        if (!data.hasta) return ui.handleValidationError('El campo "Hasta" es obligatorio.', ['hasta'], 0);
        if (data.duracion <= 0) return ui.handleValidationError('La "Duración Total" debe ser mayor a 0.', ['duracion'], 1);
        const integerFields = { 'aterrizajesDia': 'Aterrizajes Día', 'aterrizajesNoche': 'Aterrizajes Noche', 'approaches-no': 'Nº Aprox. (NO)' };
        for (const [id, name] of Object.entries(integerFields)) { const input = document.getElementById(id); const value = input.value; if (value && !Number.isInteger(Number(value))) { return ui.handleValidationError(`El campo "${name}" debe ser un número entero (sin decimales).`, [id], 2); } }
        if (data.roles.simulador > 0) { if (Math.abs(data.roles.simulador - data.duracion) > 0.01) { return ui.handleValidationError('Si es un vuelo de simulador, la "Duración Total" debe ser igual al tiempo de "Simulador".', ['duracion', 'rol-simulador'], 2); } } else { if (!data.tipoAvion) return ui.handleValidationError('El "Tipo de Avión" es obligatorio.', ['tipoAvion'], 1); }
        if (Math.abs((data.condiciones.Diurno + data.condiciones.Nocturno) - data.duracion) > 0.01) return ui.handleValidationError('La suma de Diurno y Nocturno debe ser igual a la Duración Total.', ['condicionDiurno', 'condicionNocturno'], 1);
        if (data.condiciones.IFR > data.duracion) return ui.handleValidationError('Las Horas IFR no pueden ser mayores que la Duración Total.', ['condicionIFR'], 1);
        if (userProfile.userRole === 'pilot') { if (Math.abs((data.roles.pic + data.roles.sic) - data.duracion) > 0.01) return ui.handleValidationError('Como piloto, la suma de PIC y SIC debe ser igual a la Duración Total.', ['rol-pic', 'rol-sic'], 2); } else { if (Math.abs(data.roles.instruccion - data.duracion) > 0.01) return ui.handleValidationError('Como alumno, la Instrucción debe ser igual a la Duración Total.', ['rol-instruccion'], 2); }
        const otherRoles = { 'Instrucción Recibida': { v: data.roles.instruccion, id: 'rol-instruccion'}, 'Como Instructor': {v: data.roles.instructor, id: 'rol-instructor'}, Solo: { v: data.roles.solo, id: 'rol-solo'}, Travesia: {v: data.roles.travesia, id: 'rol-travesia'} };
        for (const [name, role] of Object.entries(otherRoles)) { if (role.v > data.duracion) return ui.handleValidationError(`El tiempo de "${name}" no puede ser mayor que la Duración Total.`, [role.id], 2); }
        if (data.roles.solo > data.roles.pic) return ui.handleValidationError('El tiempo "Solo" no puede ser mayor que el tiempo "PIC".', ['rol-solo', 'rol-pic'], 2);
        return { isValid: true, data };
    },
 
    setFlightFormMode: (mode) => {
        const title = document.getElementById('flight-form-title');
        const submitBtn = document.querySelector('#flight-form .submit-btn');
        if (!title || !submitBtn) return;
        if (mode === 'edit') {
            title.textContent = 'Editar Vuelo Registrado';
            submitBtn.textContent = 'Guardar Cambios';
        } else {
            title.textContent = 'Añadir Nuevo Vuelo';
            submitBtn.textContent = 'Guardar Vuelo Definitivo';
        }
    },

    resetFlightForm: () => {
        logbookState.editingFlightId = null;
        const form = document.getElementById('flight-form');
        if (form) {
            form.reset();
            document.getElementById('fecha').value = ui.getTodayString();
            ui.setFlightFormMode('add'); // Esto ya cambia el texto del botón
            ui.goToStep(0);

            // --- INICIO DE LA CORRECCIÓN ---
            // Nos aseguramos de que el botón de envío esté siempre habilitado
            // cuando el formulario se resetea.
            const submitBtn = form.querySelector('.submit-btn');
            if (submitBtn) {
                submitBtn.disabled = false;
            }
            // --- FIN DE LA CORRECCIÓN ---
        }
    },

    showBackupFolderPath: (notSupported = false) => {
        const displayEl = document.getElementById('backup-folder-display');
        if (!displayEl) return;

        // Ocultar el mensaje de estado antiguo si existe
        const oldStatusEl = document.getElementById('backup-status');
        if (oldStatusEl) oldStatusEl.style.display = 'none';

        if (notSupported) {
            displayEl.innerHTML = `<strong>Función no compatible en este navegador.</strong>`;
            displayEl.className = 'backup-info not-configured';
            document.getElementById('setup-backup-btn').disabled = true;
            document.getElementById('restore-backup-btn').disabled = true;
            return;
        }

        if (userProfile && userProfile.backupFolderName) {
            displayEl.innerHTML = `<strong>Carpeta actual:</strong> <span>${userProfile.backupFolderName}</span>`;
            displayEl.className = 'backup-info configured';
        } else {
            displayEl.innerHTML = '<strong>No hay carpeta de respaldo configurada.</strong> <span>Recomendamos seleccionar una.</span>';
            displayEl.className = 'backup-info not-configured';
        }
    },

    showNotification: (message, type = 'info') => {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.remove();
        }, 5000);
    },
        showSyncPrompt: (count) => {
        const modal = document.getElementById('sync-prompt-modal');
        if (!modal) return;
        
        document.getElementById('local-flight-count').textContent = count;
        modal.classList.add('open');
    }
};