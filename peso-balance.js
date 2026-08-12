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
            this._syncFleetAddToCloud(id);
        }
    },
    _removeFromFlota(id) {
        this._saveFlota(this._getFlota().filter(f => f.id !== id));
        this._syncFleetRemoveFromCloud(id);
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

            // Picks simples del catálogo/comunidad ("agregar a mi flota", source:'db') → wb_fleet
            const { data: fleetRows, error: fleetErr } = await supabaseClient.from('wb_fleet')
                .select('aircraft_id').eq('user_id', userId);
            if (!fleetErr && fleetRows) {
                const flota2 = this._getFlota();
                let changed = false;
                for (const row of fleetRows) {
                    if (!flota2.some(f => f.id === row.aircraft_id)) {
                        flota2.push({ id: row.aircraft_id, source: 'db' });
                        changed = true;
                    }
                }
                if (changed) this._saveFlota(flota2);
                // picks locales que no están en la nube (agregados sin conexión) → subir
                const cloudFleetIds = new Set(fleetRows.map(r => r.aircraft_id));
                for (const f of flota2) {
                    if (f.source !== 'custom' && !cloudFleetIds.has(f.id)) this._syncFleetAddToCloud(f.id);
                }
            }

            if (this._screen === 'flota' || this._screen === 'db') this.render();
        } catch (e) { console.warn('[P&B] carga de aeronaves desde la nube falló:', e); }
    },

    async _syncFleetAddToCloud(id) {
        if (typeof supabaseClient === 'undefined' || !supabaseClient || !navigator.onLine) return;
        const userId = api._getUserId?.();
        if (!userId) return;
        try {
            const { error } = await supabaseClient.from('wb_fleet')
                .upsert({ user_id: userId, aircraft_id: id }, { onConflict: 'user_id,aircraft_id' });
            if (error) console.warn('[P&B] sync de flota (agregar) a la nube falló:', error);
        } catch (e) { console.warn('[P&B] sync de flota (agregar) a la nube falló:', e); }
    },

    async _syncFleetRemoveFromCloud(id) {
        if (typeof supabaseClient === 'undefined' || !supabaseClient || !navigator.onLine) return;
        const userId = api._getUserId?.();
        if (!userId) return;
        try {
            const { error } = await supabaseClient.from('wb_fleet')
                .delete().eq('user_id', userId).eq('aircraft_id', id);
            if (error) console.warn('[P&B] sync de flota (quitar) a la nube falló:', error);
        } catch (e) { console.warn('[P&B] sync de flota (quitar) a la nube falló:', e); }
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
    // Balance, y la envolvente como lista de VÉRTICES (peso + posición) leídos
    // directamente del gráfico del manual, en el orden en que se recorren. El
    // gráfico de preview se dibuja solo, trazando esos vértices en vivo.
    _renderForm(el) {
        const ac = this._formAc;
        const isEdit = !!ac;
        const mode = ac?.envelopeMode || 'moment';
        // _polygonFor normaliza tanto vértices nuevos {x,y} como la tabla legada
        // peso/fwd_in/aft_in (aeronaves creadas antes de este formulario).
        const envNormalRaw = ac?.limits?.cgEnvelopeNormal || [];
        const envUtilRaw = ac?.limits?.cgEnvelopeUtility || [];
        const envAcroRaw = ac?.limits?.cgEnvelopeAcrobatic || [];
        const envNormalData = envNormalRaw.length ? this._polygonFor(envNormalRaw, mode) : [];
        const envUtilData = envUtilRaw.length ? this._polygonFor(envUtilRaw, mode) : [];
        const envAcroData = envAcroRaw.length ? this._polygonFor(envAcroRaw, mode) : [];
        const hasUtil = envUtilData.length > 0;
        const hasAcro = envAcroData.length > 0;
        const emptyCg = ac ? (ac.emptyMoment_lb_in / ac.emptyWeight_lbs) : null;
        const lbPerGal = ac ? Math.round(1 / ac.fuel_gallons_per_lbs * 10) / 10 : 6;

        const stations = ac?.stations?.length ? ac.stations : [
            { name: 'Piloto y Pasajero', arm_in: 37.0, id: 'front_pax', type: 'paired_weight' },
            { name: 'Combustible Usable (Gal)', arm_in: 48.0, id: 'fuel', type: 'paired_fuel', max_gallons: 40 },
            { name: 'Equipaje', arm_in: 95.0, id: 'baggage1', type: 'paired_weight', max_lbs: 120 },
        ];
        const envNormalRows = envNormalData.length ? envNormalData : [{ x: '', y: '' }, { x: '', y: '' }, { x: '', y: '' }];
        const envUtilRows = envUtilData.length ? envUtilData : [{ x: '', y: '' }, { x: '', y: '' }, { x: '', y: '' }];
        const envAcroRows = envAcroData.length ? envAcroData : [{ x: '', y: '' }, { x: '', y: '' }, { x: '', y: '' }];

        const stRow = (st = {}) => `
            <div class="pbf-st-row" style="display:flex;gap:6px;margin-bottom:6px;align-items:flex-end;flex-wrap:wrap">
                <div class="pbf-field pbf-field-wide" style="flex:2;min-width:150px">
                    <label class="pbf-mini-label">Nombre</label>
                    <input type="text" class="pbf-st-name" placeholder="Ej: Piloto y Pasajero" value="${this._esc(st.name || '')}" style="width:100%;min-width:0">
                </div>
                <div class="pbf-field" style="flex:1;min-width:100px">
                    <label class="pbf-mini-label" title="Distancia en pulgadas desde el datum de referencia del avión (informe de masa y centrado / Weight &amp; Balance del POH)">Brazo (in)</label>
                    <input type="number" class="pbf-st-arm" placeholder="Brazo in" step="0.1" value="${st.arm_in ?? ''}" style="width:100%;min-width:0">
                </div>
                <div class="pbf-field" style="flex:1.4;min-width:130px">
                    <label class="pbf-mini-label">Tipo</label>
                    <select class="pbf-st-type" style="width:100%;min-width:0">
                        <option value="paired_weight" ${st.type !== 'paired_fuel' && st.type !== 'single_weight' ? 'selected' : ''}>Peso (lbs/kg)</option>
                        <option value="paired_fuel" ${st.type === 'paired_fuel' ? 'selected' : ''}>Combustible (gal/l)</option>
                        <option value="single_weight" ${st.type === 'single_weight' ? 'selected' : ''}>Fijo (ej: aceite)</option>
                    </select>
                </div>
                <div class="pbf-field" style="flex:0.9;min-width:90px">
                    <label class="pbf-mini-label" title="Peso: máx lbs · Combustible: capacidad gal · Fijo: valor lbs">Máx</label>
                    <input type="number" class="pbf-st-max" placeholder="Máx" step="0.1"
                           value="${st.type === 'paired_fuel' ? (st.max_gallons ?? '') : st.type === 'single_weight' ? (st.default_value ?? '') : (st.max_lbs ?? '')}"
                           title="Peso: máx lbs · Combustible: capacidad gal · Fijo: valor lbs" style="width:100%;min-width:0">
                </div>
                <button type="button" class="btn-link pbf-st-del" style="color:var(--red)">✕</button>
            </div>`;

        const envXLabel = m => m === 'cg' ? 'Posición CG (in)' : 'Momento/1000 (lb·in)';
        const envXPlaceholder = m => m === 'cg' ? 'CG in' : 'Momento/1000';
        const envRow = (p = {}, rowMode) => `
            <div class="pbf-env-row" style="display:flex;gap:6px;margin-bottom:6px;align-items:flex-end;flex-wrap:wrap">
                <div class="pbf-field" style="flex:1;min-width:100px">
                    <label class="pbf-mini-label">Peso (lbs)</label>
                    <input type="number" class="pbf-env-w" placeholder="Peso lbs" step="1" value="${p.y ?? ''}" style="width:100%;min-width:0">
                </div>
                <div class="pbf-field" style="flex:1.4;min-width:150px">
                    <label class="pbf-mini-label pbf-env-x-label">${envXLabel(rowMode)}</label>
                    <input type="number" class="pbf-env-x" placeholder="${envXPlaceholder(rowMode)}" step="0.01" value="${p.x ?? ''}" style="width:100%;min-width:0">
                </div>
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
                    <div class="pbf-st-head" style="display:flex;gap:6px;margin-bottom:6px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.03em">
                        <span style="flex:2">Nombre</span>
                        <span style="flex:1" title="Distancia en pulgadas desde el datum de referencia del avión (informe de masa y centrado / Weight &amp; Balance del POH)">Brazo (in)</span>
                        <span style="flex:1.4">Tipo</span>
                        <span style="flex:0.9" title="Peso → tope en lbs · Combustible → capacidad en galones · Fijo → valor constante en lbs">Máx (según tipo)</span>
                        <span style="width:22px"></span>
                    </div>
                    <div id="pbf-stations">${stations.map(stRow).join('')}</div>
                    <button type="button" class="btn-link" id="pbf-add-st">+ Agregar estación</button>
                </fieldset>

                <fieldset class="pb-fieldset">
                    <legend>Envolvente CG (vértices del gráfico del manual)</legend>
                    <p style="font-size:12px;color:var(--muted);margin-bottom:10px">
                        Lee los vértices del gráfico "C.G. Envelope" del manual, <strong>en el
                        orden en que los recorre el contorno</strong> (ej: subiendo por el límite
                        delantero y bajando por el trasero), y anota el peso y la posición de
                        cada uno — un punto por vértice, no dos por peso. Así se representan
                        también envolventes con más de dos límites por peso, como suele pasar en
                        categoría Utilitaria. Si el manual solo trae una tabla peso/delantero/trasero,
                        agrega igual dos vértices por fila (uno con cada límite) respetando el orden.
                        Muchos manuales traen dos o tres gráficos — Normal, Utilitaria (límites
                        más estrictos, ej: sin pasajeros traseros) y Acrobática (categoría FAA
                        para maniobras, la más restrictiva) — carga los que tenga tu avión; el
                        gráfico los dibuja juntos para que veas en cuál queda tu carga.
                        La vista previa se va dibujando desde el primer vértice que ingreses.</p>

                    <p style="font-size:12px;font-weight:600;margin-bottom:8px">Categoría Normal</p>
                    <div class="pbf-env-head pbf-env-head-normal" style="display:flex;gap:6px;margin-bottom:6px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.03em">
                        <span style="flex:1">Peso (lbs)</span>
                        <span class="pbf-env-head-x" style="flex:1.4">${envXLabel(mode)}</span>
                        <span style="width:22px"></span>
                    </div>
                    <div id="pbf-env-normal">${envNormalRows.map(p => envRow(p, mode)).join('')}</div>
                    <button type="button" class="btn-link" id="pbf-add-env-normal">+ Agregar vértice</button>

                    <div class="ll-checkbox-row" style="margin:16px 0 4px">
                        <input type="checkbox" id="pbf-has-util" ${hasUtil ? 'checked' : ''}>
                        <label for="pbf-has-util">Este avión también tiene categoría Utilitaria (opcional)</label>
                    </div>
                    <div id="pbf-env-util-block" style="${hasUtil ? '' : 'display:none'};margin-top:10px">
                        <p style="font-size:12px;font-weight:600;margin-bottom:8px">Categoría Utilitaria</p>
                        <div class="pb-input-group"><label>Peso máx. en Utilitaria (lbs, opcional si es igual al MTOW)</label>
                            <input type="number" id="pbf-util-maxw" step="1" value="${ac?.limits?.maxUtilityWeight_lbs ?? ''}"></div>
                        <div class="pbf-env-head pbf-env-head-util" style="display:flex;gap:6px;margin-bottom:6px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.03em">
                            <span style="flex:1">Peso (lbs)</span>
                            <span class="pbf-env-head-x" style="flex:1.4">${envXLabel(mode)}</span>
                            <span style="width:22px"></span>
                        </div>
                        <div id="pbf-env-utility">${envUtilRows.map(p => envRow(p, mode)).join('')}</div>
                        <button type="button" class="btn-link" id="pbf-add-env-utility">+ Agregar vértice</button>
                    </div>

                    <div class="ll-checkbox-row" style="margin:16px 0 4px">
                        <input type="checkbox" id="pbf-has-acro" ${hasAcro ? 'checked' : ''}>
                        <label for="pbf-has-acro">Este avión también tiene categoría Acrobática (opcional)</label>
                    </div>
                    <div id="pbf-env-acro-block" style="${hasAcro ? '' : 'display:none'};margin-top:10px">
                        <p style="font-size:12px;font-weight:600;margin-bottom:8px">Categoría Acrobática</p>
                        <div class="pb-input-group"><label>Peso máx. en Acrobática (lbs, opcional si es igual al MTOW)</label>
                            <input type="number" id="pbf-acro-maxw" step="1" value="${ac?.limits?.maxAcrobaticWeight_lbs ?? ''}"></div>
                        <div class="pbf-env-head pbf-env-head-acro" style="display:flex;gap:6px;margin-bottom:6px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.03em">
                            <span style="flex:1">Peso (lbs)</span>
                            <span class="pbf-env-head-x" style="flex:1.4">${envXLabel(mode)}</span>
                            <span style="width:22px"></span>
                        </div>
                        <div id="pbf-env-acrobatic">${envAcroRows.map(p => envRow(p, mode)).join('')}</div>
                        <button type="button" class="btn-link" id="pbf-add-env-acrobatic">+ Agregar vértice</button>
                    </div>

                    <div style="margin-top:14px">
                        <p style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.03em;margin-bottom:6px">Vista previa</p>
                        <div id="pbf-env-chart-wrap" style="position:relative;height:180px;display:none">
                            <canvas id="pbf-env-canvas"></canvas>
                        </div>
                        <p id="pbf-env-empty" style="font-size:12px;color:var(--muted);text-align:center">Agrega el primer vértice (Normal o Utilitaria) para ver la vista previa.</p>
                    </div>
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
            const liveMode = cg ? 'cg' : 'moment';
            el.querySelectorAll('.pbf-env-x-label, .pbf-env-head-x').forEach(l => l.textContent = envXLabel(liveMode));
            el.querySelectorAll('.pbf-env-x').forEach(i => i.placeholder = envXPlaceholder(liveMode));
            this._updateEnvPreview(el);
        }));
        const wireRowDel = () => {
            el.querySelectorAll('.pbf-st-del').forEach(b => {
                b.onclick = () => { b.parentElement.remove(); };
            });
            el.querySelectorAll('.pbf-env-del').forEach(b => {
                b.onclick = () => {
                    const container = b.closest('.pbf-env-row').parentElement;
                    b.parentElement.remove();
                    // nunca deja la lista en 0 filas: sin ninguna fila visible, el
                    // link "+ Agregar vértice" (debajo del contenedor) queda pegado
                    // al checkbox/leyenda de arriba y es fácil no verlo — se repone
                    // una fila vacía en su lugar, siempre queda algo para borrar/editar.
                    if (!container.querySelector('.pbf-env-row')) {
                        container.insertAdjacentHTML('beforeend', envRow({}, liveMode()));
                        wireRowDel();
                    }
                    this._updateEnvPreview(el);
                };
            });
        };
        wireRowDel();
        el.querySelector('#pbf-add-st').addEventListener('click', () => {
            el.querySelector('#pbf-stations').insertAdjacentHTML('beforeend', stRow());
            wireRowDel();
        });
        const liveMode = () => el.querySelector('input[name="pbf-mode"]:checked').value;
        el.querySelector('#pbf-add-env-normal').addEventListener('click', () => {
            el.querySelector('#pbf-env-normal').insertAdjacentHTML('beforeend', envRow({}, liveMode()));
            wireRowDel();
            this._updateEnvPreview(el);
        });
        el.querySelector('#pbf-add-env-utility').addEventListener('click', () => {
            el.querySelector('#pbf-env-utility').insertAdjacentHTML('beforeend', envRow({}, liveMode()));
            wireRowDel();
            this._updateEnvPreview(el);
        });
        el.querySelector('#pbf-add-env-acrobatic').addEventListener('click', () => {
            el.querySelector('#pbf-env-acrobatic').insertAdjacentHTML('beforeend', envRow({}, liveMode()));
            wireRowDel();
            this._updateEnvPreview(el);
        });
        el.querySelector('#pbf-has-util').addEventListener('change', (e) => {
            el.querySelector('#pbf-env-util-block').style.display = e.target.checked ? '' : 'none';
            this._updateEnvPreview(el);
        });
        el.querySelector('#pbf-has-acro').addEventListener('change', (e) => {
            el.querySelector('#pbf-env-acro-block').style.display = e.target.checked ? '' : 'none';
            this._updateEnvPreview(el);
        });
        el.querySelector('#pbf-env-normal').addEventListener('input', () => this._updateEnvPreview(el));
        el.querySelector('#pbf-env-utility').addEventListener('input', () => this._updateEnvPreview(el));
        el.querySelector('#pbf-env-acrobatic').addEventListener('input', () => this._updateEnvPreview(el));
        el.querySelector('#pbf-save').addEventListener('click', () => this._saveForm(el));
        this._updateEnvPreview(el);
    },

    // Lee los vértices válidos (peso+posición) de una tabla de envolvente en el form,
    // preservando el orden de las filas — es el orden en que se traza el polígono.
    _readEnvTable(el, containerSel) {
        const env = [];
        for (const row of el.querySelectorAll(`${containerSel} .pbf-env-row`)) {
            const w = parseFloat(row.querySelector('.pbf-env-w').value);
            const x = parseFloat(row.querySelector('.pbf-env-x').value);
            if (isNaN(w) || isNaN(x)) continue;
            env.push({ x, y: w });
        }
        return env;
    },

    // Dibuja en vivo ambas categorías (Normal + Utilitaria si está activada) superpuestas
    // en el mismo gráfico, igual que la vista de resultados final (_drawChart). Se traza
    // con lo que haya: 1 vértice = solo el punto, 2 = línea abierta, 3+ = contorno cerrado
    // (vuelve al primer vértice) con relleno — el preview crece a medida que se agregan.
    _updateEnvPreview(el) {
        const envNormal = this._readEnvTable(el, '#pbf-env-normal');
        const envUtil = el.querySelector('#pbf-has-util').checked ? this._readEnvTable(el, '#pbf-env-utility') : [];
        const envAcro = el.querySelector('#pbf-has-acro').checked ? this._readEnvTable(el, '#pbf-env-acrobatic') : [];

        const wrap = el.querySelector('#pbf-env-chart-wrap');
        const empty = el.querySelector('#pbf-env-empty');
        if (this._envPreviewChart) { try { this._envPreviewChart.destroy(); } catch {} this._envPreviewChart = null; }

        const datasets = [];
        const mode = el.querySelector('input[name="pbf-mode"]:checked').value;
        const canvas = el.querySelector('#pbf-env-canvas');
        const ctx = canvas.getContext('2d');
        const previewData = poly => poly.length >= 3 ? [...poly, poly[0]] : poly;

        if (envAcro.length >= 1) {
            const g = ctx.createLinearGradient(0, 0, 0, 180);
            g.addColorStop(0, 'rgba(248,113,113,0.30)'); g.addColorStop(1, 'rgba(248,113,113,0.04)');
            datasets.push({ label: 'Cat. Acrobática', data: previewData(envAcro),
                borderColor: '#f87171', backgroundColor: g, borderWidth: 2, fill: envAcro.length >= 3,
                pointRadius: 4, pointBackgroundColor: '#f87171', tension: 0 });
        }
        if (envUtil.length >= 1) {
            const g = ctx.createLinearGradient(0, 0, 0, 180);
            g.addColorStop(0, 'rgba(212,175,55,0.30)'); g.addColorStop(1, 'rgba(212,175,55,0.04)');
            datasets.push({ label: 'Cat. Utilitaria', data: previewData(envUtil),
                borderColor: '#D4AF37', backgroundColor: g, borderWidth: 2, fill: envUtil.length >= 3,
                pointRadius: 4, pointBackgroundColor: '#D4AF37', tension: 0 });
        }
        if (envNormal.length >= 1) {
            const g = ctx.createLinearGradient(0, 0, 0, 180);
            g.addColorStop(0, 'rgba(180,180,180,0.18)'); g.addColorStop(1, 'rgba(180,180,180,0.02)');
            datasets.push({ label: 'Cat. Normal', data: previewData(envNormal),
                borderColor: 'rgba(200,200,200,0.7)', backgroundColor: g, borderWidth: 1.5,
                borderDash: [6, 3], fill: envNormal.length >= 3, pointRadius: 4,
                pointBackgroundColor: 'rgba(200,200,200,0.9)', tension: 0 });
        }

        if (!datasets.length) {
            wrap.style.display = 'none';
            empty.style.display = 'block';
            return;
        }
        wrap.style.display = 'block';
        empty.style.display = 'none';

        this._envPreviewChart = new Chart(ctx, {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true, maintainAspectRatio: false, animation: { duration: 200 },
                scales: {
                    x: { type: 'linear', position: 'bottom',
                        title: { display: true, text: mode === 'cg' ? 'Posición CG (in)' : 'Momento / 1000 (lb·in)', color: '#888', font: { size: 11 } },
                        ticks: { color: '#555', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.06)' } },
                    y: { type: 'linear',
                        title: { display: true, text: 'Peso (lbs)', color: '#888', font: { size: 11 } },
                        ticks: { color: '#555', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.06)' } }
                },
                plugins: { legend: { display: datasets.length > 1, labels: { color: '#888', font: { size: 11 } } } }
            }
        });
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

        // Envolvente — categoría Normal (obligatoria) + Utilitaria (opcional). Se guarda
        // como polígono de vértices {x,y} en el orden ingresado (orden = orden de trazado,
        // no se reordena por peso: el contorno puede subir, cruzar y bajar libremente).
        const parseEnvTable = (containerSel, label) => {
            const rows = [];
            for (const row of el.querySelectorAll(`${containerSel} .pbf-env-row`)) {
                const w = parseFloat(row.querySelector('.pbf-env-w').value);
                const x = parseFloat(row.querySelector('.pbf-env-x').value);
                if (isNaN(w) && isNaN(x)) continue;
                if (isNaN(w) || isNaN(x)) throw new Error(`Cada vértice de la envolvente ${label} necesita peso y posición.`);
                rows.push({ x, y: w });
            }
            return rows;
        };
        const hasUtilChecked = el.querySelector('#pbf-has-util').checked;
        const hasAcroChecked = el.querySelector('#pbf-has-acro').checked;
        let envNormal, envUtil = [], envAcro = [];
        try {
            envNormal = parseEnvTable('#pbf-env-normal', 'Normal');
            if (hasUtilChecked) envUtil = parseEnvTable('#pbf-env-utility', 'Utilitaria');
            if (hasAcroChecked) envAcro = parseEnvTable('#pbf-env-acrobatic', 'Acrobática');
        } catch (e) {
            return err(e.message);
        }
        if (envNormal.length < 3) return err('La envolvente Normal necesita al menos 3 vértices para formar un polígono (ej: peso mínimo delantero, peso máximo delantero, peso máximo trasero).');
        if (hasUtilChecked && envUtil.length < 3) return err('Marcaste categoría Utilitaria pero le faltan vértices — agrega al menos 3, o desmarca la casilla.');
        if (hasAcroChecked && envAcro.length < 3) return err('Marcaste categoría Acrobática pero le faltan vértices — agrega al menos 3, o desmarca la casilla.');

        const limits = { maxTakeOffWeight_lbs: mtow, cgEnvelopeNormal: envNormal, defaultCategory: 'Normal' };
        if (envUtil.length >= 3) {
            limits.cgEnvelopeUtility = envUtil;
            const utilMaxW = num('#pbf-util-maxw');
            if (utilMaxW > 0) limits.maxUtilityWeight_lbs = utilMaxW;
        }
        if (envAcro.length >= 3) {
            limits.cgEnvelopeAcrobatic = envAcro;
            const acroMaxW = num('#pbf-acro-maxw');
            if (acroMaxW > 0) limits.maxAcrobaticWeight_lbs = acroMaxW;
        }

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

        const { msgs, category, ok } = this._checkLimits(ac, totalW, cg, moment1000);

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

    _checkLimits(ac, weight, cg, moment1000) {
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
        const mode = ac.envelopeMode === 'cg' ? 'cg' : 'moment';
        const x0 = mode === 'cg' ? cg : moment1000;
        const unit = mode === 'cg' ? 'in' : 'mom/1000';
        const label0 = mode === 'cg' ? `CG (${cg.toFixed(2)} in)` : `Momento/1000 (${moment1000.toFixed(2)})`;

        const tryEnvelope = (env, label) => {
            const poly = this._polygonFor(env, mode);
            if (!poly || poly.length < 3) return false;
            const range = this._envelopeXRangeAtWeight(poly, weight);
            if (!range) return false;
            if (x0 >= range.min && x0 <= range.max) {
                addMsg(`${label0} dentro de Cat. ${label} (${range.min.toFixed(2)}–${range.max.toFixed(2)} ${unit}).`, 'ok');
                return true;
            } else {
                const dir = x0 < range.min ? 'demasiado adelante' : 'demasiado atrás';
                addMsg(`${label0} fuera de Cat. ${label} — ${dir}. Límites: ${range.min.toFixed(2)}–${range.max.toFixed(2)} ${unit}.`, 'error');
                return false;
            }
        };

        if (ac.limits.cgEnvelopeAcrobatic) {
            const withinWeight = !ac.limits.maxAcrobaticWeight_lbs || weight <= ac.limits.maxAcrobaticWeight_lbs;
            if (withinWeight && tryEnvelope(ac.limits.cgEnvelopeAcrobatic, 'Acrobática')) {
                category = 'Acrobática'; ok = true;
            }
        }

        if (!ok && ac.limits.cgEnvelopeUtility) {
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

    // Normaliza cualquier envolvente guardada al polígono de vértices {x,y} (y=peso,
    // x=posición en la unidad nativa del modo: in en 'cg', momento/1000 en 'moment').
    // Formato nuevo: ya viene como lista de vértices {x,y} en el orden de trazado.
    // Formato legado (peso/fwd_in/aft_in por fila): se deriva subiendo por el límite
    // delantero y bajando por el trasero, como aproximación del polígono real.
    _polygonFor(env, mode) {
        if (!env || env.length < 2) return null;
        if (env[0].x !== undefined && env[0].y !== undefined) return env;
        const s = [...env].sort((a, b) => a.weight - b.weight);
        const xf = p => mode === 'cg' ? p.fwd_in : p.fwd_in * p.weight / 1000;
        const xa = p => mode === 'cg' ? p.aft_in : p.aft_in * p.weight / 1000;
        const up = s.map(p => ({ x: xf(p), y: p.weight }));
        const down = [...s].reverse().map(p => ({ x: xa(p), y: p.weight }));
        return [...up, ...down];
    },

    // Intersecta la recta horizontal peso=y0 con el perímetro del polígono (cerrado
    // implícitamente entre el último y el primer vértice) y devuelve el rango [min,max]
    // de x cubierto — generaliza "límite delantero/trasero a este peso" a cualquier forma.
    _envelopeXRangeAtWeight(poly, y0) {
        const xs = [];
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const yi = poly[i].y, yj = poly[j].y;
            const xi = poly[i].x, xj = poly[j].x;
            if (yi === yj) {
                if (yi === y0) { xs.push(xi, xj); }
                continue;
            }
            if ((yi <= y0 && yj >= y0) || (yj <= y0 && yi >= y0)) {
                const t = (y0 - yi) / (yj - yi);
                xs.push(xi + t * (xj - xi));
            }
        }
        if (!xs.length) return null;
        return { min: Math.min(...xs), max: Math.max(...xs) };
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

        // Polígonos: cgEnvelopeGraph* (legado, catálogo dibujado a mano) tiene prioridad
        // si existe; si no, se usa el polígono de vértices — o la tabla peso/fwd/aft
        // legada convertida — de cgEnvelope{Normal,Utility}, cerrado sobre el primer vértice.
        const closePoly = poly => (poly && poly.length ? [...poly, poly[0]] : poly);
        const acroPoly = ac.limits.cgEnvelopeGraphAcrobatic
            || (ac.limits.cgEnvelopeAcrobatic && closePoly(this._polygonFor(ac.limits.cgEnvelopeAcrobatic, mode)));
        const utilPoly = ac.limits.cgEnvelopeGraphUtility
            || (ac.limits.cgEnvelopeUtility && closePoly(this._polygonFor(ac.limits.cgEnvelopeUtility, mode)));
        const normPoly = ac.limits.cgEnvelopeGraphNormal
            || (ac.limits.cgEnvelopeNormal && closePoly(this._polygonFor(ac.limits.cgEnvelopeNormal, mode)));

        if (acroPoly) {
            track(acroPoly);
            const g = ctx.createLinearGradient(0, 0, 0, 260);
            g.addColorStop(0, 'rgba(248,113,113,0.30)'); g.addColorStop(1, 'rgba(248,113,113,0.04)');
            datasets.push({ label:'Cat. Acrobática', data: acroPoly,
                borderColor:'#f87171', backgroundColor: g, borderWidth:2, fill:true, pointRadius:0, tension:0 });
        }
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
