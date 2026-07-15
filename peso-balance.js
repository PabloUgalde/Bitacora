// peso-balance.js — Módulo de Peso y Balance con base de datos de aeronaves

const pesoBalance = {
    _screen: 'flota',      // 'flota' | 'db' | 'calc' | 'form'
    _calcAc: null,
    _formAc: null,         // aeronave en edición (null = crear nueva)
    _cgChart: null,
    _LBS_KG: 0.453592,
    _GAL_LTR: 3.78541,
    TIPOS_AVION: ['Monomotor','Multimotor','Turbo Helice','Turbo Jet','LSA','Ultraliviano','Helicoptero','Planeador'],
    _community: [],   // aeronaves públicas de otros pilotos (solo Bitácora las llena)

    // ── Matrícula: XX-ABC (prefijo OACI con guion) o N1234AB (EEUU) ──
    _validReg(reg) {
        return /^([A-Z]{1,2}-[A-Z0-9]{1,5}|N[1-9][0-9]{0,4}[A-Z]{0,2})$/.test(reg);
    },

    // ── Normalización de marca/modelo ──
    // "cesna 172n skyhawk" → "Cessna 172N Skyhawk". La marca se corrige por
    // distancia de edición contra la lista canónica (misma inicial, ≤2 letras
    // de diferencia); los tokens con dígitos se llevan a mayúsculas.
    _BRANDS: ['Cessna','Piper','Cirrus','Beechcraft','Diamond','Mooney','Tecnam','Robin','Robinson','Bell',
        'Grumman','Aeronca','Luscombe','Champion','Bellanca','Socata','Extra','Pitts','Zlin','Evektor',
        'Sling','Bristell','Savannah','Vans','CubCrafters','Maule','Stinson','Taylorcraft','Ercoupe',
        'Lancair','Glasair','Kitfox','Jabiru','Rans','Zenith','Boeing','Airbus','Embraer','Bonanza'],
    _BRAND_ALIASES: { 'beech': 'Beechcraft', 'van': 'Vans', "van's": 'Vans', 'cesna': 'Cessna', 'cesnna': 'Cessna' },

    _lev(a, b) {
        const m = a.length, n = b.length;
        if (Math.abs(m - n) > 2) return 99;
        let prev = Array.from({ length: n + 1 }, (_, j) => j);
        for (let i = 1; i <= m; i++) {
            const cur = [i];
            for (let j = 1; j <= n; j++) {
                cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
            }
            prev = cur;
        }
        return prev[n];
    },

    // ── Anti-duplicados de matrícula ──
    // Una matrícula real solo debería existir una vez entre el catálogo y las
    // aeronaves públicas — evita que dos pilotos publiquen la misma con datos
    // distintos. Chequeo local (rápido, cubre catálogo + comunidad ya
    // cargada); `_checkPublicRegistrationCloud` complementa con un round-trip
    // a la nube (cubre la carrera entre dos publicaciones simultáneas), y el
    // índice único de la base de datos es el resguardo final.
    _findDuplicateRegistration(reg, excludeId) {
        if (!reg) return null;
        const r = reg.toUpperCase();
        const inCatalog = AERONAVES_DB.find(a => (a.registration || '').toUpperCase() === r);
        if (inCatalog) return inCatalog;
        const inCommunity = (this._community || []).find(a =>
            a.id !== excludeId && (a.registration || '').toUpperCase() === r);
        return inCommunity || null;
    },

    async _checkPublicRegistrationCloud(reg, excludeId) {
        if (typeof supabaseClient === 'undefined' || !supabaseClient || !navigator.onLine) return null;
        try {
            const { data, error } = await supabaseClient.from('wb_aircraft')
                .select('data')
                .eq('is_public', true)
                .ilike('data->>registration', reg);
            if (error || !data) return null;
            return data.find(row => row.data?.id !== excludeId)?.data || null;
        } catch (e) {
            console.warn('[P&B] chequeo de matrícula en la nube falló:', e);
            return null; // no bloquear la publicación por un problema de red — el índice único de la BD es el resguardo final
        }
    },

    _normalizeMakeModel(raw) {
        const tokens = String(raw || '').trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
        if (!tokens.length) return '';
        const caseToken = t => /\d/.test(t) ? t.toUpperCase() : t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
        // primer token con dígitos (ej: "C172") no es marca — solo casear todo
        if (/\d/.test(tokens[0])) return tokens.map(caseToken).join(' ');
        const first = tokens[0].toLowerCase().replace(/[^a-z']/g, '');
        let brand = this._BRAND_ALIASES[first] || null;
        if (!brand && first.length >= 3) {
            const maxD = first.length >= 5 ? 2 : 1;
            let best = null, bestD = maxD + 1;
            for (const b of this._BRANDS) {
                const bl = b.toLowerCase();
                if (bl[0] !== first[0]) continue;
                const d = this._lev(first, bl);
                if (d < bestD) { bestD = d; best = b; }
            }
            brand = best;
        }
        const rest = tokens.slice(1).map(caseToken);
        return [brand || caseToken(tokens[0]), ...rest].join(' ');
    },

    init() { this.render(); this._loadCloudAircraft(); },

    render() {
        const el = document.getElementById('tab-peso-balance');
        if (!el) return;
        if (this._screen === 'flota') this._renderFlota(el);
        else if (this._screen === 'db') this._renderDB(el);
        else if (this._screen === 'calc') this._renderCalc(el);
        else if (this._screen === 'form') this._renderForm(el);
    },

    // ── Fleet management ──
    _getFlota() {
        try { return JSON.parse(localStorage.getItem('_miFlota') || '[]'); }
        catch { return []; }
    },
    _saveFlota(f) { localStorage.setItem('_miFlota', JSON.stringify(f)); },
    _inFlota(id) { return this._getFlota().some(f => f.id === id); },

    _addToFlota(id) {
        const flota = this._getFlota();
        if (!flota.find(f => f.id === id)) {
            flota.push({ id, source: 'db' });
            this._saveFlota(flota);
        }
    },
    _removeFromFlota(id) {
        this._saveFlota(this._getFlota().filter(f => f.id !== id));
    },
    _getAcData(id) {
        const custom = this._getFlota().find(f => f.id === id && f.source === 'custom');
        if (custom) return custom;
        return AERONAVES_DB.find(a => a.id === id)
            || (this._community || []).find(a => a.id === id)
            || null;
    },

    // ── Aeronaves propias (custom) ──
    // Viven completas dentro de _miFlota con source:'custom' (así Live Log
    // las resuelve sin cambios). En Bitácora, _persistCustom/_deleteCustom
    // además sincronizan con la tabla wb_aircraft de Supabase.
    _persistCustom(ac) {
        const flota = this._getFlota();
        const i = flota.findIndex(f => f.id === ac.id);
        if (i >= 0) flota[i] = ac; else flota.push(ac);
        this._saveFlota(flota);
        this._syncCustomToCloud?.(ac);
    },
    _deleteCustomAc(id) {
        this._saveFlota(this._getFlota().filter(f => f.id !== id));
        this._deleteCustomFromCloud?.(id);
    },

    // ── Nube (tabla wb_aircraft de Supabase) ──
    // Catálogo global (user_id null) → actualiza/extiende AERONAVES_DB sin
    // re-deploy. Propias → merge en _miFlota (la nube manda; las creadas
    // offline se suben). Públicas de otros pilotos → this._community.
    async _loadCloudAircraft() {
        if (typeof supabaseClient === 'undefined' || !supabaseClient || !navigator.onLine) return;
        const userId = api._getUserId?.();
        if (!userId) return;
        try {
            const { data, error } = await supabaseClient.from('wb_aircraft').select('user_id, is_public, data');
            if (error || !data) return;
            const community = [];
            const own = [];
            for (const row of data) {
                if (!row.data?.id) continue;
                if (!row.user_id) {
                    const i = AERONAVES_DB.findIndex(a => a.id === row.data.id);
                    if (i >= 0) AERONAVES_DB[i] = row.data; else AERONAVES_DB.push(row.data);
                } else if (row.user_id === userId) {
                    own.push({ ...row.data, source: 'custom', isPublic: !!row.is_public });
                } else if (row.is_public) {
                    community.push({ ...row.data, source: 'community' });
                }
            }
            this._community = community;
            const flota = this._getFlota();
            const cloudIds = new Set(own.map(a => a.id));
            for (const ac of own) {
                const i = flota.findIndex(f => f.id === ac.id);
                if (i >= 0) flota[i] = ac; else flota.push(ac);
            }
            this._saveFlota(flota);
            // customs locales que no están en la nube (creadas sin conexión) → subir
            for (const f of flota) {
                if (f.source === 'custom' && !cloudIds.has(f.id)) this._syncCustomToCloud(f);
            }
            if (this._screen === 'flota' || this._screen === 'db') this.render();
        } catch (e) { console.warn('[P&B] carga de aeronaves desde la nube falló:', e); }
    },

    async _syncCustomToCloud(ac) {
        if (typeof supabaseClient === 'undefined' || !supabaseClient || !navigator.onLine) return;
        const userId = api._getUserId?.();
        if (!userId) return;
        try {
            const payload = { data: ac, is_public: !!ac.isPublic, updated_at: new Date().toISOString() };
            const { data: rows } = await supabaseClient.from('wb_aircraft')
                .select('id').eq('user_id', userId).eq('data->>id', ac.id).limit(1);
            let syncError;
            if (rows?.length) {
                ({ error: syncError } = await supabaseClient.from('wb_aircraft').update(payload).eq('id', rows[0].id));
            } else {
                ({ error: syncError } = await supabaseClient.from('wb_aircraft').insert([{ user_id: userId, ...payload }]));
            }
            // 23505 = violación del índice único de matrícula (wb_aircraft_public_reg_idx):
            // dos publicaciones simultáneas ganaron la carrera al chequeo previo del
            // cliente. Revertir a privada localmente y avisar — el dato en sí no se
            // pierde, solo deja de ser pública hasta que soporte resuelva el choque.
            if (syncError?.code === '23505') {
                const flota = this._getFlota();
                const i = flota.findIndex(f => f.id === ac.id);
                if (i >= 0) { flota[i] = { ...flota[i], isPublic: false }; this._saveFlota(flota); }
                if (typeof ui !== 'undefined') {
                    ui.showNotification(
                        `La matrícula ${ac.registration} ya fue publicada por otro piloto justo antes que tú. ` +
                        `Tu aeronave quedó guardada como privada — escribe a info@bitacoradevuelo.cl si crees que es un error.`,
                        'error');
                }
                if (this._screen === 'flota') this.render();
            } else if (syncError) {
                console.warn('[P&B] sync de aeronave a la nube falló:', syncError);
            }
        } catch (e) { console.warn('[P&B] sync de aeronave a la nube falló:', e); }
    },

    async _deleteCustomFromCloud(id) {
        if (typeof supabaseClient === 'undefined' || !supabaseClient || !navigator.onLine) return;
        const userId = api._getUserId?.();
        if (!userId) return;
        try {
            await supabaseClient.from('wb_aircraft')
                .delete().eq('user_id', userId).eq('data->>id', id);
        } catch (e) { console.warn('[P&B] borrado de aeronave en la nube falló:', e); }
    },

    // ── Screen: Mi Flota ──
    _renderFlota(el) {
        const flota = this._getFlota();
        const acList = flota.map(f => this._getAcData(f.id)).filter(Boolean);

        el.innerHTML = `
            <div class="pb-sub-tabs">
                <button class="pb-sub-btn active" id="pb-btn-flota">Mi Flota</button>
                <button class="pb-sub-btn" id="pb-btn-db">Base de Datos</button>
            </div>
            <div id="pb-flota-body">
                ${acList.length === 0 ? `
                    <div class="pb-empty-state">
                        <div class="pb-empty-icon">✈</div>
                        <div class="pb-empty-title">Tu flota está vacía</div>
                        <div class="pb-empty-sub">Agrega aeronaves desde la base de datos o crea la tuya con los datos del manual de vuelo.</div>
                        <button class="pb-empty-btn" id="pb-go-db">Explorar Base de Datos</button>
                        <button class="pb-empty-btn" id="pb-create-btn" style="margin-top:8px">+ Crear aeronave propia</button>
                    </div>` :
                    `<div class="section-header">
                        <span class="section-title">Selecciona una aeronave</span>
                        <span>
                            <button class="btn-link" id="pb-create-btn">+ Crear propia</button>
                            <button class="btn-link" id="pb-go-db-link">+ Base de datos</button>
                        </span>
                     </div>
                     <div class="ac-cards-grid">
                         ${acList.map(ac => this._acCardHTML(ac, true)).join('')}
                     </div>`
                }
            </div>`;

        el.querySelector('#pb-btn-flota')?.addEventListener('click', () => {
            this._setSubTab(el, 'flota');
        });
        el.querySelector('#pb-btn-db')?.addEventListener('click', () => {
            this._screen = 'db'; this.render();
        });
        el.querySelector('#pb-go-db')?.addEventListener('click', () => {
            this._screen = 'db'; this.render();
        });
        el.querySelector('#pb-go-db-link')?.addEventListener('click', () => {
            this._screen = 'db'; this.render();
        });
        el.querySelector('#pb-create-btn')?.addEventListener('click', () => {
            this._formAc = null; this._screen = 'form'; this.render();
        });
        el.querySelectorAll('.ac-card-btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.closest('[data-acid]').dataset.acid;
                this._formAc = this._getAcData(id);
                this._screen = 'form'; this.render();
            });
        });

        el.querySelectorAll('.ac-card-btn-primary').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.closest('[data-acid]').dataset.acid;
                const ac = this._getAcData(id);
                if (!ac) return;
                this._cgChart = null;
                this._calcAc = ac;
                this._screen = 'calc';
                this.render();
            });
        });
        el.querySelectorAll('.ac-card-btn-danger').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.closest('[data-acid]').dataset.acid;
                const ac = this._getAcData(id);
                const isCustom = ac?.source === 'custom';
                const msg = isCustom
                    ? `¿Eliminar ${ac?.name || id}? Es una aeronave creada por ti — se borra definitivamente.`
                    : `¿Eliminar ${ac?.name || id} de tu flota?`;
                if (confirm(msg)) {
                    if (isCustom) this._deleteCustomAc(id);
                    else this._removeFromFlota(id);
                    this.render();
                }
            });
        });
    },

    _setSubTab(el, tab) {
        el.querySelectorAll('.pb-sub-btn').forEach(b => b.classList.remove('active'));
        el.querySelector(`#pb-btn-${tab}`)?.classList.add('active');
    },

    // ── Screen: Base de Datos ──
    _renderDB(el) {
        el.innerHTML = `
            <div class="pb-sub-tabs">
                <button class="pb-sub-btn" id="pb-btn-flota">Mi Flota</button>
                <button class="pb-sub-btn active" id="pb-btn-db">Base de Datos</button>
            </div>
            <div class="pb-search">
                <input type="text" id="pb-search" placeholder="Buscar aeronave..." autocomplete="off">
            </div>
            <div id="pb-db-body">
                <div class="ac-cards-grid" id="pb-db-grid">
                    ${AERONAVES_DB.map(ac => this._acCardHTML(ac, false)).join('')}
                </div>
                ${(this._community || []).length ? `
                <div class="section-header" style="margin-top:18px">
                    <span class="section-title">🌐 Comunidad — compartidas por otros pilotos</span>
                </div>
                <p style="font-size:12px;color:var(--muted);margin:0 0 10px">
                    Datos ingresados por otros usuarios. Al copiarla a tu flota queda como
                    aeronave tuya editable — verifica siempre contra el manual y el informe
                    de masa y centrado antes de usarla.</p>
                <div class="ac-cards-grid" id="pb-community-grid">
                    ${this._community.map(ac => this._acCardHTML(ac, false, true)).join('')}
                </div>` : ''}
            </div>`;

        el.querySelector('#pb-btn-flota').addEventListener('click', () => {
            this._screen = 'flota'; this.render();
        });
        el.querySelector('#pb-btn-db').addEventListener('click', () => {
            this._setSubTab(el, 'db');
        });

        const searchInput = el.querySelector('#pb-search');
        searchInput.addEventListener('input', () => {
            const q = searchInput.value.toLowerCase();
            el.querySelectorAll('[data-acid]').forEach(card => {
                const text = card.textContent.toLowerCase();
                card.style.display = text.includes(q) ? '' : 'none';
            });
        });

        el.querySelectorAll('.ac-card-btn-add').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.closest('[data-acid]').dataset.acid;
                this._addToFlota(id);
                btn.textContent = '✓ En mi flota';
                btn.disabled = true;
                btn.style.opacity = '0.6';
            });
        });

        // Copiar aeronave de la comunidad → queda como propia (editable, privada)
        el.querySelectorAll('.ac-card-btn-copy').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.closest('[data-acid]').dataset.acid;
                const src = (this._community || []).find(a => a.id === id);
                if (!src) return;
                const copy = { ...src, id: 'u_' + Date.now().toString(36), source: 'custom', isPublic: false };
                this._persistCustom(copy);
                btn.textContent = '✓ Copiada';
                btn.disabled = true;
                btn.style.opacity = '0.6';
            });
        });

        el.querySelectorAll('.ac-card-btn-primary').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.closest('[data-acid]').dataset.acid;
                const ac = this._getAcData(id) || AERONAVES_DB.find(a => a.id === id);
                if (!ac) return;
                this._cgChart = null;
                this._calcAc = ac;
                this._screen = 'calc';
                this.render();
            });
        });
    },

    // ── Shared card HTML ──
    _acCardHTML(ac, inFlota, isCommunity = false) {
        const fuelStation = ac.stations?.find(s => s.type === 'paired_fuel');
        const maxFuelGal = fuelStation?.max_gallons ?? null;
        const paxCount = (ac.stations?.filter(s => s.type === 'paired_weight' && s.id.includes('pax')) || []).length;
        const seats = paxCount === 1 ? 2 : paxCount === 2 ? 4 : '—';
        const payload = ac.limits?.maxTakeOffWeight_lbs
            ? (ac.limits.maxTakeOffWeight_lbs - ac.emptyWeight_lbs).toFixed(0) + ' lbs'
            : '—';
        const cat = isCommunity ? '🌐 Comunidad' : (ac.limits?.defaultCategory || 'Utilitaria');
        const alreadyInFlota = this._inFlota(ac.id);

        const isCustom = ac.source === 'custom';
        const actionButtons = inFlota
            ? `<button class="ac-card-btn ac-card-btn-primary">Calcular</button>
               ${isCustom ? '<button class="ac-card-btn ac-card-btn-edit">✎ Editar</button>' : ''}
               <button class="ac-card-btn ac-card-btn-danger">Quitar</button>`
            : isCommunity
            ? `<button class="ac-card-btn ac-card-btn-primary">Calcular</button>
               <button class="ac-card-btn ac-card-btn-copy">+ Copiar a mi flota</button>`
            : `<button class="ac-card-btn ac-card-btn-primary">Calcular</button>
               <button class="ac-card-btn ac-card-btn-add" ${alreadyInFlota ? 'disabled style="opacity:0.6"' : ''}>
                   ${alreadyInFlota ? '✓ En mi flota' : '+ Mi Flota'}
               </button>`;

        return `
            <div class="ac-card" data-acid="${ac.id}">
                <div class="ac-card-reg">${this._esc(ac.registration || '—')}</div>
                <div class="ac-card-model">${this._esc(ac.name)}</div>
                <div class="ac-card-stats">
                    <div class="ac-stat">
                        <span class="ac-stat-k">MTOW</span>
                        <span class="ac-stat-v">${ac.limits?.maxTakeOffWeight_lbs?.toLocaleString() ?? '—'} lbs</span>
                    </div>
                    <div class="ac-stat">
                        <span class="ac-stat-k">Carga útil</span>
                        <span class="ac-stat-v">${payload}</span>
                    </div>
                    <div class="ac-stat">
                        <span class="ac-stat-k">Combustible</span>
                        <span class="ac-stat-v">${maxFuelGal != null ? maxFuelGal + ' gal' : '—'}</span>
                    </div>
                    <div class="ac-stat">
                        <span class="ac-stat-k">Asientos</span>
                        <span class="ac-stat-v">${seats}</span>
                    </div>
                </div>
                <div class="ac-card-cat">${this._esc(cat)}</div>
                <div class="ac-card-actions">${actionButtons}</div>
            </div>`;
    },

    // ── Screen: Calculadora ──
    _renderCalc(el) {
        if (this._cgChart) { try { this._cgChart.destroy(); } catch {} this._cgChart = null; }
        const ac = this._calcAc;
        if (!ac) { this._screen = 'flota'; this.render(); return; }

        const emptyCG = ac.emptyWeight_lbs
            ? (ac.emptyMoment_lb_in / ac.emptyWeight_lbs).toFixed(2) + ' in'
            : '—';

        const stationsHTML = ac.stations.map(st => this._stationInputHTML(st)).join('');
        const fromStr = this._screen === 'calc' && this._getFlota().some(f => f.id === ac.id)
            ? 'Mi Flota' : 'Base de Datos';

        el.innerHTML = `
            <div class="pb-calc-header">
                <button class="pb-back-btn" id="pb-back">‹</button>
                <div>
                    <div class="pb-calc-ac-chip">${this._esc(ac.registration || '')} ${this._esc(ac.name)}</div>
                    <div class="pb-calc-ac-sub">${this._esc(fromStr)}</div>
                </div>
            </div>
            <div class="pb-calc-body">
                <div class="ac-info-strip">
                    <div class="ac-kv">
                        <span class="k">Peso Vacío</span>
                        <span class="v">${ac.emptyWeight_lbs.toFixed(1)} lbs / ${(ac.emptyWeight_lbs * this._LBS_KG).toFixed(1)} kg</span>
                    </div>
                    <div class="ac-kv">
                        <span class="k">Momento Vacío</span>
                        <span class="v">${(ac.emptyMoment_lb_in/1000).toFixed(1)} lb·in</span>
                    </div>
                    <div class="ac-kv">
                        <span class="k">CG Vacío</span>
                        <span class="v">${emptyCG}</span>
                    </div>
                    <div class="ac-kv">
                        <span class="k">MTOW</span>
                        <span class="v">${ac.limits?.maxTakeOffWeight_lbs?.toLocaleString() ?? '—'} lbs</span>
                    </div>
                </div>
                <fieldset class="pb-fieldset">
                    <legend>Pesos en Estaciones</legend>
                    ${stationsHTML}
                </fieldset>
                <button class="pb-calc-btn" id="pb-calc-btn">Calcular Peso y Balance</button>
                <div id="pb-results" class="pb-results"></div>
            </div>`;

        el.querySelector('#pb-back').addEventListener('click', () => {
            const fromFlota = this._getFlota().some(f => f.id === ac.id);
            this._screen = fromFlota ? 'flota' : 'db';
            this.render();
        });

        this._setupSyncInputs(el);
        el.querySelector('#pb-calc-btn').addEventListener('click', () => this._calculate(el, ac));
    },

    // ── Screen: Crear / editar aeronave propia ──
    // Los datos se copian del manual de vuelo (POH): peso vacío y momento (o
    // CG) del informe de masa y centrado, brazos de la sección Weight &
    // Balance, y la envolvente desde la TABLA de límites de CG (o leyendo
    // 3-4 puntos del gráfico del manual). El gráfico se dibuja solo.
    _renderForm(el) {
        const ac = this._formAc;
        const isEdit = !!ac;
        const mode = ac?.envelopeMode || 'moment';
        const envKey = ac?.limits?.cgEnvelopeUtility ? 'Utilitaria' : 'Normal';
        const env = ac?.limits?.cgEnvelopeUtility || ac?.limits?.cgEnvelopeNormal || [];
        const emptyCg = ac ? (ac.emptyMoment_lb_in / ac.emptyWeight_lbs) : null;
        const lbPerGal = ac ? Math.round(1 / ac.fuel_gallons_per_lbs * 10) / 10 : 6;

        const stations = ac?.stations?.length ? ac.stations : [
            { name: 'Piloto y Pasajero', arm_in: 37.0, id: 'front_pax', type: 'paired_weight' },
            { name: 'Combustible Usable (Gal)', arm_in: 48.0, id: 'fuel', type: 'paired_fuel', max_gallons: 40 },
            { name: 'Equipaje', arm_in: 95.0, id: 'baggage1', type: 'paired_weight', max_lbs: 120 },
        ];
        const envRows = env.length ? env : [
            { weight: '', fwd_in: '', aft_in: '' },
            { weight: '', fwd_in: '', aft_in: '' },
        ];

        const stRow = (st = {}) => `
            <div class="pbf-st-row" style="display:flex;gap:6px;margin-bottom:6px;align-items:center">
                <input type="text" class="pbf-st-name" placeholder="Nombre (ej: Piloto y Pasajero)" value="${this._esc(st.name || '')}" style="flex:2;min-width:0">
                <input type="number" class="pbf-st-arm" placeholder="Brazo in" step="0.1" value="${st.arm_in ?? ''}" style="flex:1;min-width:0">
                <select class="pbf-st-type" style="flex:1.4;min-width:0">
                    <option value="paired_weight" ${st.type !== 'paired_fuel' && st.type !== 'single_weight' ? 'selected' : ''}>Peso (lbs/kg)</option>
                    <option value="paired_fuel" ${st.type === 'paired_fuel' ? 'selected' : ''}>Combustible (gal/l)</option>
                    <option value="single_weight" ${st.type === 'single_weight' ? 'selected' : ''}>Fijo (ej: aceite)</option>
                </select>
                <input type="number" class="pbf-st-max" placeholder="Máx" step="0.1"
                       value="${st.type === 'paired_fuel' ? (st.max_gallons ?? '') : st.type === 'single_weight' ? (st.default_value ?? '') : (st.max_lbs ?? '')}"
                       title="Peso: máx lbs · Combustible: capacidad gal · Fijo: valor lbs" style="flex:0.9;min-width:0">
                <button type="button" class="btn-link pbf-st-del" style="color:var(--red)">✕</button>
            </div>`;

        const envRow = (p = {}) => `
            <div class="pbf-env-row" style="display:flex;gap:6px;margin-bottom:6px;align-items:center">
                <input type="number" class="pbf-env-w" placeholder="Peso lbs" step="1" value="${p.weight ?? ''}" style="flex:1;min-width:0">
                <input type="number" class="pbf-env-f" placeholder="Lím. delantero in" step="0.01" value="${p.fwd_in ?? ''}" style="flex:1;min-width:0">
                <input type="number" class="pbf-env-a" placeholder="Lím. trasero in" step="0.01" value="${p.aft_in ?? ''}" style="flex:1;min-width:0">
                <button type="button" class="btn-link pbf-env-del" style="color:var(--red)">✕</button>
            </div>`;

        el.innerHTML = `
            <div class="pb-calc-header">
                <button class="pb-back-btn" id="pbf-back">‹</button>
                <div>
                    <div class="pb-calc-ac-chip">${isEdit ? '✎ Editar aeronave' : '+ Nueva aeronave'}</div>
                    <div class="pb-calc-ac-sub">Datos del manual de vuelo (POH) y del informe de masa y centrado</div>
                </div>
            </div>
            <div class="pb-calc-body">
                <p id="pbf-error" class="status-error" style="display:none"></p>

                <fieldset class="pb-fieldset">
                    <legend>Identificación</legend>
                    <div class="pb-input-group"><label>Marca y modelo *</label>
                        <input type="text" id="pbf-name" placeholder="Ej: Piper PA-28-181" value="${this._esc(ac?.name || '')}"></div>
                    <div class="pb-pair">
                        <div class="pb-input-group"><label>Matrícula</label>
                            <input type="text" id="pbf-reg" placeholder="CC-ABC o N1234AB" style="text-transform:uppercase" value="${this._esc(ac?.registration || '')}"></div>
                        <div class="pb-input-group"><label>Tipo</label>
                            <select id="pbf-tipo">${this.TIPOS_AVION.map(t =>
                                `<option ${ac?.tipoAvion === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
                    </div>
                    ${typeof supabaseClient !== 'undefined' ? `
                    <div class="ll-checkbox-row" style="margin-top:4px">
                        <input type="checkbox" id="pbf-public" ${ac?.isPublic ? 'checked' : ''}>
                        <label for="pbf-public">🌐 Compartir con la comunidad — otros pilotos podrán ver y copiar esta aeronave (requiere matrícula válida)</label>
                    </div>` : ''}
                </fieldset>

                <fieldset class="pb-fieldset">
                    <legend>Peso vacío (informe de masa y centrado)</legend>
                    <div class="pb-input-group"><label>Método del manual</label>
                        <div style="display:flex;gap:14px;padding:4px 0">
                            <label style="display:flex;gap:6px;align-items:center;font-size:13px">
                                <input type="radio" name="pbf-mode" value="moment" ${mode === 'moment' ? 'checked' : ''}>
                                Momento (POH clásico, ej: Cessna)</label>
                            <label style="display:flex;gap:6px;align-items:center;font-size:13px">
                                <input type="radio" name="pbf-mode" value="cg" ${mode === 'cg' ? 'checked' : ''}>
                                Posición CG (moderno, ej: Cirrus)</label>
                        </div>
                    </div>
                    <div class="pb-pair">
                        <div class="pb-input-group"><label>Peso vacío (lbs) *</label>
                            <input type="number" id="pbf-ew" step="0.1" value="${ac?.emptyWeight_lbs ?? ''}"></div>
                        <div class="pb-input-group" id="pbf-moment-wrap" style="${mode === 'cg' ? 'display:none' : ''}">
                            <label>Momento vacío (lb·in) *</label>
                            <input type="number" id="pbf-em" step="0.1" value="${mode === 'moment' && ac ? ac.emptyMoment_lb_in : ''}"></div>
                        <div class="pb-input-group" id="pbf-cg-wrap" style="${mode === 'cg' ? '' : 'display:none'}">
                            <label>CG vacío (in) *</label>
                            <input type="number" id="pbf-ecg" step="0.01" value="${mode === 'cg' && emptyCg ? emptyCg.toFixed(2) : ''}"></div>
                    </div>
                    <div class="pb-pair">
                        <div class="pb-input-group"><label>MTOW (lbs) *</label>
                            <input type="number" id="pbf-mtow" step="1" value="${ac?.limits?.maxTakeOffWeight_lbs ?? ''}"></div>
                        <div class="pb-input-group"><label>Combustible (lb/gal)</label>
                            <input type="number" id="pbf-dens" step="0.1" value="${lbPerGal}"></div>
                    </div>
                </fieldset>

                <fieldset class="pb-fieldset">
                    <legend>Estaciones de carga (brazos del POH)</legend>
                    <div id="pbf-stations">${stations.map(stRow).join('')}</div>
                    <button type="button" class="btn-link" id="pbf-add-st">+ Agregar estación</button>
                </fieldset>

                <fieldset class="pb-fieldset">
                    <legend>Envolvente CG (tabla de límites del manual)</legend>
                    <p style="font-size:12px;color:var(--muted);margin-bottom:10px">
                        Copia la tabla "C.G. Limits" del manual: para cada peso, el límite
                        delantero y trasero <strong>en pulgadas</strong>. Si el manual solo trae
                        gráfico, lee 3–4 puntos (pesos bajo, medio y máximo). El gráfico de la
                        envolvente se dibuja automáticamente con estos puntos.</p>
                    <div class="pb-input-group"><label>Categoría</label>
                        <select id="pbf-cat">
                            <option ${envKey === 'Normal' ? 'selected' : ''}>Normal</option>
                            <option ${envKey === 'Utilitaria' ? 'selected' : ''}>Utilitaria</option>
                        </select></div>
                    <div id="pbf-env">${envRows.map(envRow).join('')}</div>
                    <button type="button" class="btn-link" id="pbf-add-env">+ Agregar punto</button>
                </fieldset>

                <button class="pb-calc-btn" id="pbf-save">${isEdit ? 'Guardar cambios' : 'Crear aeronave'}</button>
                <p style="font-size:11px;color:var(--muted);text-align:center;margin-top:10px">
                    ⚠ Verifica los datos contra el manual y el último informe de masa y
                    centrado de la aeronave. Este cálculo no reemplaza al del fabricante.</p>
            </div>`;

        el.querySelector('#pbf-back').addEventListener('click', () => {
            this._formAc = null; this._screen = 'flota'; this.render();
        });
        el.querySelectorAll('input[name="pbf-mode"]').forEach(r => r.addEventListener('change', () => {
            const cg = el.querySelector('input[name="pbf-mode"]:checked').value === 'cg';
            el.querySelector('#pbf-moment-wrap').style.display = cg ? 'none' : '';
            el.querySelector('#pbf-cg-wrap').style.display = cg ? '' : 'none';
        }));
        const wireRowDel = () => {
            el.querySelectorAll('.pbf-st-del, .pbf-env-del').forEach(b => {
                b.onclick = () => b.parentElement.remove();
            });
        };
        wireRowDel();
        el.querySelector('#pbf-add-st').addEventListener('click', () => {
            el.querySelector('#pbf-stations').insertAdjacentHTML('beforeend', stRow());
            wireRowDel();
        });
        el.querySelector('#pbf-add-env').addEventListener('click', () => {
            el.querySelector('#pbf-env').insertAdjacentHTML('beforeend', envRow());
            wireRowDel();
        });
        el.querySelector('#pbf-save').addEventListener('click', () => this._saveForm(el));
    },

    async _saveForm(el) {
        const err = (msg) => {
            const p = el.querySelector('#pbf-error');
            p.textContent = msg; p.style.display = 'block';
            p.scrollIntoView({ behavior: 'smooth', block: 'center' });
        };
        const num = (sel, ctx) => parseFloat((ctx || el).querySelector(sel)?.value);
        const DUPLICATE_MSG = (r) => `Ya existe una aeronave con la matrícula ${r} en el catálogo o la comunidad. ` +
            `Si es un error, escribe a soporte: info@bitacoradevuelo.cl`;

        const rawName = el.querySelector('#pbf-name').value.trim();
        if (!rawName) return err('Ingresa la marca y modelo.');
        const name = this._normalizeMakeModel(rawName);

        const reg = el.querySelector('#pbf-reg').value.trim().toUpperCase();
        const isPublic = !!el.querySelector('#pbf-public')?.checked;
        if (reg && !this._validReg(reg)) {
            return err(`Matrícula "${reg}" inválida. Formato: prefijo OACI con guion (CC-ABC, LV-X123) o número N sin guion (N1234AB).`);
        }
        if (isPublic && !reg) return err('Para compartir con la comunidad la aeronave necesita matrícula válida.');
        if (reg) {
            const dup = this._findDuplicateRegistration(reg, this._formAc?.id);
            if (dup) return err(DUPLICATE_MSG(reg));
        }
        if (isPublic && reg) {
            const saveBtn = el.querySelector('#pbf-save');
            saveBtn.disabled = true; saveBtn.textContent = 'Verificando matrícula…';
            const cloudDup = await this._checkPublicRegistrationCloud(reg, this._formAc?.id);
            saveBtn.disabled = false; saveBtn.textContent = this._formAc ? 'Guardar cambios' : 'Crear aeronave';
            if (cloudDup) return err(DUPLICATE_MSG(reg));
        }

        const mode = el.querySelector('input[name="pbf-mode"]:checked').value;
        const ew = num('#pbf-ew');
        if (!(ew > 0)) return err('Peso vacío inválido.');
        let em;
        if (mode === 'cg') {
            const ecg = num('#pbf-ecg');
            if (!(ecg > 0)) return err('CG vacío inválido.');
            em = ecg * ew;
        } else {
            em = num('#pbf-em');
            if (!(em > 0)) return err('Momento vacío inválido.');
            // sanity: CG resultante debe ser plausible (1–500 in)
        }
        const cgVacio = em / ew;
        if (cgVacio < 1 || cgVacio > 500) return err(`Revisa peso/momento: el CG vacío resultante (${cgVacio.toFixed(1)} in) no es plausible.`);
        const mtow = num('#pbf-mtow');
        if (!(mtow > ew)) return err('MTOW debe ser mayor que el peso vacío.');
        const dens = num('#pbf-dens') || 6;

        // Estaciones
        const stations = [];
        let fuelCount = 0;
        for (const row of el.querySelectorAll('.pbf-st-row')) {
            const stName = row.querySelector('.pbf-st-name').value.trim();
            const arm = parseFloat(row.querySelector('.pbf-st-arm').value);
            const type = row.querySelector('.pbf-st-type').value;
            const max = parseFloat(row.querySelector('.pbf-st-max').value);
            if (!stName && isNaN(arm)) continue; // fila vacía
            if (!stName) return err('Toda estación necesita nombre.');
            if (isNaN(arm)) return err(`Falta el brazo de "${stName}".`);
            const id = 'st' + stations.length + '_' + stName.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 16);
            const st = { name: stName, arm_in: arm, id, type };
            if (type === 'paired_fuel') { st.max_gallons = max > 0 ? max : 999; fuelCount++; st.id = fuelCount === 1 ? 'fuel' : st.id; }
            else if (type === 'single_weight') { st.default_value = max > 0 ? max : 0; }
            else if (max > 0) st.max_lbs = max;
            stations.push(st);
        }
        if (!stations.length) return err('Agrega al menos una estación.');

        // Envolvente
        const env = [];
        for (const row of el.querySelectorAll('.pbf-env-row')) {
            const w = parseFloat(row.querySelector('.pbf-env-w').value);
            const f = parseFloat(row.querySelector('.pbf-env-f').value);
            const a = parseFloat(row.querySelector('.pbf-env-a').value);
            if (isNaN(w) && isNaN(f) && isNaN(a)) continue;
            if (isNaN(w) || isNaN(f) || isNaN(a)) return err('Cada punto de envolvente necesita peso, límite delantero y trasero.');
            if (f >= a) return err(`En el punto de ${w} lbs, el límite delantero (${f}) debe ser menor que el trasero (${a}).`);
            env.push({ weight: w, fwd_in: f, aft_in: a });
        }
        if (env.length < 2) return err('La envolvente necesita al menos 2 puntos (ej: peso mínimo y MTOW).');
        env.sort((x, y) => x.weight - y.weight);

        const cat = el.querySelector('#pbf-cat').value;
        const limits = { maxTakeOffWeight_lbs: mtow, defaultCategory: cat };
        limits[cat === 'Utilitaria' ? 'cgEnvelopeUtility' : 'cgEnvelopeNormal'] = env;

        const ac = {
            id: this._formAc?.id || 'u_' + Date.now().toString(36),
            source: 'custom',
            name,
            registration: reg,
            category: 'Personalizada',
            tipoAvion: el.querySelector('#pbf-tipo').value,
            isPublic,
            envelopeMode: mode,
            emptyWeight_lbs: ew,
            emptyMoment_lb_in: em,
            fuel_gallons_per_lbs: 1 / dens,
            stations,
            limits,
        };

        this._persistCustom(ac);
        this._formAc = null;
        this._screen = 'flota';
        this.render();
    },

    _stationInputHTML(st) {
        if (st.type === 'single_weight') {
            return `
                <div class="pb-input-group">
                    <label>${this._esc(st.name)}</label>
                    <div class="pb-unit-wrap">
                        <input type="text" id="pb-${st.id}" data-arm="${st.arm_in}"
                               value="${st.default_value ?? ''}" placeholder="lbs">
                        <span class="pb-unit-suffix">lbs</span>
                    </div>
                    <span class="pb-arm-info">Brazo: ${st.arm_in.toFixed(1)} in</span>
                </div>`;
        }
        if (st.type === 'paired_weight') {
            const maxStr = st.max_lbs ? `Max ${st.max_lbs}` : 'lbs';
            const maxKg = st.max_lbs ? (st.max_lbs * this._LBS_KG).toFixed(1) : '';
            return `
                <div class="pb-input-group">
                    <label>${this._esc(st.name)}</label>
                    <div class="pb-pair">
                        <div class="pb-unit-wrap">
                            <input type="text" id="pb-${st.id}-lbs" data-arm="${st.arm_in}"
                                   placeholder="${maxStr}" ${st.max_lbs ? `data-max="${st.max_lbs}"` : ''}>
                            <span class="pb-unit-suffix">lbs</span>
                        </div>
                        <div class="pb-unit-wrap">
                            <input type="text" id="pb-${st.id}-kg"
                                   placeholder="${maxKg ? 'Max '+maxKg : 'kg'}">
                            <span class="pb-unit-suffix">kg</span>
                        </div>
                    </div>
                    <span class="pb-arm-info">Brazo: ${st.arm_in.toFixed(1)} in</span>
                </div>`;
        }
        if (st.type === 'paired_fuel') {
            const maxGal = st.max_gallons;
            const maxLtr = maxGal ? (maxGal * this._GAL_LTR).toFixed(1) : '';
            return `
                <div class="pb-input-group">
                    <label>${this._esc(st.name)}</label>
                    <div class="pb-pair">
                        <div class="pb-unit-wrap">
                            <input type="number" id="pb-${st.id}-gal" data-arm="${st.arm_in}"
                                   min="0" ${maxGal ? `max="${maxGal}"` : ''}
                                   placeholder="${maxGal ? '0–'+maxGal : 'gal'}">
                            <span class="pb-unit-suffix">gal</span>
                        </div>
                        <div class="pb-unit-wrap">
                            <input type="number" id="pb-${st.id}-ltr"
                                   min="0" ${maxLtr ? `max="${maxLtr}"` : ''}
                                   placeholder="${maxLtr ? '0–'+maxLtr : 'ltr'}">
                            <span class="pb-unit-suffix">ltr</span>
                        </div>
                    </div>
                    <span class="pb-arm-info">Brazo: ${st.arm_in.toFixed(1)} in</span>
                </div>`;
        }
        return '';
    },

    _setupSyncInputs(el) {
        // Pair: lbs ↔ kg
        el.querySelectorAll('[id$="-lbs"]').forEach(lbsInput => {
            const base = lbsInput.id.replace(/^pb-/, '').replace(/-lbs$/, '');
            const kgInput = el.querySelector(`#pb-${base}-kg`);
            if (!kgInput) return;
            const maxLbs = parseFloat(lbsInput.dataset.max) || Infinity;

            lbsInput.addEventListener('input', () => {
                let v = parseFloat(lbsInput.value);
                if (isNaN(v) || v < 0) { kgInput.value = ''; return; }
                if (v > maxLbs) { v = maxLbs; lbsInput.value = v.toFixed(1); }
                kgInput.value = (v * this._LBS_KG).toFixed(1);
            });
            lbsInput.addEventListener('blur', () => this._evalSum(lbsInput));

            kgInput.addEventListener('input', () => {
                let v = parseFloat(kgInput.value);
                if (isNaN(v) || v < 0) { lbsInput.value = ''; return; }
                const lbs = v / this._LBS_KG;
                if (lbs > maxLbs) { lbsInput.value = maxLbs.toFixed(1); kgInput.value = (maxLbs * this._LBS_KG).toFixed(1); return; }
                lbsInput.value = lbs.toFixed(1);
            });
            kgInput.addEventListener('blur', () => this._evalSum(kgInput));
        });

        // Pair: gal ↔ ltr
        el.querySelectorAll('[id$="-gal"]').forEach(galInput => {
            const base = galInput.id.replace(/^pb-/, '').replace(/-gal$/, '');
            const ltrInput = el.querySelector(`#pb-${base}-ltr`);
            if (!ltrInput) return;
            const maxGal = parseFloat(galInput.max) || Infinity;

            galInput.addEventListener('input', () => {
                let v = parseFloat(galInput.value);
                if (isNaN(v) || v < 0) { ltrInput.value = ''; return; }
                if (v > maxGal) { v = maxGal; galInput.value = v.toFixed(1); }
                ltrInput.value = (v * this._GAL_LTR).toFixed(1);
            });
            ltrInput.addEventListener('input', () => {
                let v = parseFloat(ltrInput.value);
                if (isNaN(v) || v < 0) { galInput.value = ''; return; }
                const g = v / this._GAL_LTR;
                if (g > maxGal) { galInput.value = maxGal.toFixed(1); ltrInput.value = (maxGal * this._GAL_LTR).toFixed(1); return; }
                galInput.value = g.toFixed(1);
            });
        });
    },

    _evalSum(input) {
        const v = input.value.trim();
        if (v.includes('+') && v.length > 1) {
            const sum = v.split('+').reduce((t, s) => t + (parseFloat(s) || 0), 0);
            input.value = sum.toFixed(1);
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    },

    // ── Gating Free/Pro ──
    // Free: 1 aeronave por día (recalcular la misma aeronave el mismo día es
    // parte del mismo "uso" — ajustar pesos no quema el cupo). Pro: ilimitado.
    _checkDailyLimit(ac) {
        if (typeof plan !== 'undefined' && plan.isPro()) return true;
        const today = new Date().toISOString().split('T')[0];
        let use = {};
        try { use = JSON.parse(localStorage.getItem('_pbDailyUse') || '{}'); } catch {}
        if (use.date === today && use.acId && use.acId !== ac.id) {
            if (typeof plan !== 'undefined' && plan.showUpgradeScreen) plan.showUpgradeScreen();
            else if (typeof ui !== 'undefined') ui.showNotification('Plan Free: 1 aeronave por día en Peso y Balance. Hazte Pro para uso ilimitado.', 'error');
            return false;
        }
        localStorage.setItem('_pbDailyUse', JSON.stringify({ date: today, acId: ac.id }));
        return true;
    },

    // ── Calculation ──
    _calculate(el, ac) {
        const resultsEl = el.querySelector('#pb-results');
        if (!resultsEl) return;
        if (!this._checkDailyLimit(ac)) return;

        let totalW = ac.emptyWeight_lbs;
        let totalMoment = ac.emptyMoment_lb_in;
        let zfW = ac.emptyWeight_lbs;
        let zfMoment = ac.emptyMoment_lb_in;
        let fuelW = 0, fuelMoment = 0;
        const breakdown = [{ name: 'Peso Vacío', w: ac.emptyWeight_lbs, m: ac.emptyMoment_lb_in }];

        ac.stations.forEach(st => {
            let itemW = 0, itemM = 0;
            if (st.type === 'single_weight') {
                itemW = parseFloat(el.querySelector(`#pb-${st.id}`)?.value) || 0;
                itemM = itemW * st.arm_in;
                zfW += itemW; zfMoment += itemM;
            } else if (st.type === 'paired_weight') {
                itemW = parseFloat(el.querySelector(`#pb-${st.id}-lbs`)?.value) || 0;
                if (st.max_lbs && itemW > st.max_lbs) itemW = st.max_lbs;
                itemM = itemW * st.arm_in;
                zfW += itemW; zfMoment += itemM;
            } else if (st.type === 'paired_fuel') {
                const gal = parseFloat(el.querySelector(`#pb-${st.id}-gal`)?.value) || 0;
                itemW = gal / ac.fuel_gallons_per_lbs;
                itemM = itemW * st.arm_in;
                fuelW += itemW; fuelMoment += itemM;
            }
            breakdown.push({ name: st.name, w: itemW, m: itemM, isFuel: st.type === 'paired_fuel' });
        });

        totalW = zfW + fuelW;
        totalMoment = zfMoment + fuelMoment;
        const cg = totalW > 0 ? totalMoment / totalW : 0;
        const moment1000 = totalMoment / 1000;

        // Baggage combined check
        const warnings = [];
        if (ac.limits?.maxCombinedBaggage_lbs) {
            const b1 = parseFloat(el.querySelector('#pb-baggage1-lbs')?.value) || 0;
            const b2 = parseFloat(el.querySelector('#pb-baggage2-lbs')?.value) || 0;
            if (b1 + b2 > ac.limits.maxCombinedBaggage_lbs) {
                warnings.push(`Equipaje combinado (${(b1+b2).toFixed(1)} lbs) excede el límite de ${ac.limits.maxCombinedBaggage_lbs} lbs.`);
            }
        }

        const { msgs, category, ok } = this._checkLimits(ac, totalW, cg);

        // Max fuel
        const fuelStation = ac.stations.find(s => s.type === 'paired_fuel');
        let maxFuelHTML = '';
        if (fuelStation) {
            const maxCap = fuelStation.max_gallons / ac.fuel_gallons_per_lbs;
            const avail = Math.max(0, (ac.limits.maxTakeOffWeight_lbs || 0) - zfW);
            const maxFuelLbs = Math.min(avail, maxCap);
            const maxFuelGal = maxFuelLbs * ac.fuel_gallons_per_lbs;
            maxFuelHTML = `
                <div class="pb-max-fuel">
                    <div class="pb-max-fuel-title">Combustible máximo cargable</div>
                    <div class="pb-max-fuel-vals">
                        <span>${maxFuelLbs.toFixed(1)} lbs</span>
                        <span>${maxFuelGal.toFixed(1)} gal</span>
                        <span>${(maxFuelGal * this._GAL_LTR).toFixed(1)} ltr</span>
                    </div>
                    ${avail > maxCap ? `<div class="pb-max-fuel-warning">Limitado por capacidad del tanque (${fuelStation.max_gallons} gal).</div>` : ''}
                </div>`;
        }

        const breakdownHTML = breakdown.map(b =>
            `<div class="pb-breakdown-row">
                <span class="pb-breakdown-name">${this._esc(b.name)}</span>
                <div class="pb-breakdown-vals">
                    <span class="pb-breakdown-w">${b.w.toFixed(1)} lbs</span>
                    <span class="pb-breakdown-m">${(b.m/1000).toFixed(2)}</span>
                </div>
             </div>`
        ).join('');

        const statusHTML = [...warnings.map(w => `<p class="status-warning">${this._esc(w)}</p>`),
            ...msgs].join('');

        resultsEl.innerHTML = `
            <div class="pb-result-card">
                <div class="pb-result-title">Resultado</div>
                <div class="pb-result-row">
                    <span class="pb-result-label">Peso ZFW</span>
                    <span class="pb-result-value">${zfW.toFixed(1)} lbs / ${(zfW*this._LBS_KG).toFixed(1)} kg</span>
                </div>
                <div class="pb-result-row">
                    <span class="pb-result-label">Peso Total (TOW)</span>
                    <span class="pb-result-value highlight">${totalW.toFixed(1)} lbs / ${(totalW*this._LBS_KG).toFixed(1)} kg</span>
                </div>
                <div class="pb-result-row">
                    <span class="pb-result-label">Momento / 1000</span>
                    <span class="pb-result-value">${moment1000.toFixed(2)} lb·in</span>
                </div>
                <div class="pb-result-row">
                    <span class="pb-result-label">CG calculado</span>
                    <span class="pb-result-value highlight">${cg.toFixed(2)} in</span>
                </div>
                <div class="pb-result-row">
                    <span class="pb-result-label">Categoría</span>
                    <span class="pb-result-value" style="color:${ok?'var(--green)':'var(--red)'}">${this._esc(category)}</span>
                </div>
            </div>
            <div class="pb-status-messages">${statusHTML}</div>
            ${maxFuelHTML}
            <div class="pb-result-card">
                <div class="pb-result-title">Desglose por estación</div>
                ${breakdownHTML}
            </div>
            <button class="pb-chart-toggle" id="pb-toggle-chart">Ver gráfica envolvente CG</button>
            <div class="pb-chart-container" id="pb-chart-wrap">
                <canvas id="pb-cg-canvas"></canvas>
            </div>`;

        el.querySelector('#pb-toggle-chart').addEventListener('click', (e) => {
            const wrap = el.querySelector('#pb-chart-wrap');
            const visible = wrap.classList.toggle('visible');
            e.target.textContent = visible ? 'Ocultar gráfica' : 'Ver gráfica envolvente CG';
            if (visible) this._drawChart(ac, totalW, moment1000, cg);
        });

        resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    _checkLimits(ac, weight, cg) {
        const msgs = [];
        const addMsg = (text, type, bold) => {
            const style = bold ? 'font-weight:700;font-size:14px;' : '';
            msgs.push(`<p class="status-${type}" style="${style}">${this._esc(text)}</p>`);
        };

        if (weight > (ac.limits.maxTakeOffWeight_lbs || Infinity)) {
            addMsg(`ERROR: Peso (${weight.toFixed(1)} lbs) excede MTOW (${ac.limits.maxTakeOffWeight_lbs} lbs).`, 'error');
        } else {
            addMsg(`Peso (${weight.toFixed(1)} lbs) dentro del MTOW (${ac.limits.maxTakeOffWeight_lbs} lbs).`, 'ok');
        }

        let category = 'Fuera de Límites';
        let ok = false;

        const tryEnvelope = (env, label) => {
            const { fwdLimit, aftLimit } = this._getCGLimits(env, weight);
            if (fwdLimit === null) return false;
            if (cg >= fwdLimit && cg <= aftLimit) {
                addMsg(`CG (${cg.toFixed(2)} in) dentro de Cat. ${label} (${fwdLimit.toFixed(2)}–${aftLimit.toFixed(2)} in).`, 'ok');
                return true;
            } else {
                const dir = cg < fwdLimit ? 'demasiado adelante' : 'demasiado atrás';
                addMsg(`CG (${cg.toFixed(2)} in) fuera de Cat. ${label} — ${dir}. Límites: ${fwdLimit.toFixed(2)}–${aftLimit.toFixed(2)} in.`, 'error');
                return false;
            }
        };

        if (ac.limits.cgEnvelopeUtility) {
            const withinWeight = !ac.limits.maxUtilityWeight_lbs || weight <= ac.limits.maxUtilityWeight_lbs;
            if (withinWeight && tryEnvelope(ac.limits.cgEnvelopeUtility, 'Utilitaria')) {
                category = 'Utilitaria'; ok = true;
            }
        }

        if (!ok && ac.limits.cgEnvelopeNormal) {
            if (tryEnvelope(ac.limits.cgEnvelopeNormal, 'Normal')) {
                category = 'Normal'; ok = true;
            }
        }

        addMsg(ok ? `AVIÓN DENTRO DE LÍMITES — Categoría ${category}.` : 'AVIÓN FUERA DE LÍMITES. NO DESPEGAR.',
               ok ? 'ok' : 'error', true);

        return { msgs, category, ok };
    },

    _getCGLimits(env, weight) {
        if (!env || !env.length) return { fwdLimit: null, aftLimit: null };
        const sorted = [...env].sort((a, b) => a.weight - b.weight);
        if (weight <= sorted[0].weight) return { fwdLimit: sorted[0].fwd_in, aftLimit: sorted[0].aft_in };
        if (weight >= sorted[sorted.length-1].weight) {
            const last = sorted[sorted.length-1];
            return { fwdLimit: last.fwd_in, aftLimit: last.aft_in };
        }
        for (let i = 0; i < sorted.length-1; i++) {
            const p1 = sorted[i], p2 = sorted[i+1];
            if (weight >= p1.weight && weight <= p2.weight) {
                const r = (weight - p1.weight) / (p2.weight - p1.weight);
                return { fwdLimit: p1.fwd_in + r*(p2.fwd_in-p1.fwd_in), aftLimit: p1.aft_in + r*(p2.aft_in-p1.aft_in) };
            }
        }
        return { fwdLimit: null, aftLimit: null };
    },

    // Deriva el polígono de la envolvente desde la tabla de límites de CG:
    // sube por el límite delantero y baja por el trasero. En modo 'cg' el eje
    // X es la posición del CG en pulgadas; en 'moment' es momento/1000.
    _envPolygon(env, mode) {
        const s = [...env].sort((a, b) => a.weight - b.weight);
        const xf = p => mode === 'cg' ? p.fwd_in : p.fwd_in * p.weight / 1000;
        const xa = p => mode === 'cg' ? p.aft_in : p.aft_in * p.weight / 1000;
        const up = s.map(p => ({ x: xf(p), y: p.weight }));
        const down = [...s].reverse().map(p => ({ x: xa(p), y: p.weight }));
        return [...up, ...down, { ...up[0] }];
    },

    _drawChart(ac, weight, moment1000, cg) {
        const canvas = document.getElementById('pb-cg-canvas');
        if (!canvas) return;
        if (this._cgChart) { try { this._cgChart.destroy(); } catch {} this._cgChart = null; }

        const mode = ac.envelopeMode === 'cg' ? 'cg' : 'moment';
        const ctx = canvas.getContext('2d');
        const datasets = [];
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

        const track = (data) => data.forEach(p => {
            if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
        });

        // Polígonos: usa el gráfico dibujado a mano si existe (catálogo en modo
        // momento); si no, lo deriva de la tabla de límites (aeronaves propias).
        const utilPoly = mode === 'moment'
            ? (ac.limits.cgEnvelopeGraphUtility || (ac.limits.cgEnvelopeUtility && this._envPolygon(ac.limits.cgEnvelopeUtility, 'moment')))
            : (ac.limits.cgEnvelopeUtility && this._envPolygon(ac.limits.cgEnvelopeUtility, 'cg'));
        const normPoly = mode === 'moment'
            ? (ac.limits.cgEnvelopeGraphNormal || (ac.limits.cgEnvelopeNormal && this._envPolygon(ac.limits.cgEnvelopeNormal, 'moment')))
            : (ac.limits.cgEnvelopeNormal && this._envPolygon(ac.limits.cgEnvelopeNormal, 'cg'));

        if (utilPoly) {
            track(utilPoly);
            const g = ctx.createLinearGradient(0, 0, 0, 260);
            g.addColorStop(0, 'rgba(212,175,55,0.30)'); g.addColorStop(1, 'rgba(212,175,55,0.04)');
            datasets.push({ label:'Cat. Utilitaria', data: utilPoly,
                borderColor:'#D4AF37', backgroundColor: g, borderWidth:2, fill:true, pointRadius:0, tension:0 });
        }
        if (normPoly) {
            track(normPoly);
            const g = ctx.createLinearGradient(0, 0, 0, 260);
            g.addColorStop(0, 'rgba(180,180,180,0.18)'); g.addColorStop(1, 'rgba(180,180,180,0.02)');
            datasets.push({ label:'Cat. Normal', data: normPoly,
                borderColor:'rgba(200,200,200,0.7)', backgroundColor: g, borderWidth:1.5,
                borderDash:[6,3], fill:true, pointRadius:0, tension:0 });
        }
        const px = mode === 'cg' ? cg : moment1000;
        if (weight > 0 && isFinite(px)) {
            track([{ x: px, y: weight }]);
            datasets.push({ label:'CG Calculado', data:[{ x: px, y: weight }],
                borderColor:'#fff', backgroundColor:'#ef4444',
                pointRadius:8, pointHoverRadius:10, pointStyle:'crossRot', borderWidth:2.5, type:'scatter' });
        }

        const step = mode === 'cg' ? 1 : 5;
        const xPad = Math.max(mode === 'cg' ? 1 : 5, (maxX-minX)*0.06);
        const xMin = Math.floor((minX-xPad)/step)*step;
        const xMax = Math.ceil((maxX+xPad)/step)*step;
        const yMin = Math.max(0, Math.floor(minY/50)*50);
        const effMax = Math.max(maxY, ac.limits.maxTakeOffWeight_lbs || 0);
        const yMax = Math.ceil((effMax + 100)/50)*50;

        this._cgChart = new Chart(ctx, {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                animation: { duration: 300 },
                scales: {
                    x: { type:'linear', position:'bottom', min: xMin, max: xMax,
                        title:{ display:true, text: mode === 'cg' ? 'Posición CG (in)' : 'Momento / 1000 (lb·in)', color:'#888', font:{size:11} },
                        ticks:{ color:'#555', font:{size:11}, maxTicksLimit:8 },
                        grid:{ color:'rgba(255,255,255,0.06)' } },
                    y: { type:'linear', min: yMin, max: yMax,
                        title:{ display:true, text:'Peso (lbs)', color:'#888', font:{size:11} },
                        ticks:{ color:'#555', font:{size:11}, maxTicksLimit:7 },
                        grid:{ color:'rgba(255,255,255,0.06)' } }
                },
                plugins: {
                    legend: { labels:{ color:'#888', font:{size:11} } },
                    tooltip: { callbacks: {
                        label: ctx => `${ctx.dataset.label}: (${ctx.parsed.x.toFixed(2)}, ${ctx.parsed.y.toFixed(0)} lbs)`
                    }}
                }
            }
        });
    },

    _esc(s) {
        return String(s || '')
            .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;');
    }
};
