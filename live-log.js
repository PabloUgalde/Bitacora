// live-log.js — Módulo de registro de vuelo en vivo

const liveLog = {
    _STORAGE_KEY: '_liveLog',
    _timerInterval: null,
    _wakeLock: null,

    TIPOS_AVION: ['Monomotor','Multimotor','Turbo Helice','Turbo Jet','LSA','Ultraliviano','Helicoptero','Planeador'],
    ROLES: ['PIC','SIC','Solo','Instruccion','Instructor'],
    CONDICIONES: ['Diurno','Nocturno','IFR'],

    init() {
        const state = this._loadState();
        if (state && !state.landed) {
            document.getElementById('live-badge').classList.remove('hidden');
            this._showGlobalBar(state);
        }
        // El wake lock se libera al cambiar de app/pestaña y NO vuelve solo:
        // re-solicitarlo cuando el usuario regresa con un vuelo activo.
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                const s = this._loadState();
                if (s && !s.landed) this._requestWakeLock();
            }
        });
        this.render();
    },

    render() {
        const state = this._loadState();
        const el = document.getElementById('tab-live-log');
        if (!el) return;
        this._stopInterval();

        if (!state) {
            this._renderPreFlight(el);
        } else if (state.landed) {
            this._renderPostFlight(el, state);
        } else {
            this._renderActive(el, state);
            this._startInterval();
            this._requestWakeLock();
        }
    },

    // ── State ──
    _loadState() {
        try { return JSON.parse(localStorage.getItem(this._STORAGE_KEY)); }
        catch { return null; }
    },
    _saveState(s) { localStorage.setItem(this._STORAGE_KEY, JSON.stringify(s)); },
    _clearState() { localStorage.removeItem(this._STORAGE_KEY); },

    // ── Flota (shared with P&B) ──
    _getFlota() {
        try { return JSON.parse(localStorage.getItem('_miFlota') || '[]'); }
        catch { return []; }
    },
    _getFlotaData() {
        return this._getFlota().map(f => {
            if (f.source === 'custom') return f;
            return AERONAVES_DB.find(a => a.id === f.id) || null;
        }).filter(Boolean);
    },

    // ── Screen: Pre-vuelo ──
    _renderPreFlight(el) {
        const flota = this._getFlotaData();
        const today = new Date().toISOString().split('T')[0];

        const tiposHTML = this.TIPOS_AVION.map(t =>
            `<input type="checkbox" name="ll-tipo" id="ll-tipo-${t}" class="ll-radio-option" value="${t}">
             <label for="ll-tipo-${t}" class="ll-radio-label">${t}</label>`
        ).join('');

        const rolesHTML = this.ROLES.map((r, i) =>
            `<input type="checkbox" name="ll-rol" id="ll-rol-${r}" class="ll-radio-option" value="${r}" ${i===0?'checked':''}>
             <label for="ll-rol-${r}" class="ll-radio-label">${r}</label>`
        ).join('');

        const condHTML = this.CONDICIONES.map((c, i) =>
            `<input type="checkbox" name="ll-cond" id="ll-cond-${c}" class="ll-radio-option" value="${c}" ${i===0?'checked':''}>
             <label for="ll-cond-${c}" class="ll-radio-label">${c}</label>`
        ).join('');

        const flotaChips = flota.length
            ? `<div class="section-header" style="padding-bottom:6px">
                   <span class="section-title">Mi Flota — toca para rellenar</span>
               </div>
               <div class="ll-flota-bar">
                   ${flota.map(ac => `
                       <button class="ll-flota-chip" data-id="${ac.id}">
                           <div class="ll-flota-chip-reg">${ac.registration || ac.name}</div>
                           <div class="ll-flota-chip-model">${ac.name}</div>
                       </button>`).join('')}
               </div>`
            : '';

        el.innerHTML = `
            <div class="ll-pre-header">
                <button class="ll-start-btn" id="ll-start-btn">✈ INICIAR VUELO</button>
                <p id="ll-error" style="color:var(--red);font-size:13px;text-align:center;display:none;margin-top:6px"></p>
            </div>
            <div class="ll-pre-scroll">
                ${flotaChips}
                <div class="ll-screen">
                    <div class="ll-form-group">
                        <label>Fecha</label>
                        <input type="date" id="ll-fecha" value="${today}">
                    </div>
                    <div class="ll-pair">
                        <div class="ll-form-group">
                            <label>Aeronave</label>
                            <input type="text" id="ll-aeronave" placeholder="Ej: C172M" autocomplete="off" style="text-transform:uppercase">
                        </div>
                        <div class="ll-form-group">
                            <label>Matrícula</label>
                            <input type="text" id="ll-matricula" placeholder="Ej: CC-KUA" autocomplete="off"
                                   style="text-transform:uppercase">
                        </div>
                    </div>
                    <div class="ll-route-row">
                        <div class="ll-form-group">
                            <label>Desde <button id="ll-gps-desde-btn" class="ll-gps-btn" type="button" title="Detectar aeródromo más cercano">📍</button></label>
                            <input type="text" id="ll-desde" placeholder="SCEL"
                                   style="text-transform:uppercase" maxlength="6">
                            <div id="ll-gps-desde-suggest" class="ll-gps-suggest"></div>
                        </div>
                        <div class="ll-route-arrow">→</div>
                        <div class="ll-form-group">
                            <label>Hasta <span style="color:var(--muted);font-weight:400">(opcional)</span></label>
                            <input type="text" id="ll-hasta" placeholder="SCTE"
                                   style="text-transform:uppercase" maxlength="6">
                        </div>
                    </div>
                    <div class="ll-form-group">
                        <label>Tipo de Avión</label>
                        <div class="ll-radio-grid">${tiposHTML}</div>
                    </div>
                    <div class="ll-form-group">
                        <label>Rol</label>
                        <div class="ll-radio-row">${rolesHTML}</div>
                    </div>
                    <div class="ll-form-group">
                        <label>Condición</label>
                        <div class="ll-radio-row">${condHTML}</div>
                    </div>
                    <div class="ll-checkbox-row">
                        <input type="checkbox" id="ll-travesia">
                        <label for="ll-travesia">Travesía (XC)</label>
                    </div>
                    <div class="ll-form-group">
                        <label>Observaciones</label>
                        <input type="text" id="ll-obs" placeholder="Opcional">
                    </div>
                    <p style="font-size:12px;color:var(--muted);text-align:center;margin-top:-4px">
                        Destino y aterrizajes se ingresan al aterrizar
                    </p>
                </div>
            </div>`;

        el.querySelectorAll('.ll-flota-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                // resuelve tanto catálogo como aeronaves creadas por el usuario
                const ac = (typeof pesoBalance !== 'undefined' && pesoBalance._getAcData(chip.dataset.id))
                    || AERONAVES_DB.find(a => a.id === chip.dataset.id);
                if (!ac) return;
                el.querySelector('#ll-aeronave').value = ac.name;
                el.querySelector('#ll-matricula').value = ac.registration || '';
                const tipoInput = el.querySelector(`#ll-tipo-${ac.tipoAvion}`);
                if (tipoInput) tipoInput.checked = true;
            });
        });

        el.querySelector('#ll-aeronave').addEventListener('input', e => {
            e.target.value = e.target.value.toUpperCase();
        });
        el.querySelector('#ll-matricula').addEventListener('input', e => {
            e.target.value = e.target.value.toUpperCase();
        });
        el.querySelector('#ll-desde').addEventListener('input', e => {
            e.target.value = e.target.value.toUpperCase();
        });
        el.querySelector('#ll-hasta').addEventListener('input', e => {
            e.target.value = e.target.value.toUpperCase();
        });

        el.querySelector('#ll-gps-desde-btn').addEventListener('click', () =>
            this._triggerGPS(el, 'll-desde', 'll-gps-desde-suggest', 'll-gps-desde-btn'));

        el.querySelector('#ll-start-btn').addEventListener('click', () => this._handleStart(el));
    },

    _handleStart(el) {
        const aeronave = el.querySelector('#ll-aeronave').value.trim();
        const desde = el.querySelector('#ll-desde').value.trim();
        const errEl = el.querySelector('#ll-error');

        if (!aeronave || !desde) {
            errEl.textContent = 'Aeronave y Desde son obligatorios.';
            errEl.style.display = 'block';
            return;
        }
        errEl.style.display = 'none';

        const checked = name => [...el.querySelectorAll(`input[name="${name}"]:checked`)].map(i => i.value);

        const state = {
            startTs: Date.now(),
            fecha: el.querySelector('#ll-fecha').value,
            aeronave: aeronave.toUpperCase(),
            matricula: (el.querySelector('#ll-matricula').value.trim()).toUpperCase(),
            desde: desde.toUpperCase(),
            hasta: (el.querySelector('#ll-hasta')?.value.trim() || '').toUpperCase(),
            tipoAvion: checked('ll-tipo'),
            rol: checked('ll-rol'),
            condicion: checked('ll-cond'),
            travesia: el.querySelector('#ll-travesia').checked,
            observaciones: el.querySelector('#ll-obs').value.trim(),
        };

        this._saveState(state);
        document.getElementById('live-badge').classList.remove('hidden');
        this._showGlobalBar(state);
        this.render();
    },

    // ── Screen: En vuelo ──
    _renderActive(el, state) {
        const acLabel = state.matricula
            ? `${state.matricula} · ${state.aeronave}`
            : state.aeronave;

        el.innerHTML = `
            <div class="ll-active-screen">
                <div class="ll-active-info">
                    <div class="ll-active-ac">${this._esc(acLabel)}</div>
                    <div class="ll-active-route">${this._esc(state.desde)} → ${state.hasta ? this._esc(state.hasta) : '?'}</div>
                </div>
                <div class="ll-timer" id="ll-timer-display">00:00:00</div>
                <div class="ll-active-badges">
                    ${(state.rol||[]).map(r => `<span class="ll-badge">${this._esc(r)}</span>`).join('')}
                    ${(state.condicion||[]).map(c => `<span class="ll-badge">${this._esc(c)}</span>`).join('')}
                    ${(state.tipoAvion||[]).map(t => `<span class="ll-badge">${this._esc(t)}</span>`).join('')}
                    ${state.travesia ? `<span class="ll-badge">XC</span>` : ''}
                </div>
                <button class="ll-land-btn" id="ll-land-btn">ATERRIZAR</button>
                <button class="ll-cancel-btn" id="ll-cancel-btn">Cancelar vuelo</button>
                <span class="ll-wake-note" id="ll-wake-note"></span>
            </div>`;

        this._updateTimerDisplay(state);

        el.querySelector('#ll-land-btn').addEventListener('click', () => this._handleLand());
        el.querySelector('#ll-cancel-btn').addEventListener('click', () => {
            if (confirm('¿Cancelar el vuelo? Se perderán los datos del timer.')) this._handleCancel();
        });
    },

    _handleLand() {
        const state = this._loadState();
        if (!state) return;
        state.endTs = Date.now();
        state.landed = true;
        state.elapsedMs = state.endTs - state.startTs;
        this._saveState(state);
        this._stopInterval();
        this._releaseWakeLock();
        this._hideGlobalBar();
        document.getElementById('live-badge').classList.add('hidden');
        this.render();
    },

    _handleCancel() {
        this._clearState();
        this._stopInterval();
        this._releaseWakeLock();
        this._hideGlobalBar();
        document.getElementById('live-badge').classList.add('hidden');
        this.render();
    },

    // ── Screen: Post-vuelo ──
    _renderPostFlight(el, state) {
        const elapsedMs = state.elapsedMs || (state.endTs - state.startTs);
        const decHours = Math.round((elapsedMs / 3600000) * 100) / 100;
        const hhmmss = this._formatMs(elapsedMs);

        const tiposHTML = this.TIPOS_AVION.map(t => {
            const checked = (state.tipoAvion || []).includes(t) ? 'checked' : '';
            return `<input type="checkbox" name="ll-post-tipo" id="lpp-tipo-${t}" class="ll-radio-option" value="${t}" ${checked}>
                    <label for="lpp-tipo-${t}" class="ll-radio-label">${t}</label>`;
        }).join('');

        const rolesHTML = this.ROLES.map(r => {
            const checked = (state.rol || []).includes(r) ? 'checked' : '';
            return `<input type="checkbox" name="ll-post-rol" id="lpp-rol-${r}" class="ll-radio-option" value="${r}" ${checked}>
                    <label for="lpp-rol-${r}" class="ll-radio-label">${r}</label>`;
        }).join('');

        const condHTML = this.CONDICIONES.map(c => {
            const checked = (state.condicion || []).includes(c) ? 'checked' : '';
            return `<input type="checkbox" name="ll-post-cond" id="lpp-cond-${c}" class="ll-radio-option" value="${c}" ${checked}>
                    <label for="lpp-cond-${c}" class="ll-radio-label">${c}</label>`;
        }).join('');

        el.innerHTML = `
            <div class="ll-post-screen">
                <div class="ll-complete-icon">✓</div>
                <div class="ll-post-title">Vuelo completado</div>
                <div class="ll-sum-duration-badge">${decHours} h · ${hhmmss}</div>

                <div class="ll-post-form">
                    <div class="ll-pair">
                        <div class="ll-form-group">
                            <label>Fecha</label>
                            <input type="date" id="lpp-fecha"
                                   value="${this._esc(state.fecha || '')}">
                        </div>
                        <div class="ll-form-group">
                            <label>Aeronave</label>
                            <input type="text" id="lpp-aeronave"
                                   value="${this._esc(state.aeronave || '')}" placeholder="C172"
                                   style="text-transform:uppercase">
                        </div>
                    </div>
                    <div class="ll-pair">
                        <div class="ll-form-group">
                            <label>Matrícula</label>
                            <input type="text" id="lpp-matricula"
                                   value="${this._esc(state.matricula || '')}"
                                   style="text-transform:uppercase;letter-spacing:0.05em" maxlength="10">
                        </div>
                        <div class="ll-form-group" style="flex:0 0 auto">
                            <label>Travesía</label>
                            <label class="ll-toggle">
                                <input type="checkbox" id="lpp-travesia" ${state.travesia ? 'checked' : ''}>
                                <span class="ll-toggle-track"></span>
                            </label>
                        </div>
                    </div>
                    <div class="ll-route-row">
                        <div class="ll-form-group">
                            <label>Desde</label>
                            <input type="text" id="lpp-desde" placeholder="SCEL"
                                   value="${this._esc(state.desde || '')}"
                                   style="text-transform:uppercase;font-size:18px;font-weight:700;letter-spacing:0.06em" maxlength="6">
                        </div>
                        <div class="ll-route-arrow">→</div>
                        <div class="ll-form-group">
                            <label>Hasta <button id="ll-gps-hasta-btn" class="ll-gps-btn" type="button" title="Detectar aeródromo más cercano">📍</button></label>
                            <input type="text" id="lpp-hasta" placeholder="SCTE"
                                   value="${this._esc(state.hasta || '')}"
                                   style="text-transform:uppercase;font-size:18px;font-weight:700;letter-spacing:0.06em" maxlength="6">
                            <div id="ll-gps-hasta-suggest" class="ll-gps-suggest"></div>
                        </div>
                    </div>
                    <div class="ll-form-group">
                        <label>Tipo de Avión</label>
                        <div class="ll-radio-group">${tiposHTML}</div>
                    </div>
                    <div class="ll-form-group">
                        <label>Rol</label>
                        <div class="ll-radio-group">${rolesHTML}</div>
                    </div>
                    <div class="ll-form-group">
                        <label>Condición</label>
                        <div class="ll-radio-group">${condHTML}</div>
                    </div>
                    <div class="ll-pair" id="lpp-cond-split" style="display:none">
                        <div class="ll-form-group">
                            <label>Horas Diurno</label>
                            <input type="number" id="lpp-horas-diurno" min="0" max="${decHours}" step="0.1">
                        </div>
                        <div class="ll-form-group">
                            <label>Horas Nocturno</label>
                            <input type="number" id="lpp-horas-nocturno" min="0" max="${decHours}" step="0.1">
                        </div>
                    </div>
                    <div class="ll-pair">
                        <div class="ll-form-group">
                            <label>Ateriz. Día</label>
                            <input type="number" id="lpp-ater-dia" min="0"
                                   value="${state.aterrizajesDia ?? ''}">
                        </div>
                        <div class="ll-form-group">
                            <label>Ateriz. Noche</label>
                            <input type="number" id="lpp-ater-noche" min="0"
                                   value="${state.aterrizajesNoche ?? ''}">
                        </div>
                    </div>
                    <div class="ll-form-group">
                        <label>Observaciones</label>
                        <textarea id="lpp-obs" rows="3"
                                  placeholder="Instrucción, ruta, condiciones..."
                        >${this._esc(state.observaciones || '')}</textarea>
                    </div>
                </div>

                <button class="ll-export-btn" id="ll-save-btn">💾 Guardar en mi bitácora</button>
                <button class="ll-new-btn" id="ll-export-btn">⬇ Descargar CSV</button>
                <button class="ll-new-btn" id="ll-new-btn">Nuevo vuelo</button>
            </div>`;

        const upcaseInput = id => {
            const inp = el.querySelector(id);
            if (inp) inp.addEventListener('input', e => { e.target.value = e.target.value.toUpperCase(); savePost(); });
        };
        upcaseInput('#lpp-desde');
        upcaseInput('#lpp-hasta');
        upcaseInput('#lpp-aeronave');
        upcaseInput('#lpp-matricula');

        const savePost = () => {
            const s = this._loadState();
            if (!s) return;
            const checked = name => [...el.querySelectorAll(`input[name="${name}"]:checked`)].map(i => i.value);
            s.fecha = el.querySelector('#lpp-fecha')?.value || s.fecha;
            s.aeronave = (el.querySelector('#lpp-aeronave')?.value.trim() || s.aeronave || '').toUpperCase();
            s.matricula = (el.querySelector('#lpp-matricula')?.value.trim() || '').toUpperCase();
            s.desde = (el.querySelector('#lpp-desde')?.value.trim() || '').toUpperCase();
            s.hasta = (el.querySelector('#lpp-hasta')?.value.trim() || '').toUpperCase();
            s.travesia = el.querySelector('#lpp-travesia')?.checked || false;
            s.tipoAvion = checked('ll-post-tipo');
            s.rol = checked('ll-post-rol');
            s.condicion = checked('ll-post-cond');
            s.aterrizajesDia = parseInt(el.querySelector('#lpp-ater-dia')?.value) || 0;
            s.aterrizajesNoche = parseInt(el.querySelector('#lpp-ater-noche')?.value) || 0;
            s.observaciones = el.querySelector('#lpp-obs')?.value.trim() || '';
            const hd = parseFloat(el.querySelector('#lpp-horas-diurno')?.value);
            const hn = parseFloat(el.querySelector('#lpp-horas-nocturno')?.value);
            s.horasDiurno = isNaN(hd) ? null : hd;
            s.horasNocturno = isNaN(hn) ? null : hn;
            this._saveState(s);
        };

        el.querySelectorAll('#lpp-fecha,#lpp-aeronave,#lpp-travesia,#lpp-ater-dia,#lpp-ater-noche,#lpp-obs')
          .forEach(inp => inp.addEventListener('change', savePost));
        el.querySelectorAll('input[name="ll-post-tipo"],input[name="ll-post-rol"],input[name="ll-post-cond"]')
          .forEach(cb => cb.addEventListener('change', savePost));

        // ── Desglose Diurno/Nocturno: si ambas condiciones están marcadas,
        //    pedir el reparto de horas (antes se exportaba la duración
        //    completa en AMBAS columnas → suma > duración total).
        const splitWrap = el.querySelector('#lpp-cond-split');
        const hDia = el.querySelector('#lpp-horas-diurno');
        const hNoc = el.querySelector('#lpp-horas-nocturno');
        const clamp = v => Math.min(decHours, Math.max(0, Math.round(v * 100) / 100));
        const updateSplitVisibility = () => {
            const both = el.querySelector('#lpp-cond-Diurno')?.checked &&
                         el.querySelector('#lpp-cond-Nocturno')?.checked;
            splitWrap.style.display = both ? '' : 'none';
            if (both && hDia.value === '' && hNoc.value === '') {
                const s = this._loadState() || {};
                hDia.value = s.horasDiurno ?? decHours;
                hNoc.value = s.horasNocturno ?? clamp(decHours - parseFloat(hDia.value));
                savePost();
            }
        };
        hDia.addEventListener('input', () => {
            const v = clamp(parseFloat(hDia.value) || 0);
            hNoc.value = clamp(decHours - v);
            savePost();
        });
        hNoc.addEventListener('input', () => {
            const v = clamp(parseFloat(hNoc.value) || 0);
            hDia.value = clamp(decHours - v);
            savePost();
        });
        el.querySelector('label[for="lpp-cond-Diurno"]')?.addEventListener('click', () => setTimeout(updateSplitVisibility, 0));
        el.querySelector('label[for="lpp-cond-Nocturno"]')?.addEventListener('click', () => setTimeout(updateSplitVisibility, 0));
        el.querySelector('#lpp-cond-Diurno')?.addEventListener('change', updateSplitVisibility);
        el.querySelector('#lpp-cond-Nocturno')?.addEventListener('change', updateSplitVisibility);
        updateSplitVisibility();

        el.querySelector('#ll-gps-hasta-btn').addEventListener('click', () =>
            this._triggerGPS(el, 'lpp-hasta', 'll-gps-hasta-suggest', 'll-gps-hasta-btn'));

        el.querySelector('#ll-save-btn').addEventListener('click', () => {
            savePost();
            this._saveToBitacora(el);
        });
        el.querySelector('#ll-export-btn').addEventListener('click', () => {
            savePost();
            this._exportJSON(this._loadState());
        });
        el.querySelector('#ll-new-btn').addEventListener('click', () => {
            this._clearState();
            document.getElementById('live-badge').classList.add('hidden');
            this.render();
        });
    },

    // ── Guardado directo en Bitácora ──
    // Convierte el estado del vuelo a un objeto de vuelo procesado (mismo
    // esquema que createFlightObject) y lo guarda con api.saveFlight — hereda
    // la cola offline: sin señal, el vuelo se sube al reconectar.
    async _saveToBitacora(el) {
        const state = this._loadState();
        if (!state) return;
        const btn = el.querySelector('#ll-save-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }
        try {
            const row = this._buildRow(state);

            // Página: misma regla que createFlightObject (8 vuelos por página)
            const lastPage = ui.getLastPageNumber();
            const flightsOnLastPage = flightData.filter(f => parseInt(f["Pagina Bitacora a Replicar"]) === lastPage).length;
            const pageNumber = flightsOnLastPage >= 8 ? lastPage + 1 : lastPage;

            const flight = {
                ...row,
                id: Date.now().toString() + Math.random().toString().slice(2),
                "Fecha": new Date(row["Fecha"] + 'T00:00:00Z'),
                "Pagina Bitacora a Replicar": pageNumber,
            };

            const ok = await api.saveFlight(flight);
            if (ok) {
                ui.showNotification('✓ Vuelo guardado en tu bitácora.', 'success');
                this._clearState();
                document.getElementById('live-badge').classList.add('hidden');
                this.render();
            } else {
                ui.showNotification('No se pudo guardar el vuelo. Intenta con "Descargar CSV".', 'error');
            }
        } catch (e) {
            console.error('[liveLog] error al guardar:', e);
            ui.showNotification('Error al guardar el vuelo: ' + (e.message || e), 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar en mi bitácora'; }
        }
    },

    // ── Timer ──
    _startInterval() {
        this._stopInterval();
        this._timerInterval = setInterval(() => {
            const state = this._loadState();
            if (!state || state.landed) { this._stopInterval(); return; }
            this._updateTimerDisplay(state);
        }, 1000);
    },

    _stopInterval() {
        if (this._timerInterval) { clearInterval(this._timerInterval); this._timerInterval = null; }
    },

    _updateTimerDisplay(state) {
        const elapsed = this._formatMs(Date.now() - state.startTs);
        const el = document.getElementById('ll-timer-display');
        if (el) el.textContent = elapsed;
        const bar = document.getElementById('ftb-time');
        if (bar) bar.textContent = elapsed;
    },

    _showGlobalBar(state) {
        const bar = document.getElementById('flight-timer-bar');
        const route = document.getElementById('ftb-route');
        if (!bar) return;
        bar.classList.remove('hidden');
        if (route) route.textContent = state.desde + (state.hasta ? ` → ${state.hasta}` : '');
        document.body.classList.add('flight-active');
    },

    _hideGlobalBar() {
        const bar = document.getElementById('flight-timer-bar');
        if (bar) bar.classList.add('hidden');
        document.body.classList.remove('flight-active');
    },

    // ── GPS / Aeródromos cercanos ──
    _haversine(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2
                + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    },

    // Base local de aeródromos chilenos para complementar OSM.
    // Verificada contra OurAirports (13-jul-2026) — los pares ICAO↔nombre↔coords
    // anteriores tenían múltiples emparejamientos erróneos (ej: SCTE≠Carriel Sur).
    _CL_AERODROMES: [
        { icao:'SCEL', name:'Arturo Merino Benítez',        lat:-33.3930, lon:-70.7858 },
        { icao:'SCTB', name:'Tobalaba (Eulogio Sánchez)',   lat:-33.4563, lon:-70.5467 },
        { icao:'SCHC', name:'Chicureo',                     lat:-33.2678, lon:-70.6472 },
        { icao:'SCVH', name:'La Victoria de Chacabuco',     lat:-33.0508, lon:-70.7089 },
        { icao:'SCKL', name:'Lipangui',                     lat:-33.3367, lon:-70.8511 },
        { icao:'SCRD', name:'Rodelillo',                    lat:-33.0681, lon:-71.5575 },
        { icao:'SCVM', name:'Viña del Mar (Torquemada)',    lat:-32.9496, lon:-71.4786 },
        { icao:'SCSE', name:'La Florida (La Serena)',       lat:-29.9162, lon:-71.1995 },
        { icao:'SCOV', name:'El Tuqui (Ovalle)',            lat:-30.5592, lon:-71.1756 },
        { icao:'SCTG', name:'Tongoy',                       lat:-30.2664, lon:-71.4836 },
        { icao:'SCLL', name:'Vallenar',                     lat:-28.5964, lon:-70.7560 },
        { icao:'SCHA', name:'Chamonate (Copiapó)',          lat:-27.2969, lon:-70.4131 },
        { icao:'SCAR', name:'Chacalluta (Arica)',           lat:-18.3485, lon:-70.3387 },
        { icao:'SCDA', name:'Diego Aracena (Iquique)',      lat:-20.5363, lon:-70.1814 },
        { icao:'SCFA', name:'Andrés Sabella (Antofagasta)', lat:-23.4453, lon:-70.4452 },
        { icao:'SCCF', name:'El Loa (Calama)',              lat:-22.4982, lon:-68.9036 },
        { icao:'SCIC', name:'General Freire (Curicó)',      lat:-34.9667, lon:-71.2164 },
        { icao:'SCTL', name:'Panguilemo (Talca)',           lat:-35.3778, lon:-71.6017 },
        { icao:'SCCH', name:'Gral. O\'Higgins (Chillán)',   lat:-36.5825, lon:-72.0314 },
        { icao:'SCIE', name:'Carriel Sur (Concepción)',     lat:-36.7724, lon:-73.0628 },
        { icao:'SCGE', name:'María Dolores (Los Ángeles)',  lat:-37.4017, lon:-72.4254 },
        { icao:'SCGO', name:'Los Confines (Angol)',         lat:-37.7947, lon:-72.6872 },
        { icao:'SCTO', name:'Victoria',                     lat:-38.2456, lon:-72.3486 },
        { icao:'SCTC', name:'Maquehue (Temuco)',            lat:-38.7668, lon:-72.6371 },
        { icao:'SCQP', name:'La Araucanía (Temuco)',        lat:-38.9259, lon:-72.6515 },
        { icao:'SCVI', name:'Villarrica',                   lat:-39.3167, lon:-72.2287 },
        { icao:'SCVD', name:'Pichoy (Valdivia)',            lat:-39.6500, lon:-73.0861 },
        { icao:'SCTE', name:'El Tepual (Puerto Montt)',     lat:-41.4431, lon:-73.0941 },
        { icao:'SCAC', name:'Pupelde (Ancud)',              lat:-41.9043, lon:-73.7966 },
        { icao:'SCAS', name:'Cabo Juan Román (Pto. Aysén)', lat:-45.3992, lon:-72.6703 },
        { icao:'SCCY', name:'Teniente Vidal (Coyhaique)',   lat:-45.5942, lon:-72.1061 },
        { icao:'SCBA', name:'Balmaceda',                    lat:-45.9160, lon:-71.6895 },
        { icao:'SCCI', name:'Carlos Ibáñez (Pta. Arenas)',  lat:-53.0026, lon:-70.8546 },
        { icao:'SCFM', name:'Cap. Fuentes M. (Porvenir)',   lat:-53.2537, lon:-70.3192 },
        { icao:'SCGZ', name:'G. Zañartu (Pto. Williams)',   lat:-54.9311, lon:-67.6263 },
        { icao:'SCIP', name:'Mataveri (Isla de Pascua)',    lat:-27.1654, lon:-109.4210 },
        { icao:'SCIR', name:'Robinson Crusoe (J. Fernández)',lat:-33.6650, lon:-78.9297 },
    ],

    async _nearbyAirports(lat, lon) {
        const runQuery = async (icaoOnly, radius) => {
            const filter = icaoOnly ? '["icao"]' : '';
            const q = `[out:json][timeout:12];(
              node["aeroway"="aerodrome"]${filter}(around:${radius},${lat},${lon});
              way["aeroway"="aerodrome"]${filter}(around:${radius},${lat},${lon});
              node["aeroway"="airstrip"](around:${radius},${lat},${lon});
              way["aeroway"="airstrip"](around:${radius},${lat},${lon});
            );out center 8;`;
            const res = await fetch(
                `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`,
                { signal: AbortSignal.timeout(14000) }
            );
            const data = await res.json();
            return data.elements
                .map(el => {
                    const lat2 = el.lat ?? el.center?.lat;
                    const lon2 = el.lon ?? el.center?.lon;
                    const code = el.tags.icao || el.tags.ref || el.tags.iata;
                    return {
                        icao: code,
                        name: el.tags.name || el.tags['name:en'] || code,
                        dist: this._haversine(lat, lon, lat2, lon2)
                    };
                })
                .filter(a => a.icao && isFinite(a.dist))
                .sort((a, b) => a.dist - b.dist)
                .slice(0, 8);
        };

        // Suplemento con base local (aerodromes que OSM no tiene bien tagueados)
        const localNearby = this._CL_AERODROMES
            .map(a => ({ ...a, dist: this._haversine(lat, lon, a.lat, a.lon) }))
            .filter(a => a.dist <= 60)
            .sort((a, b) => a.dist - b.dist);

        let osmResults = await runQuery(true, 40000);
        if (!osmResults.length) osmResults = await runQuery(false, 60000);

        // Combina OSM + local, elimina duplicados por código ICAO
        const seen = new Set(osmResults.map(a => a.icao));
        const combined = [...osmResults];
        for (const a of localNearby) {
            if (!seen.has(a.icao)) { combined.push(a); seen.add(a.icao); }
        }

        return combined.sort((a, b) => a.dist - b.dist).slice(0, 5);
    },

    async _triggerGPS(el, fieldId, suggestId, btnId) {
        const btn = el.querySelector(`#${btnId}`);
        const suggest = el.querySelector(`#${suggestId}`);
        if (!navigator.geolocation) {
            if (suggest) suggest.innerHTML = `<span class="ll-gps-msg">GPS no disponible</span>`;
            return;
        }
        if (btn) { btn.textContent = '⏳'; btn.disabled = true; }
        if (suggest) suggest.innerHTML = `<span class="ll-gps-msg">Obteniendo ubicación…</span>`;
        try {
            const pos = await new Promise((res, rej) =>
                navigator.geolocation.getCurrentPosition(res, rej,
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 })
            );
            if (suggest) suggest.innerHTML = `<span class="ll-gps-msg">Buscando aeródromos…</span>`;
            const airports = await this._nearbyAirports(pos.coords.latitude, pos.coords.longitude);
            if (!airports.length) {
                suggest.innerHTML = `<span class="ll-gps-msg">Sin aeródromos cercanos (40 km)</span>`;
            } else {
                suggest.innerHTML = airports.map(a =>
                    `<button class="ll-gps-chip" data-icao="${a.icao}">
                        <span class="ll-gps-icao">${a.icao}</span>
                        <span class="ll-gps-dist">${a.dist < 1 ? '<1' : Math.round(a.dist)} km</span>
                     </button>`
                ).join('');
                suggest.querySelectorAll('.ll-gps-chip').forEach(chip => {
                    chip.addEventListener('click', () => {
                        const inp = el.querySelector(`#${fieldId}`);
                        if (inp) { inp.value = chip.dataset.icao; }
                        suggest.innerHTML = '';
                    });
                });
            }
        } catch (err) {
            const msg = err.code === 1 ? 'Permiso denegado'
                      : err.code === 3 ? 'Tiempo agotado (GPS)'
                      : 'Error al obtener ubicación';
            if (suggest) suggest.innerHTML = `<span class="ll-gps-msg">${msg}</span>`;
        } finally {
            if (btn) { btn.textContent = '📍'; btn.disabled = false; }
        }
    },

    _formatMs(ms) {
        const s = Math.floor(ms / 1000);
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    },

    // ── Wake Lock ──
    async _requestWakeLock() {
        if (!('wakeLock' in navigator)) {
            this._setWakeNote('Mantén la pantalla activa manualmente durante el vuelo.');
            return;
        }
        try {
            this._wakeLock = await navigator.wakeLock.request('screen');
            this._setWakeNote('Pantalla bloqueada activa.');
            this._wakeLock.addEventListener('release', () => {
                this._setWakeNote('Bloqueo de pantalla liberado.');
            });
        } catch (e) {
            this._setWakeNote('Activa la pantalla manualmente durante el vuelo.');
        }
    },

    _releaseWakeLock() {
        if (this._wakeLock) { try { this._wakeLock.release(); } catch {} this._wakeLock = null; }
    },

    _setWakeNote(msg) {
        const el = document.getElementById('ll-wake-note');
        if (el) el.textContent = msg;
    },

    // ── Export ──
    // Construye la fila con las columnas en el orden EXACTO del importador
    // de Bitácora (HEADERS de state.js, sin 'id'). También la usa la
    // integración nativa en Bitácora para guardar el vuelo directamente.
    _buildRow(state) {
        const elapsedMs = state.elapsedMs || (state.endTs - state.startTs);
        const dur = Math.round((elapsedMs / 3600000) * 100) / 100;
        const tipos = Array.isArray(state.tipoAvion) ? state.tipoAvion : (state.tipoAvion ? [state.tipoAvion] : []);
        const roles = Array.isArray(state.rol) ? state.rol : (state.rol ? [state.rol] : []);
        const conds = Array.isArray(state.condicion) ? state.condicion : (state.condicion ? [state.condicion] : []);

        // Desglose Diurno/Nocturno: si el piloto marcó ambas condiciones,
        // usar el reparto ingresado; si no, la condición marcada lleva todo.
        const both = conds.includes('Diurno') && conds.includes('Nocturno');
        const hDia = both ? (state.horasDiurno ?? dur) : (conds.includes('Diurno') ? dur : 0);
        const hNoc = both ? (state.horasNocturno ?? Math.round((dur - hDia) * 100) / 100)
                          : (conds.includes('Nocturno') ? dur : 0);

        return {
            "Fecha": state.fecha || new Date(state.startTs).toISOString().split('T')[0],
            "Aeronave Marca y Modelo": state.aeronave || '',
            "Matricula Aeronave": state.matricula || '',
            "Desde": state.desde || '',
            "Hasta": state.hasta || '',
            "Duracion Total de Vuelo": dur,
            "LSA":          tipos.includes('LSA')          ? dur : 0,
            "Monomotor":    tipos.includes('Monomotor')    ? dur : 0,
            "Multimotor":   tipos.includes('Multimotor')   ? dur : 0,
            "Turbo Helice": tipos.includes('Turbo Helice') ? dur : 0,
            "Turbo Jet":    tipos.includes('Turbo Jet')    ? dur : 0,
            "Helicoptero":  tipos.includes('Helicoptero')  ? dur : 0,
            "Planeador":    tipos.includes('Planeador')    ? dur : 0,
            "Ultraliviano": tipos.includes('Ultraliviano') ? dur : 0,
            "Aterrizajes Dia":   state.aterrizajesDia   || 0,
            "Aterrizajes Noche": state.aterrizajesNoche || 0,
            "Diurno":  hDia,
            "Nocturno": hNoc,
            "IFR":     conds.includes('IFR')     ? dur : 0,
            "NO": 0,
            "Tipo": "",
            "Simulador o Entrenador de Vuelo": 0,
            "Travesia":              state.travesia                    ? dur : 0,
            "Solo":                  roles.includes('Solo')            ? dur : 0,
            "Piloto al Mando (PIC)": roles.includes('PIC')             ? dur : 0,
            "Copiloto (SIC)":        roles.includes('SIC')             ? dur : 0,
            "Instruccion Recibida":  roles.includes('Instruccion')     ? dur : 0,
            "Como Instructor":       roles.includes('Instructor')      ? dur : 0,
            "Observaciones": state.observaciones || "",
            "Pagina Bitacora a Replicar": ""
        };
    },

    _exportJSON(state) {
        const row = this._buildRow(state);
        // CSV con el mismo orden de columnas que el importador de Bitácora
        // (data-importer.js mapea por posición). El JSON anterior no era
        // importable — Bitácora solo lee Excel/CSV.
        const cols = Object.keys(row);
        const csvCell = v => {
            const s = String(v ?? '');
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const csv = cols.join(',') + '\n' + cols.map(c => csvCell(row[c])).join(',');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vuelo_${row['Fecha']}_${row['Desde']}-${row['Hasta']}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    },

    _esc(s) {
        return String(s || '')
            .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;');
    }
};
