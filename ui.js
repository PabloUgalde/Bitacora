// Este archivo contiene funciones de ayuda y lógica para la interfaz de usuario.

const ui = {

    showView: (viewId) => {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

        const activeView = document.getElementById(viewId);
        const activeLink = document.querySelector(`a.nav-link[data-view="${viewId}"]`);

        if (activeView) activeView.classList.add('active');
        if (activeLink) {
            activeLink.classList.add('active');
            // Activar el toggle padre correcto según en qué dropdown está el link
            const parentMenu = activeLink.closest('.nav-dropdown-menu');
            if (parentMenu) {
                if (parentMenu.id === 'summaries-dropdown-menu') {
                    document.getElementById('summaries-dropdown-toggle')?.classList.add('active');
                } else if (parentMenu.id === 'bitacora-dropdown-menu') {
                    document.getElementById('bitacora-dropdown-toggle')?.classList.add('active');
                }
            }
        }

        if (viewId !== 'view-add-flight') {
            ui.resetFlightForm();
        }

        const renderFunction = ui.renderMap[viewId];
        if (renderFunction) renderFunction();
    },

    populateAircraftTypes: () => {
        const container = document.getElementById('tipoAvion');
        container.innerHTML = '';
        container.style.cssText = 'display:flex; flex-wrap:wrap; padding:0.5rem 0.75rem; border:1px solid var(--border-color,#444); border-radius:8px; margin-top:0.25rem;';
        AIRCRAFT_TYPE_HEADERS.forEach(type => {
            const label = document.createElement('label');
            label.style.cssText = 'display:flex; align-items:center; gap:0.5rem; cursor:pointer; font-size:14px; font-weight:normal; white-space:nowrap; width:50%; padding:0.3rem 0; margin:0;';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.value = type;
            cb.name = 'tipoAvion';
            label.appendChild(cb);
            label.appendChild(document.createTextNode(type));
            container.appendChild(label);
        });
    },

    renderMap: { 
        'view-dashboard': render.dashboard, 
        'view-logbook': render.detailedLog, // Llama a la función de escritorio original (intacta)
        'view-anotaciones': () => anotaciones.load(),
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
    handleMultipleValidationErrors: (errors) => { const statusMessage = document.getElementById('status-message'); if (errors.length === 1) { statusMessage.textContent = `Error: ${errors[0].message}`; } else { statusMessage.innerHTML = `<strong>Se encontraron ${errors.length} errores:</strong><ul style="margin:4px 0 0 16px;padding:0;">` + errors.map(e => `<li>${e.message}</li>`).join('') + '</ul>'; } statusMessage.className = 'status error'; errors.forEach(({ fieldIds }) => { if (Array.isArray(fieldIds)) { fieldIds.forEach(id => { const field = document.getElementById(id); if (field) field.classList.add('error'); }); } }); ui.goToStep(errors[0].stepIndex !== -1 ? errors[0].stepIndex : 0); return { isValid: false, data: null }; },
    
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

    // Intérprete de entrada de tiempo (soporta 1.5 y 1:30)
    parseTimeInput: (val) => {
        if (!val || val === '') return 0;
        const strVal = String(val).trim();
        if (strVal.includes(':')) {
            const parts = strVal.split(':');
            const hours = parseInt(parts[0], 10) || 0;
            const minutes = parseInt(parts[1], 10) || 0;
            // Permitimos minutos > 59 para que 0:75 sea 1.25
            return hours + (minutes / 60);
        }
        return parseFloat(strVal.replace(',', '.')) || 0;
    },

    // Validador de formato para feedback visual en tiempo real
    isValidTimeFormat: (val) => {
        if (!val || val === '') return true;
        const strVal = String(val).trim();
        if (strVal.includes(':')) {
            const parts = strVal.split(':');
            if (parts.length !== 2) return false;
            const [h, m] = parts;
            // Verifica que sean números y los minutos no excedan 59
            if (!/^\d+$/.test(h) || !/^\d{0,2}$/.test(m)) return false;
            // Quitamos la restricción de m >= 60
            return true;
        }
        // Soporte para formato decimal tradicional
        const floatVal = parseFloat(strVal.replace(',', '.'));
        return !isNaN(floatVal) && isFinite(floatVal) && /^\d*([.,]\d*)?$/.test(strVal);
    },

    // Configura la validación visual en tiempo real para todos los campos de tiempo
    setupRealTimeValidation: () => {
        const timeFields = [
            'duracion', 'condicionDiurno', 'condicionNocturno', 'condicionIFR',
            'rol-simulador', 'rol-travesia', 'rol-solo', 'rol-pic', 'rol-sic',
            'rol-instruccion', 'rol-instructor'
        ];
        timeFields.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                // Cambiamos el tipo a text para permitir el caracter ":"
                el.type = 'text';
                // Sugerimos teclado telefónico para acceso rápido a números y símbolos
                el.setAttribute('inputmode', 'tel');
                el.addEventListener('input', () => {
                    el.classList.toggle('error', !ui.isValidTimeFormat(el.value));
                });
                // Re-formatear automáticamente al perder el foco (convierte 1:64 a 2:04)
                el.addEventListener('blur', () => {
                    if (el.value && ui.isValidTimeFormat(el.value)) {
                        const decimalValue = ui.parseTimeInput(el.value);
                        el.value = formatHours(decimalValue);
                    }
                });
            }
        });
    },

    populateFlightForm: (flight) => {
        if (!flight) return;
        document.getElementById('fecha').value = flight.Fecha && !isNaN(flight.Fecha.getTime()) ? flight.Fecha.toISOString().split('T')[0] : '';
        document.getElementById('aeronave').value = flight['Aeronave Marca y Modelo'] || '';
        document.getElementById('matricula').value = flight['Matricula Aeronave'] || '';
        document.getElementById('desde').value = flight.Desde || '';
        document.getElementById('hasta').value = flight.Hasta || '';
        document.getElementById('duracion').value = formatHours(flight['Duracion Total de Vuelo'] || 0);
        document.getElementById('condicionDiurno').value = formatHours(flight.Diurno || 0);
        document.getElementById('condicionNocturno').value = formatHours(flight.Nocturno || 0);
        document.getElementById('condicionIFR').value = formatHours(flight.IFR || 0);
        document.getElementById('approaches-no').value = flight.NO || '';
        document.getElementById('approaches-tip').value = flight.Tipo || '';
        document.getElementById('aterrizajesDia').value = flight['Aterrizajes Dia'] || '';
        document.getElementById('aterrizajesNoche').value = flight['Aterrizajes Noche'] || '';
        document.getElementById('rol-pic').value = formatHours(flight['Piloto al Mando (PIC)'] || 0);
        document.getElementById('rol-sic').value = formatHours(flight['Copiloto (SIC)'] || 0);
        document.getElementById('rol-instruccion').value = formatHours(flight['Instruccion Recibida'] || 0);
        document.getElementById('rol-instructor').value = formatHours(flight['Como Instructor'] || 0);
        document.getElementById('rol-solo').value = formatHours(flight.Solo || 0);
        document.getElementById('rol-travesia').value = formatHours(flight.Travesia || 0);
        document.getElementById('rol-simulador').value = formatHours(flight['Simulador o Entrenador de Vuelo'] || 0);
        document.getElementById('observaciones').value = flight.Observaciones || '';
        ui.populateAircraftTypes();
        AIRCRAFT_TYPE_HEADERS.forEach(type => {
            const cb = document.querySelector(`input[name="tipoAvion"][value="${type}"]`);
            if (cb) cb.checked = flight[type] > 0;
        });
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
        "Piloto al Mando (PIC)": data.roles.pic, "Copiloto (SIC)": data.roles.sic,
        "Instruccion Recibida": data.roles.instruccion, "Como Instructor": data.roles.instructor,
        "Observaciones": data.observaciones,
        "Pagina Bitacora a Replicar": pageNumber, // Usamos el número de página calculado.
    };
    AIRCRAFT_TYPE_HEADERS.forEach(type => { newFlight[type] = 0; });
    const tiposSeleccionados = Array.isArray(data.tipoAvion) ? data.tipoAvion : [data.tipoAvion];
    tiposSeleccionados.forEach(tipo => {
        if (tipo && AIRCRAFT_TYPE_HEADERS.includes(tipo)) {
            newFlight[tipo] = data.duracion;
        }
    });
    return newFlight;
},

    validateAndGetData: () => {
        document.querySelectorAll('input.error, select.error, #tipoAvion.error').forEach(el => el.classList.remove('error'));
        document.getElementById('status-message').textContent = '';

        // Recolección de datos usando el nuevo parser para campos de tiempo
        const data = {
            fecha: document.getElementById('fecha').value || ui.getTodayString(),
            aeronave: document.getElementById('aeronave').value,
            matricula: document.getElementById('matricula').value,
            desde: document.getElementById('desde').value,
            hasta: document.getElementById('hasta').value,
            duracion: ui.parseTimeInput(document.getElementById('duracion').value),
            tipoAvion: Array.from(document.querySelectorAll('input[name="tipoAvion"]:checked')).map(cb => cb.value),
            condiciones: {
                Diurno: ui.parseTimeInput(document.getElementById('condicionDiurno').value),
                Nocturno: ui.parseTimeInput(document.getElementById('condicionNocturno').value),
                IFR: ui.parseTimeInput(document.getElementById('condicionIFR').value),
            },
            approaches: { no: document.getElementById('approaches-no').value, tipo: document.getElementById('approaches-tip').value },
            aterrizajesDia: document.getElementById('aterrizajesDia').value,
            aterrizajesNoche: document.getElementById('aterrizajesNoche').value,
            roles: {
                simulador: ui.parseTimeInput(document.getElementById('rol-simulador').value),
                travesia: ui.parseTimeInput(document.getElementById('rol-travesia').value),
                solo: ui.parseTimeInput(document.getElementById('rol-solo').value),
                pic: ui.parseTimeInput(document.getElementById('rol-pic').value),
                sic: ui.parseTimeInput(document.getElementById('rol-sic').value),
                instruccion: ui.parseTimeInput(document.getElementById('rol-instruccion').value),
                instructor: ui.parseTimeInput(document.getElementById('rol-instructor').value)
            },
            observaciones: document.getElementById('observaciones').value,
        };

        const errors = [];
        const addError = (message, fieldIds, stepIndex) => errors.push({ message, fieldIds, stepIndex });
        if (!data.aeronave) addError('El campo "Aeronave" es obligatorio.', ['aeronave'], 0);
        if (!data.matricula) addError('El campo "Matrícula" es obligatorio.', ['matricula'], 0);
        if (!data.desde) addError('El campo "Desde" es obligatorio.', ['desde'], 0);
        if (!data.hasta) addError('El campo "Hasta" es obligatorio.', ['hasta'], 0);
        if (data.duracion <= 0) addError('La "Duración Total" debe ser mayor a 0.', ['duracion'], 1);
        const integerFields = { 'aterrizajesDia': 'Aterrizajes Día', 'aterrizajesNoche': 'Aterrizajes Noche', 'approaches-no': 'Nº Aprox. (NO)' };
        for (const [id, name] of Object.entries(integerFields)) { const input = document.getElementById(id); const value = input.value; if (value && !Number.isInteger(Number(value))) { addError(`El campo "${name}" debe ser un número entero (sin decimales).`, [id], 2); } }
        if (data.roles.simulador > 0) { if (Math.abs(data.roles.simulador - data.duracion) > 0.01) { addError('Si es un vuelo de simulador, la "Duración Total" debe ser igual al tiempo de "Simulador".', ['duracion', 'rol-simulador'], 2); } } else { if (!data.tipoAvion || data.tipoAvion.length === 0) addError('El "Tipo de Avión" es obligatorio.', ['tipoAvion'], 1); }
        if (data.duracion > 0 && Math.abs((data.condiciones.Diurno + data.condiciones.Nocturno) - data.duracion) > 0.01) addError('La suma de Diurno y Nocturno debe ser igual a la Duración Total.', ['condicionDiurno', 'condicionNocturno'], 1);
        if (data.condiciones.IFR > data.duracion) addError('Las Horas IFR no pueden ser mayores que la Duración Total.', ['condicionIFR'], 1);
        if (userProfile.userRole === 'pilot') { if (data.duracion > 0 && Math.abs((data.roles.pic + data.roles.sic) - data.duracion) > 0.01) addError('Como piloto, la suma de PIC y SIC debe ser igual a la Duración Total.', ['rol-pic', 'rol-sic'], 2); } else { if (data.duracion > 0 && Math.abs(data.roles.instruccion - data.duracion) > 0.01) addError('Como alumno, la Instrucción debe ser igual a la Duración Total.', ['rol-instruccion'], 2); }
        const otherRoles = { 'Instrucción Recibida': { v: data.roles.instruccion, id: 'rol-instruccion'}, 'Como Instructor': {v: data.roles.instructor, id: 'rol-instructor'}, Solo: { v: data.roles.solo, id: 'rol-solo'}, Travesia: {v: data.roles.travesia, id: 'rol-travesia'} };
        for (const [name, role] of Object.entries(otherRoles)) { if (role.v > data.duracion) addError(`El tiempo de "${name}" no puede ser mayor que la Duración Total.`, [role.id], 2); }
        if (userProfile.userRole === 'pilot' && !logbookState.editingFlightId?.startsWith('saldo-') && data.roles.solo > data.roles.pic) addError(`El tiempo "Solo" no puede ser mayor que el tiempo "PIC".`, ['rol-solo', 'rol-pic'], 2);
        if (errors.length > 0) return ui.handleMultipleValidationErrors(errors);
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
            
            // Forzamos a que el contenedor de aproximaciones se oculte al resetear
            const ifrContainer = document.getElementById('ifr-approaches-container');
            if (ifrContainer) {
                ifrContainer.classList.add('hidden');
            }
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
    },
        showCheckoutResult: (type) => {
        const overlay = document.createElement('div');
        overlay.id = 'checkout-result-overlay';

        const isSuccess = type === 'success';
        overlay.innerHTML = `
            <div class="checkout-result-card">
                <div class="checkout-result-icon">${isSuccess ? '✈' : '✕'}</div>
                <h2>${isSuccess ? '¡Bienvenido a Pro!' : 'Pago cancelado'}</h2>
                <p>${isSuccess 
                    ? 'Tu suscripción está activa. Ahora tienes acceso completo a todas las funciones de la bitácora.' 
                    : 'No se realizó ningún cobro. Puedes intentarlo nuevamente cuando quieras.'}</p>
                <button onclick="document.getElementById('checkout-result-overlay').remove()">
                    ${isSuccess ? 'Comenzar →' : 'Volver al dashboard'}
                </button>
            </div>`;

        const style = document.createElement('style');
        style.textContent = `
            #checkout-result-overlay {
                position: fixed; inset: 0; z-index: 9997;
                background: rgba(0,0,0,0.85);
                display: flex; align-items: center; justify-content: center;
                backdrop-filter: blur(4px);
            }
            .checkout-result-card {
                background: #1a1a1a;
                border: 1px solid ${isSuccess ? '#c9a84c' : '#444'};
                border-radius: 16px;
                padding: 40px 36px;
                width: 100%; max-width: 420px;
                text-align: center;
                box-shadow: 0 0 40px ${isSuccess ? 'rgba(201,168,76,0.2)' : 'rgba(0,0,0,0.5)'};
            }
            .checkout-result-icon {
                font-size: 48px; margin-bottom: 16px;
            }
            .checkout-result-card h2 {
                font-size: 22px; font-weight: 700;
                color: ${isSuccess ? '#c9a84c' : '#888'};
                margin-bottom: 12px;
            }
            .checkout-result-card p {
                color: #888; font-size: 14px;
                line-height: 1.6; margin-bottom: 24px;
            }
            .checkout-result-card button {
                background: ${isSuccess ? '#c9a84c' : 'transparent'};
                color: ${isSuccess ? '#000' : '#888'};
                border: ${isSuccess ? 'none' : '1px solid #444'};
                border-radius: 8px; padding: 12px 32px;
                font-size: 15px; font-weight: 700;
                cursor: pointer; transition: opacity 0.2s;
            }
            .checkout-result-card button:hover { opacity: 0.85; }
        `;
        document.head.appendChild(style);
        document.body.appendChild(overlay);
    },
};