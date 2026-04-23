// --- MÓDULO DE IMPORTACIÓN DE DATOS ---
// Este archivo contiene la lógica para procesar archivos Excel y no será modificado en el futuro.

const dataImporter = {
    processExcelFile: async (file) => {
        const dataStatus = document.getElementById('data-status');
        dataStatus.textContent = 'Procesando archivo...';
        dataStatus.className = 'status';

        const parseDate = (dateInput) => { if (!dateInput) return null; if (dateInput instanceof Date) return dateInput; if (typeof dateInput === 'number') return new Date(Date.UTC(1899, 11, 30 + dateInput)); if (typeof dateInput !== 'string') return null; const separators = /[\/\-\.]/; const parts = dateInput.split(separators); if (parts.length !== 3) return null; let [p1, p2, p3] = parts.map(p => parseInt(p, 10)); let year, month, day; if (p1 > 1000) { year = p1; month = p2 - 1; day = p3; } else if (p3 > 1000) { day = p1; month = p2 - 1; year = p3; } else if (p1 > 31) { year = p1 < 100 ? 2000 + p1 : p1; month = p2 - 1; day = p3; } else { day = p1; month = p2 - 1; year = p3 < 100 ? 2000 + p3 : p3; } const date = new Date(Date.UTC(year, month, day)); return isNaN(date.getTime()) ? null : date; };

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

            let loadedFlights = dataRows.map((row, rowIndex) => {
                if (!Array.isArray(row) || row.every(cell => cell === null)) return null;
                const firstCellContent = row[0] ? row[0].toString().toLowerCase() : '';
                if (totalKeywords.some(keyword => firstCellContent.includes(keyword))) { return null; }

                const newFlight = {
                    id: Date.now().toString() + (rowIndex * Math.random()).toString().slice(2) // <-- AÑADIR ID ÚNICO
                };
                HEADERS.slice(1).forEach((headerName, index) => { if (index < row.length) { newFlight[headerName] = row[index]; } });

                const simTime = parseTimeToHours(newFlight['Simulador o Entrenador de Vuelo']);
                let duration = simTime > 0 ? simTime : parseTimeToHours(newFlight['Duracion Total de Vuelo']);
                if (duration <= 0) { return null; }

                newFlight.Fecha = parseDate(newFlight.Fecha);
                if (!newFlight.Fecha) { newFlight.Fecha = new Date('Invalid Date'); }

                const pageFromExcel = parseInt(newFlight["Pagina Bitacora a Replicar"], 10);
                newFlight["Pagina Bitacora a Replicar"] = (pageFromExcel && !isNaN(pageFromExcel)) ? pageFromExcel : Math.floor(rowIndex / 8) + 1;
                
                const integerHeaders = ["Aterrizajes Dia", "Aterrizajes Noche", "NO"];
                HEADERS.forEach(header => {
                    if (header === 'Tipo') {
                        newFlight[header] = newFlight[header] ? String(newFlight[header]) : '';
                    }
                    if (integerHeaders.includes(header)) {
                        newFlight[header] = Math.trunc(parseFloat(String(newFlight[header]).replace(",", ".")) || 0);
                    } 
                    else if (SUMMARIZABLE_HEADERS.includes(header)) {
                        newFlight[header] = parseTimeToHours(newFlight[header]);
                    }
                    else if (['Aeronave Marca y Modelo', 'Matricula Aeronave', 'Desde', 'Hasta', 'Observaciones', 'Tipo'].includes(header)) {
                         newFlight[header] = newFlight[header] ? String(newFlight[header]) : '';
                    }
                });

                if (simTime > 0) newFlight['Duracion Total de Vuelo'] = simTime;

                return newFlight;
            }).filter(Boolean);

            if (loadedFlights.length === 0) throw new Error("No se pudo procesar ninguna fila con datos válidos.");
            
            dataStatus.textContent = `¡Éxito! Se procesaron ${loadedFlights.length} vuelos.`;
            dataStatus.className = 'status success';
            
            return { success: true, data: loadedFlights.reverse() };

        } catch (error) {
            console.error("Error procesando el archivo Excel:", error);
            dataStatus.textContent = `Error: ${error.message}`;
            dataStatus.className = 'status error';
            return { success: false, data: [] };
        }
    },

    showValidationModal: (flights) => {
        return new Promise((resolve) => {
            const totalHoras     = flights.reduce((s, f) => s + (f['Duracion Total de Vuelo'] || 0), 0);
            const totalAterrDia  = flights.reduce((s, f) => s + (f['Aterrizajes Dia']          || 0), 0);
            const totalAterrNoche= flights.reduce((s, f) => s + (f['Aterrizajes Noche']        || 0), 0);

            const fmtH = (v) => (typeof formatHours === 'function') ? formatHours(v) : v.toFixed(2);

            const inputStyle = `width:90px;text-align:right;background:var(--bg-color,#111);border:1px solid var(--border-color,#333);border-radius:4px;color:inherit;padding:4px 8px;font-size:14px;`;
            const rowStyle   = `border-bottom:1px solid var(--border-color,#222);`;
            const cellPad    = `padding:10px 4px;`;

            const modal = document.createElement('div');
            modal.className = 'modal open';
            modal.innerHTML = `
            <div class="modal-content" style="max-width:520px;">
                <div class="modal-header">
                    <h3>Verificar Importación</h3>
                </div>
                <p style="color:var(--text-secondary,#aaa);margin:0 0 1.25rem;">
                    Se procesaron <strong style="color:var(--text-color,#fff);">${flights.length} vuelos</strong>.
                    Ingresa los totales de tu Excel para verificar. La validación es opcional.
                </p>
                <table style="width:100%;border-collapse:collapse;margin-bottom:1.5rem;">
                    <thead>
                        <tr style="border-bottom:1px solid var(--border-color,#333);">
                            <th style="text-align:left;padding:8px 4px;font-size:12px;color:var(--text-secondary,#888);">Campo</th>
                            <th style="text-align:right;padding:8px 4px;font-size:12px;color:var(--text-secondary,#888);">Importado</th>
                            <th style="text-align:right;padding:8px 4px;font-size:12px;color:var(--text-secondary,#888);">Tu total</th>
                            <th style="width:32px;"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="val-row" data-imported="${totalHoras}" data-type="hours" style="${rowStyle}">
                            <td style="${cellPad}">Horas totales</td>
                            <td style="text-align:right;${cellPad}font-variant-numeric:tabular-nums;">${fmtH(totalHoras)}</td>
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
                    <span id="val-summary" style="font-size:13px;color:var(--text-secondary,#aaa);"></span>
                </div>
                <div style="display:flex;gap:12px;justify-content:flex-end;padding-top:1rem;border-top:1px solid var(--border-color,#333);">
                    <button id="val-cancel-btn" class="settings-btn-secondary" style="padding:10px 20px;">Cancelar</button>
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
                    summary.style.color = 'var(--text-secondary,#aaa)';
                } else if (allOk) {
                    summary.textContent = '✓ Los totales coinciden.';
                    summary.style.color = '#4caf50';
                } else {
                    summary.textContent = 'Hay discrepancias. Pasa el cursor sobre ✗ para ver la diferencia.';
                    summary.style.color = '#f44336';
                }
            });

            modal.querySelector('#val-confirm-btn').addEventListener('click', () => { cleanup(); resolve(true); });
            modal.querySelector('#val-cancel-btn').addEventListener('click', () => { cleanup(); resolve(false); });
        });
    }
};