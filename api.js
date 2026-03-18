// =================================================================
// API.JS - VERSIÓN SUPABASE
// Misma interfaz que la versión Google Sheets.
// app.js, ui.js y el resto del código no necesitan cambios.
// =================================================================

const api = {

    // ── Helpers internos ─────────────────────────────────────────

    // Convierte un objeto de vuelo (formato app) a fila de Supabase
    _flightToRow(flight, userId) {
        const fecha = flight.Fecha instanceof Date && !isNaN(flight.Fecha)
            ? `${flight.Fecha.getUTCFullYear()}-${String(flight.Fecha.getUTCMonth()+1).padStart(2,'0')}-${String(flight.Fecha.getUTCDate()).padStart(2,'0')}`
            : null;
        return {
            id:                    flight.id,
            user_id:               userId,
            fecha,
            aeronave_marca_modelo: flight['Aeronave Marca y Modelo'] || null,
            matricula_aeronave:    flight['Matricula Aeronave'] || null,
            desde:                 flight['Desde'] || null,
            hasta:                 flight['Hasta'] || null,
            duracion_total:        parseFloat(flight['Duracion Total de Vuelo']) || 0,
            lsa:                   parseFloat(flight['LSA']) || 0,
            monomotor:             parseFloat(flight['Monomotor']) || 0,
            multimotor:            parseFloat(flight['Multimotor']) || 0,
            turbo_helice:          parseFloat(flight['Turbo Helice']) || 0,
            turbo_jet:             parseFloat(flight['Turbo Jet']) || 0,
            helicoptero:           parseFloat(flight['Helicoptero']) || 0,
            planeador:             parseFloat(flight['Planeador']) || 0,
            ultraliviano:          parseFloat(flight['Ultraliviano']) || 0,
            aterrizajes_dia:       parseInt(flight['Aterrizajes Dia']) || 0,
            aterrizajes_noche:     parseInt(flight['Aterrizajes Noche']) || 0,
            diurno:                parseFloat(flight['Diurno']) || 0,
            nocturno:              parseFloat(flight['Nocturno']) || 0,
            ifr:                   parseFloat(flight['IFR']) || 0,
            no_app:                parseInt(flight['NO']) || 0,
            tipo_app:              flight['Tipo'] || null,
            simulador:             parseFloat(flight['Simulador o Entrenador de Vuelo']) || 0,
            travesia:              parseFloat(flight['Travesia']) || 0,
            solo:                  parseFloat(flight['Solo']) || 0,
            pic:                   parseFloat(flight['Piloto al Mando (PIC)']) || 0,
            sic:                   parseFloat(flight['Copiloto (SIC)']) || 0,
            instruccion_recibida:  parseFloat(flight['Instruccion Recibida']) || 0,
            como_instructor:       parseFloat(flight['Como Instructor']) || 0,
            observaciones:         flight['Observaciones'] || null,
            pagina_bitacora:       parseInt(flight['Pagina Bitacora a Replicar']) || null,
        };
    },

    // Convierte una fila de Supabase al formato de objeto de vuelo que usa la app
    _rowToFlight(row) {
        return {
            id:                              row.id,
            'Fecha':                         row.fecha ? new Date(row.fecha + 'T12:00:00Z') : null,
            'Aeronave Marca y Modelo':        row.aeronave_marca_modelo || '',
            'Matricula Aeronave':             row.matricula_aeronave || '',
            'Desde':                          row.desde || '',
            'Hasta':                          row.hasta || '',
            'Duracion Total de Vuelo':        row.duracion_total || 0,
            'LSA':                            row.lsa || 0,
            'Monomotor':                      row.monomotor || 0,
            'Multimotor':                     row.multimotor || 0,
            'Turbo Helice':                   row.turbo_helice || 0,
            'Turbo Jet':                      row.turbo_jet || 0,
            'Helicoptero':                    row.helicoptero || 0,
            'Planeador':                      row.planeador || 0,
            'Ultraliviano':                   row.ultraliviano || 0,
            'Aterrizajes Dia':                row.aterrizajes_dia || 0,
            'Aterrizajes Noche':              row.aterrizajes_noche || 0,
            'Diurno':                         row.diurno || 0,
            'Nocturno':                       row.nocturno || 0,
            'IFR':                            row.ifr || 0,
            'NO':                             row.no_app || 0,
            'Tipo':                           row.tipo_app || '',
            'Simulador o Entrenador de Vuelo': row.simulador || 0,
            'Travesia':                       row.travesia || 0,
            'Solo':                           row.solo || 0,
            'Piloto al Mando (PIC)':          row.pic || 0,
            'Copiloto (SIC)':                 row.sic || 0,
            'Instruccion Recibida':           row.instruccion_recibida || 0,
            'Como Instructor':                row.como_instructor || 0,
            'Observaciones':                  row.observaciones || '',
            'Pagina Bitacora a Replicar':     row.pagina_bitacora || '',
        };
    },

    _getUserId() {
        return currentUser?.id || null;
    },

    // ── Carga inicial ─────────────────────────────────────────────
    loadInitialFlights: async () => {
        const defaultProfile = {
            personal: {}, licenses: {}, dashboardCards: [],
            userRole: 'student', dataSource: 'supabase'
        };
        const savedProfile = await api.loadProfile() || defaultProfile;
        userProfile = { ...defaultProfile, ...savedProfile };
        userProfile.dataSource = 'supabase'; // siempre Supabase

        const userId = api._getUserId();
        if (!userId) {
            console.warn("No hay usuario autenticado. Cargando desde localStorage.");
            api.loadFlightsFromLocalStorage();
            return;
        }

        try {
            console.log("Cargando vuelos desde Supabase...");
            // Traer todos los vuelos paginando de a 1000
            let allRows = [];
            let offset = 0;
            const limit = 1000;
            while (true) {
                const { data, error } = await supabaseClient
                    .from('flights')
                    .select('*')
                    .eq('user_id', userId)
                    .order('fecha', { ascending: false })
                    .range(offset, offset + limit - 1);

                if (error) throw error;
                allRows = allRows.concat(data);
                if (data.length < limit) break;
                offset += limit;
            }

            flightData = allRows.map(row => api._rowToFlight(row));
            api.saveFlightsToLocalStorage(); // caché local
            console.log(`${flightData.length} vuelos cargados desde Supabase.`);
        } catch (err) {
            console.error("Error al cargar desde Supabase:", err);
            console.warn("Cargando desde caché local como fallback.");
            api.loadFlightsFromLocalStorage();
        }
    },

    // ── Operaciones CRUD ──────────────────────────────────────────
    saveFlight: async (flightDataToSave) => {
        const newFlight = ui.createFlightObject(flightDataToSave);
        const userId = api._getUserId();

        // 1. Insertar en Supabase
        if (userId) {
            const row = api._flightToRow(newFlight, userId);
            const { error } = await supabaseClient.from('flights').insert([row]);
            if (error) {
                console.error("Error al guardar en Supabase:", error);
                ui.showNotification("Error al guardar el vuelo en la base de datos.", "error");
                return false;
            }
        }

        // 2. Actualizar estado local
        flightData.unshift(newFlight);
        api.saveFlightsToLocalStorage();
        await backupManager.createBackup();
        return true;
    },

    updateFlight: async (flightId, flightDataToUpdate) => {
        const index = flightData.findIndex(f => f && f.id === flightId);
        if (index === -1) return false;

        const updatedFlight = ui.createFlightObject(flightDataToUpdate);
        updatedFlight.id = flightId;

        const userId = api._getUserId();

        // 1. Actualizar en Supabase
        if (userId) {
            const row = api._flightToRow(updatedFlight, userId);
            const { error } = await supabaseClient
                .from('flights')
                .update(row)
                .eq('id', flightId)
                .eq('user_id', userId);
            if (error) {
                console.error("Error al actualizar en Supabase:", error);
                ui.showNotification("Error al actualizar el vuelo.", "error");
                return false;
            }
        }

        // 2. Actualizar estado local
        flightData[index] = updatedFlight;
        api.saveFlightsToLocalStorage();
        await backupManager.createBackup();
        return true;
    },

    deleteFlight: async (flightId) => {
        const index = flightData.findIndex(f => f && f.id === flightId);
        if (index === -1) return false;

        const userId = api._getUserId();

        // 1. Eliminar en Supabase
        if (userId) {
            const { error } = await supabaseClient
                .from('flights')
                .delete()
                .eq('id', flightId)
                .eq('user_id', userId);
            if (error) {
                console.error("Error al eliminar en Supabase:", error);
                ui.showNotification("Error al eliminar el vuelo.", "error");
                return false;
            }
        }

        // 2. Actualizar estado local
        flightData.splice(index, 1);
        api.saveFlightsToLocalStorage();
        await backupManager.createBackup();
        return true;
    },

    // ── Almacenamiento local (caché / fallback offline) ───────────
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
                        flight.id = flight.id.toString();
                    }
                    flight.Fecha = new Date(flight.Fecha);
                    return flight;
                }).filter(Boolean);
                console.log(`${flightData.length} vuelos cargados desde localStorage (caché).`);
            } catch (e) {
                console.error("Error al parsear caché local:", e);
                flightData = [];
            }
        } else {
            flightData = [];
        }
    },

    saveFlightsToLocalStorage: () => {
        localStorage.setItem('flightLogData', JSON.stringify(flightData));
    },

    // ── Perfil de usuario ─────────────────────────────────────────
    // ── Perfil de usuario ─────────────────────────────────────────
    saveProfile: async (profileData) => {
        // Guardar en localStorage como caché
        localStorage.setItem('flightLogUserProfile', JSON.stringify(profileData));
 
        // Guardar en Supabase
        const userId = api._getUserId();
        if (!userId) return;
        const row = {
            id:               userId,
            full_name:        profileData.personal?.['profile-nombre'] || null,
            rut:              profileData.personal?.['profile-rut'] || null,
            fecha_nacimiento: profileData.personal?.['profile-nacimiento'] || null,
            carnet:           profileData.personal?.['profile-documento'],
            telefono:         profileData.personal?.['profile-telefono'] || null,
            email:            profileData.personal?.['profile-email'] || null,
            domicilio:        profileData.personal?.['profile-domicilio'] || null,
            licencias:        profileData.licenses || {},
            dashboard_cards:  profileData.dashboardCards || [],
            user_role:        profileData.userRole || 'student',
            updated_at:       new Date().toISOString(),
        };
        const { error } = await supabaseClient
            .from('profiles')
            .upsert(row, { onConflict: 'id' });
        if (error) console.error("Error al guardar perfil en Supabase:", error);
    },
 
    loadProfile: async () => {
        // Intentar cargar desde Supabase primero
        const userId = api._getUserId();
        if (userId) {
            try {
                const { data, error } = await supabaseClient
                    .from('profiles')
                    .select('*')
                    .eq('id', userId)
                    .single();
                if (!error && data) {
                    const profile = {
                        dataSource: 'supabase',
                        userRole:   data.user_role || 'student',
                        dashboardCards: data.dashboard_cards || [],
                        licenses:   data.licencias || {},
                        personal: {
                            'profile-nombre':     data.full_name || '',
                            'profile-rut':        data.rut || '',
                            'profile-nacimiento': data.fecha_nacimiento || '',
                            'profile-documento':         data.carnet || '',
                            'profile-telefono':   data.telefono || '',
                            'profile-email':      data.email || '',
                            'profile-domicilio':  data.domicilio || '',
                        },
                    };
                    // Actualizar caché local
                    localStorage.setItem('flightLogUserProfile', JSON.stringify(profile));
                    return profile;
                }
            } catch (e) {
                console.warn("Error al cargar perfil desde Supabase, usando caché local.", e);
            }
        }
        // Fallback: localStorage
        const saved = localStorage.getItem('flightLogUserProfile');
        return saved ? JSON.parse(saved) : null;
    },

    // ── Exportación ───────────────────────────────────────────────
    // Mantiene exportación a Excel (igual que antes)
    exportToExcel: () => {
        if (flightData.length === 0) { alert("No hay vuelos para exportar."); return; }
        const dataForSheet = [HEADERS];
        [...flightData].filter(Boolean).reverse().forEach(flight => {
            const row = [];
            HEADERS.forEach(header => {
                let value = flight[header];
                if (header === 'Fecha') {
                    const date = new Date(value);
                    value = !isNaN(date.getTime())
                        ? `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`
                        : '';
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

    // Exportación CSV (para backup)
    exportToCSV: () => {
        if (flightData.length === 0) { alert("No hay vuelos para exportar."); return; }
        const rows = [HEADERS.join(',')];
        [...flightData].filter(Boolean).reverse().forEach(flight => {
            const row = HEADERS.map(header => {
                let value = flight[header];
                if (header === 'Fecha') {
                    const date = new Date(value);
                    value = !isNaN(date.getTime())
                        ? `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`
                        : '';
                }
                if (value === null || value === undefined) return '';
                const str = String(value);
                return str.includes(',') || str.includes('"') || str.includes('\n')
                    ? `"${str.replace(/"/g, '""')}"` : str;
            });
            rows.push(row.join(','));
        });
        const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Bitacora_Backup_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    },

    // ── Métodos legacy (no usados con Supabase, se mantienen por compatibilidad) ──
    _getTwoRowHeaderArray() { return []; },
    _flightObjectToValuesArray(flight) { return HEADERS.map(h => flight[h] ?? ''); },
    _postToSheets: async () => ({ success: false, message: 'Google Sheets desactivado.' }),
    loadFlightsFromGoogleSheets: async () => ({ success: false, data: [], message: 'Use Supabase.' }),
    syncAllFlightsToSheets: async () => ({ success: false, message: 'Google Sheets desactivado.' }),
};
