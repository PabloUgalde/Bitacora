// --- ESTADO GLOBAL Y CONFIGURACIÓN ---
let flightData = [];
let charts = { dashboard: null, monthlySummary: null, yearlySummary: null, airportSummary: null };

let userProfile = {
    personal: {},
    licenses: {},
    userRole: 'student'
};

const logbookState = {
    currentPage: 1,
    itemsPerPage: 50,
    filteredData: [],
    filters: {},
    sortOrder: 'natural',
    editingFlightId: null,
    hiddenColumns: new Set()
};

// --- CONSTANTES DE LA APLICACIÓN ---
const HEADERS = ["id", "Fecha", "Aeronave Marca y Modelo", "Matricula Aeronave", "Desde", "Hasta", "Duracion Total de Vuelo", "LSA", "Monomotor", "Multimotor", "Turbo Helice", "Turbo Jet", "Helicoptero", "Planeador", "Ultraliviano", "Aterrizajes Dia", "Aterrizajes Noche", "Diurno", "Nocturno", "IFR", "NO", "Tipo", "Simulador o Entrenador de Vuelo", "Travesia", "Solo", "Piloto al Mando (PIC)", "Copiloto (SIC)", "Instruccion Recibida", "Como Instructor", "Observaciones", "Pagina Bitacora a Replicar"];

// --- ÍNDICES CORREGIDOS ---
const AIRCRAFT_TYPE_HEADERS = HEADERS.slice(7, 15); // Correcto: Desde LSA hasta Ultraliviano

// --- INICIO DE LA CORRECCIÓN ---
// Se redefine SUMMARIZABLE_HEADERS para excluir explícitamente la columna "Tipo", que es de texto.
// Se une el rango de columnas numéricas antes y después de "Tipo".
const SUMMARIZABLE_HEADERS = [
    ...HEADERS.slice(6, 21),  // Desde "Duracion Total de Vuelo" hasta "NO" (incluido)
    ...HEADERS.slice(22, 29) // Desde "Simulador..." hasta "Como Instructor" (incluido)
];
// --- FIN DE LA CORRECCIÓN ---


const HEADER_STRUCTURE = [ { name: "Fecha", isGroup: false, rowspan: 2 }, { name: "Aeronave Marca y Modelo", isGroup: false, rowspan: 2, short: "Aeronave" }, { name: "Matricula Aeronave", isGroup: false, rowspan: 2, short: "Matrícula" }, { name: "Ruta de Vuelo", isGroup: true, colspan: 2, children: ["Desde", "Hasta"] }, { name: "Duracion Total de Vuelo", isGroup: false, rowspan: 2, short: "Duración Total" }, { name: "Avión", isGroup: true, colspan: 8, children: AIRCRAFT_TYPE_HEADERS }, { name: "Aterrizajes", isGroup: true, colspan: 2, children: ["Aterrizajes Dia", "Aterrizajes Noche"] }, { name: "Condición de Vuelo", isGroup: true, colspan: 3, children: ["Diurno", "Nocturno", "IFR"] }, { name: "APP", isGroup: true, colspan: 2, children: ["NO", "Tipo"] }, { name: "Tipo de Tiempo de Vuelo", isGroup: true, colspan: 7, children: ["Simulador o Entrenador de Vuelo", "Travesia", "Solo", "Piloto al Mando (PIC)", "Copiloto (SIC)", "Instruccion Recibida", "Como Instructor"] }, { name: "Observaciones", isGroup: false, rowspan: 2 }, { name: "Pagina Bitacora a Replicar", isGroup: false, rowspan: 2, short: "Pág." } ];

// --- FUNCIÓN DE AYUDA GLOBAL ---
const calculateTotals = (data, headers) => headers.reduce((totals, header) => { totals[header] = data.reduce((sum, flight) => sum + (parseFloat(flight[header]) || 0), 0); return totals; }, {});

const formatHours = (val) => {
    if (val === 0 || val === null || val === undefined) return "";
    if (userProfile.hoursFormat === 'hhmm') {
        // Redondear en minutos totales: evita resultados como "1:60" (ej: 1.999 hrs)
        const totalMin = Math.round(val * 60);
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        return `${h}:${String(m).padStart(2, '0')}`;
    }
    // Muestra hasta 2 decimales, eliminando ceros al final, pero siempre al menos 1
    const s = val.toFixed(2);
    const trimmed = s.replace(/(\.\d*?)0+$/, '$1');
    return trimmed.endsWith('.') ? trimmed + '0' : trimmed;
};

// Estandariza el campo Aeronave (Marca y Modelo) al estilo designador corto
// que usan los pilotos (C150, C182, PA-28): mayúsculas, colapsa el espacio
// entre el prefijo de letras y el número de modelo (C 172 → C172) y limpia
// espacios alrededor de guiones sin insertarlos ni quitarlos (PA - 28 → PA-28,
// pero PA28 se deja tal cual si el piloto no usó guion).
const normalizeAircraftModel = (raw) => {
    let s = String(raw || '').trim().toUpperCase().replace(/\s+/g, ' ');
    if (!s) return '';
    s = s.replace(/^([A-Z]{1,4})\s+(\d)/, '$1$2');
    s = s.replace(/\s*-\s*/g, '-');
    return s;
};

// Deriva el designador OACI corto (C172, C150, PA-28, SR22T, DA40) a partir
// del nombre completo marca+modelo usado en el catálogo/flota de Peso y
// Balance ("Cessna 172M Skyhawk", "Piper PA-28-181 Archer"). Cessna colapsa
// la letra de variante (172M → C172); Piper trunca al número de serie
// (PA-28-181 → PA-28); el resto de marcas ya usan el modelo como segundo
// token (Cirrus SR22T, Diamond DA40, Bonanza F33A) así que se toma tal cual.
const aircraftIcaoDesignator = (fullName) => {
    const tokens = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (tokens.length < 2) return normalizeAircraftModel(tokens[0] || '');
    const brand = tokens[0].toLowerCase();
    const model = tokens[1];
    if (brand.startsWith('cessna')) {
        const m = model.match(/^(\d+)/);
        return normalizeAircraftModel(m ? `C${m[1]}` : model);
    }
    if (brand.startsWith('piper')) {
        const m = model.match(/^PA-?(\d+)/i);
        return normalizeAircraftModel(m ? `PA-${m[1]}` : model);
    }
    return normalizeAircraftModel(model);
};

// --- CONFIGURACIÓN DEL DASHBOARD ---
const DASHBOARD_CARDS = [
    { id: 'totalHours',      label: 'Horas Totales',        dataKey: 'Duracion Total de Vuelo',                      isFixed: true,  formatFn: val => formatHours(val), customClass: 'primary-card' },
    { id: 'picHours',        label: 'Horas PIC',            dataKey: 'Piloto al Mando (PIC)',                        isFixed: false, formatFn: val => formatHours(val) },
    { id: 'sicHours',        label: 'Horas SIC',            dataKey: 'Copiloto (SIC)',                               isFixed: false, formatFn: val => formatHours(val) },
    { id: 'totalLandings',   label: 'Total Aterrizajes',    dataKey: ['Aterrizajes Dia', 'Aterrizajes Noche'],       isFixed: false, formatFn: val => Math.round(val) },
    { id: 'dayLandings',     label: 'Ater. Diurnos',        dataKey: 'Aterrizajes Dia',                              isFixed: false, formatFn: val => Math.round(val) },
    { id: 'nightLandings',   label: 'Ater. Nocturnos',      dataKey: 'Aterrizajes Noche',                            isFixed: false, formatFn: val => Math.round(val) },
    { id: 'ifrHours',        label: 'Horas IFR',            dataKey: 'IFR',                                          isFixed: false, formatFn: val => formatHours(val) },
    { id: 'dayHours',        label: 'Horas Diurnas',        dataKey: 'Diurno',                                       isFixed: false, formatFn: val => formatHours(val) },
    { id: 'nightHours',      label: 'Horas Nocturnas',      dataKey: 'Nocturno',                                     isFixed: false, formatFn: val => formatHours(val) },
    { id: 'soloHours',       label: 'Horas Solo',           dataKey: 'Solo',                                         isFixed: false, formatFn: val => formatHours(val) },
    { id: 'xcHours',         label: 'Horas Travesía',       dataKey: 'Travesia',                                     isFixed: false, formatFn: val => formatHours(val) },
    { id: 'dualHours',       label: 'Instrucción Recibida', dataKey: 'Instruccion Recibida',                         isFixed: false, formatFn: val => formatHours(val) },
    { id: 'instructorHours', label: 'Como Instructor',      dataKey: 'Como Instructor',                              isFixed: false, formatFn: val => formatHours(val) },
    { id: 'simHours',        label: 'Horas Simulador',      dataKey: 'Simulador o Entrenador de Vuelo',              isFixed: false, formatFn: val => formatHours(val) },
    { id: 'approaches',      label: 'Nº Aproximaciones',    dataKey: 'NO',                                           isFixed: false, formatFn: val => Math.round(val) },
    { id: 'singleEngine',    label: 'Monomotor',            dataKey: 'Monomotor',                                    isFixed: false, formatFn: val => formatHours(val) },
    { id: 'multiEngine',     label: 'Multimotor',           dataKey: 'Multimotor',                                   isFixed: false, formatFn: val => formatHours(val) },
    { id: 'turboProps',      label: 'Turbo Hélice',         dataKey: 'Turbo Helice',                                 isFixed: false, formatFn: val => formatHours(val) },
    { id: 'turboJet',        label: 'Turbo Jet',            dataKey: 'Turbo Jet',                                    isFixed: false, formatFn: val => formatHours(val) },
    { id: 'heliHours',       label: 'Helicóptero',          dataKey: 'Helicoptero',                                  isFixed: false, formatFn: val => formatHours(val) },
    { id: 'gliderHours',     label: 'Planeador',            dataKey: 'Planeador',                                    isFixed: false, formatFn: val => formatHours(val) },
    { id: 'ultraHours',      label: 'Ultraliviano',         dataKey: 'Ultraliviano',                                 isFixed: false, formatFn: val => formatHours(val) },
    { id: 'lsaHours',        label: 'LSA',                  dataKey: 'LSA',                                          isFixed: false, formatFn: val => formatHours(val) },
];