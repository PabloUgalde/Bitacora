// =================================================================
// LICENSES-SYSTEM.JS
// Sistema de licencias y habilitaciones DGAC Chile
// Basado en DAR 61 / DAN 61
// Estructura:
//   1. Licencias (con categoría propia)
//   2. Habilitaciones de Clase (independientes)
//   3. Habilitaciones de Función (independientes)
//   4. Habilitaciones Especiales (IFR, Agrícola, etc.)
//   5. Habilitaciones de Tipo (aeronaves específicas)
//   6. Certificado Médico
// =================================================================

const licenseSystem = {

    LICENCIAS: [
        { id: 'AP',   label: 'Alumno Piloto',                         tipo: 'student', catLabel: 'Habilitación de Categoría AP' },
        { id: 'PP',   label: 'Piloto Privado',                        tipo: 'pilot',   catLabel: 'Habilitación de Categoría PP' },
        { id: 'PD',   label: 'Piloto Deportivo',                      tipo: 'pilot',   catLabel: 'Habilitación de Categoría PD' },
        { id: 'PC',   label: 'Piloto Comercial',                      tipo: 'pilot',   catLabel: 'Habilitación de Categoría PC' },
        { id: 'PTLA', label: 'Piloto de Transporte de Línea Aérea',   tipo: 'pilot',   catLabel: 'Habilitación de Categoría PTLA' },
        { id: 'PPL',  label: 'Piloto de Planeador',                   tipo: 'pilot',   catLabel: null },
        { id: 'PGL',  label: 'Piloto Globo Libre',                    tipo: 'pilot',   catLabel: null },
        { id: 'UL',   label: 'Piloto Ultraliviano No Motorizado',     tipo: 'pilot',   catLabel: null },
    ],

    CATEGORIAS: {
        AP:   ['Avión', 'Helicóptero', 'Planeador', 'Globo Libre', 'Dirigible', 'Aeronave Despegue Vertical', 'UL', 'ULM', 'LSA-Distinto de Avión'],
        PP:   ['Avión', 'Helicóptero', 'Planeador', 'Globo Libre', 'Dirigible', 'Aeronave Despegue Vertical', 'UL', 'ULM', 'LSA-Distinto de Avión'],
        PD:   ['Avión', 'Helicóptero', 'UL', 'ULM'],
        PC:   ['Avión', 'Helicóptero', 'Planeador', 'Globo Libre', 'Dirigible', 'Aeronave Despegue Vertical'],
        PTLA: ['Avión', 'Helicóptero', 'Aeronave Despegue Vertical'],
        PPL:  [], PGL: [], UL: [],
    },

    HAB_CLASE: [
        'Monomotor Terrestre', 'Multimotor Terrestre',
        'Anfibio Monomotor', 'Anfibio Multimotor',
        'Hidroavión Monomotor', 'Hidroavión Multimotor',
    ],

    HAB_FUNCION: [
        'Instructor de Vuelo', 'Ayudante de Instructor',
        'Copiloto (SIC)', 'I.V.I.', 'English Proficient',
    ],

    HAB_ESPECIALES: [
        { id: 'IFR',      label: 'Vuelo por Instrumentos (IFR)' },
        { id: 'AGRICOLA', label: 'Vuelo Agrícola' },
        { id: 'PESCA',    label: 'Prospección Pesquera' },
    ],

    CERT_MEDICO: [
        { id: 'CM1', label: 'Clase 1 — Comercial' },
        { id: 'CM2', label: 'Clase 2 — Privado' },
        { id: 'CM3', label: 'Clase 3 — Controladores' },
    ],

    data: {
        licencias: [], habClase: [], habFuncion: [],
        habEspeciales: [], habTipo: [], certMedico: [],
    },

    containerId: '',

    init(containerId, savedData = {}) {
        this.containerId = containerId;
        this.data = {
            licencias:     savedData.licencias     || [],
            habClase:      savedData.habClase      || [],
            habFuncion:    savedData.habFuncion     || [],
            habEspeciales: savedData.habEspeciales  || [],
            habTipo:       savedData.habTipo        || [],
            certMedico:    savedData.certMedico     || [],
        };
        this.render();
    },

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;
        container.innerHTML = `<div class="lic-sys">
            ${this._sec('Licencias', this._licencias())}
            ${this._sec('Habilitaciones de Función', this._habFuncion())}
            ${this._sec('Habilitaciones Especiales', this._habEspeciales())}
            ${this._sec('Habilitaciones de Tipo (Aeronave)', this._habTipo())}
            ${this._sec('Certificado Médico', this._certMedico())}
        </div>`;
    },

    _sec(title, content) {
        return `<div class="lic-section">
            <div class="lic-section-title">${title}</div>
            <div class="lic-section-body">${content}</div>
        </div>`;
    },

    _licencias() {
        const rows = this.data.licencias.map((lic, i) => {
            const def = this.LICENCIAS.find(l => l.id === lic.licenciaId);
            const cats = lic.licenciaId ? (this.CATEGORIAS[lic.licenciaId] || []) : [];
            return `<div class="lic-row">
                <div class="lic-field">
                    <label>Licencia</label>
                    <select onchange="licenseSystem._onLicChange(${i}, this.value)">
                        <option value="">Seleccionar...</option>
                        ${this.LICENCIAS.map(l => `<option value="${l.id}" ${lic.licenciaId === l.id ? 'selected' : ''}>${l.label}</option>`).join('')}
                    </select>
                </div>
                <div class="lic-field">
                    <label>Número</label>
                    <input type="text" value="${lic.numero || ''}" placeholder="Ej: 12345"
                        onchange="licenseSystem.data.licencias[${i}].numero = this.value">
                </div>
                <div class="lic-field">
                    <label>Vencimiento</label>
                    <input type="date" value="${lic.vencimiento || ''}"
                        onchange="licenseSystem.data.licencias[${i}].vencimiento = this.value">
                </div>
                ${cats.length > 0 ? `<div class="lic-field">
                    <label>${def?.catLabel || 'Hab. Categoría'}</label>
                    <select onchange="licenseSystem._onCatChange(${i}, this.value)">
                        <option value="">Ninguna</option>
                        ${cats.map(c => `<option value="${c}" ${lic.categoria === c ? 'selected' : ''}>${c}</option>`).join('')}
                    </select>
                </div>` : ''}
${lic.categoria === 'Avión' ? `<div class="lic-field">
    <label>Hab. de Clase (Avión)</label>
    <select onchange="licenseSystem.data.licencias[${i}].clase = this.value">
        <option value="">Ninguna</option>
        ${this.HAB_CLASE.map(c => `<option value="${c}" ${lic.clase === c ? 'selected' : ''}>${c}</option>`).join('')}
    </select>
</div>` : ''}
                <button type="button" class="lic-remove" onclick="licenseSystem._removeLic(${i})" title="Eliminar">✕</button>
            </div>`;
        }).join('') || '<p class="lic-empty">Sin licencias.</p>';

        return rows + `<button type="button" class="lic-add-btn" onclick="licenseSystem._addLic()">+ Agregar licencia</button>`;
    },

    _habFuncion() {
        const rows = this.data.habFuncion.map((h, i) => `<div class="lic-row">
            <div class="lic-field flex2">
                <label>Función</label>
                <select onchange="licenseSystem.data.habFuncion[${i}].funcion = this.value">
                    <option value="">Seleccionar...</option>
                    ${this.HAB_FUNCION.map(f => `<option value="${f}" ${h.funcion === f ? 'selected' : ''}>${f}</option>`).join('')}
                </select>
            </div>
            <div class="lic-field">
                <label>Vencimiento</label>
                <input type="date" value="${h.vencimiento || ''}"
                    onchange="licenseSystem.data.habFuncion[${i}].vencimiento = this.value">
            </div>
            <button type="button" class="lic-remove" onclick="licenseSystem._removeArr('habFuncion', ${i})">✕</button>
        </div>`).join('') || '<p class="lic-empty">Sin habilitaciones de función.</p>';

        return rows + `<button type="button" class="lic-add-btn" onclick="licenseSystem._addArr('habFuncion')">+ Agregar</button>`;
    },

    _habEspeciales() {
        const rows = this.data.habEspeciales.map((h, i) => `<div class="lic-row">
            <div class="lic-field flex2">
                <label>Habilitación</label>
                <select onchange="licenseSystem.data.habEspeciales[${i}].tipo = this.value">
                    <option value="">Seleccionar...</option>
                    ${this.HAB_ESPECIALES.map(e => `<option value="${e.id}" ${h.tipo === e.id ? 'selected' : ''}>${e.label}</option>`).join('')}
                </select>
            </div>
            <div class="lic-field">
                <label>Vencimiento</label>
                <input type="date" value="${h.vencimiento || ''}"
                    onchange="licenseSystem.data.habEspeciales[${i}].vencimiento = this.value">
            </div>
            <button type="button" class="lic-remove" onclick="licenseSystem._removeArr('habEspeciales', ${i})">✕</button>
        </div>`).join('') || '<p class="lic-empty">Sin habilitaciones especiales.</p>';

        return rows + `<button type="button" class="lic-add-btn" onclick="licenseSystem._addArr('habEspeciales')">+ Agregar</button>`;
    },

    _habTipo() {
        const rows = this.data.habTipo.map((h, i) => `<div class="lic-row">
            <div class="lic-field flex2">
                <label>Aeronave / Tipo</label>
                <input type="text" value="${h.aeronave || ''}" placeholder="Ej: B737, A320, C172..."
                    onchange="licenseSystem.data.habTipo[${i}].aeronave = this.value">
            </div>
            <div class="lic-field">
                <label>Vencimiento</label>
                <input type="date" value="${h.vencimiento || ''}"
                    onchange="licenseSystem.data.habTipo[${i}].vencimiento = this.value">
            </div>
            <button type="button" class="lic-remove" onclick="licenseSystem._removeArr('habTipo', ${i})">✕</button>
        </div>`).join('') || '<p class="lic-empty">Sin habilitaciones de tipo.</p>';

        return rows + `<button type="button" class="lic-add-btn" onclick="licenseSystem._addArr('habTipo')">+ Agregar</button>`;
    },

    _certMedico() {
        const rows = this.data.certMedico.map((c, i) => `<div class="lic-row" style="flex-wrap:wrap;">
            <div class="lic-field">
                <label>Clase</label>
                <select onchange="licenseSystem.data.certMedico[${i}].clase = this.value">
                    <option value="">Seleccionar...</option>
                    ${this.CERT_MEDICO.map(m => `<option value="${m.id}" ${c.clase === m.id ? 'selected' : ''}>${m.label}</option>`).join('')}
                </select>
            </div>
            <div class="lic-field">
                <label>Vencimiento</label>
                <input type="date" value="${c.vencimiento || ''}"
                    onchange="licenseSystem.data.certMedico[${i}].vencimiento = this.value">
            </div>
            <div class="lic-field flex2">
                <label>Restricciones / Dispensas</label>
                <input type="text" value="${c.restricciones || ''}" placeholder="Ej: Debe usar lentes correctores"
                    onchange="licenseSystem.data.certMedico[${i}].restricciones = this.value">
            </div>
            <button type="button" class="lic-remove" onclick="licenseSystem._removeArr('certMedico', ${i})">✕</button>
        </div>`).join('') || '<p class="lic-empty">Sin certificados médicos.</p>';

        return rows + `<button type="button" class="lic-add-btn" onclick="licenseSystem._addArr('certMedico')">+ Agregar certificado médico</button>`;
    },

    // ── Acciones ─────────────────────────────────────────────────

    _addLic() {
        this.data.licencias.push({ id: Date.now().toString(), licenciaId: '', numero: '', vencimiento: '', categoria: '' });
        this.render();
    },

    _removeLic(i) {
        this.data.licencias.splice(i, 1);
        this.render();
    },

    _onLicChange(i, value) {
        this.data.licencias[i].licenciaId = value;
        this.data.licencias[i].categoria = '';
        this.render();
    },

    _onCatChange(i, value) {
        this.data.licencias[i].categoria = value;
        this.data.licencias[i].clase = '';
        this.render();
    },

    _addArr(section) {
        this.data[section].push({ id: Date.now().toString() });
        this.render();
    },

    _removeArr(section, i) {
        this.data[section].splice(i, 1);
        this.render();
    },

    getData() { return this.data; },

    getUserRole() {
        const hasPilot = this.data.licencias.some(l => {
            const def = this.LICENCIAS.find(d => d.id === l.licenciaId);
            return def && def.tipo === 'pilot' && l.numero?.trim();
        });
        return hasPilot ? 'pilot' : 'student';
    },
};