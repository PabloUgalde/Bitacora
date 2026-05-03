// logbook-scanner.js — Escáner multi-foto con Gemini Vision
const logbookScanner = {

    _pages: [],       // [{ id, file, photoURL, _displayURL, rotation, mime, flights, processed }]
    _currentIdx: 0,   // página en revisión
    _mode: 'page',    // 'page' | 'all'

    get _curPage() { return this._pages[this._currentIdx] || null; },

    // ── Ciclo de vida ─────────────────────────────────────────────

    open() {
        const content = document.querySelector('#scanner-modal .modal-content');
        const h = Math.floor(window.innerHeight * 0.9) + 'px';
        if (content) { content.style.height = h; content.style.maxHeight = h; }
        document.getElementById('scanner-modal').style.display = 'flex';
        document.body.style.overflow = 'hidden';
        this._step('upload');
    },

    close() {
        document.getElementById('scanner-modal').style.display = 'none';
        document.body.style.overflow = '';
        document.getElementById('sc-photo-lens').style.display = 'none';
        this._pages.forEach(p => URL.revokeObjectURL(p.photoURL));
        this._pages = [];
        this._currentIdx = 0;
        this._mode = 'page';
        document.getElementById('scanner-file').value = '';
        document.getElementById('sc-dropzone-label').textContent = 'Haz clic o arrastra imágenes aquí';
        document.getElementById('sc-photo-grid').innerHTML = '';
    },

    _step(name) {
        document.querySelectorAll('#scanner-modal .sc-step').forEach(el => { el.style.display = 'none'; });
        const el = document.getElementById('sc-step-' + name);
        if (el) el.style.display = (name === 'review' || name === 'consolidate') ? 'flex' : 'block';
    },

    // ── Selección de archivos ─────────────────────────────────────

    _onFilesSelect() {
        const fi = document.getElementById('scanner-file');
        if (!fi.files.length) return;
        this._pages.forEach(p => URL.revokeObjectURL(p.photoURL));
        this._pages = Array.from(fi.files).map((file, i) => ({
            id: i, file,
            photoURL: URL.createObjectURL(file),
            _displayURL: null,
            rotation: 0,
            mime: file.type || 'image/jpeg',
            flights: [],
            processed: false
        }));
        const n = this._pages.length;
        document.getElementById('sc-dropzone-label').textContent =
            n === 1 ? '✓ 1 foto seleccionada' : `✓ ${n} fotos seleccionadas`;
        this._renderPhotoGrid();
    },

    _renderPhotoGrid() {
        document.getElementById('sc-photo-grid').innerHTML = this._pages.map(p => `
            <div class="sc-thumb" id="sc-thumb-${p.id}">
                <div class="sc-thumb-img">
                    <img src="${p.photoURL}" style="transform:rotate(${p.rotation}deg)" alt="Foto ${p.id + 1}">
                </div>
                <div class="sc-thumb-bar">
                    <button class="sc-rot-btn" onclick="logbookScanner._rotate(${p.id},-90)" title="Girar izquierda">↺</button>
                    <span class="sc-thumb-lbl" id="sc-tlbl-${p.id}">Foto ${p.id + 1}</span>
                    <button class="sc-rot-btn" onclick="logbookScanner._rotate(${p.id}, 90)" title="Girar derecha">↻</button>
                </div>
                <div class="sc-thumb-status" id="sc-tsts-${p.id}"></div>
            </div>`).join('');
    },

    _rotate(pageId, deg) {
        const page = this._pages.find(p => p.id === pageId);
        if (!page) return;
        page.rotation = (page.rotation + deg + 360) % 360;
        page._displayURL = null;
        this._applyRotation(page);
    },

    async _applyRotation(page) {
        if (page.rotation !== 0) {
            if (!page._displayURL) {
                const raw = await this._b64(page.file);
                const rot = await this._rotateB64(raw, page.mime, page.rotation);
                page._displayURL = `data:${page.mime};base64,${rot}`;
            }
        }
        const src = page._displayURL || page.photoURL;
        // Actualiza miniatura (sin CSS transform — imagen real rotada)
        const thumb = document.querySelector(`#sc-thumb-${page.id} img`);
        if (thumb) { thumb.src = src; thumb.style.transform = ''; }
        // Actualiza foto principal si es la página activa
        if (this._curPage?.id === page.id) {
            const photoEl = document.getElementById('sc-photo');
            if (photoEl) { photoEl.src = src; photoEl.style.transform = ''; this._initPhotoZoom(); }
        }
    },

    async _updatePhotoDisplay(page) {
        await this._applyRotation(page);
    },

    // ── Procesamiento con Gemini ──────────────────────────────────

    async scan() {
        if (!this._pages.length) { ui.showNotification('Selecciona al menos una foto', 'error'); return; }

        for (let i = 0; i < this._pages.length; i++) {
            const page = this._pages[i];
            this._step('loading');
            document.getElementById('sc-loading-msg').textContent =
                `Analizando foto ${i + 1} de ${this._pages.length}…`;
            document.getElementById('sc-loading-sub').textContent = page.file.name;

            await this._scanPage(page, i);
            this._updateThumbStatus(page);
        }

        this._currentIdx = 0;
        this._mode = 'page';
        this._step('review');
        this._renderPageReview();
    },

    async _scanPage(page, i) {
        try {
            const rawB64 = await this._b64(page.file);
            let b64 = page.rotation ? await this._rotateB64(rawB64, page.mime, page.rotation) : rawB64;
            b64 = await this._compress(b64, page.mime);
            const flights = await this._gemini(b64, page.mime);
            page.flights = flights.map((f, j) => ({ ...this._empty(), ...f, _id: `${i}_${j}` }));
            this._autoFillPages(page, i);
            page.flights.forEach(f => this._validate(f));
            page.processed = true;
            page._error = null;
        } catch (e) {
            console.error(`[Scanner] Foto ${i + 1}:`, e);
            // Auto-retry si Gemini indica tiempo de espera (rate limit)
            const match = e.message.match(/retry in (\d+(?:\.\d+)?)s/i);
            if (match) {
                let secs = Math.ceil(parseFloat(match[1])) + 2;
                while (secs > 0) {
                    document.getElementById('sc-loading-msg').textContent =
                        `Foto ${i + 1}: límite de API — reintentando en ${secs}s…`;
                    await new Promise(r => setTimeout(r, 1000));
                    secs--;
                }
                document.getElementById('sc-loading-msg').textContent =
                    `Analizando foto ${i + 1} de ${this._pages.length}…`;
                await this._scanPage(page, i); // un solo reintento
            } else {
                page.processed = false;
                page._error = e.message;
            }
        }
    },

    _updateThumbStatus(page) {
        const el = document.getElementById(`sc-tsts-${page.id}`);
        if (!el) return;
        if (!page.processed) {
            el.innerHTML = `<span style="color:#e57373">✗ Error</span>
                <button onclick="logbookScanner._retryPage(${page.id})"
                    style="margin-left:.3rem;background:none;border:1px solid #e57373;color:#e57373;border-radius:3px;padding:1px 5px;font-size:.7rem;cursor:pointer">↻ Reintentar</button>`;
            return;
        }
        const w = page.flights.filter(f => f._warnings.length).length;
        const statusColor = w ? '#e57373' : '#81c784';
        el.style.color = statusColor;
        el.innerHTML = `<span>${w ? `⚠ ${w} advertencias` : `✓ ${page.flights.length} vuelos`}</span>
            <button onclick="logbookScanner._retryPage(${page.id})"
                style="margin-left:.3rem;background:none;border:1px solid #555;color:#aaa;border-radius:3px;padding:1px 5px;font-size:.7rem;cursor:pointer" title="Re-escanear esta foto">↺</button>`;
    },

    async _retryPage(pageId) {
        const page = this._pages.find(p => p.id === pageId);
        if (!page) return;
        const el = document.getElementById(`sc-tsts-${pageId}`);
        if (el) el.innerHTML = '<span style="color:#888">Reintentando…</span>';
        const i = this._pages.indexOf(page);
        await this._scanPage(page, i);
        this._updateThumbStatus(page);
        if (this._curPage?.id === pageId) this._renderPageReview();
    },

    async rescanCurrent() {
        const page = this._curPage;
        if (!page) return;
        const btn = document.getElementById('sc-rescan-btn');
        if (btn) { btn.disabled = true; btn.textContent = '↺ Escaneando…'; }
        const el = document.getElementById(`sc-tsts-${page.id}`);
        if (el) el.innerHTML = '<span style="color:#888">Re-escaneando…</span>';
        const i = this._pages.indexOf(page);
        await this._scanPage(page, i);
        this._updateThumbStatus(page);
        this._renderPageReview();
        if (btn) { btn.disabled = false; btn.textContent = '↺ Re-escanear'; }
    },

    // ── Helpers ───────────────────────────────────────────────────

    _b64(file) {
        return new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = e => res(e.target.result.split(',')[1]);
            r.onerror = rej;
            r.readAsDataURL(file);
        });
    },

    _rotateB64(b64, mime, deg) {
        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => {
                const swap = deg === 90 || deg === 270;
                const canvas = document.createElement('canvas');
                canvas.width  = swap ? img.height : img.width;
                canvas.height = swap ? img.width  : img.height;
                const ctx = canvas.getContext('2d');
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.rotate(deg * Math.PI / 180);
                ctx.drawImage(img, -img.width / 2, -img.height / 2);
                resolve(canvas.toDataURL(mime).split(',')[1]);
            };
            img.src = `data:${mime};base64,${b64}`;
        });
    },

    _compress(b64, mime, maxDim = 2400, quality = 0.88) {
        return new Promise(resolve => {
            const bytes = b64.length * 0.75;
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                const needsResize = width > maxDim || height > maxDim;
                const needsCompress = bytes > 3.5 * 1024 * 1024;
                if (!needsResize && !needsCompress) { resolve(b64); return; }
                if (needsResize) {
                    const ratio = Math.min(maxDim / width, maxDim / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }
                const canvas = document.createElement('canvas');
                canvas.width = width; canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1]);
            };
            img.src = `data:${mime};base64,${b64}`;
        });
    },

    _autoFillPages(page, pageIdx) {
        const hasDetected = page.flights.some(f => f['Pagina Bitacora a Replicar']);
        if (hasDetected) return;
        const currentMax = (typeof flightData !== 'undefined' ? flightData : [])
            .reduce((max, f) => Math.max(max, parseInt(f['Pagina Bitacora a Replicar']) || 0), 0);
        page.flights.forEach((f, i) => {
            f['Pagina Bitacora a Replicar'] = currentMax + pageIdx + Math.floor(i / 8) + 1;
        });
    },

    async _gemini(b64, mime) {
        const prompt = `OCR de bitácora de vuelo chilena (DGAC). Tabla impresa, cada fila = un vuelo.

REGLAS:
- Lee cada fila de forma independiente. No copies ni inferyas valores de otras filas. Cada celda, léela directamente desde la imagen aunque parezca igual a la anterior (ej: CC-KUH y CC-KUG son matrículas distintas).
- Matrículas: formato CC-XXX o CC-XXXX, mayúsculas. Lee cada letra individualmente.
- Fechas: salida "YYYY-MM-DD". Ej: "15/03/24"→"2024-03-15".
- Vacío numérico→0, vacío texto→"".
- Ignora filas de totales/subtotales.
- Número de página: búscalo en encabezado o esquina y asígnalo a todos los vuelos.

TIEMPOS (Duracion Total, LSA, Monomotor, Multimotor, Turbo Helice, Turbo Jet, Helicoptero, Planeador, Ultraliviano, Diurno, Nocturno, IFR, Simulador, Travesia, Solo, PIC, SIC, Instruccion Recibida, Como Instructor):
Las columnas de tiempo tienen dos sub-columnas separadas por línea vertical. Detecta el formato mirando la fila TOTAL PAGINA si existe: prueba ambas interpretaciones y usa la que cuadre con el total.
- Formato decimal H.h: 1|5=1.5, 0|6=0.6, 0|75=0.75 (úsalo si parte derecha >59 o si cuadra con total)
- Formato HH:MM→decimal: 1:30→1.5, 0:45→0.75, 1:15→1.25

CONTEOS ENTEROS (no convertir): Aterrizajes Dia, Aterrizajes Noche, NO.

Schema de salida — un objeto por vuelo:
{
  "Fecha": "YYYY-MM-DD",
  "Aeronave Marca y Modelo": "",
  "Matricula Aeronave": "",
  "Desde": "",
  "Hasta": "",
  "Duracion Total de Vuelo": 0.0,
  "LSA": 0.0,
  "Monomotor": 0.0,
  "Multimotor": 0.0,
  "Turbo Helice": 0.0,
  "Turbo Jet": 0.0,
  "Helicoptero": 0.0,
  "Planeador": 0.0,
  "Ultraliviano": 0.0,
  "Aterrizajes Dia": 0,
  "Aterrizajes Noche": 0,
  "Diurno": 0.0,
  "Nocturno": 0.0,
  "IFR": 0.0,
  "NO": 0,
  "Tipo": "",
  "Simulador o Entrenador de Vuelo": 0.0,
  "Travesia": 0.0,
  "Solo": 0.0,
  "Piloto al Mando (PIC)": 0.0,
  "Copiloto (SIC)": 0.0,
  "Instruccion Recibida": 0.0,
  "Como Instructor": 0.0,
  "Observaciones": "",
  "Pagina Bitacora a Replicar": null
}

Responde ÚNICAMENTE con el JSON array. Sin texto adicional, sin markdown.`;

        const { data: { session } } = await supabaseClient.auth.getSession();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 90000);
        let resp;
        try {
            resp = await fetch(
                `${supabaseClient.supabaseUrl}/functions/v1/gemini-ocr`,
                {
                    signal: controller.signal,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({
                        contents: [{ parts: [
                            { text: prompt },
                            { inline_data: { mime_type: mime, data: b64 } }
                        ]}],
                        generationConfig: {
                            temperature: 0.1,
                            response_mime_type: 'application/json'
                        }
                    })
                }
            );
        } catch (e) {
            throw new Error(e.name === 'AbortError' ? 'Tiempo de espera agotado (90s). Intenta re-escanear.' : e.message);
        } finally {
            clearTimeout(timeout);
        }

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.error?.message || err.error || `HTTP ${resp.status}`);
        }
        const data = await resp.json();
        const text = data.candidates?.[0]?.content?.parts?.find(p => p.text)?.text || '[]';
        // Extraer JSON aunque el modelo envuelva la respuesta en markdown
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        return JSON.parse(jsonMatch ? jsonMatch[0] : text);
    },

    _empty() {
        return {
            'Fecha': '', 'Aeronave Marca y Modelo': '', 'Matricula Aeronave': '',
            'Desde': '', 'Hasta': '', 'Duracion Total de Vuelo': 0,
            'LSA': 0, 'Monomotor': 0, 'Multimotor': 0, 'Turbo Helice': 0,
            'Turbo Jet': 0, 'Helicoptero': 0, 'Planeador': 0, 'Ultraliviano': 0,
            'Aterrizajes Dia': 0, 'Aterrizajes Noche': 0,
            'Diurno': 0, 'Nocturno': 0, 'IFR': 0, 'NO': 0, 'Tipo': '',
            'Simulador o Entrenador de Vuelo': 0, 'Travesia': 0, 'Solo': 0,
            'Piloto al Mando (PIC)': 0, 'Copiloto (SIC)': 0,
            'Instruccion Recibida': 0, 'Como Instructor': 0,
            'Observaciones': '', 'Pagina Bitacora a Replicar': null, '_warnings': []
        };
    },

    // ── Validación ────────────────────────────────────────────────

    _validateAll() {
        const list = this._mode === 'all'
            ? this._pages.flatMap(p => p.flights)
            : (this._curPage?.flights || []);
        list.forEach(f => this._validate(f));
    },

    _validate(f) {
        const w = [];
        const dur = +f['Duracion Total de Vuelo'] || 0;
        const acTypes = ['LSA','Monomotor','Multimotor','Turbo Helice','Turbo Jet','Helicoptero','Planeador','Ultraliviano'];
        const acSum = acTypes.reduce((s, k) => s + (+f[k] || 0), 0);
        if (dur > 0 && acSum > 0 && Math.abs(acSum - dur) > 0.05)
            w.push(`Tipo avión suma ${this._fmt(acSum)} pero duración total es ${this._fmt(dur)}`);
        const dn = (+f['Diurno'] || 0) + (+f['Nocturno'] || 0);
        if (dur > 0 && dn > 0 && Math.abs(dn - dur) > 0.05)
            w.push(`Diurno (${this._fmt(+f['Diurno']||0)}) + Nocturno (${this._fmt(+f['Nocturno']||0)}) = ${this._fmt(dn)} ≠ duración ${this._fmt(dur)}`);
        if (!f['Fecha']) w.push('Fecha no detectada — ingresa manualmente');
        if (dur <= 0)    w.push('Duración total es cero — revisa el campo Dur.');
        f._warnings = w;
    },

    _fmt(h) { return (typeof formatHours === 'function') ? formatHours(+h || 0) : (+h || 0).toFixed(2); },

    _parseTm(v) {
        const s = String(v).trim();
        const hm = s.match(/^(\d+):(\d{2})$/);
        if (hm) return +hm[1] + +hm[2] / 60;
        return parseFloat(s.replace(',', '.')) || 0;
    },

    // ── Navegación de páginas ─────────────────────────────────────

    _renderPageReview() {
        const page = this._curPage;
        if (!page) return;

        document.getElementById('sc-page-nav').textContent =
            `Foto ${this._currentIdx + 1} / ${this._pages.length}`;
        document.getElementById('sc-prev-page').disabled = this._currentIdx === 0;
        document.getElementById('sc-next-page').disabled = this._currentIdx === this._pages.length - 1;

        const photoEl = document.getElementById('sc-photo');
        if (photoEl) {
            photoEl.style.display = 'block';
            this._updatePhotoDisplay(page);
        }

        document.getElementById('sc-rot-left').onclick  = () => this._rotate(page.id, -90);
        document.getElementById('sc-rot-right').onclick = () => this._rotate(page.id,  90);

        const allDone = this._pages.every(p => p.processed);
        document.getElementById('sc-consolidate-btn').style.display = allDone ? 'inline-flex' : 'none';

        this.flights = page.flights;
        this._render();
    },

    prevPage() {
        if (this._currentIdx > 0) { this._currentIdx--; this._renderPageReview(); }
    },

    nextPage() {
        if (this._currentIdx < this._pages.length - 1) { this._currentIdx++; this._renderPageReview(); }
    },

    // ── Consolidar ────────────────────────────────────────────────

    consolidate() {
        this._mode = 'all';
        // Merge y ordenar por número de página
        const all = this._pages.flatMap((p, pi) =>
            p.flights.map(f => ({ ...f, _pageIdx: pi }))
        );
        all.sort((a, b) => {
            const pa = parseInt(a['Pagina Bitacora a Replicar']) || 9999;
            const pb = parseInt(b['Pagina Bitacora a Replicar']) || 9999;
            return pa !== pb ? pa - pb : (a._pageIdx - b._pageIdx);
        });
        this.flights = all;
        this._validateAll();
        this._step('consolidate');
        this._render();
    },

    backToReview() {
        this._mode = 'page';
        this._step('review');
        this._renderPageReview();
    },

    // ── Render ────────────────────────────────────────────────────

    _cols: [
        { k: 'Fecha',                          l: 'Fecha',     t: 'text', w: 110 },
        { k: 'Aeronave Marca y Modelo',         l: 'Aeronave',  t: 'text', w: 130 },
        { k: 'Matricula Aeronave',              l: 'Matrícula', t: 'text', w: 90  },
        { k: 'Desde',                           l: 'Desde',     t: 'text', w: 60  },
        { k: 'Hasta',                           l: 'Hasta',     t: 'text', w: 60  },
        { k: 'Duracion Total de Vuelo',         l: 'Dur.',      t: 'num',  w: 58  },
        { k: 'LSA',                             l: 'LSA',       t: 'num',  w: 48  },
        { k: 'Monomotor',                       l: 'Mono',      t: 'num',  w: 55  },
        { k: 'Multimotor',                      l: 'Multi',     t: 'num',  w: 52  },
        { k: 'Turbo Helice',                    l: 'T.Hél',     t: 'num',  w: 52  },
        { k: 'Turbo Jet',                       l: 'T.Jet',     t: 'num',  w: 50  },
        { k: 'Helicoptero',                     l: 'Heli',      t: 'num',  w: 48  },
        { k: 'Planeador',                       l: 'Plan.',     t: 'num',  w: 50  },
        { k: 'Ultraliviano',                    l: 'Ultra',     t: 'num',  w: 50  },
        { k: 'Aterrizajes Dia',                 l: 'At.D',      t: 'int',  w: 46  },
        { k: 'Aterrizajes Noche',               l: 'At.N',      t: 'int',  w: 50  },
        { k: 'Diurno',                          l: 'Diurno',    t: 'num',  w: 58  },
        { k: 'Nocturno',                        l: 'Nocturno',  t: 'num',  w: 65  },
        { k: 'IFR',                             l: 'IFR',       t: 'num',  w: 46  },
        { k: 'NO',                              l: 'N°Ap.',     t: 'int',  w: 46  },
        { k: 'Tipo',                            l: 'Tipo Ap.',  t: 'text', w: 65  },
        { k: 'Simulador o Entrenador de Vuelo', l: 'Simul.',    t: 'num',  w: 55  },
        { k: 'Travesia',                        l: 'Travesía',  t: 'num',  w: 65  },
        { k: 'Solo',                            l: 'Solo',      t: 'num',  w: 48  },
        { k: 'Piloto al Mando (PIC)',           l: 'PIC',       t: 'num',  w: 52  },
        { k: 'Copiloto (SIC)',                  l: 'SIC',       t: 'num',  w: 48  },
        { k: 'Instruccion Recibida',            l: 'Instr.',    t: 'num',  w: 52  },
        { k: 'Como Instructor',                 l: 'Inst.C',    t: 'num',  w: 52  },
        { k: 'Observaciones',                   l: 'Obs',       t: 'text', w: 160 },
        { k: 'Pagina Bitacora a Replicar',      l: 'Pág',       t: 'int',  w: 42  },
    ],

    _render() {
        const errN = this.flights.filter(f => f._warnings.length).length;
        const summaryId = this._mode === 'all' ? 'sc-cons-summary' : 'sc-summary';
        const tableId   = this._mode === 'all' ? 'sc-cons-table'   : 'sc-table';
        const totalsId  = this._mode === 'all' ? 'sc-cons-totals'  : 'sc-totals';

        const summaryEl = document.getElementById(summaryId);
        if (summaryEl) summaryEl.innerHTML =
            `<strong>${this.flights.length}</strong> vuelos — ` +
            (errN > 0
                ? `<span style="color:#e57373">${errN} con advertencias</span>`
                : '<span style="color:#81c784">Todos válidos ✓</span>');

        if (this._mode !== 'all') this._renderWarningsPanel();
        this._renderTable(tableId);
        this._renderTotals(totalsId);
    },

    _renderWarningsPanel() {
        const panel = document.getElementById('sc-warn-panel');
        if (!panel) return;
        const warned = this.flights.filter(f => f._warnings.length);
        if (!warned.length) { panel.style.display = 'none'; return; }
        panel.style.display = 'block';
        panel.innerHTML = `<div class="sc-warn-title">⚠ Advertencias — revisa estos campos antes de importar</div>` +
            warned.map(f => {
                const idx = this.flights.indexOf(f) + 1;
                return f._warnings.map(w =>
                    `<div class="sc-warn-item"><span class="sc-warn-row">Fila ${idx}</span><span>${w}</span></div>`
                ).join('');
            }).join('');
    },

    _tfootHtml() {
        let cells = `<td style="text-align:center;color:#555;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em">TOT</td>`;
        this._cols.forEach(c => {
            const sum = this.flights.reduce((s, f) => s + (+f[c.k] || 0), 0);
            let disp = '';
            if (c.t === 'num')  disp = sum > 0 ? this._fmt(sum) : '—';
            if (c.t === 'int')  disp = Math.round(sum) > 0 ? String(Math.round(sum)) : '—';
            const gold = disp && disp !== '—';
            cells += `<td style="min-width:${c.w}px;font-weight:600;color:${gold ? '#D4AF37' : '#3a3a3a'};text-align:center;padding:4px 2px">${disp}</td>`;
        });
        cells += `<td></td>`;
        return `<tr>${cells}</tr>`;
    },

    _renderTable(containerId = 'sc-table') {
        let html = `<table class="sc-table"><thead><tr>
            <th style="width:28px">#</th>
            ${this._cols.map(c => `<th style="min-width:${c.w}px">${c.l}</th>`).join('')}
            <th style="width:32px"></th></tr></thead><tbody>`;

        this.flights.forEach((f, idx) => {
            const hw = f._warnings.length > 0;
            html += `<tr data-sid="${f._id}" class="${hw ? 'sc-row-warn' : ''}">
                <td style="text-align:center;color:#666;font-size:.8rem">${idx + 1}</td>`;
            this._cols.forEach(c => {
                const v = f[c.k] ?? (c.t === 'text' ? '' : 0);
                const disp = c.t === 'num' ? (v ? this._fmt(v) : '') : (v ?? '');
                html += `<td><input type="text" value="${String(disp).replace(/"/g,'&quot;')}"
                    data-sid="${f._id}" data-key="${c.k}" data-type="${c.t}"
                    style="width:${c.w - 10}px"
                    class="sc-cell ${c.t !== 'text' ? 'sc-cell-num' : ''}"
                    onchange="logbookScanner._change(this)"></td>`;
            });
            html += `<td><button onclick="logbookScanner._del('${f._id}','${containerId}')"
                class="sc-del-btn" title="Eliminar">✕</button></td></tr>`;
        });
        html += `</tbody><tfoot class="sc-tfoot">${this._tfootHtml()}</tfoot></table>`;
        document.getElementById(containerId).innerHTML = html;
    },

    _renderTotals(containerId = 'sc-totals') {
        const tableId = containerId === 'sc-cons-totals' ? 'sc-cons-table' : 'sc-table';
        const tfoot = document.querySelector(`#${tableId} tfoot`);
        if (tfoot) tfoot.innerHTML = this._tfootHtml();
    },

    _change(input) {
        const sid = input.dataset.sid;
        const key = input.dataset.key;
        const type = input.dataset.type;
        const f = this.flights.find(f => f._id === sid);
        if (!f) return;

        if (type === 'num')      f[key] = this._parseTm(input.value);
        else if (type === 'int') f[key] = parseInt(input.value) || 0;
        else                     f[key] = input.value;

        this._validate(f);
        const row = document.querySelector(`tr[data-sid="${sid}"]`);
        if (row) row.className = f._warnings.length ? 'sc-row-warn' : '';

        if (this._mode !== 'all') this._renderWarningsPanel();
        this._renderTotals(this._mode === 'all' ? 'sc-cons-totals' : 'sc-totals');

        const errN = this.flights.filter(f => f._warnings.length).length;
        const sid2 = this._mode === 'all' ? 'sc-cons-summary' : 'sc-summary';
        const el = document.getElementById(sid2);
        if (el) el.innerHTML = `<strong>${this.flights.length}</strong> vuelos — ` +
            (errN > 0 ? `<span style="color:#e57373">${errN} con advertencias</span>` : '<span style="color:#81c784">Todos válidos ✓</span>');
    },

    _del(sid, containerId) {
        this.flights = this.flights.filter(f => f._id !== sid);
        // Sincronizar con la página fuente
        if (this._mode === 'page' && this._curPage)
            this._curPage.flights = this.flights;
        this._renderTable(containerId || 'sc-table');
        this._renderTotals(this._mode === 'all' ? 'sc-cons-totals' : 'sc-totals');
    },

    // ── Zoom foto ─────────────────────────────────────────────────

    _initPhotoZoom() {
        const img = document.getElementById('sc-photo');
        const lens = document.getElementById('sc-photo-lens');
        if (!img || !lens) return;
        const ZOOM = 5, LW = 300, LH = 210;
        const fresh = img.cloneNode(true);
        img.parentNode.replaceChild(fresh, img);
        fresh.addEventListener('click', () => window.open(fresh.src, '_blank'));
        fresh.addEventListener('mousemove', (e) => {
            const rect = fresh.getBoundingClientRect();
            const px = (e.clientX - rect.left) / rect.width;
            const py = (e.clientY - rect.top)  / rect.height;
            const bgW = rect.width * ZOOM, bgH = rect.height * ZOOM;
            const bgX = px * bgW - LW / 2, bgY = py * bgH - LH / 2;
            const lx = (window.innerWidth - e.clientX) > LW + 20 ? e.clientX + 16 : e.clientX - LW - 16;
            const ly = Math.max(8, Math.min(e.clientY - LH / 2, window.innerHeight - LH - 8));
            lens.style.cssText = `display:block;left:${lx}px;top:${ly}px;` +
                `background-image:url(${fresh.src});background-size:${bgW}px ${bgH}px;` +
                `background-position:-${bgX}px -${bgY}px`;
        });
        fresh.addEventListener('mouseleave', () => { lens.style.display = 'none'; });
    },

    // ── Descargar / Importar ──────────────────────────────────────

    downloadExcel() {
        if (!this.flights.length) { ui.showNotification('No hay vuelos', 'error'); return; }
        const cols = HEADERS.filter(h => h !== 'id');
        const rows = this.flights.map(f => cols.map(col => {
            if (col === 'Fecha') {
                const v = f[col] || '';
                if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { const [y,m,d]=v.split('-'); return `${d}/${m}/${y}`; }
                return v;
            }
            return f[col] ?? '';
        }));
        const ws = XLSX.utils.aoa_to_sheet([cols, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Vuelos escaneados');
        XLSX.writeFile(wb, `bitacora-escaneada-${new Date().toISOString().slice(0,10)}.xlsx`);
        ui.showNotification(`Excel descargado con ${this.flights.length} vuelo(s)`, 'success');
    },

    async importAll() {
        if (!this.flights.length) { ui.showNotification('No hay vuelos para importar', 'error'); return; }
        const withW = this.flights.filter(f => f._warnings.length);
        if (withW.length && !confirm(`${withW.length} vuelo(s) tienen advertencias. ¿Importar de todas formas?`)) return;
        const btn = document.getElementById('sc-import-btn');
        btn.disabled = true; btn.textContent = 'Importando…';
        try {
            const toImport = this.flights.map(f => ({
                ...f, 'Fecha': f['Fecha'] ? new Date(f['Fecha'] + 'T12:00:00Z') : null
            }));
            for (let i = 0; i < toImport.length; i += 50) {
                const ok = await api.saveFlightsBatch(toImport.slice(i, i + 50));
                if (!ok) throw new Error('Error al guardar lote');
            }
            ui.showNotification(`${this.flights.length} vuelo(s) importados`, 'success');
            this.close();
            await api.loadInitialFlights();
            if (typeof render !== 'undefined') render.dashboard();
        } catch (e) {
            ui.showNotification('Error: ' + e.message, 'error');
        } finally {
            btn.disabled = false; btn.textContent = '✓ Importar vuelos';
        }
    }
};
