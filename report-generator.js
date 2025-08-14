// --- MÓDULO DE GENERACIÓN DE REPORTES (CON RESUMEN MEJORADO) ---

const reportGenerator = {

    generate: () => {
        // ... (Esta función no cambia)
        const fromPage = parseInt(document.getElementById('print-page-from').value, 10) || 1;
        const toPageInput = document.getElementById('print-page-to');
        const toPage = parseInt(toPageInput.value, 10) || ui.getLastPageNumber();
        const includeSummary = document.getElementById('print-include-summary').checked;
        const flightsForReport = flightData.filter(flight => {
            const pageNum = flight["Pagina Bitacora a Replicar"];
            return pageNum >= fromPage && pageNum <= toPage;
        });
        if (flightsForReport.length === 0) {
            alert("No se encontraron vuelos en el rango de páginas especificado.");
            return;
        }
        const reportHtml = reportGenerator.buildReportHtml(flightsForReport, includeSummary, fromPage, toPage);
        const reportWindow = window.open('', '_blank');
        reportWindow.document.write(reportHtml);
        reportWindow.document.close();
    },
    
    // ... (getPrintHeaderStructure, buildColgroup, buildLogbookHeader, buildLogbookRow no cambian) ...
    getPrintHeaderStructure: () => {
        let printStructure = JSON.parse(JSON.stringify(HEADER_STRUCTURE));
        printStructure = printStructure.filter(header => header.name !== 'Observaciones');
        const abbreviations = { "Duracion Total de Vuelo": "Hrs Totales", "Aeronave Marca y Modelo": "Aeronave", "Matricula Aeronave": "Matrícula", "Piloto al Mando (PIC)": "PIC", "Copiloto (SIC)": "SIC", "Instruccion Recibida": "Instrucción", "Como Instructor": "Instructor", "Simulador o Entrenador de Vuelo": "Simulador", "Pagina Bitacora a Replicar": "Pág." };
        printStructure.forEach(header => {
            const newShort = abbreviations[header.name];
            if (newShort) header.short = newShort;
            if (header.isGroup) {
                header.children = header.children.map(child => abbreviations[child] || child);
            }
        });
        return printStructure;
    },
    buildReportHtml: (flights, includeSummary, fromPage, toPage) => {
        const today = new Date().toLocaleDateString('es-CL');
        const printHeaderStructure = reportGenerator.getPrintHeaderStructure();
        let html = `
            <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
                <title>Reporte de Vuelo (${fromPage}-${toPage})</title>
                <link rel="stylesheet" href="print.css">
            </head><body id="print-report-body" class="print-preview">
        `;
        if (includeSummary) {
            html += reportGenerator.buildSummaryPage(fromPage, toPage, today);
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
    buildColgroup: () => {
        const widths = ["4.5%", "5.5%", "5.5%", "4.3%", "4.3%", "7%", "2.5%", "2.5%", "2.5%", "2.5%", "2.5%", "2.5%", "2.5%", "2.5%", "3.4%", "3.4%", "3.8%", "3.8%", "3.8%", "2.5%", "3.6%", "3%", "3%", "3%", "3%", "3%", "3%", "3%", "3%"];
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
        const abbreviations = { "Hrs Totales": "Duracion Total de Vuelo", "Aeronave": "Aeronave Marca y Modelo", "Matrícula": "Matricula Aeronave", "PIC": "Piloto al Mando (PIC)", "SIC": "Copiloto (SIC)", "Instrucción": "Instruccion Recibida", "Instructor": "Como Instructor", "Simulador": "Simulador o Entrenador de Vuelo", "Pág.": "Pagina Bitacora a Replicar" };
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

    // --- FUNCIÓN buildSummaryPage CORREGIDA ---
    buildSummaryPage: (fromPage, toPage, today) => {
        const allTotals = calculateTotals(flightData, SUMMARIZABLE_HEADERS);
        const p = userProfile.personal || {};
        const l = userProfile.licenses || {};

        const licenseNames = { 'lic-ap-numero': 'Alumno Piloto', 'lic-pd-numero': 'Piloto Deportivo', 'lic-pp-numero': 'Piloto Privado', 'lic-pc-numero': 'Piloto Comercial', 'lic-ptla-numero': 'Piloto de TLA' };
        const licensesHtml = Object.keys(licenseNames).filter(key => l[key]).map(key => `<tr><td>${licenseNames[key]}:</td><td><strong>${l[key]}</strong></td></tr>`).join('');

        const totalGroups = {
            "Tiempos Generales": ["Duracion Total de Vuelo", "Diurno", "Nocturno", "IFR"],
            "Tipos de Aeronave": AIRCRAFT_TYPE_HEADERS,
            "Roles y Tipos de Vuelo": ["Piloto al Mando (PIC)", "Copiloto (SIC)", "Instruccion Recibida", "Como Instructor", "Solo", "Travesia", "Simulador o Entrenador de Vuelo"],
            "Aterrizajes y Aprox.": ["Aterrizajes Dia", "Aterrizajes Noche", "NO"]
        };
        
        const buildTotalsGroup = (groupName) => {
            let html = `<div class="totals-group"><h4>${groupName}</h4><table class="totals-table"><tbody>`;
            const headers = totalGroups[groupName];
            for (let i = 0; i < headers.length; i += 2) {
                html += '<tr>';
                const h1 = headers[i];
                const v1 = (h1.includes("Aterrizajes") || h1 === "NO") ? Math.round(allTotals[h1] || 0) : (allTotals[h1] || 0).toFixed(1);
                html += `<td>${h1.replace("(PIC)", "").replace("(SIC)", "")}</td><td>${v1}</td>`;
                const h2 = headers[i + 1];
                if (h2) {
                    const v2 = (h2.includes("Aterrizajes") || h2 === "NO") ? Math.round(allTotals[h2] || 0) : (allTotals[h2] || 0).toFixed(1);
                    html += `<td>${h2.replace("(PIC)", "").replace("(SIC)", "")}</td><td>${v2}</td>`;
                } else {
                    html += '<td></td><td></td>';
                }
                html += '</tr>';
            }
            html += '</tbody></table></div>';
            return html;
        };

        const periods = [{ label: 'Últimos 30 días', days: 30 }, { label: 'Últimos 60 días', days: 60 }, { label: 'Últimos 90 días', days: 90 }, { label: 'Últimos 180 días', days: 180 }, { label: 'Último Año', days: 365 }];
        const recencyHeaders = ["Duracion Total de Vuelo", "Diurno", "Nocturno", "Aterrizajes Dia", "Aterrizajes Noche", "IFR", "NO"];
        const recencyData = periods.map(period => {
            const limitDate = new Date(); 
            limitDate.setDate(limitDate.getDate() - period.days);
            const periodFlights = flightData.filter(f => !isNaN(f.Fecha.getTime()) && f.Fecha >= limitDate);
            const totals = calculateTotals(periodFlights, recencyHeaders);

        const totalHours = (totals["Duracion Total de Vuelo"] || 0).toFixed(1);
        const dayHours = (totals["Diurno"] || 0).toFixed(1);
        const nightHours = (totals["Nocturno"] || 0).toFixed(1);
        const hoursText = `${totalHours} (${dayHours}/${nightHours})`;

        const dayLandings = Math.round(totals["Aterrizajes Dia"] || 0);
        const nightLandings = Math.round(totals["Aterrizajes Noche"] || 0);
        const totalLandings = dayLandings + nightLandings;
        const landingsText = `${totalLandings} (${dayLandings}/${nightLandings})`;

        return {
            label: period.label,
            hours: hoursText,
            landings: landingsText,
            ifr: (totals["IFR"] || 0).toFixed(1),
            approaches: Math.round(totals["NO"] || 0)
        };
    });

    // 2. Se actualiza el HTML de la tabla con el nuevo encabezado y el uso de los datos formateados
    const recencyTableHtml = `
        <table class="recency-table">
            <thead>
                <tr>
                    <th>Período</th>
                    <th>Horas (D/N)</th>
                    <th>Aterrizajes (D/N)</th>
                    <th>Hrs IFR</th>
                    <th>Aprox. IFR</th>
                </tr>
            </thead>
            <tbody>
                ${recencyData.map(row => `
                    <tr>
                        <td>${row.label}</td>
                        <td>${row.hours}</td>
                        <td>${row.landings}</td>
                        <td>${row.ifr}</td>
                        <td>${row.approaches}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;


return `
            <div class="page summary-page">
                <div class="report-header"><img src="logo-avion-osc.png" class="report-logo" alt="Logo"><h1>Resumen de Experiencia de Vuelo</h1></div>
                

                <table class="info-details-table">
                    <tbody>
                        <tr>
                            <td class="info-personal">
                                <p><strong>Piloto:</strong> ${p['profile-nombre'] || 'N/A'}</p>
                                <p><strong>RUT:</strong> ${p['profile-rut'] || 'N/A'}</p>
                                <p><strong>Fecha de Nacimiento:</strong> ${p['profile-nacimiento'] ? new Date(p['profile-nacimiento']+'T00:00:00Z').toLocaleDateString('es-CL') : 'N/A'}</p>
                            </td>
                            <td class="info-licencias">
                                ${licensesHtml ? `<table><tbody>${licensesHtml}</tbody></table>` : '<p>No hay licencias registradas.</p>'}
                            </td>
                            <td class="info-reporte">
                                <p><strong>Fecha del Reporte:</strong> ${today}</p>
                            </td>
                        </tr>
                    </tbody>
                </table>

                
                <h3>Totales Generales (Toda la Bitácora)</h3>
                <div class="totals-grid-container">${reportGenerator.buildTotalsForLayout(allTotals)}</div>

                <h3>Actividad Reciente</h3>
                <table class="recency-table">
                    <thead><tr><th>Período</th><th>Horas (D/N)</th><th>Aterrizajes (D/N)</th><th>Hrs IFR</th><th>Aprox. IFR</th></tr></thead>
                    <tbody>${recencyData.map(row => `<tr><td>${row.label}</td><td>${row.hours}</td><td>${row.landings}</td><td>${row.ifr}</td><td>${row.approaches}</td></tr>`).join('')}</tbody>
                </table>
                <div class="report-footer"><p>Resumen generado automáticamente. El detalle de los vuelos de las páginas ${fromPage} a ${toPage} se encuentra en las hojas siguientes.</p></div>
            </div>
        `;
    },

    // Nueva función para generar el HTML de los totales, para mantener el código limpio
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
                const h1 = headers[i], v1 = (h1.includes("Aterrizajes") || h1 === "NO") ? Math.round(allTotals[h1] || 0) : (allTotals[h1] || 0).toFixed(1);
                tableHtml += `<td>${h1.replace("(PIC)", "").replace("(SIC)", "")}</td><td>${v1}</td>`;
                const h2 = headers[i + 1];
                if (h2) {
                    const v2 = (h2.includes("Aterrizajes") || h2 === "NO") ? Math.round(allTotals[h2] || 0) : (allTotals[h2] || 0).toFixed(1);
                    tableHtml += `<td>${h2.replace("(PIC)", "").replace("(SIC)", "")}</td><td>${v2}</td>`;
                } else { tableHtml += '<td></td><td></td>'; }
                tableHtml += '</tr>';
            }
            return tableHtml + '</tbody>';
        };

        return `
            <div class="totals-column"><table class="totals-table">${buildGroupHtml("Tiempos Generales")}${buildGroupHtml("Roles y Tipos de Vuelo")}</table></div>
            <div class="totals-column"><table class="totals-table">${buildGroupHtml("Tipos de Aeronave")}${buildGroupHtml("Aterrizajes y Aprox.")}</table></div>
        `;
    }
};