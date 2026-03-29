// --- MÓDULO DE GENERACIÓN DE REPORTES (VERSIÓN FINAL COMPATIBLE CON ANDROID Y MAC) ---
const LOGO_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAggAAAEQCAYAAADVkYwIAAAAAXNSR0IArs4c6QAAIABJREFUeF7snQl8nFXV/3/nPpMutKUsAqIsAhWwQOksmZm00BYUFfVFxD+vqLyuiAuiqAiZ4FIQkoDghrggKC74vgouoIK0TVug7azPTFqkArKKIltLWbqkmec5/95JUiaTmcz2zGQmc57PJ59Cc+85537v0+Q3dzmHII8QEAJCQAgIASEgBHIIkBARAkJACAgBISAEhEAuAREI8k4IASEgBISAEBACYwiIQJCXQggIASEgBISAEBCBIO+AEBACQkAICAEhUJyArCAUZyQthIAQEAJCQAi0HAERCC035TJgISAEhIAQEALFCYhAKM5IWggBISAEhIAQaDkCIhBabsplwEJACAgBISAEihMQgVCckbQQAkJACAgBIdByBEQgtNyUy4CFgBAQAkJACBQnIAKhOCNpIQSEgBAQAkKg5QiIQGi5KZcBCwEhIASEgBAoTkAEQnFG0kIICAEhIASEQMsREIHQclMuAxYCQkAICAEhUJyACITijKSFEBACQkAICIGWIyACoeWmXAYsBISAEBACQqA4AREIxRlJCyEgBISAEBACLUdABELLTbkMWAgIASEgBIRAcQIiEIozkhZCQAgIASEgBFqOgAiElptyGbAQEAJCQAgIgeIERCAUZyQthIAQEAJCQAi0HAERCC035TJgISAEhIAQEALFCYhAKM5IWggBISAEhIAQaDkCIhBabsplwEJACAgBISAEihMQgVCckbQQAkJACAgBIdByBEQgtNyUy4CFgBAQAkJACBQnIAKhOCNpIQSEgBAQAkKg5QiIQGi5KZcBCwEhIASEgBAoTkAEQnFG0kIICAEhIASEQMsREIHQclMuAxYCQkAICAEhUJyACITijKSFEBACQkAICIGWIyACoeWmXAYsBISAEBACQqA4AREIxRlJCyEgBISAEBACLUdABELLTbkMWAgIASEgBIRAcQIiEIozkhZCQAgIASEgBFqOgAiElptyGbAQEAJCQAgIgeIERCAUZyQthIAQEAJCQAi0HAERCC035TJgISAEhIAQEAKFCfjm+5Yk+hOrRSDIWyIEhIAQEAJCQAjsJuD1+P9h2eoUEQjyUggBISAEhIAQEAIZAj63//1M+LVlq8NEIMhLIQSEgBAQAkJA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';
const reportGenerator = {

    generate: () => {
        const paperSize = window.matchMedia('print') ? 
        (screen.width > 1400 ? 'letter' : 'a4') : 'a4';
        const fromPage = parseInt(document.getElementById('print-page-from').value, 10) || 1;
        const toPageInput = document.getElementById('print-page-to');
        const toPage = parseInt(toPageInput.value, 10) || ui.getLastPageNumber();
        const includeSummary = document.getElementById('print-include-summary').checked;

        const hasActiveFilters = Object.keys(logbookState.filters).length > 0;
        let flightsForReport;

        if (hasActiveFilters) {
            flightsForReport = logbookState.filteredData;
        } else {
            flightsForReport = flightData.filter(flight => {
                const pageNum = flight["Pagina Bitacora a Replicar"];
                return pageNum >= fromPage && pageNum <= toPage;
            });
        }

        if (flightsForReport.length === 0) {
            alert("No hay vuelos para los criterios seleccionados.");
            return;
        }

        const reportHtml = reportGenerator.buildReportHtml(flightsForReport, includeSummary, fromPage, toPage);

        // --- DETECCIÓN DE DISPOSITIVO ---
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

        if (isMobile) {
            // MÉTODO ANDROID: Blob
            const blob = new Blob([reportHtml], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            window.location.href = url;
        } else {
            // MÉTODO MAC/DESKTOP: ventana nueva
            const reportWindow = window.open('', '_blank');
            reportWindow.document.write(reportHtml);
            reportWindow.document.close();
        }
    },

    buildReportHtml: (flights, includeSummary, fromPage, toPage) => {
        const today = new Date().toLocaleDateString('es-CL');
        const printHeaderStructure = reportGenerator.getPrintHeaderStructure();
        const logoSrc = LOGO_BASE64.length > 50 
            ? `data:image/png;base64,${LOGO_BASE64}` 
            : 'logo-avion-osc.png';
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

        // CSS completo inyectado — solo se usa en Android/móvil
        // En Mac/desktop se carga print.css externo que ya tiene todos los estilos correctos
        const cssInyectado = `
            @media screen {
                #print-report-body { background-color: #555 !important; display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 20px 0; }
                #print-report-body .page { background: white !important; margin: 0; box-shadow: 0 0 10px rgba(0,0,0,0.5); }
            }

            #print-report-body { color: #000 !important; font-family: system-ui, sans-serif; font-size: 10pt; }
            #print-report-body .page { width: 29.7cm; height: 20.9cm; padding: 1cm; box-sizing: border-box; page-break-after: always; display: flex; flex-direction: column; overflow: hidden; position: relative; }
            #print-report-body .page:last-child { page-break-after: auto; }

            #print-report-body .page::before { content: ''; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 60%; height: 60%; background-image: url('${logoSrc}'); background-repeat: no-repeat; background-position: center; background-size: contain; opacity: 0.12; z-index: 1; }
            #print-report-body .page > * { position: relative; z-index: 2; }

            .report-header { display: flex; align-items: center; gap: 1.5rem; padding-bottom: 0.1cm; border-bottom: 2px solid #000; }
            .report-logo { height: 60px; width: auto; }
            .report-header h1 { margin: 0; font-size: 18pt; color: #000; }

            .info-details-table { width: 100%; border-collapse: collapse; margin: 0.1cm 0; border-bottom: 1px solid #ccc; }
            .info-details-table td { vertical-align: top; padding: 0.1cm 0; }
            .info-details-table p { margin: 3px 0; font-size: 10pt; }
            .info-licencias table { width: 100%; }
            .info-licencias td { padding: 1px 0; font-size: 9pt; }
            .info-reporte { text-align: right; }

            #print-report-body .summary-page h3 { padding: 0.3cm 0 0.2cm; margin: 0; font-size: 13pt; color: #000; border: none; }
            .totals-grid-container { display: flex; gap: 1.5cm; }
            .totals-column { flex: 1; }

            .totals-group h4 { font-size: 10pt; font-weight: bold; margin: 8px 0 4px 0; padding-left: 5px; }
            .totals-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; table-layout: fixed; }
            .totals-table td { padding: 4px 8px; font-size: 8.5pt; border: 1px solid #ccc; }
            .totals-table td:nth-child(1) { width: 32%; }
            .totals-table td:nth-child(2) { width: 18%; text-align: center; font-family: 'Courier New', Courier, monospace; }
            .totals-table td:nth-child(3) { width: 32%; }
            .totals-table td:nth-child(4) { width: 18%; text-align: center; font-family: 'Courier New', Courier, monospace; }

            .recency-table { width: 100%; margin: 8px 0 1.5cm 0; border-collapse: collapse; }
            .recency-table th, .recency-table td { padding: 4px; border: 1px solid #ccc; text-align: left; }
            .recency-table th { background-color: #EEE; font-weight: bold; }
            .recency-table td:not(:first-child) { text-align: center; }
            .report-footer { margin-top: auto; padding-top: 0.3cm; border-top: 1px solid #ccc; font-size: 8pt; font-style: italic; }

            /* Marca de agua visible a través de tablas — sin !important para no pisar bg de encabezados */
            #print-report-body .logbook-page table { background-color: transparent; }
            #print-report-body .logbook-page th, #print-report-body .logbook-page td { background-color: transparent; }
            #print-report-body .recency-table th { background-color: rgba(238, 238, 238, 0.8); }

            .logbook-page .table-container { border: none; overflow: visible; flex-grow: 1; }
            #print-report-body .logbook-page table { width: 100%; border-collapse: collapse; table-layout: fixed; border: 2px solid #000; }
            #print-report-body .logbook-page thead { display: table-header-group; }
            #print-report-body .logbook-page th, #print-report-body .logbook-page td { border: 1px solid #333 !important; padding: 2px; font-size: 8pt; vertical-align: middle; text-align: center; word-break: break-word; }
            #print-report-body .logbook-page th { color: #000 !important; background-color: rgba(238, 238, 238, 0.85) !important; }
            #print-report-body .logbook-page td { vertical-align: top; font-family: 'Courier New', Courier, monospace; color: #000 !important; }
            #print-report-body .logbook-page thead tr:first-child th { white-space: nowrap; }
            #print-report-body .logbook-page thead tr:last-child th { height: 100px; padding: 2px; }
            #print-report-body .rotated-header { display: flex; align-items: center; justify-content: center; height: 100%; }
            #print-report-body .rotated-header > span { font-weight: bold; font-size: 8pt; writing-mode: vertical-rl; transform: rotate(180deg); }

            /* LÍNEAS DIVISORIAS - ENCABEZADO HORIZONTAL */
            #print-report-body #detailed-logbook-container thead tr:last-child th,
            #print-report-body #detailed-logbook-container thead tr:first-child th[rowspan] { border-bottom: 2px solid #000 !important; }

            /* LÍNEAS DIVISORIAS - VERTICALES EN ENCABEZADO Y CUERPO */
            #print-report-body #detailed-logbook-container thead tr:first-child th:nth-child(3),
            #print-report-body #detailed-logbook-container thead tr:first-child th:nth-child(4),
            #print-report-body #detailed-logbook-container thead tr:first-child th:nth-child(5),
            #print-report-body #detailed-logbook-container thead tr:first-child th:nth-child(6),
            #print-report-body #detailed-logbook-container thead tr:first-child th:nth-child(7),
            #print-report-body #detailed-logbook-container thead tr:first-child th:nth-child(8),
            #print-report-body #detailed-logbook-container thead tr:first-child th:nth-child(9),
            #print-report-body #detailed-logbook-container thead tr:first-child th:nth-child(10),
            #print-report-body #detailed-logbook-container thead tr:first-child th:nth-child(11),
            #print-report-body #detailed-logbook-container thead tr:first-child th:nth-child(12),
            #print-report-body #detailed-logbook-container thead tr:last-child th:nth-child(2),
            #print-report-body #detailed-logbook-container thead tr:last-child th:nth-child(10),
            #print-report-body #detailed-logbook-container thead tr:last-child th:nth-child(12),
            #print-report-body #detailed-logbook-container thead tr:last-child th:nth-child(15),
            #print-report-body #detailed-logbook-container thead tr:last-child th:nth-child(17),
            #print-report-body #detailed-logbook-container thead tr:last-child th:nth-child(24),
            #print-report-body #detailed-logbook-container tbody td:nth-child(3),
            #print-report-body #detailed-logbook-container tbody td:nth-child(5),
            #print-report-body #detailed-logbook-container tbody td:nth-child(6),
            #print-report-body #detailed-logbook-container tbody td:nth-child(14),
            #print-report-body #detailed-logbook-container tbody td:nth-child(16),
            #print-report-body #detailed-logbook-container tbody td:nth-child(19),
            #print-report-body #detailed-logbook-container tbody td:nth-child(21),
            #print-report-body #detailed-logbook-container tbody td:nth-child(28),
            #print-report-body #detailed-logbook-container tbody td:nth-child(29),
            #print-report-body #detailed-logbook-container tbody td:nth-child(30) { border-right: 2px solid #000 !important; }

            /* FIRMAS */
            .signature-container { display: flex; justify-content: space-between; margin-top: 1.5cm; gap: 1.5cm; }
            .signature-box { flex: 1; text-align: center; }
            .signature-line { border-top: 1px solid #000; margin-top: 1.2cm; margin-bottom: 0.1cm; }
            .signature-text { font-size: 8pt; font-weight: bold; text-transform: uppercase; }
            .certification-statement { margin-top: 0.8cm; font-style: italic; font-size: 10pt; text-align: left; }

            /* COMPACTAR RESUMEN */
            #print-report-body .page.summary-page { display: block !important; height: 20.9cm; overflow: visible !important; }
            .summary-page .totals-table td { padding: 2px 4px !important; font-size: 8pt !important; }
            .summary-page .recency-table td, .summary-page .recency-table th { padding: 3px !important; font-size: 8.5pt !important; }
            .summary-page h3 { margin: 5px 0 !important; font-size: 11pt !important; }

            @media print {
                @page { size: landscape; margin: 1cm; }
                #print-report-body { background-color: transparent !important; }
                #print-report-body .page { width: auto; height: auto; margin: 0; padding: 0; box-shadow: none !important; border: none !important; }
                .summary-page div[style*="border-top"] { border-top-color: #000 !important; border-top-width: 1.5pt !important; }
                * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
        `;

        // Mac/desktop: solo print.css externo (funciona perfecto, no tocar)
        // Android/móvil: CSS inyectado completo porque el blob no puede cargar archivos externos
        const headCss = isMobile
            ? `<style>${cssInyectado}</style>`
            : `<link rel="stylesheet" href="print.css">`;

        const viewportMeta = isMobile
            ? `<meta name="viewport" content="width=1122">`
            : '';

        let html = `
            <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
                ${viewportMeta}
                <title>Reporte de Vuelo (${fromPage}-${toPage})</title>
                ${headCss}
            </head><body id="print-report-body" class="print-preview">
        `;

        if (includeSummary) {
            html += reportGenerator.buildSummaryPage(fromPage, toPage, today, logoSrc);
        }

        const flightsPerPage = 20;
        const totalLogPages = Math.ceil(flights.length / flightsPerPage);
        for (let i = 0; i < totalLogPages; i++) {
            const startIndex = i * flightsPerPage;
            const endIndex = startIndex + flightsPerPage;
            const pageFlights = flights.slice(startIndex, endIndex);
            html += `
                <div class="page logbook-page">
                    <div id="detailed-logbook-container">
                        <div class="table-container">
                            <table>
                                ${reportGenerator.buildColgroup()}
                                ${reportGenerator.buildLogbookHeader(printHeaderStructure)}
                                <tbody>
                                    ${pageFlights.map(flight => reportGenerator.buildLogbookRow(flight, printHeaderStructure)).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        }
        html += `</body></html>`;
        return html;
    },

    buildSummaryPage: (fromPage, toPage, today, logoSrc) => {
        const allTotals = calculateTotals(flightData, SUMMARIZABLE_HEADERS);
        const p = userProfile.personal || {};
        const l = userProfile.licenses || {};

        const licenseLabels = { 'AP': 'Alumno Piloto', 'PD': 'Piloto Deportivo', 'PP': 'Piloto Privado', 'PC': 'Piloto Comercial', 'PTLA': 'Piloto TLA' };
        const dgac = l.dgac || {};
        const licencias = dgac.licencias || [];
        const habFuncion = dgac.habFuncion || [];
        const habEspeciales = dgac.habEspeciales || [];

        let licensesHtml = licencias.map(lic => {
            const label = licenseLabels[lic.licenciaId] || lic.licenciaId;
            const venc = lic.vencimiento ? ` (vence: ${new Date(lic.vencimiento+'T00:00:00Z').toLocaleDateString('es-CL', {timeZone:'UTC'})})` : '';
            return `<tr><td style="padding:0 5px; font-size: 9pt"><strong>${label}:</strong></td><td style="padding:0 5px;font-size: 9pt">${lic.numero}${venc}</td></tr>`;
        }).join('');
        licensesHtml += habFuncion.map(h => 
            `<tr><td style="padding:0 5px; font-size: 9pt"><strong>Habilitación:</strong></td><td style="padding:0 5px;font-size: 9pt">${h.funcion}</td></tr>`
        ).join('');
        licensesHtml += habEspeciales.map(h => 
            `<tr><td style="padding:0 5px; font-size: 9pt"><strong>Hab. Especial:</strong></td><td style="padding:0 5px;font-size: 9pt">${h.tipo}</td></tr>`
        ).join('');

        const periods = [{ label: 'Últimos 30 días', days: 30 }, { label: 'Últimos 60 días', days: 60 }, { label: 'Últimos 90 días', days: 90 }, { label: 'Últimos 180 días', days: 180 }, { label: 'Último Año', days: 365 }];
        const recencyHeaders = ["Duracion Total de Vuelo", "Diurno", "Nocturno", "Aterrizajes Dia", "Aterrizajes Noche", "IFR", "NO"];
        const recencyData = periods.map(period => {
            const limitDate = new Date();
            limitDate.setDate(limitDate.getDate() - period.days);
            const periodFlights = flightData.filter(f => !isNaN(f.Fecha.getTime()) && f.Fecha >= limitDate);
            const totals = calculateTotals(periodFlights, recencyHeaders);
            return {
                label: period.label,
                hours: `${(totals["Duracion Total de Vuelo"] || 0).toFixed(1)} (${(totals["Diurno"] || 0).toFixed(1)}/${(totals["Nocturno"] || 0).toFixed(1)})`,
                landings: `${Math.round((totals["Aterrizajes Dia"] || 0) + (totals["Aterrizajes Noche"] || 0))} (${Math.round(totals["Aterrizajes Dia"] || 0)}/${Math.round(totals["Aterrizajes Noche"] || 0)})`,
                ifr: (totals["IFR"] || 0).toFixed(1),
                approaches: Math.round(totals["NO"] || 0)
            };
        });

        return `
            <div class="page summary-page">
                <div class="report-header">
                    <img src="${logoSrc}" class="report-logo">
                    <h1>Resumen de Experiencia de Vuelo</h1>
                </div>

                <table class="info-details-table" style="margin-top: 0.1cm;">
                    <tbody><tr>
                        <td style="width: 35%; vertical-align: top;">
                            <p style="margin: 2px 0;"><strong>Piloto:</strong> ${p['profile-nombre'] || 'N/A'}</p>
                            <p style="margin: 2px 0;"><strong>RUT:</strong> ${p['profile-documento'] || 'N/A'}</p>
                            <p style="margin: 2px 0;"><strong>Nacimiento:</strong> ${p['profile-nacimiento'] ? new Date(p['profile-nacimiento']+'T00:00:00Z').toLocaleDateString('es-CL', { timeZone: 'UTC' }) : 'N/A'}</p>
                        </td>
                        <td style="width: 40%; vertical-align: top;">
                            <table style="font-size: 8pt; border-collapse: collapse;">${licensesHtml}</table>
                        </td>
                        <td style="width: 25%; text-align: right; vertical-align: top;">
                            <p><strong>Fecha Reporte:</strong> ${today}</p>
                        </td>
                    </tr></tbody>
                </table>

                <h3 style="margin: 5px 0; font-size: 11pt;">Totales Generales (Toda la Bitácora)</h3>
                <div class="totals-grid-container">
                    ${reportGenerator.buildTotalsForLayout(allTotals)}
                </div>

                <h3 style="margin: 5px 0; font-size: 11pt;">Actividad Reciente</h3>
                <table class="recency-table" style="width: 100%; border-collapse: collapse;">
                    <thead><tr><th>Período</th><th>Horas (D/N)</th><th>Aterrizajes (D/N)</th><th>Hrs IFR</th><th>Aprox. IFR</th></tr></thead>
                    <tbody>${recencyData.map(row => `<tr><td>${row.label}</td><td style="text-align:center">${row.hours}</td><td style="text-align:center">${row.landings}</td><td style="text-align:center">${row.ifr}</td><td style="text-align:center">${row.approaches}</td></tr>`).join('')}</tbody>
                </table>
                <div style="flex-grow: 1; min-height: 2.5cm;"></div>
                <div class="summary-footer" style="padding-top: 0.3cm;">
                    <div style="display: flex; justify-content: space-between; gap: 80px; align-items: flex-end; margin-bottom: 20px;">
                        <div style="flex: 1; text-align: center;">
                            <div style="border-top: 1.5px solid #000; margin-bottom: 8px;"></div>
                            <p style="margin: 0; font-size: 8.5pt;">Entidad que certifica Hrs. de Vuelo</p>
                            <p style="margin: 3px 0 0 0; font-size: 8.5pt; font-weight: bold;">TIMBRE Y FIRMA</p>
                        </div>
                        <div style="flex: 1; text-align: center;">
                            <div style="border-top: 1.5px solid #000; margin-bottom: 8px;"></div>
                            <p style="margin: 0; font-size: 8.5pt;">Certifico que los datos escritos en esta bitácora son fidedignos</p>
                            <p style="margin: 3px 0 0 0; font-size: 8.5pt; font-weight: bold;">FIRMA DEL PILOTO</p>
                        </div>
                    </div>
                    <div style="text-align: center; border-top: 1px solid #eee; padding-top: 5px;">
                        <p style="font-size: 7.5pt; font-style: italic; color: #777; margin: 0;">
                            Resumen generado automáticamente. Detalle de páginas ${fromPage} a ${toPage} se encuentra en las hojas siguientes.
                        </p>
                    </div>
                </div>
             </div>
        `;
    },

    buildTotalsForLayout: (allTotals) => {
        const totalGroups = {
            "Tiempos Generales": ["Duracion Total de Vuelo", "Diurno", "Nocturno", "IFR"],
            "Tipos de Aeronave": AIRCRAFT_TYPE_HEADERS,
            "Roles y Tipos de Vuelo": ["Piloto al Mando (PIC)", "Copiloto (SIC)", "Instruccion Recibida", "Como Instructor", "Solo", "Travesia", "Simulador o Entrenador de Vuelo"],
            "Aterrizajes y Aprox.": ["Aterrizajes Dia", "Aterrizajes Noche", "NO"]
        };

        const buildGroupHtml = (groupName) => {
            let tableHtml = `<thead><tr><th colspan="4">${groupName}</th></tr></thead><tbody>`;
            const headers = totalGroups[groupName];
            for (let i = 0; i < headers.length; i += 2) {
                tableHtml += '<tr>';
                const h1 = headers[i];
                const label1 = h1 ? h1.replace("NO", "App IFR").replace("Duracion Total de Vuelo", "Hrs. de Vuelo Total").replace("(PIC)", "").replace("(SIC)", "").replace(" o Entrenador de Vuelo", "") : '';
                const v1 = (h1 && (h1.includes("Aterrizajes") || h1 === "NO")) ? Math.round(allTotals[h1] || 0) : (allTotals[h1] || 0).toFixed(1);
                tableHtml += `<td>${label1}</td><td>${h1 ? v1 : ''}</td>`;

                const h2 = headers[i + 1];
                if (h2) {
                    const label2 = h2.replace("NO", "App IFR").replace("Duracion Total de Vuelo", "Hrs. de Vuelo Total").replace("(PIC)", "").replace("(SIC)", "").replace(" o Entrenador de Vuelo", "");
                    const v2 = (h2.includes("Aterrizajes") || h2 === "NO") ? Math.round(allTotals[h2] || 0) : (allTotals[h2] || 0).toFixed(1);
                    tableHtml += `<td>${label2}</td><td>${v2}</td>`;
                } else {
                    tableHtml += '<td></td><td></td>';
                }
                tableHtml += '</tr>';
            }
            return tableHtml + '</tbody>';
        };

        return `
            <div class="totals-column"><table class="totals-table">${buildGroupHtml("Tiempos Generales")}${buildGroupHtml("Roles y Tipos de Vuelo")}</table></div>
            <div class="totals-column"><table class="totals-table">${buildGroupHtml("Tipos de Aeronave")}${buildGroupHtml("Aterrizajes y Aprox.")}</table></div>
        `;
    },

    buildColgroup: () => {
        const widths = ["4.5%", "5.5%", "5.5%", "4.3%", "4.3%", "5%", "2.5%", "2.5%", "2.5%", "2.5%", "2.5%", "2.5%", "2.5%", "2.5%", "3.4%", "3.4%", "3.8%", "3.8%", "3.8%", "2.5%", "3.6%", "3%", "3%", "3%", "3%", "3%", "3%", "3%", "3%"];
        let colgroupHtml = '<colgroup>';
        widths.forEach(width => { colgroupHtml += `<col style="width: ${width};">`; });
        colgroupHtml += '</colgroup>';
        return colgroupHtml;
    },

    buildLogbookHeader: (printHeaderStructure) => {
        let headerHtml = `<thead><tr>`;
        printHeaderStructure.forEach(header => { headerHtml += `<th ${header.isGroup ? `colspan="${header.colspan}"` : `rowspan="2"`}>${header.short || header.name}</th>`; });
        headerHtml += `</tr><tr>`;
        printHeaderStructure.forEach(header => {
            if (!header.isGroup) return;
            header.children.forEach(child => { headerHtml += `<th><div class="rotated-header"><span>${child.replace("Aterrizajes ", "")}</span></div></th>`; });
        });
        headerHtml += `</tr></thead>`;
        return headerHtml;
    },

    buildLogbookRow: (flight, printHeaderStructure) => {
        const abbreviations = { "Hrs<br>Totales": "Duracion Total de Vuelo", "Aeronave": "Aeronave Marca y Modelo", "Matrícula": "Matricula Aeronave", "PIC": "Piloto al Mando (PIC)", "SIC": "Copiloto (SIC)", "Instrucción": "Instruccion Recibida", "Instructor": "Como Instructor", "Simulador": "Simulador o Entrenador de Vuelo", "Pág.": "Pagina Bitacora a Replicar", "Nº": "NO" };
        let rowHtml = `<tr>`;
        const headersToRender = printHeaderStructure.flatMap(h => h.isGroup ? h.children : [h.short || h.name]);
        headersToRender.forEach(headerName => {
            const originalHeaderName = abbreviations[headerName] || headerName;
            let value = flight[originalHeaderName];
            let formattedValue = "";
            if (value instanceof Date) {
                formattedValue = !isNaN(value.getTime()) ? value.toLocaleDateString("es-CL", { timeZone: "UTC" }).split("-").reverse().join("-") : '';
            } else if (typeof value === 'number' && originalHeaderName !== 'Tipo') {
                formattedValue = (SUMMARIZABLE_HEADERS.includes(originalHeaderName) && !originalHeaderName.includes("Aterrizajes") && originalHeaderName !== "NO") ? value.toFixed(1) : value;
            } else {
                formattedValue = value === undefined || value === null ? "" : value;
            }
            rowHtml += `<td>${formattedValue}</td>`;
        });
        rowHtml += `</tr>`;
        return rowHtml;
    },

    getPrintHeaderStructure: () => {
        let printStructure = JSON.parse(JSON.stringify(HEADER_STRUCTURE));
        printStructure = printStructure.filter(header => header.name !== 'Observaciones');
        const abbreviations = { "Duracion Total de Vuelo": "Hrs<br>Totales", "Aeronave Marca y Modelo": "Aeronave", "Matricula Aeronave": "Matrícula", "Piloto al Mando (PIC)": "PIC", "Copiloto (SIC)": "SIC", "Instruccion Recibida": "Instrucción", "Como Instructor": "Instructor", "Simulador o Entrenador de Vuelo": "Simulador", "Pagina Bitacora a Replicar": "Pág.", "NO": "Nº" };
        printStructure.forEach(header => {
            const newShort = abbreviations[header.name];
            if (newShort) header.short = newShort;
            if (header.isGroup) {
                header.children = header.children.map(child => abbreviations[child] || child);
            }
        });
        return printStructure;
    }
};