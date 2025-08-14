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
    sortOrder: 'natural', // <--- CAMBIO CLAVE: El orden por defecto ahora es 'natural' (orden del archivo)
    editingFlightId: null // <--- NUEVA PROPIEDAD para saber si estamos editando
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

// --- CONFIGURACIÓN DEL DASHBOARD ---
const DASHBOARD_CARDS = [
    { id: 'totalHours', label: 'Horas Totales', dataKey: 'Duracion Total de Vuelo', isFixed: true, formatFn: val => val.toFixed(1), customClass: 'primary-card' },
    { id: 'picHours', label: 'Horas PIC', dataKey: 'Piloto al Mando (PIC)', isFixed: false, formatFn: val => val.toFixed(1) },
    { id: 'totalLandings', label: 'Total Aterrizajes', dataKey: ['Aterrizajes Dia', 'Aterrizajes Noche'], isFixed: false, formatFn: val => Math.round(val) },
    { id: 'ifrHours', label: 'Horas IFR', dataKey: 'IFR', isFixed: false, formatFn: val => val.toFixed(1) },
    { id: 'soloHours', label: 'Horas Solo', dataKey: 'Solo', isFixed: false, formatFn: val => val.toFixed(1) },
    { id: 'xcHours', label: 'Horas Travesía', dataKey: 'Travesia', isFixed: false, formatFn: val => val.toFixed(1) },
    { id: 'nightHours', label: 'Horas Nocturnas', dataKey: 'Nocturno', isFixed: false, formatFn: val => val.toFixed(1) },
    { id: 'nightLandings', label: 'Ater. Nocturnos', dataKey: 'Aterrizajes Noche', isFixed: false, formatFn: val => Math.round(val) },
    { id: 'dualHours', label: 'Instrucción Recibida', dataKey: 'Instruccion Recibida', isFixed: false, formatFn: val => val.toFixed(1) },
    { id: 'instructorHours', label: 'Como Instructor', dataKey: 'Como Instructor', isFixed: false, formatFn: val => val.toFixed(1) },
    { id: 'simHours', label: 'Horas Simulador', dataKey: 'Simulador o Entrenador de Vuelo', isFixed: false, formatFn: val => val.toFixed(1) }
];