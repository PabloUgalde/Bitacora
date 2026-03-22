// =================================================================
// SALDO-INICIAL.JS
// Permite ingresar totales históricos desde bitácora física
// Formulario de 4 pasos igual que Añadir Vuelo, sin validaciones cruzadas
// =================================================================

const saldoInicial = {

    currentStep: 0,
    _initObsField: () => {
        const getBaseObs = () => {
            const inicio = document.getElementById('si-fecha-inicio')?.value;
            const corte = document.getElementById('si-fecha')?.value;
            const fmt = (d) => d ? new Date(d + 'T12:00:00Z').toLocaleDateString('es-CL', {timeZone:'UTC'}) : null;
            const fInicio = fmt(inicio);
            const fCorte = fmt(corte);
            if (!fCorte) return '';
            return fInicio
                ? `Registros iniciales desde el ${fInicio} hasta el ${fCorte}`
                : `Registros iniciales hasta el ${fCorte}`;
        };

        let userCleared = false;
        let extraText = '';

        const setObsStyle = (isEmpty) => {
            const obs = document.getElementById('si-obs');
            const helper = document.getElementById('si-obs-helper');
            if (!obs || !helper) return;
            if (isEmpty) {
                obs.style.borderColor = '#555';
                obs.style.color = '#555';
                obs.style.fontStyle = 'italic';
                helper.textContent = 'No se incluirá ninguna descripción en este vuelo.';
                helper.style.color = '#666';
            } else {
                obs.style.borderColor = '';
                obs.style.color = '';
                obs.style.fontStyle = '';
                helper.textContent = 'Generado a partir de las fechas. Puedes editarlo libremente.';
                helper.style.color = '#c9a84c55';
            }
        };

        const updateObs = () => {
            if (userCleared) return;
            const obs = document.getElementById('si-obs');
            if (!obs) return;
            const base = getBaseObs();
            obs.value = base + (extraText ? '. ' + extraText : '');
            setObsStyle(!base && !obs.value);
        };

        const obs = document.getElementById('si-obs');
        if (!obs) return;

        // Al cargar, separar texto extra del base si ya había valor
        if (obs.value) {
            if (obs.value.startsWith('Registros iniciales') || obs.value.startsWith('Totales acumulados')) {
                extraText = obs.value.replace(/^[^.]+\.?\s*/, '').trim();
            } else {
                extraText = obs.value;
            }
        }

        updateObs();

        obs.addEventListener('input', (e) => {
            const val = e.target.value;
            if (val === '') {
                userCleared = true;
                extraText = '';
                setObsStyle(true);
            } else {
                userCleared = false;
                const base = getBaseObs();
                extraText = val.startsWith(base)
                    ? val.slice(base.length).replace(/^[\.\s]+/, '').trim()
                    : val;
                setObsStyle(false);
            }
        });

        document.getElementById('si-fecha-inicio')?.addEventListener('input', updateObs);
        document.getElementById('si-fecha')?.addEventListener('input', updateObs);
    },
    open: () => {
            saldoInicial.currentStep = 0;
            const existing = saldoInicial._getExisting();
            let overlay = document.getElementById('saldo-inicial-overlay');
            if (overlay) overlay.remove();

            overlay = document.createElement('div');
            overlay.id = 'saldo-inicial-overlay';

            const num = (key) => existing ? (existing[key] || '') : '';
            const today = new Date().toISOString().split('T')[0];
            const fechaVal = existing?.Fecha instanceof Date
                ? existing.Fecha.toISOString().split('T')[0]
                : today;

            const tiposHtml = (typeof AIRCRAFT_TYPE_HEADERS !== 'undefined' ? AIRCRAFT_TYPE_HEADERS : [])
                .map(t => `
                    <div class="si-field">
                        <label>${t}</label>
                        <input type="number" step="0.1" min="0" id="si-tipo-${t.replace(/\s/g,'-')}" 
                            placeholder="0" value="${num(t)}">
                    </div>`).join('');

            overlay.innerHTML = `
            <div class="si-card">
                <div class="si-header">
                    <div>
                        <h3 class="si-title">Saldo inicial desde bitácora física</h3>
                        <p class="si-subtitle">Totales acumulados antes de iniciar tu bitácora digital.</p>
                    </div>
                    <button onclick="document.getElementById('saldo-inicial-overlay').remove()" class="si-close">×</button>
                </div>
                <div class="si-note">
                    Sin restricciones — ingresa los totales que tengas disponibles. Solo fecha y horas totales son obligatorios.
                </div>

                <div class="si-steps-indicator">
                    <div class="si-step-dot active" id="si-dot-0">1</div>
                    <div class="si-step-line"></div>
                    <div class="si-step-dot" id="si-dot-1">2</div>
                    <div class="si-step-line"></div>
                    <div class="si-step-dot" id="si-dot-2">3</div>
                    <div class="si-step-line"></div>
                    <div class="si-step-dot" id="si-dot-3">4</div>
                </div>

                <!-- PASO 1: Fecha y observaciones -->
                <div class="si-step active" id="si-step-0">
                    <h4 class="si-step-title">Paso 1: Período</h4>
                    <div class="si-fields">
                        <div class="si-field full">
                            <label>Fecha de inicio (primer vuelo en papel)</label>
                            <input type="date" id="si-fecha-inicio" value="${existing?.fechaInicio || ''}">
                        </div>
                        <div class="si-field full">
                            <label>Fecha de corte * (hasta cuándo cuentan estos totales)</label>
                            <input type="date" id="si-fecha" value="${fechaVal}">
                        </div>
                        <div class="si-field full">
                            <label>Observaciones</label>
                            <input type="text" id="si-obs"
                                value="${existing?.Observaciones?.startsWith('SALDO INICIAL') ? '' : (existing?.Observaciones || '')}">
                            <div id="si-obs-helper" style="font-size:11px; margin-top:4px; color:#c9a84c55;">
                                Generado a partir de las fechas. Puedes editarlo libremente.
                            </div>
                        </div>
                    </div>
                    <div class="si-nav">
                        <div></div>
                        <button class="si-btn-primary" onclick="saldoInicial.goToStep(1)">Siguiente →</button>
                    </div>
                </div>

                <!-- PASO 2: Tiempos y tipos de avión -->
                <div class="si-step" id="si-step-1">
                    <h4 class="si-step-title">Paso 2: Tiempos de vuelo</h4>
                    <div class="si-fields">
                        <div class="si-field">
                            <label>Duración Total *</label>
                            <input type="number" step="0.1" min="0" id="si-total" placeholder="Ej: 312.5" value="${num('Duracion Total de Vuelo')}">
                        </div>
                        <div class="si-field">
                            <label>Horas Diurnas</label>
                            <input type="number" step="0.1" min="0" id="si-diurno" placeholder="0" value="${num('Diurno')}">
                        </div>
                        <div class="si-field">
                            <label>Horas Nocturnas</label>
                            <input type="number" step="0.1" min="0" id="si-nocturno" placeholder="0" value="${num('Nocturno')}">
                        </div>
                        <div class="si-field">
                            <label>Horas IFR</label>
                            <input type="number" step="0.1" min="0" id="si-ifr" placeholder="0" value="${num('IFR')}">
                        </div>
                        <div class="si-field">
                            <label>Nº Aproximaciones</label>
                            <input type="number" step="1" min="0" id="si-no-app" placeholder="0" value="${num('NO')}">
                        </div>
                        <div class="si-field">
                            <label>Tipo Aproximaciones</label>
                            <input type="text" id="si-tipo-app" placeholder="Ej: ILS, VOR" value="${existing?.Tipo || ''}">
                        </div>
                    </div>
                    <div class="si-section-title">Horas por tipo de aeronave</div>
                    <div class="si-fields">${tiposHtml}</div>
                    <div class="si-nav">
                        <button class="si-btn-secondary" onclick="saldoInicial.goToStep(0)">← Anterior</button>
                        <button class="si-btn-primary" onclick="saldoInicial.goToStep(2)">Siguiente →</button>
                    </div>
                </div>

                <!-- PASO 3: Roles y aterrizajes -->
                <div class="si-step" id="si-step-2">
                    <h4 class="si-step-title">Paso 3: Roles y aterrizajes</h4>
                    <div class="si-fields">
                        <div class="si-field">
                            <label>Horas PIC</label>
                            <input type="number" step="0.1" min="0" id="si-pic" placeholder="0" value="${num('Piloto al Mando (PIC)')}">
                        </div>
                        <div class="si-field">
                            <label>Horas SIC</label>
                            <input type="number" step="0.1" min="0" id="si-sic" placeholder="0" value="${num('Copiloto (SIC)')}">
                        </div>
                        <div class="si-field">
                            <label>Instrucción Recibida</label>
                            <input type="number" step="0.1" min="0" id="si-instruccion" placeholder="0" value="${num('Instruccion Recibida')}">
                        </div>
                        <div class="si-field">
                            <label>Como Instructor</label>
                            <input type="number" step="0.1" min="0" id="si-instructor" placeholder="0" value="${num('Como Instructor')}">
                        </div>
                        <div class="si-field">
                            <label>Horas Solo</label>
                            <input type="number" step="0.1" min="0" id="si-solo" placeholder="0" value="${num('Solo')}">
                        </div>
                        <div class="si-field">
                            <label>Horas Travesía</label>
                            <input type="number" step="0.1" min="0" id="si-travesia" placeholder="0" value="${num('Travesia')}">
                        </div>
                        <div class="si-field">
                            <label>Horas Simulador</label>
                            <input type="number" step="0.1" min="0" id="si-simulador" placeholder="0" value="${num('Simulador o Entrenador de Vuelo')}">
                        </div>
                        <div class="si-field">
                            <label>Aterrizajes Día</label>
                            <input type="number" step="1" min="0" id="si-aterrizajes-dia" placeholder="0" value="${num('Aterrizajes Dia')}">
                        </div>
                        <div class="si-field">
                            <label>Aterrizajes Noche</label>
                            <input type="number" step="1" min="0" id="si-aterrizajes-noche" placeholder="0" value="${num('Aterrizajes Noche')}">
                        </div>
                    </div>
                    <div class="si-nav">
                        <button class="si-btn-secondary" onclick="saldoInicial.goToStep(1)">← Anterior</button>
                        <button class="si-btn-primary" onclick="saldoInicial.goToStep(3)">Revisar →</button>
                    </div>
                </div>

                <!-- PASO 4: Revisar -->
                <div class="si-step" id="si-step-3">
                    <h4 class="si-step-title">Paso 4: Revisar y guardar</h4>
                    <div id="si-preview" class="si-preview"></div>
                    <div class="si-nav">
                        <button class="si-btn-secondary" onclick="saldoInicial.goToStep(2)">← Corregir</button>
                        <button class="si-btn-primary" onclick="saldoInicial.save()">Guardar saldo inicial</button>
                    </div>
                </div>

                <div class="si-footer">
                    ${existing ? `<button class="si-btn-danger" onclick="saldoInicial.delete()">Eliminar saldo inicial</button>` : '<div></div>'}
                </div>
            </div>`;

            saldoInicial._injectStyles();
            document.body.appendChild(overlay);
            saldoInicial._initObsField();
    },

    currentStep: 0,

    goToStep: (n) => {
        if (n === 3) saldoInicial._buildPreview();
        document.querySelectorAll('.si-step').forEach((s, i) => s.classList.toggle('active', i === n));
        document.querySelectorAll('.si-step-dot').forEach((d, i) => {
            d.classList.toggle('active', i === n);
            d.classList.toggle('done', i < n);
        });
        saldoInicial.currentStep = n;
    },

    _buildPreview: () => {
        const tipoFields = (typeof AIRCRAFT_TYPE_HEADERS !== 'undefined' ? AIRCRAFT_TYPE_HEADERS : [])
            .map(t => [t, document.getElementById(`si-tipo-${t.replace(/\s/g,'-')}`)?.value])
            .filter(([, v]) => v && parseFloat(v) > 0);

        const fields = [
            ['Fecha de corte', document.getElementById('si-fecha')?.value],
            ['Observaciones', document.getElementById('si-obs')?.value],
            ['Horas Totales', document.getElementById('si-total')?.value],
            ['Diurnas', document.getElementById('si-diurno')?.value],
            ['Nocturnas', document.getElementById('si-nocturno')?.value],
            ['IFR', document.getElementById('si-ifr')?.value],
            ['Aproximaciones', document.getElementById('si-no-app')?.value],
            ...tipoFields,
            ['PIC', document.getElementById('si-pic')?.value],
            ['SIC', document.getElementById('si-sic')?.value],
            ['Instrucción', document.getElementById('si-instruccion')?.value],
            ['Instructor', document.getElementById('si-instructor')?.value],
            ['Solo', document.getElementById('si-solo')?.value],
            ['Travesía', document.getElementById('si-travesia')?.value],
            ['Simulador', document.getElementById('si-simulador')?.value],
            ['Aterrizajes Día', document.getElementById('si-aterrizajes-dia')?.value],
            ['Aterrizajes Noche', document.getElementById('si-aterrizajes-noche')?.value],
        ].filter(([, v]) => v && v !== '0');

        const preview = document.getElementById('si-preview');
        if (preview) {
            preview.innerHTML = `<div class="si-preview-grid">${
                fields.map(([k, v]) => `
                    <div class="si-preview-item">
                        <div class="si-preview-label">${k}</div>
                        <div class="si-preview-val">${v}</div>
                    </div>`).join('')
            }</div>`;
        }
    },

    goToStep: (n) => {
        if (n === 3) saldoInicial._buildPreview();
        document.querySelectorAll('.si-step').forEach((s, i) => s.classList.toggle('active', i === n));
        document.querySelectorAll('.si-step-dot').forEach((d, i) => {
            d.classList.toggle('active', i === n);
            d.classList.toggle('done', i < n);
        });
        saldoInicial.currentStep = n;
    },

    _buildPreview: () => {
        const fields = [
            ['Fecha de corte', document.getElementById('si-fecha')?.value],
            ['Horas Totales', document.getElementById('si-total')?.value],
            ['Diurnas', document.getElementById('si-diurno')?.value],
            ['Nocturnas', document.getElementById('si-nocturno')?.value],
            ['IFR', document.getElementById('si-ifr')?.value],
            ['PIC', document.getElementById('si-pic')?.value],
            ['SIC', document.getElementById('si-sic')?.value],
            ['Instrucción', document.getElementById('si-instruccion')?.value],
            ['Instructor', document.getElementById('si-instructor')?.value],
            ['Solo', document.getElementById('si-solo')?.value],
            ['Travesía', document.getElementById('si-travesia')?.value],
            ['Simulador', document.getElementById('si-simulador')?.value],
            ['Aterrizajes Día', document.getElementById('si-aterrizajes-dia')?.value],
            ['Aterrizajes Noche', document.getElementById('si-aterrizajes-noche')?.value],
            ['Observaciones', document.getElementById('si-obs')?.value],
        ].filter(([, v]) => v);

        const preview = document.getElementById('si-preview');
        if (preview) {
            preview.innerHTML = `<div class="si-preview-grid">${
                fields.map(([k, v]) => `
                    <div class="si-preview-item">
                        <div class="si-preview-label">${k}</div>
                        <div class="si-preview-val">${v}</div>
                    </div>`).join('')
            }</div>`;
        }
    },

    save: async () => {
        const fecha = document.getElementById('si-fecha')?.value;
        const total = parseFloat(document.getElementById('si-total')?.value);

        if (!fecha) { ui.showNotification('La fecha de corte es obligatoria.', 'error'); saldoInicial.goToStep(0); return; }
        if (!total || total <= 0) { ui.showNotification('Las horas totales deben ser mayores a 0.', 'error'); saldoInicial.goToStep(1); return; }

        const existing = saldoInicial._getExisting();
        if (existing) {
            await api.deleteFlight(existing.id);
            flightData = flightData.filter(f => f.id !== existing.id);
        }

        const aeronave = document.getElementById('si-aeronave')?.value || 'SALDO INICIAL';
        const matricula = document.getElementById('si-matricula')?.value || '—';
        const desde = document.getElementById('si-desde')?.value || '—';
        const hasta = document.getElementById('si-hasta')?.value || '—';
        const obs = document.getElementById('si-obs')?.value.trim() || '';
        const tipoAvion = document.getElementById('si-tipo-avion')?.value || '';

        const flightObj = {
            id: 'saldo-' + currentUser.id,
            'Fecha': new Date(fecha + 'T12:00:00Z'),
            'Aeronave Marca y Modelo': aeronave,
            'Matricula Aeronave': matricula,
            'Desde': desde,
            'Hasta': hasta,
            'Duracion Total de Vuelo': total,
            'Diurno':    parseFloat(document.getElementById('si-diurno')?.value) || 0,
            'Nocturno':  parseFloat(document.getElementById('si-nocturno')?.value) || 0,
            'IFR':       parseFloat(document.getElementById('si-ifr')?.value) || 0,
            'NO':        parseInt(document.getElementById('si-no-app')?.value) || 0,
            'Tipo':      document.getElementById('si-tipo-app')?.value || '',
            'Piloto al Mando (PIC)':   parseFloat(document.getElementById('si-pic')?.value) || 0,
            'Copiloto (SIC)':          parseFloat(document.getElementById('si-sic')?.value) || 0,
            'Instruccion Recibida':    parseFloat(document.getElementById('si-instruccion')?.value) || 0,
            'Como Instructor':         parseFloat(document.getElementById('si-instructor')?.value) || 0,
            'Solo':      parseFloat(document.getElementById('si-solo')?.value) || 0,
            'Travesia':  parseFloat(document.getElementById('si-travesia')?.value) || 0,
            'Simulador o Entrenador de Vuelo': parseFloat(document.getElementById('si-simulador')?.value) || 0,
            'Aterrizajes Dia':   parseInt(document.getElementById('si-aterrizajes-dia')?.value) || 0,
            'Aterrizajes Noche': parseInt(document.getElementById('si-aterrizajes-noche')?.value) || 0,
            'Observaciones': obs,
            'Pagina Bitacora a Replicar': 0,
            'es_saldo_inicial': true,
        };

        AIRCRAFT_TYPE_HEADERS.forEach(h => {
            const id = `si-tipo-${h.replace(/\s/g,'-')}`;
            flightObj[h] = parseFloat(document.getElementById(id)?.value) || 0;
        });

        const userId = api._getUserId();
        const row = { ...api._flightToRow(flightObj, userId), es_saldo_inicial: true };

        const { error } = await supabaseClient
            .from('flights')
            .upsert([row], { onConflict: 'id' });

        if (error) {
            console.error('Error guardando saldo inicial:', error);
            ui.showNotification('Error al guardar.', 'error');
            return;
        }

        flightData.unshift(flightObj);
        document.getElementById('saldo-inicial-overlay').remove();
        saldoInicial._updateStatus();
        render.dashboard();
        ui.showNotification('Saldo inicial guardado correctamente.', 'success');
    },

    delete: async () => {
        if (!confirm('¿Eliminar el saldo inicial? Esto no afecta tus vuelos digitales.')) return;
        const existing = saldoInicial._getExisting();
        if (!existing) return;
        await api.deleteFlight(existing.id);
        flightData = flightData.filter(f => f.id !== existing.id);
        document.getElementById('saldo-inicial-overlay')?.remove();
        saldoInicial._updateStatus();
        render.dashboard();
        ui.showNotification('Saldo inicial eliminado.', 'success');
    },

    _getExisting: () => flightData.find(f => f.es_saldo_inicial || f['Aeronave Marca y Modelo'] === 'SALDO INICIAL'),

    _updateStatus: () => {
        const el = document.getElementById('saldo-inicial-status');
        if (!el) return;
        const existing = saldoInicial._getExisting();
        if (existing) {
            const fecha = existing.Fecha instanceof Date
                ? existing.Fecha.toLocaleDateString('es-CL', { timeZone: 'UTC' })
                : existing.Fecha;
            const total = existing['Duracion Total de Vuelo'] || 0;
            el.innerHTML = `<div class="si-status-ok">Saldo inicial configurado — ${total.toFixed(1)} hrs hasta el ${fecha}</div>`;
        } else {
            el.innerHTML = `<div class="si-status-empty">Sin saldo inicial configurado.</div>`;
        }
    },

    init: () => {
        saldoInicial._updateStatus();
    },

    _injectStyles: () => {
        if (document.getElementById('si-styles')) return;
        const style = document.createElement('style');
        style.id = 'si-styles';
        style.textContent = `
        #saldo-inicial-overlay {
            position: fixed; inset: 0; z-index: 9995;
            background: rgba(0,0,0,0.88);
            display: flex; align-items: center; justify-content: center;
            backdrop-filter: blur(4px); padding: 20px; overflow-y: auto;
        }
        .si-card {
            background: #1a1a1a; border: 1px solid #2a2a2a;
            border-radius: 14px; padding: 28px;
            width: 100%; max-width: 600px; margin: auto;
        }
        .si-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
        .si-title { font-size: 17px; font-weight: 700; color: #fff; margin-bottom: 4px; }
        .si-subtitle { font-size: 13px; color: #555; }
        .si-close { background: none; border: none; color: #555; font-size: 22px; cursor: pointer; padding: 0; line-height: 1; }
        .si-close:hover { color: #aaa; }
        .si-note { background: #1c1a10; border: 1px solid #c9a84c30; border-radius: 8px; padding: 10px 14px; font-size: 12px; color: #888; margin-bottom: 16px; line-height: 1.5; }
        .si-steps-indicator { display: flex; align-items: center; margin-bottom: 20px; }
        .si-step-dot { width: 28px; height: 28px; border-radius: 50%; background: #222; border: 1px solid #333; color: #555; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.2s; }
        .si-step-dot.active { background: #c9a84c; border-color: #c9a84c; color: #000; }
        .si-step-dot.done { background: #1a3020; border-color: #2d5a2d; color: #4a9a4a; }
        .si-step-line { flex: 1; height: 1px; background: #2a2a2a; }
        .si-step { display: none; }
        .si-step.active { display: block; }
        .si-step-title { font-size: 14px; font-weight: 700; color: #c9a84c; margin-bottom: 14px; }
        .si-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
        .si-field label { display: block; font-size: 11px; color: #555; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .si-field input, .si-field select { width: 100%; padding: 8px 12px; background: #111; border: 1px solid #2a2a2a; border-radius: 6px; color: #e2e8f0; font-size: 13px; outline: none; box-sizing: border-box; }
        .si-field input:focus, .si-field select:focus { border-color: #c9a84c; }
        .si-field.full { grid-column: 1 / -1; }
        .si-nav { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #1e1e1e; padding-top: 14px; margin-top: 4px; }
        .si-footer { display: flex; justify-content: flex-start; margin-top: 12px; padding-top: 12px; border-top: 1px solid #1a1a1a; }
        .si-btn-primary { background: #c9a84c; color: #000; border: none; border-radius: 7px; padding: 9px 20px; font-size: 13px; font-weight: 700; cursor: pointer; }
        .si-btn-primary:hover { opacity: 0.9; }
        .si-btn-secondary { background: transparent; color: #666; border: 1px solid #2a2a2a; border-radius: 7px; padding: 9px 20px; font-size: 13px; cursor: pointer; }
        .si-btn-secondary:hover { border-color: #444; color: #aaa; }
        .si-btn-danger { background: transparent; color: #c05050; border: 1px solid #7a2020; border-radius: 7px; padding: 9px 16px; font-size: 13px; cursor: pointer; }
        .si-btn-danger:hover { background: rgba(192,80,80,0.1); }
        .si-preview { background: #111; border-radius: 8px; padding: 14px; margin-bottom: 4px; }
        .si-preview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .si-preview-item { background: #181818; border-radius: 6px; padding: 8px 10px; }
        .si-preview-label { font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
        .si-preview-val { font-size: 14px; font-weight: 600; color: #c9a84c; }
        .si-status-ok { font-size: 12px; color: #4a9a4a; background: #0f1a0f; border: 1px solid #1a3020; border-radius: 6px; padding: 8px 12px; }
        .si-status-empty { font-size: 12px; color: #555; font-style: italic; }
        .si-section-title { font-size: 11px; font-weight: 700; color: #555; text-transform: uppercase; letter-spacing: 1px; margin: 4px 0 10px; grid-column: 1/-1; }
        .si-field select { width: 100%; padding: 8px 12px; background: #111; border: 1px solid #2a2a2a; border-radius: 6px; color: #e2e8f0; font-size: 13px; outline: none; box-sizing: border-box; }
        .si-field select:focus { border-color: #c9a84c; }
        @media (max-width: 480px) { .si-fields { grid-template-columns: 1fr; } .si-card { padding: 20px 16px; } .si-preview-grid { grid-template-columns: 1fr; } }`;
        document.head.appendChild(style);
    }
};