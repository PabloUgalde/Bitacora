// =================================================================
// API.JS - VERSIÓN FINAL Y DEFINITIVA
// =================================================================

const api = {

    _getTwoRowHeaderArray() {
        const headerRow1 = ['ID'];
        const headerRow2 = ['']; 

        HEADER_STRUCTURE.forEach(header => {
            if (header.isGroup) {
                // Fila 1: Nombre del grupo, seguido de celdas vacías
                headerRow1.push(header.short || header.name);
                for (let i = 1; i < header.colspan; i++) {
                    headerRow1.push('');
                }
                // Fila 2: Hijos del grupo
                header.children.forEach(child => {
                    headerRow2.push(child.replace("Aterrizajes ", ""));
                });
            } else {
                // Fila 1: Nombre de la columna
                headerRow1.push(header.short || header.name);
                // Fila 2: Celda vacía para que ocupe el rowspan visualmente
                headerRow2.push('');
            }
        });

        // La tercera fila contiene los identificadores reales que usa la app
        const dataIdentifiersRow = HEADERS;

        return [headerRow1, headerRow2];
    },

    _flightObjectToValuesArray(flight) {
        return HEADERS.map(header => {
            const value = flight[header];
            if (header === 'Fecha' && value instanceof Date && !isNaN(value.getTime())) {
                // --- INICIO DE LA CORRECCIÓN ---
                // Creamos una nueva fecha usando los componentes UTC para evitar problemas de zona horaria.
                const year = value.getUTCFullYear();
                const month = String(value.getUTCMonth() + 1).padStart(2, '0');
                const day = String(value.getUTCDate()).padStart(2, '0');
                
                // Retornamos el formato deseado: YYYY-MM-DD
                return `${year}-${month}-${day}`;
                // --- FIN DE LA CORRECCIÓN ---
            }
            return (value === null || value === undefined) ? '' : value;
        });
    },
    
    // --- FUNCIÓN DE COMUNICACIÓN CENTRALIZADA ---
    async _postToSheets(payload) {
        try {
            // Añadimos mode: 'no-cors'. Esto "dispara y olvida" la solicitud.
            // El navegador la envía pero no espera leer la respuesta, evitando el error de CORS.
            await fetch(userProfile.googleSheetsUrl, {
                method: 'POST',
                body: JSON.stringify(payload),
                mode: 'no-cors' 
            });

            // Como no podemos leer la respuesta, asumimos que fue exitosa (actualización optimista).
            // La funcionalidad en Google Sheets seguirá ejecutándose correctamente.
            return { success: true, message: 'Solicitud enviada a Google Sheets.' };

        } catch (error) {
            // Este bloque 'catch' ahora solo se activará para errores de red genuinos
            // (ej. el usuario no tiene conexión a internet).
            console.error("Error de Red Genuino al enviar a Google Sheets:", error);
            return { success: false, message: `Error de red: ${error.message}` };
        }
    },

    // --- CARGA INICIAL ---
    loadInitialFlights: async () => {
        const defaultProfile = { personal: {}, licenses: {}, dashboardCards: [], userRole: 'student', dataSource: 'local' };
        const savedProfile = api.loadProfile() || defaultProfile;
        userProfile = { ...defaultProfile, ...savedProfile };
        const dataSource = userProfile.dataSource || 'local';

        if (dataSource === 'google_sheets' && userProfile.googleSheetsUrl) {
            console.log("Cargando desde Google Sheets...");
            const result = await api.loadFlightsFromGoogleSheets(userProfile.googleSheetsUrl);
            if (result.success) {
                flightData = result.data;
                api.saveFlightsToLocalStorage();
                console.log(`Éxito: ${result.message}`);
            } else {
                console.warn(`Fallo al cargar desde Google Sheets: ${result.message}. Cargando desde respaldo local.`);
                api.loadFlightsFromLocalStorage();
            }
        } else {
            console.log("Cargando desde almacenamiento local...");
            api.loadFlightsFromLocalStorage();
        }
    },

    loadFlightsFromGoogleSheets: (url) => {
        return new Promise((resolve, reject) => {
            const callbackName = 'handleGSheetsResponse';
            window[callbackName] = (response) => {
                try {
                    if (response.success) {
                        const dataRows = response.flights;
                        if (!dataRows || dataRows.length === 0) {
                            resolve({ success: true, data: [], message: "La hoja de Google Sheets no contiene vuelos." });
                            return;
                        }

                        const loadedFlights = dataRows.map((row) => {
                            if (!Array.isArray(row) || row.length === 0) return null;

                            // 1. CREACIÓN POSICIONAL DEL OBJETO
                            // Crea el objeto de vuelo asignando cada valor de la fila a la propiedad
                            // correspondiente de HEADERS, basándose en su posición.
                            const newFlight = {};
                            HEADERS.forEach((headerName, index) => {
                                // Si la fila es más corta que los encabezados, asigna undefined
                                newFlight[headerName] = row[index] !== undefined ? row[index] : undefined;
                            });

                            // 2. VALIDACIÓN Y NORMALIZACIÓN DEL ID
                            // Si no hay ID o está vacío, el vuelo es inválido.
                            if (newFlight.id === undefined || newFlight.id === null || newFlight.id === '') {
                                return null;
                            }
                            newFlight.id = newFlight.id.toString();

                            // 3. PARSEO Y CONVERSIÓN DE TIPOS
                            const duration = parseFloat(String(newFlight['Duracion Total de Vuelo']).replace(",", ".")) || 0;
                            const simTime = parseFloat(String(newFlight['Simulador o Entrenador de Vuelo']).replace(",", ".")) || 0;
                            if (duration <= 0 && simTime <= 0) return null; // Vuelo sin horas no es válido

                            // Convierte la fecha, manejando posibles formatos incorrectos
                            const dateValue = newFlight.Fecha;
                            newFlight.Fecha = (dateValue && !isNaN(new Date(dateValue).getTime())) ? new Date(dateValue) : null;

                            // Convierte todos los campos numéricos, asegurando que sean números.
                            const integerHeaders = ["Aterrizajes Dia", "Aterrizajes Noche", "NO"];
                            HEADERS.forEach(header => {
                                if (SUMMARIZABLE_HEADERS.includes(header) && !integerHeaders.includes(header)) {
                                    newFlight[header] = parseFloat(String(newFlight[header]).replace(",", ".")) || 0;
                                } else if (integerHeaders.includes(header)) {
                                    newFlight[header] = Math.trunc(parseFloat(String(newFlight[header]).replace(",", ".")) || 0);
                                }
                            });

                            return newFlight;

                        }).filter(Boolean); // Elimina todos los vuelos 'null'

                        resolve({ success: true, data: loadedFlights.reverse(), message: `Se cargaron ${loadedFlights.length} vuelos.` });

                    } else {
                        reject(new Error(response.message || 'Error desconocido desde Google Sheets.'));
                    }
                } finally {
                    // 4. LIMPIEZA
                    delete window[callbackName];
                    const scriptTag = document.querySelector(`script[src*="callback=${callbackName}"]`);
                    if (scriptTag) {
                        document.body.removeChild(scriptTag);
                    }
                }
            };

            const script = document.createElement('script');
            script.src = `${url}?callback=${callbackName}&t=${new Date().getTime()}`; // Añadimos timestamp para evitar caché
            script.onerror = () => {
                reject(new Error('Error de red al intentar cargar el script desde Google Sheets.'));
                delete window[callbackName];
                if (document.body.contains(script)) {
                    document.body.removeChild(script);
                }
            };
            document.body.appendChild(script);
        });
    },


// ... (resto de api.js)
    
    // --- OPERACIONES DE MODIFICACIÓN ---
    saveFlight: async (flightDataToSave) => {
        const newFlight = ui.createFlightObject(flightDataToSave);
        flightData.unshift(newFlight);
        if (userProfile.dataSource === 'google_sheets' && userProfile.googleSheetsUrl) {
            const values = api._flightObjectToValuesArray(newFlight);
            await api._postToSheets({ action: 'addFlight', headers: HEADERS, values: values });
        }
        api.saveFlightsToLocalStorage();
        await backupManager.createBackup();
        return true;
    },

    updateFlight: async (flightId, flightDataToUpdate) => {
        const index = flightData.findIndex(f => f && f.id === flightId);
        if (index === -1) return false;

        const updatedFlight = ui.createFlightObject(flightDataToUpdate);
        updatedFlight.id = flightId; // Re-aseguramos el ID original

        // Reemplazamos el objeto viejo por el nuevo en el array en memoria
        flightData[index] = updatedFlight;

        // Enviamos la actualización a la fuente de datos externa si es necesario
        if (userProfile.dataSource === 'google_sheets' && userProfile.googleSheetsUrl) {
            const values = api._flightObjectToValuesArray(updatedFlight);
            await api._postToSheets({ action: 'updateFlight', flightId, values });
        }

        // Guardamos el estado completo y correcto en la caché local
        api.saveFlightsToLocalStorage();

        // Creamos un respaldo local de la operación
        await backupManager.createBackup();

        return true;
    },

    deleteFlight: async (flightId) => {
        const index = flightData.findIndex(f => f && f.id === flightId);
        if (index === -1) return false;
        flightData.splice(index, 1);
        if (userProfile.dataSource === 'google_sheets' && userProfile.googleSheetsUrl) {
            await api._postToSheets({ action: 'deleteFlight', flightId });
        }
        api.saveFlightsToLocalStorage();
        await backupManager.createBackup();
        return true;
    },
    
    syncAllFlightsToSheets: async () => {
        if (userProfile.dataSource !== 'google_sheets' || !userProfile.googleSheetsUrl) {
            return { success: false, message: "La sincronización solo está disponible si la fuente de datos es Google Sheets."};
        }
        if (!confirm(`Esto reemplazará TODO el contenido de tu Google Sheet con los ${flightData.length} vuelos que tienes cargados en la app. ¿Estás seguro?`)) {
            return { success: false, message: "Sincronización cancelada."};
        }
        
        // --- INICIO DE LA CORRECCIÓN ---
        // Generamos la nueva estructura de 3 filas de encabezado
        const headersForSheet = api._getTwoRowHeaderArray();
        
        const allFlightsAsArrays = [...flightData].filter(Boolean).reverse().map(flight => api._flightObjectToValuesArray(flight));
        
        // Enviamos la nueva estructura de encabezados en el payload
        return await api._postToSheets({ action: 'syncAllFlights', headers: headersForSheet, flights: allFlightsAsArrays });
        // --- FIN DE LA CORRECCIÓN ---
    },

    // --- FUNCIONES DE ALMACENAMIENTO LOCAL, PERFIL Y EXPORTACIÓN ---
    loadFlightsFromLocalStorage: () => {
        const localData = localStorage.getItem('flightLogData');
        if (localData) {
            try {
                flightData = JSON.parse(localData).map(flight => {
                    if (!flight) return null;
                if (flight.ID !== undefined && flight.ID !== null) {
                    flight.id = flight.ID.toString();
                    delete flight.ID;
                } else if (flight.id !== undefined && flight.id !== null) {
                    // Si ya tiene 'id', solo nos aseguramos de que sea string.
                    flight.id = flight.id.toString();
                }
                    flight.Fecha = new Date(flight.Fecha);
                    return flight;
                }).filter(Boolean);
                console.log(`${flightData.length} vuelos cargados desde localStorage.`);
            } catch (e) {
                console.error("Error al parsear datos locales, iniciando con bitácora vacía.", e);
                flightData = [];
            }
        } else {
            flightData = [];
        }
    },
    saveFlightsToLocalStorage: () => {
        localStorage.setItem('flightLogData', JSON.stringify(flightData));
    },
    saveProfile: async (profileData) => {
        localStorage.setItem('flightLogUserProfile', JSON.stringify(profileData));
        console.log("Perfil de usuario guardado.");
    },
    loadProfile: () => {
        const savedProfile = localStorage.getItem('flightLogUserProfile');
        return savedProfile ? JSON.parse(savedProfile) : null;
    },
    exportToExcel: () => {
        if (flightData.length === 0) { alert("No hay vuelos para exportar."); return; }
        const dataForSheet = [HEADERS];
        [...flightData].filter(Boolean).reverse().forEach(flight => {
            const row = [];
            HEADERS.forEach(header => {
                let value = flight[header];
                if (header === 'Fecha') {
                    const date = new Date(value);
                    value = !isNaN(date.getTime()) ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}` : '';
                }
                row.push(value === null || value === undefined ? '' : value);
            });
            dataForSheet.push(row);
        });
        const worksheet = XLSX.utils.aoa_to_sheet(dataForSheet);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Bitacora");
        XLSX.writeFile(workbook, `Bitacora_de_Vuelo_${new Date().toISOString().split('T')[0]}.xlsx`);
    },
};
