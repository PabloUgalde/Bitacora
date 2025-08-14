// --- MÓDULO DE RENDERIZADO PARA RESÚMENES (BLINDADO) ---
// Contiene la lógica para todos los resúmenes completados. No modificar.

const summaryRenderer = {
    // --- RESUMEN POR PÁGINA ---
    byPage: () => {
        const container = document.getElementById('summary-by-page-container');
        if (!container) return;
        container.innerHTML = "";
        if (!flightData || flightData.length === 0) {
            container.innerHTML = "<p>No hay páginas para resumir.</p>";
            return;
        }
        const summaryStructure = [HEADER_STRUCTURE.find(h => h.name === 'Duracion Total de Vuelo'), HEADER_STRUCTURE.find(h => h.name === 'Avión'), HEADER_STRUCTURE.find(h => h.name === 'Aterrizajes'), HEADER_STRUCTURE.find(h => h.name === 'Condición de Vuelo'), HEADER_STRUCTURE.find(h => h.name === 'APP'), HEADER_STRUCTURE.find(h => h.name === 'Tipo de Tiempo de Vuelo')].filter(Boolean);
        const summaryHeaders = summaryStructure.flatMap(group => group.isGroup ? group.children : [group.name]);
        let headerHtml = '<thead><tr><th rowspan="2" class="sticky-col">Info Página</th>';
        summaryStructure.forEach(header => { headerHtml += `<th ${header.isGroup ? `colspan="${header.colspan}"` : `rowspan="2"`}>${header.short || header.name}</th>`; });
        headerHtml += '</tr><tr>';
        summaryStructure.forEach(header => { if (header.isGroup) { header.children.forEach(child => { headerHtml += `<th>${child.replace("Aterrizajes ", "").replace(/o Entrenador de Vuelo|de Vuelo/g, "").trim()}</th>`; }); } });
        headerHtml += '</tr></thead>';
        const pageNumbers = [...new Set(flightData.map(f => f["Pagina Bitacora a Replicar"]))].sort((a, b) => a - b);
        let previousTotals = calculateTotals([], summaryHeaders);
        let content = '';
        pageNumbers.forEach(pageNumber => {
            const pageFlights = flightData.filter(f => f["Pagina Bitacora a Replicar"] === pageNumber);
            if (pageFlights.length === 0 && !Object.values(previousTotals).some(v => v > 0)) return;
            const pageTotals = calculateTotals(pageFlights, summaryHeaders);
            const accumulatedTotals = {};
            summaryHeaders.forEach(h => accumulatedTotals[h] = (previousTotals[h] || 0) + (pageTotals[h] || 0));
            let table = `<div class="table-container summary-page-table"><h3>Página ${pageNumber}</h3><table>${headerHtml}<tbody>`;
            ['Total Página', 'Total Anterior', 'Total Acumulado'].forEach(rowType => {
                table += `<tr><td class="sticky-col">${rowType}</td>`;
                summaryHeaders.forEach(h => {
                    let value = 0;
                    if (rowType === 'Total Página') value = pageTotals[h] || 0;
                    else if (rowType === 'Total Anterior') value = previousTotals[h] || 0;
                    else value = accumulatedTotals[h] || 0;
                    table += `<td style="text-align: center;">${(h.includes("Aterrizajes") || h === "NO") ? Math.round(value) : value.toFixed(1)}</td>`;
                });
                table += '</tr>';
            });
            table += '</tbody></table></div>';
            content += table;
            previousTotals = accumulatedTotals;
        });
        container.innerHTML = content;
    },

    // --- RESUMEN ANUAL / MENSUAL ---
    byTime: () => {
        const yearSelect = document.getElementById('time-summary-year-select');
        const yearlyContainer = document.getElementById('yearly-summary-table-container');
        const monthlyContainer = document.getElementById('monthly-breakdown-container');
        if (!yearSelect || !yearlyContainer || !monthlyContainer) return;

        const allYears = [...new Set(flightData.map(f => f.Fecha.getUTCFullYear()))].sort((a, b) => b - a);
        if (yearSelect.options.length <= 1 || allYears.length !== (yearSelect.options.length - 1)) {
            const currentYearVal = yearSelect.value;
            yearSelect.innerHTML = '<option value="all">Ver Todos los Años</option>';
            allYears.forEach(year => yearSelect.add(new Option(year, year)));
            yearSelect.value = currentYearVal && allYears.includes(parseInt(currentYearVal)) ? currentYearVal : 'all';
        }

        const summaryHeaders = ["Duracion Total de Vuelo", "Aterrizajes Dia", "Aterrizajes Noche", "Diurno", "Nocturno", "IFR", "Simulador o Entrenador de Vuelo", "Travesia", "Solo", "Piloto al Mando (PIC)", "Copiloto (SIC)", "Instruccion Recibida", "Como Instructor"];
        const selectedYear = yearSelect.value;
        const yearsToDisplay = selectedYear === 'all' ? allYears : [parseInt(selectedYear, 10)];
        const yearlyTotals = yearsToDisplay.map(year => {
            const yearData = flightData.filter(f => f.Fecha.getUTCFullYear() === year);
            return { year, totals: calculateTotals(yearData, summaryHeaders) };
        });

        let yearlyHtml = `<h3>${selectedYear === 'all' ? 'Totales por Año' : `Total para ${selectedYear}`}</h3><div class="table-container"><table><thead><tr><th>Año</th><th>Hrs Totales</th><th>Aterrizajes (D/N)</th><th>Diurno</th><th>Nocturno</th><th>IFR</th><th>Sim</th><th>Travesía</th><th>Solo</th><th>PIC</th><th>SIC</th><th>Instrucción</th><th>Instructor</th></tr></thead><tbody>`;
        yearlyTotals.forEach(data => { const landings = (data.totals["Aterrizajes Dia"] || 0) + (data.totals["Aterrizajes Noche"] || 0); yearlyHtml += `<tr><td><strong>${data.year}</strong></td><td>${(data.totals["Duracion Total de Vuelo"] || 0).toFixed(1)}</td><td>${landings} (${Math.round(data.totals["Aterrizajes Dia"] || 0)}/${Math.round(data.totals["Aterrizajes Noche"] || 0)})</td><td>${(data.totals["Diurno"] || 0).toFixed(1)}</td><td>${(data.totals["Nocturno"] || 0).toFixed(1)}</td><td>${(data.totals["IFR"] || 0).toFixed(1)}</td><td>${(data.totals["Simulador o Entrenador de Vuelo"] || 0).toFixed(1)}</td><td>${(data.totals["Travesia"] || 0).toFixed(1)}</td><td>${(data.totals["Solo"] || 0).toFixed(1)}</td><td>${(data.totals["Piloto al Mando (PIC)"] || 0).toFixed(1)}</td><td>${(data.totals["Copiloto (SIC)"] || 0).toFixed(1)}</td><td>${(data.totals["Instruccion Recibida"] || 0).toFixed(1)}</td><td>${(data.totals["Como Instructor"] || 0).toFixed(1)}</td></tr>`; });
        yearlyHtml += `</tbody></table></div>`;
        yearlyContainer.innerHTML = yearlyHtml;

        if (selectedYear === 'all') { monthlyContainer.innerHTML = ''; return; }
        const yearData = flightData.filter(f => f.Fecha.getUTCFullYear() === parseInt(selectedYear, 10));
        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const monthlyTotals = monthNames.map((name, index) => { const monthData = yearData.filter(f => f.Fecha.getUTCMonth() === index); return { month: name, totals: calculateTotals(monthData, summaryHeaders), hasData: monthData.length > 0 }; }).filter(m => m.hasData);
        let monthlyHtml = `<h3>Desglose Mensual para ${selectedYear}</h3><div class="table-container"><table><thead><tr><th>Mes</th><th>Hrs Totales</th><th>Aterrizajes (D/N)</th><th>Diurno</th><th>Nocturno</th><th>IFR</th><th>Sim</th><th>Travesía</th><th>Solo</th><th>PIC</th><th>SIC</th><th>Instrucción</th><th>Instructor</th></tr></thead><tbody>`;
        monthlyTotals.forEach(data => { const landings = (data.totals["Aterrizajes Dia"] || 0) + (data.totals["Aterrizajes Noche"] || 0); monthlyHtml += `<tr><td><strong>${data.month}</strong></td><td>${(data.totals["Duracion Total de Vuelo"] || 0).toFixed(1)}</td><td>${landings} (${Math.round(data.totals["Aterrizajes Dia"] || 0)}/${Math.round(data.totals["Aterrizajes Noche"] || 0)})</td><td>${(data.totals["Diurno"] || 0).toFixed(1)}</td><td>${(data.totals["Nocturno"] || 0).toFixed(1)}</td><td>${(data.totals["IFR"] || 0).toFixed(1)}</td><td>${(data.totals["Simulador o Entrenador de Vuelo"] || 0).toFixed(1)}</td><td>${(data.totals["Travesia"] || 0).toFixed(1)}</td><td>${(data.totals["Solo"] || 0).toFixed(1)}</td><td>${(data.totals["Piloto al Mando (PIC)"] || 0).toFixed(1)}</td><td>${(data.totals["Copiloto (SIC)"] || 0).toFixed(1)}</td><td>${(data.totals["Instruccion Recibida"] || 0).toFixed(1)}</td><td>${(data.totals["Como Instructor"] || 0).toFixed(1)}</td></tr>`; });
        monthlyHtml += `</tbody></table></div>`;
        monthlyContainer.innerHTML = monthlyHtml;
    },

    // --- RESUMEN POR AERONAVE ---
    populateAircraftSummaryFilters: function() {
        const yearSelect = document.getElementById('aircraft-summary-year-select');
        const monthSelect = document.getElementById('aircraft-summary-month-select');
        if (!yearSelect || !monthSelect) return;
        const allYears = [...new Set(flightData.map(f => f.Fecha.getUTCFullYear()))].sort((a, b) => b - a);
        if (yearSelect.options.length <= 1) { yearSelect.innerHTML = '<option value="all">Todos los Años</option>'; allYears.forEach(year => yearSelect.add(new Option(year, year))); }
        const selectedYear = yearSelect.value;
        const yearData = selectedYear === 'all' ? flightData : flightData.filter(f => f.Fecha.getUTCFullYear() === parseInt(selectedYear, 10));
        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const monthsInYear = [...new Set(yearData.map(f => f.Fecha.getUTCMonth()))].sort((a, b) => a - b);
        const currentMonthVal = monthSelect.value;
        monthSelect.innerHTML = '<option value="all">Todos los Meses</option>';
        monthsInYear.forEach(monthIndex => monthSelect.add(new Option(monthNames[monthIndex], monthIndex)));
        if (monthsInYear.includes(parseInt(currentMonthVal))) { monthSelect.value = currentMonthVal; }
    },
    byAircraft: () => {
        summaryRenderer.populateAircraftSummaryFilters(); 
        const tableContainer = document.getElementById('aircraft-summary-table-container');
        const activeButton = document.querySelector('#aircraft-group-by-buttons .toggle-btn.active');
        if (!tableContainer || !activeButton) return;
        const yearSelect = document.getElementById('aircraft-summary-year-select');
        const monthSelect = document.getElementById('aircraft-summary-month-select');
        const groupByKey = activeButton.dataset.value;
        const selectedYear = yearSelect.value;
        const selectedMonth = monthSelect.value;
        let filteredData = flightData;
        if (selectedYear !== 'all') { filteredData = filteredData.filter(f => f.Fecha.getUTCFullYear() === parseInt(selectedYear, 10)); }
        if (selectedMonth !== 'all') { filteredData = filteredData.filter(f => f.Fecha.getUTCMonth() === parseInt(selectedMonth, 10)); }
        if (filteredData.length === 0) { tableContainer.innerHTML = "<div class='table-container'><p style='padding: 1rem; text-align: center;'>No hay datos para el período seleccionado.</p></div>"; return; }
        const aircraftGroups = filteredData.reduce((acc, flight) => { const key = flight[groupByKey]; if (key) { if (!acc[key]) acc[key] = []; acc[key].push(flight); } return acc; }, {});
        if (groupByKey === 'Matricula Aeronave') {
            const summaryHeaders = ["Duracion Total de Vuelo", "Aterrizajes Dia", "Aterrizajes Noche", "Diurno", "Nocturno", "IFR", "Travesia", "Solo", "Piloto al Mando (PIC)", "Copiloto (SIC)", "Instruccion Recibida", "Como Instructor"];
            const aircraftTotals = Object.entries(aircraftGroups).map(([key, flights]) => ({ key: key, totals: calculateTotals(flights, summaryHeaders) })).sort((a, b) => b.totals["Duracion Total de Vuelo"] - a.totals["Duracion Total de Vuelo"]);
            let tableHtml = `<div class="table-container"><table><thead><tr><th>Matrícula</th><th>Hrs Totales</th><th>Aterrizajes (D/N)</th><th>Diurno</th><th>Nocturno</th><th>IFR</th><th>Travesía</th><th>Solo</th><th>PIC</th><th>SIC</th><th>Instrucción</th><th>Instructor</th></tr></thead><tbody>`;
            aircraftTotals.forEach(data => { const landings = (data.totals["Aterrizajes Dia"] || 0) + (data.totals["Aterrizajes Noche"] || 0); tableHtml += `<tr><td><strong>${data.key}</strong></td><td>${(data.totals["Duracion Total de Vuelo"] || 0).toFixed(1)}</td><td>${landings} (${Math.round(data.totals["Aterrizajes Dia"] || 0)}/${Math.round(data.totals["Aterrizajes Noche"] || 0)})</td><td>${(data.totals["Diurno"] || 0).toFixed(1)}</td><td>${(data.totals["Nocturno"] || 0).toFixed(1)}</td><td>${(data.totals["IFR"] || 0).toFixed(1)}</td><td>${(data.totals["Travesia"] || 0).toFixed(1)}</td><td>${(data.totals["Solo"] || 0).toFixed(1)}</td><td>${(data.totals["Piloto al Mando (PIC)"] || 0).toFixed(1)}</td><td>${(data.totals["Copiloto (SIC)"] || 0).toFixed(1)}</td><td>${(data.totals["Instruccion Recibida"] || 0).toFixed(1)}</td><td>${(data.totals["Como Instructor"] || 0).toFixed(1)}</td></tr>`; });
            tableHtml += `</tbody></table></div>`;
            tableContainer.innerHTML = tableHtml;
        } else {
            const summaryHeaders = ["Duracion Total de Vuelo", "Aterrizajes Dia", "Aterrizajes Noche", "Diurno", "Nocturno", "IFR", "Simulador o Entrenador de Vuelo", "Travesia", "Solo", "Piloto al Mando (PIC)", "Copiloto (SIC)", "Instruccion Recibida", "Como Instructor"];
            const aircraftTotals = Object.entries(aircraftGroups).map(([key, flights]) => ({ key: key, totals: calculateTotals(flights, summaryHeaders) })).sort((a, b) => b.totals["Duracion Total de Vuelo"] - a.totals["Duracion Total de Vuelo"]);
            let tableHtml = `<div class="table-container"><table><thead><tr><th>Modelo</th><th>Hrs Totales</th><th>Aterrizajes (D/N)</th><th>Diurno</th><th>Nocturno</th><th>IFR</th><th>Simulador</th><th>Travesía</th><th>Solo</th><th>PIC</th><th>SIC</th><th>Instrucción</th><th>Instructor</th></tr></thead><tbody>`;
            aircraftTotals.forEach(data => { const landings = (data.totals["Aterrizajes Dia"] || 0) + (data.totals["Aterrizajes Noche"] || 0); tableHtml += `<tr><td><strong>${data.key}</strong></td><td>${(data.totals["Duracion Total de Vuelo"] || 0).toFixed(1)}</td><td>${landings} (${Math.round(data.totals["Aterrizajes Dia"] || 0)}/${Math.round(data.totals["Aterrizajes Noche"] || 0)})</td><td>${(data.totals["Diurno"] || 0).toFixed(1)}</td><td>${(data.totals["Nocturno"] || 0).toFixed(1)}</td><td>${(data.totals["IFR"] || 0).toFixed(1)}</td><td>${(data.totals["Simulador o Entrenador de Vuelo"] || 0).toFixed(1)}</td><td>${(data.totals["Travesia"] || 0).toFixed(1)}</td><td>${(data.totals["Solo"] || 0).toFixed(1)}</td><td>${(data.totals["Piloto al Mando (PIC)"] || 0).toFixed(1)}</td><td>${(data.totals["Copiloto (SIC)"] || 0).toFixed(1)}</td><td>${(data.totals["Instruccion Recibida"] || 0).toFixed(1)}</td><td>${(data.totals["Como Instructor"] || 0).toFixed(1)}</td></tr>`; });
            tableHtml += `</tbody></table></div>`;
            tableContainer.innerHTML = tableHtml;
        }
    },

    // --- RESUMEN IFR ---
    populateIFRSummaryFilters: function() {
        const yearSelect = document.getElementById('ifr-summary-year-select');
        const monthSelect = document.getElementById('ifr-summary-month-select');
        if (!yearSelect || !monthSelect) return;
        const ifrFlights = flightData.filter(f => f.IFR > 0);
        const allYears = [...new Set(ifrFlights.map(f => f.Fecha.getUTCFullYear()))].sort((a, b) => b - a);
        if (yearSelect.options.length <= 1 || allYears.length !== (yearSelect.options.length - 1)) { const currentYearVal = yearSelect.value; yearSelect.innerHTML = '<option value="all">Todos los Años</option>'; allYears.forEach(year => yearSelect.add(new Option(year, year))); yearSelect.value = allYears.includes(parseInt(currentYearVal)) ? currentYearVal : 'all'; }
        const selectedYear = yearSelect.value;
        const yearData = selectedYear === 'all' ? ifrFlights : ifrFlights.filter(f => f.Fecha.getUTCFullYear() === parseInt(selectedYear, 10));
        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const monthsInYear = [...new Set(yearData.map(f => f.Fecha.getUTCMonth()))].sort((a, b) => a - b);
        const currentMonthVal = monthSelect.value;
        monthSelect.innerHTML = '<option value="all">Todos los Meses</option>';
        monthsInYear.forEach(monthIndex => monthSelect.add(new Option(monthNames[monthIndex], monthIndex)));
        if (monthsInYear.includes(parseInt(currentMonthVal))) { monthSelect.value = currentMonthVal; }
    },
    byIFR: () => {
        summaryRenderer.populateIFRSummaryFilters(); 
        const tableContainer = document.getElementById('ifr-summary-table-container');
        const activeButton = document.querySelector('#ifr-group-by-buttons .toggle-btn.active');
        if (!tableContainer || !activeButton) return;
        const yearSelect = document.getElementById('ifr-summary-year-select');
        const monthSelect = document.getElementById('ifr-summary-month-select');
        const groupByKey = activeButton.dataset.value;
        let filteredData = flightData.filter(f => f.IFR > 0);
        const selectedYear = yearSelect.value;
        const selectedMonth = monthSelect.value;
        if (selectedYear !== 'all') { filteredData = filteredData.filter(f => f.Fecha.getUTCFullYear() === parseInt(selectedYear, 10)); }
        if (selectedMonth !== 'all') { filteredData = filteredData.filter(f => f.Fecha.getUTCMonth() === parseInt(selectedMonth, 10)); }
        if (filteredData.length === 0) { tableContainer.innerHTML = "<div class='table-container'><p style='padding: 1rem; text-align: center;'>No hay vuelos IFR para el período seleccionado.</p></div>"; return; }
        const aircraftGroups = filteredData.reduce((acc, flight) => { const key = flight[groupByKey]; if (key) { if (!acc[key]) acc[key] = []; acc[key].push(flight); } return acc; }, {});
        if (groupByKey === 'Matricula Aeronave') {
            const summaryHeaders = ["IFR", "Diurno", "Nocturno", "NO", "Aterrizajes Dia", "Aterrizajes Noche", "Travesia", "Solo", "Piloto al Mando (PIC)", "Copiloto (SIC)", "Instruccion Recibida", "Como Instructor"];
            const aircraftTotals = Object.entries(aircraftGroups).map(([key, flights]) => ({ key: key, totals: calculateTotals(flights, summaryHeaders) })).sort((a, b) => b.totals.IFR - a.totals.IFR);
            let tableHtml = `<div class="table-container"><table><thead><tr><th>Matrícula</th><th>Hrs IFR</th><th>Hrs Día</th><th>Hrs Noche</th><th>Aprox.</th><th>Aterrizajes (D/N)</th><th>Travesía</th><th>Solo</th><th>PIC</th><th>SIC</th><th>Instrucción</th><th>Instructor</th></tr></thead><tbody>`;
            aircraftTotals.forEach(data => { const landings = (data.totals["Aterrizajes Dia"] || 0) + (data.totals["Aterrizajes Noche"] || 0); tableHtml += `<tr><td><strong>${data.key}</strong></td><td>${(data.totals.IFR || 0).toFixed(1)}</td><td>${(data.totals.Diurno || 0).toFixed(1)}</td><td>${(data.totals.Nocturno || 0).toFixed(1)}</td><td>${Math.round(data.totals.NO || 0)}</td><td>${landings} (${Math.round(data.totals["Aterrizajes Dia"] || 0)}/${Math.round(data.totals["Aterrizajes Noche"] || 0)})</td><td>${(data.totals.Travesia || 0).toFixed(1)}</td><td>${(data.totals.Solo || 0).toFixed(1)}</td><td>${(data.totals["Piloto al Mando (PIC)"] || 0).toFixed(1)}</td><td>${(data.totals["Copiloto (SIC)"] || 0).toFixed(1)}</td><td>${(data.totals["Instruccion Recibida"] || 0).toFixed(1)}</td><td>${(data.totals["Como Instructor"] || 0).toFixed(1)}</td></tr>`; });
            tableHtml += `</tbody></table></div>`;
            tableContainer.innerHTML = tableHtml;
        } else {
            const summaryHeaders = ["IFR", "Diurno", "Nocturno", "NO", "Aterrizajes Dia", "Aterrizajes Noche", "Simulador o Entrenador de Vuelo", "Travesia", "Solo", "Piloto al Mando (PIC)", "Copiloto (SIC)", "Instruccion Recibida", "Como Instructor"];
            const aircraftTotals = Object.entries(aircraftGroups).map(([key, flights]) => ({ key: key, totals: calculateTotals(flights, summaryHeaders) })).sort((a, b) => b.totals.IFR - a.totals.IFR);
            let tableHtml = `<div class="table-container"><table><thead><tr><th>Modelo</th><th>Hrs IFR</th><th>Hrs Día</th><th>Hrs Noche</th><th>Aprox.</th><th>Aterrizajes (D/N)</th><th>Simulador</th><th>Travesía</th><th>Solo</th><th>PIC</th><th>SIC</th><th>Instrucción</th><th>Instructor</th></tr></thead><tbody>`;
            aircraftTotals.forEach(data => { const landings = (data.totals["Aterrizajes Dia"] || 0) + (data.totals["Aterrizajes Noche"] || 0); tableHtml += `<tr><td><strong>${data.key}</strong></td><td>${(data.totals.IFR || 0).toFixed(1)}</td><td>${(data.totals.Diurno || 0).toFixed(1)}</td><td>${(data.totals.Nocturno || 0).toFixed(1)}</td><td>${Math.round(data.totals.NO || 0)}</td><td>${landings} (${Math.round(data.totals["Aterrizajes Dia"] || 0)}/${Math.round(data.totals["Aterrizajes Noche"] || 0)})</td><td>${(data.totals["Simulador o Entrenador de Vuelo"] || 0).toFixed(1)}</td><td>${(data.totals.Travesia || 0).toFixed(1)}</td><td>${(data.totals.Solo || 0).toFixed(1)}</td><td>${(data.totals["Piloto al Mando (PIC)"] || 0).toFixed(1)}</td><td>${(data.totals["Copiloto (SIC)"] || 0).toFixed(1)}</td><td>${(data.totals["Instruccion Recibida"] || 0).toFixed(1)}</td><td>${(data.totals["Como Instructor"] || 0).toFixed(1)}</td></tr>`; });
            tableHtml += `</tbody></table></div>`;
            tableContainer.innerHTML = tableHtml;
        }
    },
    
    // --- RESUMEN POR AERÓDROMO (RECUPERADO) ---
    populateAirportSummaryFilters: function() {
        const yearSelect = document.getElementById('airport-summary-year-select');
        const monthSelect = document.getElementById('airport-summary-month-select');
        if (!yearSelect || !monthSelect) return;
        if (flightData.length === 0) {yearSelect.innerHTML = '<option value="all">Todos los Años</option>'; monthSelect.innerHTML = '<option value="all">Todos los Meses</option>'; return;}
        const allYears = [...new Set(flightData.map(f => f.Fecha.getUTCFullYear()))].sort((a, b) => b - a);
        if (yearSelect.options.length <= 1) { yearSelect.innerHTML = '<option value="all">Todos los Años</option>'; allYears.forEach(year => yearSelect.add(new Option(year, year))); }
        const selectedYear = yearSelect.value;
        const yearData = selectedYear === 'all' ? flightData : flightData.filter(f => f.Fecha.getUTCFullYear() === parseInt(selectedYear, 10));
        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const monthsInYear = [...new Set(yearData.map(f => f.Fecha.getUTCMonth()))].sort((a, b) => a - b);
        const currentMonthVal = monthSelect.value;
        monthSelect.innerHTML = '<option value="all">Todos los Meses</option>';
        monthsInYear.forEach(monthIndex => monthSelect.add(new Option(monthNames[monthIndex], monthIndex)));
        if (monthsInYear.includes(parseInt(currentMonthVal))) { monthSelect.value = currentMonthVal; }
    },
    byAirport: () => {
        summaryRenderer.populateAirportSummaryFilters();
        const tableContainer = document.getElementById('airport-summary-table-container');
        const yearSelect = document.getElementById('airport-summary-year-select');
        const monthSelect = document.getElementById('airport-summary-month-select');
        if(!yearSelect || !tableContainer) return;
        const selectedYear = yearSelect.value;
        const selectedMonth = monthSelect.value;
        let filteredData = flightData;
        if (selectedYear !== 'all') { filteredData = filteredData.filter(f => f.Fecha.getUTCFullYear() === parseInt(selectedYear, 10)); }
        if (selectedMonth !== 'all') { filteredData = filteredData.filter(f => f.Fecha.getUTCMonth() === parseInt(selectedMonth, 10)); }
        if (filteredData.length === 0) { tableContainer.innerHTML = "<div class='table-container'><p style='padding: 1rem; text-align: center;'>No hay datos para el período seleccionado.</p></div>"; return; }
        const airportStats = {};
        const allAirports = new Set(filteredData.flatMap(f => [f.Desde, f.Hasta]).filter(Boolean));
        allAirports.forEach(airportCode => {
            const departures = filteredData.filter(f => f.Desde === airportCode);
            const arrivals = filteredData.filter(f => f.Hasta === airportCode);
            const arrivalTotals = calculateTotals(arrivals, ["Aterrizajes Dia", "Aterrizajes Noche", "NO"]);
            airportStats[airportCode] = { departures: departures.length, arrivals: arrivals.length, totalLandings: (arrivalTotals["Aterrizajes Dia"] || 0) + (arrivalTotals["Aterrizajes Noche"] || 0), dayLandings: arrivalTotals["Aterrizajes Dia"] || 0, nightLandings: arrivalTotals["Aterrizajes Noche"] || 0, approaches: arrivalTotals["NO"] || 0 };
        });
        const sortedAirports = Object.entries(airportStats).sort(([, a], [, b]) => (b.departures + b.arrivals) - (a.departures + a.arrivals));
        let tableHtml = `<div class="table-container"><table><thead><tr><th>Aeródromo</th><th>Salidas</th><th>Llegadas</th><th>Aterrizajes (Total)</th><th>Aterrizajes (Día/Noche)</th><th>Aproximaciones (APP)</th></tr></thead><tbody>`;
        sortedAirports.forEach(([code, stats]) => { if (stats.departures > 0 || stats.arrivals > 0) { tableHtml += `<tr><td><strong>${code}</strong></td><td>${stats.departures}</td><td>${stats.arrivals}</td><td>${stats.totalLandings}</td><td>${stats.dayLandings} / ${stats.nightLandings}</td><td>${stats.approaches}</td></tr>`; } });
        tableHtml += `</tbody></table></div>`;
        tableContainer.innerHTML = tableHtml;
    },
    // Dentro del objeto summaryRenderer

    // --- RESUMEN POR TIPO DE AVIÓN ---
    populateTypeSummaryFilters: function() {
        const yearSelect = document.getElementById('type-summary-year-select');
        const monthSelect = document.getElementById('type-summary-month-select');
        if (!yearSelect || !monthSelect) return;
        if (flightData.length === 0) {yearSelect.innerHTML = '<option value="all">Todos los Años</option>'; monthSelect.innerHTML = '<option value="all">Todos los Meses</option>';return;}

        const allYears = [...new Set(flightData.map(f => f.Fecha.getUTCFullYear()))].sort((a, b) => b - a);
        
        if (yearSelect.options.length <= 1) {
            yearSelect.innerHTML = '<option value="all">Todos los Años</option>';
            allYears.forEach(year => yearSelect.add(new Option(year, year)));
        }
        
        const selectedYear = yearSelect.value;
        const yearData = selectedYear === 'all' ? flightData : flightData.filter(f => f.Fecha.getUTCFullYear() === parseInt(selectedYear, 10));

        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const monthsInYear = [...new Set(yearData.map(f => f.Fecha.getUTCMonth()))].sort((a, b) => a - b);
        
        const currentMonthVal = monthSelect.value;
        monthSelect.innerHTML = '<option value="all">Todos los Meses</option>';
        monthsInYear.forEach(monthIndex => monthSelect.add(new Option(monthNames[monthIndex], monthIndex)));
        
        if (monthsInYear.includes(parseInt(currentMonthVal))) {
            monthSelect.value = currentMonthVal;
        }
    },

    byType: () => {
        summaryRenderer.populateTypeSummaryFilters();

        const yearSelect = document.getElementById('type-summary-year-select');
        const monthSelect = document.getElementById('type-summary-month-select');
        const tableContainer = document.getElementById('type-summary-table-container');
        if (!yearSelect || !monthSelect || !tableContainer) return;

        // 1. Filtrar por fecha
        const selectedYear = yearSelect.value;
        const selectedMonth = monthSelect.value;
        
        let filteredData = flightData;
        if (selectedYear !== 'all') {
            filteredData = filteredData.filter(f => f.Fecha.getUTCFullYear() === parseInt(selectedYear, 10));
        }
        if (selectedMonth !== 'all') {
            filteredData = filteredData.filter(f => f.Fecha.getUTCMonth() === parseInt(selectedMonth, 10));
        }

        if (filteredData.length === 0) {
            tableContainer.innerHTML = "<div class='table-container'><p style='padding: 1rem; text-align: center;'>No hay datos para el período seleccionado.</p></div>";
            return;
        }

        // 2. Calcular totales para todas las columnas relevantes
        const summaryHeaders = [...AIRCRAFT_TYPE_HEADERS, "Aterrizajes Dia", "Aterrizajes Noche", "NO", "Duracion Total de Vuelo"];
        const totals = calculateTotals(filteredData, summaryHeaders);

        // 3. Construir la tabla
        let tableHtml = `<div class="table-container"><table>
            <thead><tr>
                <th>Tipo de Avión</th>
                <th>Horas Totales</th>
                <th>Aterrizajes (Día/Noche)</th>
                <th>Aproximaciones (APP)</th>
            </tr></thead>
            <tbody>`;

        AIRCRAFT_TYPE_HEADERS.forEach(type => {
            const typeHours = totals[type] || 0;
            if (typeHours > 0) { // Solo mostrar tipos de avión con horas voladas
                // Para los aterrizajes, filtramos los vuelos de ese tipo específico
                const typeFlights = filteredData.filter(f => (f[type] || 0) > 0);
                const landingTotals = calculateTotals(typeFlights, ["Aterrizajes Dia", "Aterrizajes Noche", "NO"]);
                const dayLandings = Math.round(landingTotals["Aterrizajes Dia"] || 0);
                const nightLandings = Math.round(landingTotals["Aterrizajes Noche"] || 0);
                const approaches = Math.round(landingTotals["NO"] || 0);

                tableHtml += `<tr>
                    <td><strong>${type}</strong></td>
                    <td style="text-align: center;">${typeHours.toFixed(1)}</td>
                    <td style="text-align: center;">${dayLandings + nightLandings} (${dayLandings}/${nightLandings})</td>
                    <td style="text-align: center;">${approaches}</td>
                </tr>`;
            }
        });

        tableHtml += `</tbody></table></div>`;
        tableContainer.innerHTML = tableHtml;
    },
};