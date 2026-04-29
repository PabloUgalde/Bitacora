// --- MÓDULO DE IMPORTACIÓN DE DATOS ---
// Este archivo contiene la lógica para procesar archivos Excel y no será modificado en el futuro.

const dataImporter = {
    processExcelFile: async (file) => {
        // Define a schema for flight data to ensure consistent types and default values.
        // This helps prevent 'undefined' errors when properties are missing from Excel
        // and ensures all fields are correctly initialized.
        const flightSchema = {
            id: { type: 'string', default: '' },
            'Fecha': { type: 'date', default: null },
            'Aeronave Marca y Modelo': { type: 'string', default: '' },
            'Matricula Aeronave': { type: 'string', default: '' },
            'Desde': { type: 'string', default: '' },
            'Hasta': { type: 'string', default: '' },
            'Duracion Total de Vuelo': { type: 'time', default: 0 },
            'LSA': { type: 'time', default: 0 },
            'Monomotor': { type: 'time', default: 0 },
            'Multimotor': { type: 'time', default: 0 },
            'Turbo Helice': { type: 'time', default: 0 },
            'Turbo Jet': { type: 'time', default: 0 },
            'Helicoptero': { type: 'time', default: 0 },
            'Planeador': { type: 'time', default: 0 },
            'Ultraliviano': { type: 'time', default: 0 },
            'Aterrizajes Dia': { type: 'integer', default: 0 },
            'Aterrizajes Noche': { type: 'integer', default: 0 },
            'Diurno': { type: 'time', default: 0 },
            'Nocturno': { type: 'time', default: 0 },
            'IFR': { type: 'time', default: 0 },
            'NO': { type: 'integer', default: 0 }, // Corresponds to no_app
            'Tipo': { type: 'string', default: '' }, // Corresponds to tipo_app
            'Simulador o Entrenador de Vuelo': { type: 'time', default: 0 },
            'Travesia': { type: 'time', default: 0 },
            'Solo': { type: 'time', default: 0 },
            'Piloto al Mando (PIC)': { type: 'time', default: 0 },
            'Copiloto (SIC)': { type: 'time', default: 0 },
            'Instruccion Recibida': { type: 'time', default: 0 },
            'Como Instructor': { type: 'time', default: 0 },
            'Observaciones': { type: 'string', default: '' },
            'Pagina Bitacora a Replicar': { type: 'integer', default: null },
            'es_saldo_inicial': { type: 'boolean', default: false }
        };

        const dataStatus = document.getElementById('data-status');
        dataStatus.textContent = 'Procesando archivo...';
        dataStatus.className = 'status';

        // Helper function to parse date values from various formats
        const parseDate = (dateInput, fmt) => {
            if (!dateInput) return null;
            if (dateInput instanceof Date) return dateInput;
            if (typeof dateInput === 'number') {
                return new Date(Date.UTC(1899, 11, 30 + dateInput));
            }
            if (typeof dateInput !== 'string') return null;

            const separators = /[\/\-\.]/;
            const parts = dateInput.split(separators);
            if (parts.length !== 3) return null;

            let [p1, p2, p3] = parts.map(p => parseInt(p, 10));
            let year, month, day;

            if (fmt === 'dmy') {
                day = p1; month = p2 - 1; year = p3 < 100 ? 2000 + p3 : p3;
            } else if (fmt === 'mdy') {
                month = p1 - 1; day = p2; year = p3 < 100 ? 2000 + p3 : p3;
            } else if (fmt === 'ymd') {
                year = p1 < 100 ? 2000 + p1 : p1; month = p2 - 1; day = p3;
            } else {
                // auto-detect
                if (p1 > 1000) { year = p1; month = p2 - 1; day = p3; }
                else if (p3 > 1000) { day = p1; month = p2 - 1; year = p3; }
                else if (p1 > 31) { year = p1 < 100 ? 2000 + p1 : p1; month = p2 - 1; day = p3; }
                else if (p2 > 12 && p1 <= 12) { month = p1 - 1; day = p2; year = p3 < 100 ? 2000 + p3 : p3; }
                else { day = p1; month = p2 - 1; year = p3 < 100 ? 2000 + p3 : p3; }
            }

            const date = new Date(Date.UTC(year, month, day));
            return isNaN(date.getTime()) ? null : date;
        };

        // Helper function to parse time values (e.g., "1:30" or 1.5) into decimal hours
        const parseTimeToHours = (val) => {
            if (val === null || val === undefined || val === '') return 0;
            if (typeof val === 'number') return val < 1 ? val * 24 : val;
            const s = String(val).trim();
            const hms = s.match(/^(\d+):(\d{2}):(\d{2})$/);
            if (hms) return parseInt(hms[1]) + parseInt(hms[2]) / 60 + parseInt(hms[3]) / 3600;
            const hm = s.match(/^(\d+):(\d{2})$/);
            if (hm) return parseInt(hm[1]) + parseInt(hm[2]) / 60;
            return parseFloat(s.replace(',', '.')) || 0;
        };

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const sheetAsArray = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null, raw: false });

            if (sheetAsArray.length < 2) throw new Error("El archivo Excel tiene menos de dos filas.");

            let headerRowIndex = -1;
            const headerKeywords = ["fecha", "aeronave", "matricula", "desde", "hasta", "duracion", "total"];
            for (let i = 0; i < Math.min(10, sheetAsArray.length); i++) {
                const rowText = (sheetAsArray[i] || []).join(" ").toLowerCase();
                let matches = 0;
                headerKeywords.forEach(keyword => { if (rowText.includes(keyword)) matches++; });
                if (matches > 3) { headerRowIndex = i; break; }
            }

            if (headerRowIndex === -1) {
                throw new Error("No se pudo identificar una fila de encabezados. La importación por posición requiere una fila de encabezado reconocible.");
            }
            
            console.log(`Se asume que los datos comienzan después de la fila ${headerRowIndex + 1}.`);
            
            const dataRows = sheetAsArray.slice(headerRowIndex + 1);
            const totalKeywords = ['total', 'subtotal', 'suma'];

            let loadedEntries = dataRows.map((row, rowIndex) => {
                if (!Array.isArray(row) || row.every(cell => cell === null)) return null;
                const firstCellContent = row[0] ? row[0].toString().toLowerCase() : '';
                if (totalKeywords.some(keyword => firstCellContent.includes(keyword))) { return null; }

                const rawDate = { value: row[0], excelRow: headerRowIndex + 2 + rowIndex };
                const newFlight = {
                    id: Date.now().toString() + (rowIndex * Math.random()).toString().slice(2)
                };

                // Populate newFlight object based on HEADERS and apply schema for type conversion
                HEADERS.slice(1).forEach((headerName, index) => { // HEADERS.slice(1) because 'id' is generated
                    const schemaEntry = flightSchema[headerName];
                    // Get raw value from Excel row, or undefined if not present
                    let rawValue = (index < row.length) ? row[index] : undefined;

                    if (!schemaEntry) {
                        // Fallback for headers not explicitly in schema (should ideally not happen if schema is complete)
                        newFlight[headerName] = (rawValue !== undefined && rawValue !== null) ? String(rawValue) : '';
                        return;
                    }

                    switch (schemaEntry.type) {
                        case 'string':
                            newFlight[headerName] = (rawValue !== undefined && rawValue !== null) ? String(rawValue) : schemaEntry.default;
                            break;
                        case 'number':
                            newFlight[headerName] = parseFloat(String(rawValue || '').replace(",", ".")) || schemaEntry.default;
                            break;
                        case 'integer':
                            newFlight[headerName] = Math.trunc(parseFloat(String(rawValue || '').replace(",", ".")) || schemaEntry.default);
                            break;
                        case 'time': // Custom type for time-based numbers
                            newFlight[headerName] = parseTimeToHours(rawValue) || schemaEntry.default;
                            break;
                        case 'date':
                            newFlight[headerName] = parseDate(rawValue) || schemaEntry.default;
                            if (newFlight[headerName] && isNaN(newFlight[headerName].getTime())) {
                                newFlight[headerName] = schemaEntry.default; // Ensure valid date or default
                            }
                            break;
                        case 'boolean':
                            newFlight[headerName] = Boolean(rawValue);
                            break;
                        default:
                            newFlight[headerName] = rawValue; // Keep original type if not specified
                    }
                });

                // If Simulador time is present, it overrides Duracion Total de Vuelo
                const simTime = newFlight['Simulador o Entrenador de Vuelo'];
                if (simTime > 0) {
                    newFlight['Duracion Total de Vuelo'] = simTime;
                }

                // Ensure Duracion Total de Vuelo is valid
                if (newFlight['Duracion Total de Vuelo'] <= 0) {
                    return null; // Invalid flight if no duration
                }

                // Leave Pagina Bitacora a Replicar as-is (null or from Excel); app.js handles assignment.

                // Ensure 'es_saldo_inicial' is always a boolean, defaulting to false
                if (typeof newFlight['es_saldo_inicial'] !== 'boolean') {
                    newFlight['es_saldo_inicial'] = false;
                }

                return { flight: newFlight, rawDate };
            }).filter(Boolean);

            if (loadedEntries.length === 0) throw new Error("No se pudo procesar ninguna fila con datos válidos.");

            const loadedFlights = loadedEntries.map(e => e.flight).reverse();
            const rawDates     = loadedEntries.map(e => e.rawDate).reverse();

            dataStatus.textContent = `¡Éxito! Se procesaron ${loadedFlights.length} vuelos.`;
            dataStatus.className = 'status success';

            return { success: true, data: loadedFlights, rawDates };

        } catch (error) {
            console.error("Error procesando el archivo Excel:", error);
            dataStatus.textContent = `Error: ${error.message}`;
            dataStatus.className = 'status error';
            return { success: false, data: [] };
        }
    },
    
    // Helper function to parse date values from various formats
    _parseDate: (dateInput) => {
        if (!dateInput) return null;
        if (dateInput instanceof Date) return dateInput;
        if (typeof dateInput === 'number') { // Excel serial date
            // Excel's epoch is Jan 1, 1900. JS epoch is Jan 1, 1970.
            // 25569 is the number of days between 1900-01-01 and 1970-01-01.
            // Date.UTC(1899, 11, 30) is Dec 30, 1899, which is Excel day 0.
            return new Date(Date.UTC(1899, 11, 30 + dateInput));
        }
        if (typeof dateInput !== 'string') return null;

        const separators = /[\/\-\.]/;
        const parts = dateInput.split(separators);

        if (parts.length !== 3) return null;

        let [p1, p2, p3] = parts.map(p => parseInt(p, 10));
        let year, month, day;

        // Try to infer date format (YYYY-MM-DD, DD-MM-YYYY, MM-DD-YYYY)
        if (p1 > 1000) { year = p1; month = p2 - 1; day = p3; } // YYYY-MM-DD
        else if (p3 > 1000) { day = p1; month = p2 - 1; year = p3; } // DD-MM-YYYY
        else if (p1 > 31) { year = p1 < 100 ? 2000 + p1 : p1; month = p2 - 1; day = p3; } // YY-MM-DD
        else if (p2 > 12 && p1 <= 12) { month = p1 - 1; day = p2; year = p3 < 100 ? 2000 + p3 : p3; } // MM-DD-YY
        else { day = p1; month = p2 - 1; year = p3 < 100 ? 2000 + p3 : p3; } // Assume DD-MM-YY or DD-MM-YYYY

        const date = new Date(Date.UTC(year, month, day));
        return isNaN(date.getTime()) ? null : date;
    },

    // Helper function to parse time values (e.g., "1:30" or 1.5) into decimal hours
    _parseTimeToHours: (val) => {
        if (val === null || val === undefined || val === '') return 0;
        if (typeof val === 'number') return val < 1 ? val * 24 : val;
        const s = String(val).trim();
        const hms = s.match(/^(\d+):(\d{2}):(\d{2})$/);
        if (hms) return parseInt(hms[1]) + parseInt(hms[2]) / 60 + parseInt(hms[3]) / 3600;
        const hm = s.match(/^(\d+):(\d{2})$/);
        if (hm) return parseInt(hm[1]) + parseInt(hm[2]) / 60;
        return parseFloat(s.replace(',', '.')) || 0;
    },

    showDateValidationModal: (flights, rawDates) => {
        return new Promise((resolve) => {
            // rawDates[i] = { value, excelRow }
            const parseWithFmt = (val, fmt) => {
                if (val == null || val === '') return null;
                if (typeof val === 'number') return new Date(Date.UTC(1899, 11, 30 + val));
                const parts = String(val).trim().split(/[\/\-\.]/);
                if (parts.length !== 3) return null;
                let [p1, p2, p3] = parts.map(p => parseInt(p, 10));
                let year, month, day;
                if (fmt === 'dmy')      { day = p1; month = p2 - 1; year = p3 < 100 ? 2000 + p3 : p3; }
                else if (fmt === 'mdy') { month = p1 - 1; day = p2; year = p3 < 100 ? 2000 + p3 : p3; }
                else if (fmt === 'ymd') { year = p1 < 100 ? 2000 + p1 : p1; month = p2 - 1; day = p3; }
                const d = new Date(Date.UTC(year, month, day));
                return isNaN(d.getTime()) ? null : d;
            };

            const fmtDate = d => d ? d.toLocaleDateString('es-CL', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' }) : null;

            // All pairs with a non-null raw value
            const validPairs = flights
                .map((f, i) => ({ f, rd: rawDates[i] }))
                .filter(x => x.rd && x.rd.value != null && x.rd.value !== '');

            // Pick 8 evenly-distributed samples
            const step = Math.max(1, Math.floor(validPairs.length / 8));
            const samples = [];
            for (let i = 0; i < validPairs.length && samples.length < 8; i += step) samples.push(validPairs[i]);

            // Score each format on up to 30 samples and pick the best
            const scoreFmt = fmt => validPairs.slice(0, 30).reduce((score, { rd }) => {
                const d = parseWithFmt(rd.value, fmt);
                const y = d ? d.getUTCFullYear() : 0;
                return score + (d && y >= 1970 && y <= 2100 ? 1 : 0);
            }, 0);
            const scores = { dmy: scoreFmt('dmy'), mdy: scoreFmt('mdy'), ymd: scoreFmt('ymd') };
            const detectedFmt = Object.keys(scores).reduce((a, b) => scores[a] >= scores[b] ? a : b);

            const buildRows = fmt => samples.map(({ f, rd }) => {
                const d = parseWithFmt(rd.value, fmt);
                const y = d ? d.getUTCFullYear() : 0;
                const sane = d && y >= 1970 && y <= 2100;
                const color = sane ? '#4caf50' : '#e57373';
                const label = sane ? fmtDate(d) : (d ? `Año ${y} — revisa formato` : 'Inválida');
                return `<tr style="border-bottom:1px solid #1a1a1a;">
                    <td style="padding:7px 10px;color:#555;font-size:12px;">Fila ${rd.excelRow}</td>
                    <td style="padding:7px 10px;font-family:monospace;color:#ccc;">${rd.value}</td>
                    <td style="padding:7px 10px;color:${color};">${label}</td>
                </tr>`;
            }).join('');

            const formats = [
                { value: 'dmy', label: 'DD/MM/AA', hint: 'Día / Mes / Año — Chile, Europa' },
                { value: 'mdy', label: 'MM/DD/AA', hint: 'Mes / Día / Año — EE.UU.' },
                { value: 'ymd', label: 'AA/MM/DD', hint: 'Año / Mes / Día — ISO' },
            ];

            const modal = document.createElement('div');
            modal.className = 'modal open';
            modal.style.zIndex = "10003";
            modal.innerHTML = `
            <div class="modal-content" style="max-width:520px;">
                <div class="modal-header"><h3>Formato de Fechas del Excel</h3></div>
                <p style="color:#aaa;margin:0 0 1.25rem;">Selecciona el formato de las fechas y verifica que las muestras se vean correctas (en verde).</p>
                <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:1.25rem;">
                    ${formats.map(fmt => `
                    <label class="datefmt-opt" style="display:flex;align-items:center;gap:14px;padding:12px 16px;border:1px solid ${fmt.value === detectedFmt ? '#666' : '#333'};border-radius:8px;cursor:pointer;box-sizing:border-box;width:100%;">
                        <input type="radio" name="date-fmt" value="${fmt.value}" ${fmt.value === detectedFmt ? 'checked' : ''} style="flex-shrink:0;margin:0;width:16px;height:16px;">
                        <div style="flex:1;min-width:0;">
                            <div style="color:#e0e0e0;font-weight:600;font-size:14px;">${fmt.label}</div>
                            <div style="color:#666;font-size:12px;margin-top:2px;">${fmt.hint}</div>
                        </div>
                    </label>`).join('')}
                </div>
                <p style="font-size:12px;color:#555;margin:0 0 6px;">Muestra de 8 registros distribuidos del archivo:</p>
                <table style="width:100%;border-collapse:collapse;margin-bottom:1.5rem;font-size:13px;">
                    <thead><tr style="border-bottom:1px solid #222;">
                        <th style="text-align:left;padding:6px 10px;color:#555;font-weight:normal;width:60px;">Fila</th>
                        <th style="text-align:left;padding:6px 10px;color:#555;font-weight:normal;width:110px;">En el Excel</th>
                        <th style="text-align:left;padding:6px 10px;color:#555;font-weight:normal;">Se interpreta como</th>
                    </tr></thead>
                    <tbody id="datefmt-rows">${buildRows(detectedFmt)}</tbody>
                </table>
                <div style="display:flex;gap:12px;justify-content:flex-end;padding-top:1rem;border-top:1px solid #333;">
                    <button id="datefmt-cancel" class="prev-btn" style="padding:10px 20px;background:transparent;border:1px solid #444;">Cancelar importación</button>
                    <button id="datefmt-confirm" class="submit-btn" style="padding:10px 24px;">Confirmar y continuar</button>
                </div>
            </div>`;

            document.body.appendChild(modal);
            const cleanup = () => modal.remove();

            modal.querySelectorAll('input[name="date-fmt"]').forEach(radio => {
                radio.addEventListener('change', () => {
                    modal.querySelectorAll('.datefmt-opt').forEach(l => l.style.borderColor = '#333');
                    radio.closest('.datefmt-opt').style.borderColor = '#666';
                    modal.querySelector('#datefmt-rows').innerHTML = buildRows(radio.value);
                });
            });

            modal.querySelector('#datefmt-confirm').addEventListener('click', () => {
                const fmt = modal.querySelector('input[name="date-fmt"]:checked')?.value || 'dmy';
                cleanup(); resolve(fmt);
            });
            modal.querySelector('#datefmt-cancel').addEventListener('click', () => { cleanup(); resolve(null); });
        });
    },

    reparseFlightDates: (flights, rawDates, fmt) => {
        // rawDates[i] = { value, excelRow }
        flights.forEach((f, i) => {
            const rd = rawDates[i];
            const val = rd ? rd.value : null;
            if (val == null || val === '') { f['Fecha'] = null; return; }
            if (typeof val === 'number') { f['Fecha'] = new Date(Date.UTC(1899, 11, 30 + val)); return; }
            const parts = String(val).trim().split(/[\/\-\.]/);
            if (parts.length !== 3) { f['Fecha'] = null; return; }
            let [p1, p2, p3] = parts.map(p => parseInt(p, 10));
            let year, month, day;
            if (fmt === 'dmy')      { day = p1; month = p2 - 1; year = p3 < 100 ? 2000 + p3 : p3; }
            else if (fmt === 'mdy') { month = p1 - 1; day = p2; year = p3 < 100 ? 2000 + p3 : p3; }
            else if (fmt === 'ymd') { year = p1 < 100 ? 2000 + p1 : p1; month = p2 - 1; day = p3; }
            const d = new Date(Date.UTC(year, month, day));
            f['Fecha'] = isNaN(d.getTime()) ? null : d;
        });
    },

    showValidationModal: (flights) => {
        return new Promise((resolve) => {
            const totalHoras     = flights.reduce((s, f) => s + (f['Duracion Total de Vuelo'] || 0), 0);
            const totalAterrDia  = flights.reduce((s, f) => s + (f['Aterrizajes Dia']          || 0), 0);
            const totalAterrNoche= flights.reduce((s, f) => s + (f['Aterrizajes Noche']        || 0), 0);

            const fmtH = (v) => (typeof formatHours === 'function') ? formatHours(v) : v.toFixed(2);

            const inputStyle = `width:90px;text-align:right;background:#111;border:1px solid #333;border-radius:4px;color:inherit;padding:4px 8px;font-size:14px;`;
            const rowStyle   = `border-bottom:1px solid #222;`;
            const cellPad    = `padding:10px 4px;`;

            const modal = document.createElement('div');
            modal.className = 'modal open';
            modal.style.zIndex = "10001";
            modal.innerHTML = `
            <div class="modal-content" style="max-width:520px;">
                <div class="modal-header">
                    <h3>Verificar Importación</h3>
                </div>
                <p style="color:#aaa;margin:0 0 1.25rem;">
                    Se procesaron <strong style="color:#fff;">${flights.length} vuelos</strong>.
                    Ingresa los totales de tu Excel para verificar. La validación es opcional.
                </p>
                <table style="width:100%;border-collapse:collapse;margin-bottom:1.5rem;">
                    <thead>
                        <tr style="border-bottom:1px solid #333;">
                            <th style="text-align:left;padding:8px 4px;font-size:12px;color:#888;">Campo</th>
                            <th style="text-align:right;padding:8px 4px;font-size:12px;color:#888;">Importado</th>
                            <th style="text-align:right;padding:8px 4px;font-size:12px;color:#888;">Tu total</th>
                            <th style="width:32px;"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="val-row" data-imported="${totalHoras}" data-type="hours" style="${rowStyle}">
                            <td style="${cellPad}">Horas totales</td>
                            <td style="text-align:right;${cellPad}">${fmtH(totalHoras)}</td>
                            <td style="text-align:right;${cellPad}"><input type="number" step="0.01" min="0" placeholder="—" style="${inputStyle}"></td>
                            <td style="text-align:center;${cellPad}font-size:18px;" class="val-icon"></td>
                        </tr>
                        <tr class="val-row" data-imported="${totalAterrDia}" data-type="int" style="${rowStyle}">
                            <td style="${cellPad}">Aterrizajes diurnos</td>
                            <td style="text-align:right;${cellPad}">${totalAterrDia}</td>
                            <td style="text-align:right;${cellPad}"><input type="number" step="1" min="0" placeholder="—" style="${inputStyle}"></td>
                            <td style="text-align:center;${cellPad}font-size:18px;" class="val-icon"></td>
                        </tr>
                        <tr class="val-row" data-imported="${totalAterrNoche}" data-type="int">
                            <td style="${cellPad}">Aterrizajes nocturnos</td>
                            <td style="text-align:right;${cellPad}">${totalAterrNoche}</td>
                            <td style="text-align:right;${cellPad}"><input type="number" step="1" min="0" placeholder="—" style="${inputStyle}"></td>
                            <td style="text-align:center;${cellPad}font-size:18px;" class="val-icon"></td>
                        </tr>
                    </tbody>
                </table>
                <div style="display:flex;gap:10px;align-items:center;margin-bottom:1.25rem;">
                    <button id="val-verify-btn" class="next-btn" style="flex:0 0 auto;padding:10px 20px;">Verificar</button>
                    <span id="val-summary" style="font-size:13px;color:#aaa;"></span>
                </div>
                <div style="display:flex;gap:12px;justify-content:flex-end;padding-top:1rem;border-top:1px solid #333;">
                    <button id="val-cancel-btn" class="prev-btn" style="padding:10px 20px; background: transparent; border: 1px solid #444;">Cancelar</button>
                    <button id="val-confirm-btn" class="submit-btn" style="padding:10px 24px;">Confirmar importación</button>
                </div>
            </div>`;

            document.body.appendChild(modal);
            const cleanup = () => modal.remove();

            modal.querySelector('#val-verify-btn').addEventListener('click', () => {
                const rows = modal.querySelectorAll('.val-row');
                let allOk = true;
                let anyEntered = false;

                rows.forEach(row => {
                    const input    = row.querySelector('input');
                    const icon     = row.querySelector('.val-icon');
                    const rawVal   = input.value.trim();
                    if (!rawVal) { icon.textContent = ''; return; }

                    anyEntered = true;
                    const imported  = parseFloat(row.dataset.imported);
                    const entered   = parseFloat(rawVal.replace(',', '.'));
                    const isHours   = row.dataset.type === 'hours';
                    const tolerance = isHours ? (2 / 60) : 0.5;
                    const diff      = Math.abs(imported - entered);

                    if (diff <= tolerance) {
                        icon.textContent = '✓';
                        icon.style.color = '#4caf50';
                    } else {
                        icon.textContent = '✗';
                        icon.style.color = '#f44336';
                        const diffLabel = isHours ? fmtH(diff) : Math.round(diff);
                        icon.title = `Diferencia: ${diffLabel}`;
                        allOk = false;
                    }
                });

                const summary = modal.querySelector('#val-summary');
                if (!anyEntered) {
                    summary.textContent = 'Ingresa al menos un total para verificar.';
                } else if (allOk) {
                    summary.textContent = '✓ Los totales coinciden.';
                    summary.style.color = '#4caf50';
                } else {
                    summary.textContent = 'Hay discrepancias.';
                    summary.style.color = '#f44336';
                }
            });

            modal.querySelector('#val-confirm-btn').addEventListener('click', () => { cleanup(); resolve(true); });
            modal.querySelector('#val-cancel-btn').addEventListener('click', () => { cleanup(); resolve(false); });
        });
    },

    showPageNumberModal: (flights, currentMaxPage) => {
        return new Promise((resolve) => {
            const hasExcelPages = flights.some(f => parseInt(f['Pagina Bitacora a Replicar']) > 0);
            const nextPage = (currentMaxPage || 0) + 1;

            const modal = document.createElement('div');
            modal.className = 'modal open';
            modal.style.zIndex = "10002";
            modal.innerHTML = `
            <div class="modal-content" style="max-width:460px;">
                <div class="modal-header">
                    <h3>Páginas de Bitácora</h3>
                </div>
                <p style="color:#aaa;margin:0 0 1.5rem;">¿Cómo deseas asignar los números de página para los ${flights.length} vuelos importados?</p>
                <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:1.75rem;">
                    <label style="display:flex;align-items:flex-start;gap:14px;padding:14px 16px;border:1px solid #555;border-radius:8px;cursor:pointer;box-sizing:border-box;width:100%;" id="page-opt-auto-label">
                        <input type="radio" name="page-mode" value="auto" style="flex-shrink:0;margin-top:2px;width:16px;height:16px;" checked>
                        <div style="flex:1;min-width:0;">
                            <div style="color:#e0e0e0;font-weight:600;font-size:14px;">Numeración automática</div>
                            <div style="color:#888;font-size:13px;margin-top:3px;">Asigna páginas consecutivas empezando en la ${nextPage} (siguiente a tu última página actual).</div>
                        </div>
                    </label>
                    <label style="display:flex;align-items:flex-start;gap:14px;padding:14px 16px;border:1px solid #333;border-radius:8px;cursor:pointer;box-sizing:border-box;width:100%;${!hasExcelPages ? 'opacity:0.45;pointer-events:none;' : ''}" id="page-opt-excel-label">
                        <input type="radio" name="page-mode" value="excel" style="flex-shrink:0;margin-top:2px;width:16px;height:16px;" ${!hasExcelPages ? 'disabled' : ''}>
                        <div style="flex:1;min-width:0;">
                            <div style="color:#e0e0e0;font-weight:600;font-size:14px;">Usar valores del Excel</div>
                            <div style="color:#888;font-size:13px;margin-top:3px;">${hasExcelPages ? 'Mantiene los números de página que vienen en el archivo.' : 'El Excel no contiene números de página.'}</div>
                        </div>
                    </label>
                </div>
                <div style="display:flex;gap:12px;justify-content:flex-end;padding-top:1rem;border-top:1px solid #333;">
                    <button id="page-modal-cancel" class="prev-btn" style="padding:10px 20px;background:transparent;border:1px solid #444;">Cancelar importación</button>
                    <button id="page-modal-confirm" class="submit-btn" style="padding:10px 24px;">Continuar</button>
                </div>
            </div>`;

            document.body.appendChild(modal);
            const cleanup = () => modal.remove();

            modal.querySelectorAll('input[name="page-mode"]').forEach(radio => {
                radio.addEventListener('change', () => {
                    modal.querySelectorAll('label[id^="page-opt"]').forEach(l => l.style.borderColor = '#333');
                    const checked = modal.querySelector('input[name="page-mode"]:checked');
                    if (checked) checked.closest('label').style.borderColor = '#555';
                });
            });
            modal.querySelector('input[name="page-mode"]:checked').closest('label').style.borderColor = '#555';

            modal.querySelector('#page-modal-confirm').addEventListener('click', () => {
                const mode = modal.querySelector('input[name="page-mode"]:checked')?.value || 'auto';
                cleanup();
                resolve(mode);
            });
            modal.querySelector('#page-modal-cancel').addEventListener('click', () => { cleanup(); resolve(null); });
        });
    }
};