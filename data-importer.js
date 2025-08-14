// --- MÓDULO DE IMPORTACIÓN DE DATOS ---
// Este archivo contiene la lógica para procesar archivos Excel y no será modificado en el futuro.

const dataImporter = {
    processExcelFile: async (file) => {
        const dataStatus = document.getElementById('data-status');
        dataStatus.textContent = 'Procesando archivo...';
        dataStatus.className = 'status';

        const parseDate = (dateInput) => { if (!dateInput) return null; if (dateInput instanceof Date) return dateInput; if (typeof dateInput === 'number') return new Date(Date.UTC(1899, 11, 30 + dateInput)); if (typeof dateInput !== 'string') return null; const separators = /[\/\-\.]/; const parts = dateInput.split(separators); if (parts.length !== 3) return null; let [p1, p2, p3] = parts.map(p => parseInt(p, 10)); let year, month, day; if (p1 > 1000) { year = p1; month = p2 - 1; day = p3; } else if (p3 > 1000) { day = p1; month = p2 - 1; year = p3; } else if (p1 > 31) { year = p1 < 100 ? 2000 + p1 : p1; month = p2 - 1; day = p3; } else { day = p1; month = p2 - 1; year = p3 < 100 ? 2000 + p3 : p3; } const date = new Date(Date.UTC(year, month, day)); return isNaN(date.getTime()) ? null : date; };

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const sheetAsArray = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

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
                
                let duration = parseFloat(String(newFlight['Duracion Total de Vuelo']).replace(",", ".")) || 0;
                const simTime = parseFloat(String(newFlight['Simulador o Entrenador de Vuelo']).replace(",", ".")) || 0;
                if (simTime > 0) { duration = simTime; newFlight['Duracion Total de Vuelo'] = simTime; }
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
                        newFlight[header] = parseFloat(String(newFlight[header]).replace(",", ".")) || 0;
                    }
                    else if (['Aeronave Marca y Modelo', 'Matricula Aeronave', 'Desde', 'Hasta', 'Observaciones', 'Tipo'].includes(header)) {
                         newFlight[header] = newFlight[header] ? String(newFlight[header]) : '';
                    }
                });

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
    }
};