// =================================================================
// API.JS - VERSIÓN SUPABASE
// Misma interfaz que la versión Google Sheets.
// app.js, ui.js y el resto del código no necesitan cambios.
// =================================================================

const api = {

    // ── Helpers internos ─────────────────────────────────────────

    // Convierte un objeto de vuelo (formato app) a fila de Supabase
    _flightToRow(flight, userId) {
        const fechaDate = flight.Fecha instanceof Date ? flight.Fecha : (flight.Fecha ? new Date(flight.Fecha) : null);
        const fecha = fechaDate && !isNaN(fechaDate)
            ? `${fechaDate.getUTCFullYear()}-${String(fechaDate.getUTCMonth()+1).padStart(2,'0')}-${String(fechaDate.getUTCDate()).padStart(2,'0')}`
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
            'es_saldo_inicial':               row.es_saldo_inicial || false,
        };
    },

    _getUserId() {
        return currentUser?.id || null;
    },

    // ── Carga inicial ─────────────────────────────────────────────
    loadInitialFlights: async () => {
        // Limpiar caché si el usuario cambió
        const cachedProfile = localStorage.getItem('flightLogUserProfile');
        if (cachedProfile) {
            const cached = JSON.parse(cachedProfile);
            const cachedEmail = cached?.personal?.['profile-email'];
            if (cachedEmail && currentUser?.email && cachedEmail !== currentUser.email) {
                console.log('Usuario diferente detectado — limpiando caché local');
                localStorage.removeItem('flightLogUserProfile');
                localStorage.removeItem('flightLogData');
            }
        }
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
            flightData.sort((a, b) => {
                if (a.es_saldo_inicial) return 1;
                if (b.es_saldo_inicial) return -1;
                return 0;
            });
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

        if (userId) {
            let savedToCloud = false;
            if (navigator.onLine) {
                try {
                    const row = api._flightToRow(newFlight, userId);
                    const { error } = await supabaseClient.from('flights').insert([row]);
                    if (!error) savedToCloud = true;
                    else console.error("Error Supabase al guardar:", error);
                } catch (e) { console.warn("Red caída al guardar:", e); }
            }
            if (!savedToCloud) {
                api._queuePending({ op: 'save', flight: newFlight });
                flightData.unshift(newFlight);
                api.saveFlightsToLocalStorage();
                ui.showNotification('Sin conexión — el vuelo se guardó localmente y se subirá cuando recuperes señal.', 'info');
                app.updateOfflineBar();
                return true;
            }
        }

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

        if (userId) {
            let savedToCloud = false;
            if (navigator.onLine) {
                try {
                    const row = api._flightToRow(updatedFlight, userId);
                    const { error } = await supabaseClient.from('flights').update(row)
                        .eq('id', flightId).eq('user_id', userId);
                    if (!error) savedToCloud = true;
                    else console.error("Error Supabase al actualizar:", error);
                } catch (e) { console.warn("Red caída al actualizar:", e); }
            }
            if (!savedToCloud) {
                api._queuePending({ op: 'update', flight: updatedFlight });
                flightData[index] = updatedFlight;
                api.saveFlightsToLocalStorage();
                ui.showNotification('Sin conexión — cambios guardados localmente. Se sincronizarán al recuperar señal.', 'info');
                app.updateOfflineBar();
                return true;
            }
        }

        flightData[index] = updatedFlight;
        api.saveFlightsToLocalStorage();
        await backupManager.createBackup();
        return true;
    },

    deleteFlight: async (flightId) => {
        const index = flightData.findIndex(f => f && f.id === flightId);
        if (index === -1) return false;

        const userId = api._getUserId();

        if (userId) {
            let deletedFromCloud = false;
            if (navigator.onLine) {
                try {
                    const { error } = await supabaseClient.from('flights').delete()
                        .eq('id', flightId).eq('user_id', userId);
                    if (!error) deletedFromCloud = true;
                    else console.error("Error Supabase al eliminar:", error);
                } catch (e) { console.warn("Red caída al eliminar:", e); }
            }
            if (!deletedFromCloud) {
                api._queuePending({ op: 'delete', flightId });
                flightData.splice(index, 1);
                api.saveFlightsToLocalStorage();
                ui.showNotification('Sin conexión — eliminación guardada localmente. Se sincronizará al recuperar señal.', 'info');
                app.updateOfflineBar();
                return true;
            }
        }

        flightData.splice(index, 1);
        api.saveFlightsToLocalStorage();
        await backupManager.createBackup();
        return true;
    },

    // ── Cola offline ──────────────────────────────────────────────
    _getPendingQueue: () => {
        try { return JSON.parse(localStorage.getItem('flightLogPendingSync') || '[]'); }
        catch { return []; }
    },

    _savePendingQueue: (queue) => {
        localStorage.setItem('flightLogPendingSync', JSON.stringify(queue));
    },

    _queuePending: (item) => {
        const queue = api._getPendingQueue();
        queue.push(item);
        api._savePendingQueue(queue);
    },

    syncPendingFlights: async () => {
        const queue = api._getPendingQueue();
        if (queue.length === 0) return;

        const userId = api._getUserId();
        if (!userId || !navigator.onLine) return;

        ui.showNotification(`Sincronizando ${queue.length} vuelo(s) pendiente(s)...`, 'info');

        const failed = [];
        for (const item of queue) {
            try {
                if (item.op === 'save') {
                    const row = api._flightToRow(item.flight, userId);
                    const { error } = await supabaseClient.from('flights').insert([row]);
                    if (error) throw error;
                } else if (item.op === 'update') {
                    const row = api._flightToRow(item.flight, userId);
                    const { error } = await supabaseClient.from('flights').update(row)
                        .eq('id', item.flight.id).eq('user_id', userId);
                    if (error) throw error;
                } else if (item.op === 'delete') {
                    const { error } = await supabaseClient.from('flights').delete()
                        .eq('id', item.flightId).eq('user_id', userId);
                    if (error) throw error;
                }
            } catch (e) {
                failed.push(item);
            }
        }

        api._savePendingQueue(failed);
        if (failed.length === 0) {
            ui.showNotification(`✓ ${queue.length} vuelo(s) sincronizado(s) correctamente.`, 'success');
        } else {
            ui.showNotification(`${queue.length - failed.length} sincronizados, ${failed.length} con error. Se reintentará.`, 'error');
        }
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
            dashboard_cards:       profileData.dashboardCards || [],
            dashboard_card_count:  profileData.dashboardCardCount || 8,
            user_role:             profileData.userRole || 'student',
            hours_format:          profileData.hoursFormat || 'decimal',
            updated_at:            new Date().toISOString(),
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
                    .maybeSingle(); 
                if (!error && data) {
                    // Si el perfil en Supabase está incompleto (RLS bloqueó saves previos),
                    // fusionamos con localStorage para sincronizar automáticamente
                    const isIncomplete = !data.domicilio && !data.user_role &&
                        (!data.licencias || Object.keys(data.licencias).length === 0);
                    const cached = localStorage.getItem('flightLogUserProfile');
                    const local = cached ? JSON.parse(cached) : null;

                    const profile = {
                        dataSource: 'supabase',
                        userRole:          data.user_role || local?.userRole || 'student',
                        hoursFormat:       data.hours_format || local?.hoursFormat || 'decimal',
                        dashboardCards:    (data.dashboard_cards?.length ? data.dashboard_cards : local?.dashboardCards) || [],
                        dashboardCardCount: data.dashboard_card_count || local?.dashboardCardCount || 8,
                        licenses:          (data.licencias && Object.keys(data.licencias).length ? data.licencias : local?.licenses) || {},
                        plan:              data.plan || 'lite',
                        planExpiresAt:     data.plan_expires_at || null,
                        personal: {
                            'profile-pais':       data.pais || local?.personal?.['profile-pais'] || 'CL',
                            'profile-nombre':     data.full_name || local?.personal?.['profile-nombre'] || '',
                            'profile-rut':        data.rut || local?.personal?.['profile-rut'] || '',
                            'profile-nacimiento': data.fecha_nacimiento || local?.personal?.['profile-nacimiento'] || '',
                            'profile-documento':  data.carnet || local?.personal?.['profile-documento'] || '',
                            'profile-telefono':   data.telefono || local?.personal?.['profile-telefono'] || '',
                            'profile-email':      data.email || local?.personal?.['profile-email'] || '',
                            'profile-domicilio':  data.domicilio || local?.personal?.['profile-domicilio'] || '',
                        },
                    };

                    // Si Supabase estaba incompleto y localStorage tenía datos, sincronizar
                    if (isIncomplete && local) {
                        api.saveProfile(profile).catch(() => {});
                    }

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
        const exportHeaders = HEADERS.slice(1); // excluir 'id' para que sea re-importable
        const dataForSheet = [exportHeaders];
        [...flightData].filter(Boolean).reverse().forEach(flight => {
            const row = [];
            exportHeaders.forEach(header => {
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

    downloadTemplate: () => {
        const templateHeaders = HEADERS.slice(1);
        const worksheet = XLSX.utils.aoa_to_sheet([templateHeaders]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Bitacora");
        XLSX.writeFile(workbook, 'Template_Bitacora_de_Vuelo.xlsx');
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
};
