// =================================================================
// API.JS - VERSIÓN SUPABASE
// Misma interfaz que la versión Google Sheets.
// app.js, ui.js y el resto del código no necesitan cambios.
// =================================================================

// Orden canónico de flightData: fecha desc, luego página desc para mismo día, saldo al final.
function _sortFlightData(arr) {
    arr.sort((a, b) => {
        if (a.es_saldo_inicial) return 1;
        if (b.es_saldo_inicial) return -1;
        const aTime = a.Fecha ? a.Fecha.getTime() : 0;
        const bTime = b.Fecha ? b.Fecha.getTime() : 0;
        if (aTime !== bTime) return bTime - aTime;
        return (parseInt(b["Pagina Bitacora a Replicar"]) || 0) - (parseInt(a["Pagina Bitacora a Replicar"]) || 0);
    });
}

const api = {

    // ── Helpers internos ─────────────────────────────────────────

    // Convierte un objeto de vuelo (formato app) a fila de Supabase
    _flightToRow(flight, userId) {
        const fechaDate = flight.Fecha instanceof Date ? flight.Fecha : (flight.Fecha ? new Date(flight.Fecha) : null);
        const fecha = fechaDate && !isNaN(fechaDate)
            ? `${fechaDate.getUTCFullYear()}-${String(fechaDate.getUTCMonth()+1).padStart(2,'0')}-${String(fechaDate.getUTCDate()).padStart(2,'0')}`
            : null;
        const row = {
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
        row.id = flight.id || crypto.randomUUID();
        return row;
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
        // Limpiar caché si el usuario cambió. Se compara por user.id (fiable);
        // el chequeo por email se mantiene para cachés antiguas sin ownerId.
        const currentUserId = api._getUserId();
        const cachedOwnerId = localStorage.getItem('flightLogOwnerId');
        let userChanged = !!(currentUserId && cachedOwnerId && cachedOwnerId !== currentUserId);
        if (!userChanged) {
            const cachedProfile = localStorage.getItem('flightLogUserProfile');
            if (cachedProfile) {
                const cached = JSON.parse(cachedProfile);
                const cachedEmail = cached?.personal?.['profile-email'];
                userChanged = !!(cachedEmail && currentUser?.email && cachedEmail !== currentUser.email);
            }
        }
        if (userChanged) {
            console.log('Usuario diferente detectado — limpiando caché local');
            localStorage.removeItem('flightLogUserProfile');
            localStorage.removeItem('flightLogData');
            localStorage.removeItem('flightLogFrequentValues');
        }
        if (currentUserId) localStorage.setItem('flightLogOwnerId', currentUserId);
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
            const fetchAll = async (filterDeleted) => {
                let rows = [];
                let offset = 0;
                const limit = 1000;
                while (true) {
                    let query = supabaseClient
                        .from('flights')
                        .select('*')
                        .eq('user_id', userId)
                        .order('fecha', { ascending: false })
                        .order('pagina_bitacora', { ascending: false })
                        .range(offset, offset + limit - 1);
                    if (filterDeleted) query = query.is('deleted_at', null);
                    const { data, error } = await query;
                    if (error) throw error;
                    rows = rows.concat(data);
                    if (data.length < limit) break;
                    offset += limit;
                }
                return rows;
            };

            let allRows;
            try {
                allRows = await fetchAll(true); // excluir papelera
            } catch (err) {
                // La columna deleted_at aún no existe: cargar sin filtro
                if (api._isMissingDeletedAt(err)) allRows = await fetchAll(false);
                else throw err;
            }

            // Purga definitiva de la papelera (>30 días), en segundo plano
            api.purgeOldTrash();

            // Guard anti-sobrescritura: si la nube devuelve muchos menos vuelos
            // que el caché local, avisar antes de pisar el caché. La nube sigue
            // siendo la fuente de verdad — nunca se re-sube el caché local.
            await api._warnCloudDiscrepancy(allRows.length);

            flightData = allRows.map(row => api._rowToFlight(row));
            _sortFlightData(flightData);
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
        // Detectar si ya es un objeto de vuelo procesado (del importador) 
        // o si son datos crudos del formulario manual.
        const newFlight = flightDataToSave.id && flightDataToSave.Fecha instanceof Date 
            ? flightDataToSave 
            : ui.createFlightObject(flightDataToSave);
            
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

    saveFlightsBatch: async (flightsData) => {
        const userId = api._getUserId();
        if (!userId) return false;

        // Convertimos el lote de objetos al formato de tabla de Supabase
        const rows = flightsData.map(f => api._flightToRow(f, userId));
        // Propagar el id generado al objeto local: sin esto, los vuelos recién
        // importados no se pueden editar/borrar hasta recargar desde la nube.
        rows.forEach((row, i) => { flightsData[i].id = row.id; });

        if (navigator.onLine) {
            try {
                // Supabase permite insertar un array de objetos de una sola vez
                const { error } = await supabaseClient.from('flights').insert(rows);
                if (error) {
                    console.error("Error Supabase batch insert:", error);
                    return false;
                }
            } catch (e) {
                console.warn("Red caída al guardar lote:", e);
                return false;
            }
        } else {
            // Si está offline, encolamos individualmente para sincronización posterior
            flightsData.forEach(f => api._queuePending({ op: 'save', flight: f }));
        }
        flightData = [...flightsData, ...flightData];
        api.saveFlightsToLocalStorage();
        return true;
    },

    renumberExistingFlights: async (shift) => {
        const userId = api._getUserId();
        if (!userId) return false;

        const toUpdate = flightData.filter(f =>
            !f.es_saldo_inicial && parseInt(f['Pagina Bitacora a Replicar']) > 0
        );

        if (!navigator.onLine) {
            toUpdate.forEach(f => {
                f['Pagina Bitacora a Replicar'] = parseInt(f['Pagina Bitacora a Replicar']) + shift;
                api._queuePending({ op: 'update', flight: f });
            });
            api.saveFlightsToLocalStorage();
            app.updateOfflineBar();
            return true;
        }

        const chunkSize = 20;
        for (let i = 0; i < toUpdate.length; i += chunkSize) {
            const chunk = toUpdate.slice(i, i + chunkSize);
            const results = await Promise.all(chunk.map(f => {
                const newPage = parseInt(f['Pagina Bitacora a Replicar']) + shift;
                return supabaseClient
                    .from('flights')
                    .update({ pagina_bitacora: newPage })
                    .eq('id', f.id)
                    .eq('user_id', userId);
            }));
            if (results.some(r => r.error)) {
                console.error('Error renumerando páginas:', results.find(r => r.error).error);
                return false;
            }
            chunk.forEach(f => {
                f['Pagina Bitacora a Replicar'] = parseInt(f['Pagina Bitacora a Replicar']) + shift;
            });
        }

        api.saveFlightsToLocalStorage();
        return true;
    },

    updateFlight: async (flightId, flightDataToUpdate) => {
        const index = flightData.findIndex(f => f && f.id === flightId);
        if (index === -1) return false;

        // Aplicar la misma lógica de detección que en saveFlight
        const updatedFlight = flightDataToUpdate.id && flightDataToUpdate.Fecha instanceof Date
            ? flightDataToUpdate
            : ui.createFlightObject(flightDataToUpdate);
            
        updatedFlight.id = flightId;

        const userId = api._getUserId();

        // Si este vuelo ya tiene un save/update pendiente en la cola offline,
        // actualizar ese item en vez de tocar la nube: evita que la versión
        // antigua en cola sobrescriba esta edición al sincronizar.
        if (userId) {
            const queue = api._getPendingQueue();
            const qIdx = queue.findIndex(i =>
                (i.op === 'save' || i.op === 'update') && i.flight && i.flight.id === flightId
            );
            if (qIdx !== -1) {
                queue[qIdx].flight = updatedFlight;
                api._savePendingQueue(queue);
                flightData[index] = updatedFlight;
                api.saveFlightsToLocalStorage();
                if (navigator.onLine) await api.syncPendingFlights();
                app.updateOfflineBar();
                return true;
            }
        }

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

        // Descartar saves/updates pendientes de este vuelo: si quedaran en cola,
        // la sincronización lo re-insertaría después de borrado ("resurrección").
        if (userId) {
            const queue = api._getPendingQueue();
            const remaining = queue.filter(i =>
                !((i.op === 'save' || i.op === 'update') && i.flight && i.flight.id === flightId)
            );
            if (remaining.length !== queue.length) api._savePendingQueue(remaining);
        }

        if (userId) {
            let deletedFromCloud = false;
            if (navigator.onLine) {
                try {
                    const error = await api._softDeleteRow(flightId, userId);
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

    deleteUserAccountAndData: async () => {
        const userId = api._getUserId();
        if (!userId) {
            ui.showNotification("No hay usuario autenticado para eliminar.", "error");
            return false;
        }

        try {
            // 0. Respaldo automático: última copia de los vuelos antes de
            //    eliminar la cuenta (borrado físico, sin papelera).
            if (flightData.length > 0) {
                try { api.exportToCSV(flightData, 'cuenta-eliminada'); }
                catch (e) { console.warn('No se pudo generar el respaldo CSV:', e); }
            }

            // 1. Eliminar todos los vuelos del usuario en Supabase
            const { error: deleteFlightsError } = await supabaseClient
                .from('flights')
                .delete()
                .eq('user_id', userId);

            if (deleteFlightsError) throw deleteFlightsError;

            // 2. Eliminar el perfil del usuario en Supabase
            const { error: deleteProfileError } = await supabaseClient
                .from('profiles')
                .delete()
                .eq('id', userId);

            if (deleteProfileError) throw deleteProfileError;

            // 3. Cerrar sesión y limpiar datos locales
            await supabaseClient.auth.signOut();
            localStorage.clear();
            
            ui.showNotification("Tus registros han sido eliminados. Redirigiendo...", "success");
            setTimeout(() => {
                window.location.replace('landing.html');
            }, 2000);
            return true;
        } catch (error) {
            console.error("Error al eliminar los datos:", error);
            ui.showNotification(`Error al eliminar datos: ${error.message}`, "error");
            return false;
        }
    },

    deleteAllFlights: async () => {
        const userId = api._getUserId();
        if (!userId) {
            ui.showNotification("No hay usuario autenticado.", "error");
            return false;
        }
        try {
            // Respaldo automático antes del borrado masivo
            if (flightData.length > 0) {
                try { api.exportToCSV(flightData, 'pre-borrado'); }
                catch (e) { console.warn('No se pudo generar el respaldo CSV:', e); }
            }
            // Mover todo a la papelera (restaurable 30 días);
            // fallback a DELETE físico si la columna deleted_at no existe.
            const { error } = await supabaseClient.from('flights')
                .update({ deleted_at: new Date().toISOString() })
                .eq('user_id', userId).is('deleted_at', null);
            if (error && api._isMissingDeletedAt(error)) {
                const res = await supabaseClient.from('flights').delete().eq('user_id', userId);
                if (res.error) throw res.error;
            } else if (error) throw error;
            flightData.length = 0;
            api.saveFlightsToLocalStorage();
            return true;
        } catch (error) {
            console.error("Error al eliminar vuelos:", error);
            ui.showNotification(`Error al eliminar: ${error.message}`, "error");
            return false;
        }
    },

    // ── Papelera (soft-delete) ────────────────────────────────────
    // Requiere la columna flights.deleted_at (ver supabase/soft-delete-flights.sql).
    // Mientras la columna no exista, todo hace fallback al comportamiento anterior
    // (DELETE físico / carga sin filtro), así el orden de deploy no rompe nada.

    _isMissingDeletedAt: (error) => {
        const msg = error?.message || '';
        return msg.includes('deleted_at') &&
            (msg.includes('does not exist') || msg.includes('schema cache'));
    },

    // Mueve una fila a la papelera; fallback a DELETE físico si no hay columna.
    // Devuelve el error de Supabase o null.
    _softDeleteRow: async (flightId, userId) => {
        const { error } = await supabaseClient.from('flights')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', flightId).eq('user_id', userId);
        if (error && api._isMissingDeletedAt(error)) {
            const res = await supabaseClient.from('flights').delete()
                .eq('id', flightId).eq('user_id', userId);
            return res.error || null;
        }
        return error || null;
    },

    listDeletedFlights: async () => {
        const userId = api._getUserId();
        if (!userId || !navigator.onLine) return [];
        const { data, error } = await supabaseClient.from('flights')
            .select('*').eq('user_id', userId)
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false });
        if (error) {
            if (!api._isMissingDeletedAt(error)) console.error('Error listando papelera:', error);
            return [];
        }
        return data || [];
    },

    restoreFlight: async (flightId) => {
        const userId = api._getUserId();
        if (!userId) return false;
        const { error } = await supabaseClient.from('flights')
            .update({ deleted_at: null })
            .eq('id', flightId).eq('user_id', userId);
        if (error) { console.error('Error restaurando vuelo:', error); return false; }
        await api.loadInitialFlights();
        return true;
    },

    emptyTrash: async () => {
        const userId = api._getUserId();
        if (!userId) return false;
        const { error } = await supabaseClient.from('flights').delete()
            .eq('user_id', userId).not('deleted_at', 'is', null);
        if (error) { console.error('Error vaciando papelera:', error); return false; }
        return true;
    },

    // Purga definitiva de vuelos con más de 30 días en la papelera.
    // Fire-and-forget desde loadInitialFlights.
    purgeOldTrash: () => {
        const userId = api._getUserId();
        if (!userId || !navigator.onLine) return;
        const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
        supabaseClient.from('flights').delete()
            .eq('user_id', userId).not('deleted_at', 'is', null).lt('deleted_at', cutoff)
            .then(({ error }) => {
                if (error && !api._isMissingDeletedAt(error)) console.warn('Error purgando papelera:', error);
            });
    },

    // ── Guard de discrepancia nube vs caché local ─────────────────
    // La nube es la fuente de verdad, pero si devuelve significativamente menos
    // vuelos que el caché local (0, o menos de la mitad en bitácoras de 10+),
    // se avisa al usuario ANTES de sobrescribir el caché y se le ofrece
    // descargar su copia local en CSV. Nunca se re-sube el caché a la nube
    // (podría resucitar vuelos borrados legítimamente en otro dispositivo).
    _warnCloudDiscrepancy: (cloudCount) => {
        let cachedFlights = [];
        try {
            cachedFlights = (JSON.parse(localStorage.getItem('flightLogData') || '[]') || []).filter(Boolean);
        } catch { return Promise.resolve(); }

        const userId = api._getUserId();
        // Los vuelos en cola offline aún no están en la nube: no son discrepancia
        const pendingSaves = api._getPendingQueue()
            .filter(i => i.op === 'save' && (!i.userId || i.userId === userId)).length;
        const localCount = cachedFlights.length - pendingSaves;

        const significant = localCount > 0 &&
            (cloudCount === 0 || (localCount >= 10 && cloudCount < localCount / 2));
        if (!significant) return Promise.resolve();

        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal open';
            modal.style.zIndex = '10005';
            modal.innerHTML = `
            <div class="modal-content" style="max-width:480px;">
                <div class="modal-header"><h3>⚠️ Diferencia entre tus datos locales y la nube</h3></div>
                <p style="color:#aaa;margin:0 0 0.75rem;">
                    Tu copia local tiene <strong style="color:#fff;">${localCount} vuelo(s)</strong>,
                    pero la base de datos devolvió <strong style="color:#e57373;">${cloudCount}</strong>.
                </p>
                <p style="color:#888;font-size:13px;margin:0 0 0.75rem;">
                    Esto puede ser normal (eliminaste vuelos desde otro dispositivo) o indicar un
                    problema con tu cuenta o el servidor. La aplicación continuará con los datos
                    de la nube, que son el registro oficial.
                </p>
                <p style="color:#888;font-size:13px;margin:0 0 1rem;">
                    Si crees que es un error, descarga ahora tu copia local como respaldo —
                    después de continuar, la copia local se reemplaza por los datos de la nube.
                </p>
                <div style="display:flex;gap:12px;justify-content:flex-end;flex-wrap:wrap;padding-top:1rem;border-top:1px solid #333;">
                    <button id="disc-continue" class="prev-btn" style="padding:10px 20px;background:transparent;border:1px solid #444;">Continuar con la nube</button>
                    <button id="disc-backup" class="submit-btn" style="padding:10px 24px;">Descargar copia local (CSV) y continuar</button>
                </div>
            </div>`;
            document.body.appendChild(modal);
            modal.querySelector('#disc-backup').addEventListener('click', () => {
                try { api.exportToCSV(cachedFlights, 'copia-local'); }
                catch (e) { console.error('Error exportando copia local:', e); }
                modal.remove();
                resolve();
            });
            modal.querySelector('#disc-continue').addEventListener('click', () => {
                modal.remove();
                resolve();
            });
        });
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
        // Etiquetar con el usuario dueño: si otra cuenta inicia sesión en este
        // dispositivo, sus items no deben sincronizarse bajo el nuevo usuario.
        queue.push({ ...item, userId: api._getUserId() });
        api._savePendingQueue(queue);
    },

    syncPendingFlights: async () => {
        const queue = api._getPendingQueue();
        if (queue.length === 0) return;

        const userId = api._getUserId();
        if (!userId || !navigator.onLine) return;

        // Solo sincronizar items de este usuario. Items de otra cuenta quedan
        // en cola hasta que esa cuenta vuelva a iniciar sesión en el dispositivo.
        const mine   = queue.filter(item => !item.userId || item.userId === userId);
        const others = queue.filter(item => item.userId && item.userId !== userId);
        if (mine.length === 0) return;

        ui.showNotification(`Sincronizando ${mine.length} vuelo(s) pendiente(s)...`, 'info');

        const failed = [];
        for (const item of mine) {
            try {
                if (item.op === 'save' || item.op === 'update') {
                    // upsert: idempotente ante reintentos (si el insert original sí
                    // llegó a la nube no falla por duplicado) y crea la fila si un
                    // update quedó huérfano porque el save nunca se concretó.
                    const row = api._flightToRow(item.flight, userId);
                    const { error } = await supabaseClient.from('flights')
                        .upsert([row], { onConflict: 'id' });
                    if (error) throw error;
                } else if (item.op === 'delete') {
                    const error = await api._softDeleteRow(item.flightId, userId);
                    if (error) throw error;
                }
            } catch (e) {
                failed.push(item);
            }
        }

        api._savePendingQueue([...failed, ...others]);
        if (failed.length === 0) {
            ui.showNotification(`✓ ${mine.length} vuelo(s) sincronizado(s) correctamente.`, 'success');
        } else {
            ui.showNotification(`${mine.length - failed.length} sincronizados, ${failed.length} con error. Se reintentará.`, 'error');
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
                _sortFlightData(flightData);
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
        if (error) {
            const msg = error?.message || '';
            if (msg.includes('column') && msg.includes('does not exist')) {
                const col = msg.match(/column "([^"]+)"/)?.[1] || 'desconocida';
                console.error(`[saveProfile] La columna "${col}" no existe en la tabla profiles de Supabase. Ejecuta: ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ${col} TEXT;`);
            } else {
                console.error('[saveProfile] Error al guardar perfil en Supabase:', error);
            }
        }
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
                        trial_used:        !!data.trial_used,
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
                    const date = value ? new Date(value) : null;
                    value = date && !isNaN(date.getTime())
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

    // Exportación CSV (para backup). Acepta un array de vuelos opcional
    // (respaldo automático pre-borrado, copia local ante discrepancias, etc.)
    exportToCSV: (data, filenameSuffix) => {
        const flights = Array.isArray(data) ? data : flightData;
        if (flights.length === 0) { alert("No hay vuelos para exportar."); return; }
        const rows = [HEADERS.join(',')];
        [...flights].filter(Boolean).reverse().forEach(flight => {
            const row = HEADERS.map(header => {
                let value = flight[header];
                if (header === 'Fecha') {
                    const date = value ? new Date(value) : null;
                    value = date && !isNaN(date.getTime())
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
        const suffix = filenameSuffix ? `${filenameSuffix}_` : '';
        a.download = `Bitacora_Backup_${suffix}${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    },
};
