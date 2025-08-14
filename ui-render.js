// Contiene todas las funciones que generan HTML y dibujan en la pantalla.

const render = {
    destroyChart: (chartKey) => { if (charts[chartKey]) { charts[chartKey].destroy(); charts[chartKey] = null; } },
    
    dashboard: () => { 
        render.dashboardCards(); 
        render.dashboardTotalsTable(); 
        render.dashboardFlights(); 
        render.flightTimePieChart();
        render.recencySummary();
    },

    dashboardCards: () => {
        const container = document.getElementById("totals-display");
        if (!container) return;

        const fixedCards = DASHBOARD_CARDS.filter(c => c.isFixed);
        const defaultSelection = ['picHours', 'totalLandings', 'ifrHours', 'soloHours', 'xcHours', 'nightHours', 'nightLandings'];
        const userSelectedIds = userProfile.dashboardCards || defaultSelection;
        const userSelectedCards = userSelectedIds.map(id => DASHBOARD_CARDS.find(c => c.id === id)).filter(Boolean);

        const finalCards = [...fixedCards, ...userSelectedCards];

        if (flightData.length === 0) {
            // --- INICIO DE LA MODIFICACIÓN 1 ---
            container.innerHTML = finalCards.map(cardDef => {
                if (!cardDef) return '';
                const formattedZero = cardDef.formatFn(0);
                const zeroValue = String(formattedZero).includes('.') ? '0.0' : '0';
                // Añadimos la clase personalizada si existe
                return `<div class="summary-card ${cardDef.customClass || ''}"><h3>${cardDef.label}</h3><div class="value">${zeroValue}</div></div>`;
            }).join('');
            // --- FIN DE LA MODIFICACIÓN 1 ---
            return;
        }

        const totals = calculateTotals(flightData, SUMMARIZABLE_HEADERS);
        let cardsHtml = '';
        // --- INICIO DE LA MODIFICACIÓN 2 ---
        finalCards.forEach(cardDef => {
            if (!cardDef) return;
            let value = 0;
            if (Array.isArray(cardDef.dataKey)) {
                value = cardDef.dataKey.reduce((sum, key) => sum + (totals[key] || 0), 0);
            } else {
                value = totals[cardDef.dataKey] || 0;
            }
            const formattedValue = cardDef.formatFn(value);
            // Añadimos la clase personalizada si existe
            cardsHtml += `<div class="summary-card ${cardDef.customClass || ''}"><h3>${cardDef.label}</h3><div class="value">${formattedValue}</div></div>`;
        });
        // --- FIN DE LA MODIFICACIÓN 2 ---
        container.innerHTML = cardsHtml;
    },

    dashboardTotalsTable: () => { 
        const container = document.getElementById('dashboard-totals-table-container'); 
        if (!container) return; 
        if (flightData.length === 0) { container.innerHTML = "<p>No hay datos para mostrar totales.</p>"; 
            return; 
        } 
        const totals = calculateTotals(flightData, SUMMARIZABLE_HEADERS); 
            const totalGroups = { "Tiempos Generales": ["Duracion Total de Vuelo", "Diurno", "Nocturno", "IFR"], "Tipos de Aeronave": ["Monomotor", "Multimotor", "Turbo Helice", "Turbo Jet", "Helicoptero", "Planeador", "Ultraliviano", "LSA"], "Roles y Tipos de Vuelo": ["Piloto al Mando (PIC)", "Copiloto (SIC)", "Instruccion Recibida", "Como Instructor", "Solo", "Travesia", "Simulador o Entrenador de Vuelo", null], "Aterrizajes y Aprox.": ["Aterrizajes Dia", "Aterrizajes Noche", "NO", null] 
            }; 
            let tableHtml = '<table><tbody>'; 
            for (const groupName in totalGroups) { 
                tableHtml += `<tr><th colspan="4">${groupName}</th></tr>`; 
                const groupHeaders = totalGroups[groupName]; 
                for (let i = 0; i < groupHeaders.length; i += 2) { tableHtml += '<tr>'; 
                    const header1 = groupHeaders[i]; 
                    if (header1) { 
                        const value1 = (header1.includes("Aterrizajes") || header1 === "NO") ? Math.round(totals[header1] || 0) : (totals[header1] || 0).toFixed(1); 
                        tableHtml += `<td>${header1.replace("(PIC)", "").replace("(SIC)", "")}</td><td>${value1}</td>`; 
                    } else { 
                        tableHtml += '<td></td><td></td>'; 
                    } 
                    const header2 = groupHeaders[i + 1]; 
                    if (header2) { 
                        const value2 = (header2.includes("Aterrizajes") || header2 === "NO") ? Math.round(totals[header2] || 0) : (totals[header2] || 0).toFixed(1); 
                        tableHtml += `<td>${header2.replace("(PIC)", "").replace("(SIC)", "")}</td><td style="text-align: center; padding-right: 1.5rem;">${value2}</td>`;
                    } 
                    else { 
                        tableHtml += '<td></td><td></td>'; 
                    } 
                    tableHtml += '</tr>'; 
                } 
            } 
            tableHtml += '</tbody></table>'; 
            container.innerHTML = tableHtml; 
        },
    
    dashboardFlights: () => { 
        const container = document.getElementById("logbook-display-dashboard"); 
        if (!container) return; 
        container.innerHTML = ""; 
        if (flightData.length === 0) { 
            container.innerHTML = "<p>No hay vuelos registrados.</p>"; 
            return 
        } 
        const tableHeaders = ["Fecha", "Aeronave", "Ruta", "Duración", "Roles"]; 
        let table = `<div class="table-container"><table><thead><tr>${tableHeaders.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>`; 
        flightData.slice(0, 5).forEach(flight => { 
            const ruta = `${flight.Desde} - ${flight.Hasta}`; 
            const roles = Object.keys(flight).filter(k => ["Piloto al Mando (PIC)", "Copiloto (SIC)", "Instruccion Recibida", "Como Instructor"].includes(k) && flight[k] > 0).map(rol => { 
                if (rol === "Como Instructor") return "Instructor"; 
                return rol.match(/\(([^)]+)\)/)?.[1] || rol.split(" ")[0]; }).join(", "); 
                const duration = flight["Duracion Total de Vuelo"] || flight['Simulador o Entrenador de Vuelo'] || 0; 
                table += `<tr>
                            <td>${flight.Fecha ? flight.Fecha.toLocaleDateString("es-CL", { timeZone: "UTC" }) : 'N/A'}</td>
                            <td style="text-align: center;">${flight["Aeronave Marca y Modelo"]}</td>
                            <td style="text-align: center;">${ruta}</td>
                            <td style="text-align: center;">${duration.toFixed(1)}</td>
                            <td style="text-align: center;">${roles}</td>
                        </tr>`
                    }); 
                table += "</tbody></table></div>"; 
                container.innerHTML = table 
            },
    
    flightTimePieChart: () => {
        render.destroyChart('flightTimePie');
        const ctx = document.getElementById("flight-time-pie-chart")?.getContext("2d");
        if (!ctx || flightData.length === 0) return;
        const fieldsToSum = ["Piloto al Mando (PIC)", "Copiloto (SIC)", "Instruccion Recibida", "Como Instructor", "Simulador o Entrenador de Vuelo", "Travesia", "Solo"];
        const labels = ['PIC', 'SIC', 'Instrucción', 'Instructor', 'Simulador', 'Travesía', 'Solo'];
        const totals = calculateTotals(flightData, fieldsToSum);
        const allData = fieldsToSum.map(field => totals[field] || 0);
        const data = allData.filter(value => value > 0);
        const finalLabels = labels.filter((_, index) => allData[index] > 0);
        if (data.length === 0) return;
        charts.flightTimePie = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: finalLabels,
                datasets: [{ data: data, backgroundColor: ['rgba(212, 175, 55, 0.9)', 'rgba(169, 144, 59, 0.9)', 'rgba(54, 162, 235, 0.9)', 'rgba(75, 192, 192, 0.9)', 'rgba(153, 102, 255, 0.9)', 'rgba(255, 159, 64, 0.9)', 'rgba(255, 205, 86, 0.9)'], borderColor: 'rgba(24, 24, 24, 1)', borderWidth: 2 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { color: 'rgba(255, 255, 255, 0.8)', font: { size: 14 } } } } }
        });
    },

    recencySummary: () => {
        const container = document.getElementById('recency-summary-container');
        if (!container || flightData.length === 0) {
            if (container) container.innerHTML = "<div class='table-container'><p style='padding: 1rem; text-align: center;'>No hay vuelos para analizar.</p></div>";
            return;
        }
        const periods = [{ label: 'Últimos 30 días', days: 30 }, { label: 'Últimos 60 días', days: 60 }, { label: 'Últimos 90 días', days: 90 }, { label: 'Últimos 180 días', days: 180 }, { label: 'Último Año', days: 365 }];
        const headers = ["Duracion Total de Vuelo", "Diurno", "Nocturno", "Aterrizajes Dia", "Aterrizajes Noche", "IFR", "NO"];
        let tableHtml = `<div class="table-container"><table><thead><tr>
                            <th>Período</th>
                            <th>Horas (D/N)</th>
                            <th>Aterrizajes (D/N)</th>
                            <th>Hrs IFR</th>
                            <th>Aprox.</th>
                        </tr></thead><tbody>`;
    periods.forEach(period => {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const limitDate = new Date(today);
        limitDate.setDate(today.getDate() - period.days);
        const periodFlights = flightData.filter(f => f.Fecha && !isNaN(f.Fecha.getTime()) && f.Fecha >= limitDate);
        
        const totals = calculateTotals(periodFlights, headers);
        
        // 2. Se preparan los valores para el nuevo formato de horas y aterrizajes.
        const totalHours = (totals["Duracion Total de Vuelo"] || 0).toFixed(1);
        const dayHours = (totals["Diurno"] || 0).toFixed(1);
        const nightHours = (totals["Nocturno"] || 0).toFixed(1);
        const hoursText = `${totalHours} (${dayHours}/${nightHours})`;

        // 3. Se preparan los valores para el nuevo formato de aterrizajes.
        const dayLandings = Math.round(totals["Aterrizajes Dia"] || 0);
        const nightLandings = Math.round(totals["Aterrizajes Noche"] || 0);
        const totalLandings = dayLandings + nightLandings;
        const landingsText = `${totalLandings} (${dayLandings}/${nightLandings})`;

        // 3. Se añade centrado a las celdas numéricas y se usa el nuevo texto para aterrizajes.
        tableHtml += `<tr>
                        <td><strong>${period.label}</strong></td>
                        <td style="text-align: center;">${hoursText}</td>
                        <td style="text-align: center;">${landingsText}</td>
                        <td style="text-align: center;">${(totals["IFR"] || 0).toFixed(1)}</td>
                        <td style="text-align: center;">${Math.round(totals["NO"] || 0)}</td>
                    </tr>`;
    });

    // --- FIN DE LA MODIFICACIÓN ---

    tableHtml += `</tbody></table></div>`;
    container.innerHTML = tableHtml;
},

    detailedLog: () => {
        const WRAPPABLE_COLUMNS = ['Aeronave Marca y Modelo', 'Observaciones'];
        let processedData = [...flightData];
        processedData = processedData.filter(flight => { for (const key in logbookState.filters) { const filterValue = logbookState.filters[key]; if (!filterValue) continue; const [fieldName, operator] = key.split('-'); const flightValue = flight[fieldName]; const isFlightDateInvalid = isNaN(flight.Fecha.getTime()); if (fieldName === 'Fecha') { if (isFlightDateInvalid) return false; if (operator === 'min' && flight.Fecha < new Date(filterValue + 'T00:00:00Z')) return false; if (operator === 'max' && flight.Fecha > new Date(filterValue + 'T23:59:59Z')) return false; } else if (fieldName === 'Pagina Bitacora a Replicar') { if (flightValue != parseInt(filterValue)) { return false; } } else { if (operator === 'min') { if ((flightValue || 0) < parseFloat(filterValue)) return false; } else { if (!flightValue || !flightValue.toString().toLowerCase().includes(filterValue.toLowerCase())) return false; } } } return true; });
        if (logbookState.sortOrder !== 'natural') {
            processedData.sort((a, b) => {
                // Manejo de seguridad para fechas inválidas o nulas
                const aTime = (a && a.Fecha) ? a.Fecha.getTime() : 0;
                const bTime = (b && b.Fecha) ? b.Fecha.getTime() : 0;
                
                if (!aTime) return 1;  // Mueve los vuelos sin fecha al final
                if (!bTime) return -1; // Mueve los vuelos sin fecha al final

                return logbookState.sortOrder === 'desc' ? bTime - aTime : aTime - bTime;
            });
        }
        logbookState.filteredData = processedData;

        const totalItems = logbookState.filteredData.length;
        const totalPages = Math.ceil(totalItems / logbookState.itemsPerPage);
        if (logbookState.currentPage > totalPages && totalPages > 0) logbookState.currentPage = totalPages;
        else if (totalPages === 0) logbookState.currentPage = 1;
        
        const startIndex = (logbookState.currentPage - 1) * logbookState.itemsPerPage;
        const endIndex = startIndex + logbookState.itemsPerPage;
        const pageData = logbookState.filteredData.slice(startIndex, endIndex);

        const container = document.getElementById("detailed-logbook-container");
        if (!container) return;

        // --- LA CORRECCIÓN CLAVE ---
        container.innerHTML = ''; // Limpiamos el contenedor antes de dibujar.

        // ========================================================== //
        // =         2. LÓGICA DE RENDERIZADO (CONDICIONAL)         = //
        // ========================================================== //

        const isMobile = window.innerWidth <= 800;

        if (pageData.length === 0) {
            container.innerHTML = "<div class='table-container'><p style='padding: 1rem; text-align: center;'>No hay vuelos que coincidan con los filtros y orden actual.</p></div>";
        
        } else if (isMobile) {
            // --- RENDERIZADO MÓVIL (TARJETAS) ---
            let cardsHtml = '<div class="logbook-cards-container">';
            pageData.forEach(flight => {
                const duration = (flight['Duracion Total de Vuelo'] || 0).toFixed(1);
                const landings = (flight['Aterrizajes Dia'] || 0) + (flight['Aterrizajes Noche'] || 0);
            let aircraftType = '';
            // AIRCRAFT_TYPE_HEADERS es una constante global de state.js
            for (const type of AIRCRAFT_TYPE_HEADERS) {
                if (flight[type] > 0) {
                    aircraftType = type;
                    break; // Salimos del bucle una vez que lo encontramos
                }
            }
                const details = [
                    { label: 'Aterrizajes (D/N)', value: `${landings} (${flight['Aterrizajes Dia']}/${flight['Aterrizajes Noche']})` },
                    ...(aircraftType ? [{ label: 'Tipo de Avión', value: aircraftType }] : []),
                    { label: 'PIC', value: (flight['Piloto al Mando (PIC)'] || 0) },
                    { label: 'SIC', value: (flight['Copiloto (SIC)'] || 0) },
                    { label: 'Instrucción', value: (flight['Instruccion Recibida'] || 0) },
                    { label: 'Instructor', value: (flight['Como Instructor'] || 0) },
                    { label: 'Solo', value: (flight['Solo'] || 0) },
                    { label: 'Travesía', value: (flight['Travesia'] || 0) },
                    { label: 'IFR', value: (flight['IFR'] || 0) },
                    { label: 'Nocturno', value: (flight['Nocturno'] || 0) },
                    { label: 'Simulador', value: (flight['Simulador o Entrenador de Vuelo'] || 0) },
                    { label: 'Aprox. IFR', value: (flight['NO'] || 0)},
                    { label: 'Pág. Bitácora', value: flight['Pagina Bitacora a Replicar'] || 'N/A' }
                ].filter(d => {
                    const numValue = parseFloat(d.value);
                    return (isNaN(numValue) && d.value) || numValue > 0 || (d.label === 'Aterrizajes' && landings > 0);
                });

                cardsHtml += `
                    <div class="flight-card" id="flight-${flight.id}">
                        <div class="flight-card-main">
                            <div class="flight-card-date">${flight.Fecha ? flight.Fecha.toLocaleDateString("es-CL", { timeZone: "UTC" }) : 'Sin Fecha'}</div>
                            <div class="flight-card-aircraft">${flight['Aeronave Marca y Modelo']} (${flight['Matricula Aeronave']})</div>
                            <div class="flight-card-route">${flight.Desde} → ${flight.Hasta}</div>
                        </div>
                        <div class="flight-card-duration">
                            <span class="value">${duration}</span>
                            <span class="label">HRS</span>
                        </div>
                        <div class="flight-card-details">
                            <div class="details-grid">
                                ${details.map(d => `<div class="detail-item"><span class="label">${d.label}</span>${d.value}</div>`).join('')}
                            </div>
                            ${flight.Observaciones ? `<div class="detail-item" style="grid-column: 1/-1; margin-top: 1rem;"><span class="label">Observaciones</span>${flight.Observaciones}</div>` : ''}
                        </div>
                        <div class="flight-card-actions">
                             <button class="toggle-details-btn prev-btn">Ver Detalles</button>
                             <button class="edit-flight-btn next-btn" data-flight-id="${flight.id}">Editar</button>
                             <button class="delete-flight-btn" data-flight-id="${flight.id}" style="flex-grow: 0; padding: 0.6rem;">🗑️</button>
                        </div>
                    </div>`;
            });
            cardsHtml += '</div>';
            container.innerHTML = cardsHtml;
        
        } else {
            // --- RENDERIZADO DE ESCRITORIO (TABLA) ---
            let headerHtml = `<thead><tr>`;
            HEADER_STRUCTURE.forEach(header => { headerHtml += `<th ${header.isGroup ? `colspan="${header.colspan}"` : `rowspan="2"`}>${header.short || header.name}</th>`; });
            headerHtml += `<th rowspan="2">Acciones</th>`;
            headerHtml += `</tr><tr>`;
            HEADER_STRUCTURE.forEach(header => { if (!header.isGroup) return; header.children.forEach(child => { headerHtml += `<th>${child.replace("Aterrizajes ", "")}</th>`; }); });
            headerHtml += `</tr></thead>`;
            
            // --- INICIO DE LA CORRECCIÓN ---
            // Aseguramos que bodyHtml esté aquí
            let bodyHtml = '<tbody>';
            let previousPageNumber = null;

            // Cambiamos a un bucle 'for' para tener acceso al índice y al elemento anterior
            for (let i = 0; i < pageData.length; i++) {
                const flight = pageData[i];
                const currentPageNumber = flight["Pagina Bitacora a Replicar"];
                let rowClass = '';
                
                // Determinamos el índice absoluto del vuelo en la lista filtrada
                const absoluteIndex = startIndex + i;
                
                // Comparamos con el vuelo anterior solo si no es el primer vuelo de toda la lista
                if (absoluteIndex > 0) {
                    const previousFlight = logbookState.filteredData[absoluteIndex - 1];
                    if (previousFlight && previousFlight["Pagina Bitacora a Replicar"] !== currentPageNumber) {
                        rowClass = ' class="page-break"';
                    }
                }
                
                bodyHtml += `<tr${rowClass}>`;
                
                HEADER_STRUCTURE.flatMap(h => h.isGroup ? h.children : [h.name]).forEach(headerName => {
                    let value = flight[headerName];
                    let formattedValue = "";
                    let cellStyle = 'text-align: center;';
                    if (WRAPPABLE_COLUMNS.includes(headerName)) { cellStyle = 'text-align: left; white-space: pre-wrap; word-break: break-word;'; }
                    if (value instanceof Date) { formattedValue = !isNaN(value.getTime()) ? value.toLocaleDateString("es-CL", { timeZone: "UTC" }).split("-").reverse().join("-") : 'Sin Fecha'; }
                    else if (typeof value === 'number' && headerName !== 'Tipo') { 
                        formattedValue = (SUMMARIZABLE_HEADERS.includes(headerName) && !headerName.includes("Aterrizajes") && headerName !== "NO") ? value.toFixed(1) : value; 
                    }
                    else { formattedValue = value === undefined || value === null ? "" : value; }
                    bodyHtml += `<td style="${cellStyle}">${formattedValue}</td>`;
                });
                bodyHtml += `
                    <td style="text-align: center; white-space: nowrap;">
                        <button class="edit-flight-btn" data-flight-id="${flight.id}" title="Editar Vuelo">✏️</button>
                        <button class="delete-flight-btn" data-flight-id="${flight.id}" title="Borrar Vuelo">🗑️</button>
                    </td>`;                
                bodyHtml += `</tr>`;
            }

            bodyHtml += '</tbody>';
            container.innerHTML = `<div class="table-container"><table>${headerHtml}${bodyHtml}</table></div>`;
            // --- FIN DE LA CORRECCIÓN ---
        }


        // ========================================================== //
        // =      3. LLAMADAS FINALES (COMUNES A AMBOS)             = //
        // ========================================================== //

        render.paginationControls(totalPages);
        render.activeFilters();
    },
    
    paginationControls: (totalPages) => { 
        const buttonsContainer = document.getElementById("pagination-buttons"); 
        const infoContainer = document.getElementById("pagination-info");
        if (!buttonsContainer || !infoContainer) return;
        buttonsContainer.innerHTML = `<button class="prev-btn" ${logbookState.currentPage === 1 ? 'disabled' : ''}>« Anterior</button> <button class="next-btn" ${logbookState.currentPage === totalPages || totalPages === 0 ? 'disabled' : ''}>Siguiente »</button>`;
        if (logbookState.filteredData.length > 0) {
            const startItem = (logbookState.currentPage - 1) * logbookState.itemsPerPage + 1;
            const endItem = Math.min(startItem + logbookState.itemsPerPage - 1, logbookState.filteredData.length);
            infoContainer.textContent = `Mostrando ${startItem}-${endItem} de ${logbookState.filteredData.length} vuelos`;
        } else {
            infoContainer.textContent = '0 vuelos';
        }
    },
    
    activeFilters: () => { 
        const display = document.getElementById('active-filters-display'); 
        const clearBtn = document.getElementById('clear-logbook-filter-btn');
        if (!display || !clearBtn) return;
        const activeFilters = Object.keys(logbookState.filters).filter(key => logbookState.filters[key]);
        if (activeFilters.length > 0) {
            display.textContent = `Filtros activos: ${activeFilters.length}.`;
            clearBtn.classList.remove('hidden');
        } else {
            display.textContent = '';
            clearBtn.classList.add('hidden');
        }
    },

    flightPreview: (data) => {
        const WRAPPABLE_COLUMNS = ['Aeronave Marca y Modelo', 'Observaciones'];
        const previewContainer = document.getElementById('flight-preview-container');
        if (!previewContainer) return;

        const flightForPreview = ui.createFlightObject(data);

        // Filtramos la estructura para excluir columnas no deseadas en la previsualización
        const previewStructure = HEADER_STRUCTURE.filter(h => h.name !== 'Pagina Bitacora a Replicar');

        let headerHtml = `<thead><tr>`;
        // La columna de Acciones no va en la previsualización
        previewStructure.forEach(header => {
            headerHtml += `<th ${header.isGroup ? `colspan="${header.colspan}"` : `rowspan="2"`}>${header.short || header.name}</th>`;
        });
        headerHtml += `</tr><tr>`;
        previewStructure.forEach(header => {
            if (!header.isGroup) return;
            header.children.forEach(child => {
                headerHtml += `<th>${child.replace("Aterrizajes ", "")}</th>`;
            });
        });
        headerHtml += `</tr></thead>`;

        let bodyHtml = '<tbody><tr>';
        // Generamos las celdas basándonos en la estructura filtrada para mantener el orden
        previewStructure.flatMap(h => h.isGroup ? h.children : [h.name]).forEach(headerName => {
            let value = flightForPreview[headerName];
            let formattedValue = "";
            let cellStyle = 'text-align: center;';

            if (WRAPPABLE_COLUMNS.includes(headerName)) {
                cellStyle = 'text-align: left; white-space: pre-wrap; word-break: break-word;';
            }

            if (value instanceof Date) {
                formattedValue = !isNaN(value.getTime()) ? value.toLocaleDateString("es-CL", { timeZone: "UTC" }).split("-").reverse().join("-") : 'Sin Fecha';
            } 
            // --- INICIO DE LA CORRECCIÓN ---
            // Se añade la condición `headerName !== 'Tipo'` para que no trate la columna "Tipo" como un número.
            else if (typeof value === 'number' && headerName !== 'Tipo') {
                const isRoundingNeeded = headerName.includes("Aterrizajes") || headerName === "NO";
                formattedValue = SUMMARIZABLE_HEADERS.includes(headerName) && !isRoundingNeeded ? value.toFixed(1) : value;
            } 
            // --- FIN DE LA CORRECCIÓN ---
            else {
                formattedValue = value === undefined || value === null ? "" : value;
            }
            
            bodyHtml += `<td style="${cellStyle}">${formattedValue}</td>`;
        });
        bodyHtml += `</tr></tbody>`;

        previewContainer.innerHTML = `<div class="table-container"><table>${headerHtml}${bodyHtml}</table></div>`;
    },
};