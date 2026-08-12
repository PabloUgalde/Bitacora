// aeronaves-db.js — Base de datos de aeronaves para Peso y Balance

const AERONAVES_DB = [
    {
        id: "c150a_pzu",
        name: "Cessna 150A",
        registration: "CC-PZU",
        category: "Entrenador",
        tipoAvion: "Monomotor",
        emptyWeight_lbs: 1096.5, emptyMoment_lb_in: 37538.5, fuel_gallons_per_lbs: 1/6,
        stations: [
            { name: "Aceite (6 Qts)", arm_in: -9.09, id: "oil", type: "single_weight", default_value: 11 },
            { name: "Piloto y Pasajero", arm_in: 39.0, id: "front_pax", type: "paired_weight" },
            { name: "Combustible Usable (Gal)", arm_in: 42.2, id: "fuel", type: "paired_fuel", max_gallons: 35.0 },
            { name: "Equipaje Área 1 (Max 120 lbs)", arm_in: 64.0, id: "baggage1", type: "paired_weight", max_lbs: 120 },
            { name: "Equipaje Área 2 (Max 40 lbs)", arm_in: 84.0, id: "baggage2", type: "paired_weight", max_lbs: 40 }
        ],
        limits: {
            maxTakeOffWeight_lbs: 1500, maxLandingWeight_lbs: 1500,
            cgEnvelopeUtility: [ {x:32.20,y:1000},{x:40.25,y:1250},{x:50.10,y:1500},{x:54.00,y:1500},{x:45.00,y:1250},{x:36.00,y:1000} ],
            maxCombinedBaggage_lbs: 120, defaultCategory: "Utilitaria"
        }
    },
    {
        id: "c150f_snc",
        name: "Cessna 150F Commuter",
        registration: "CC-SNC",
        category: "Entrenador",
        tipoAvion: "Monomotor",
        emptyWeight_lbs: 1131.6, emptyMoment_lb_in: 38995.0, fuel_gallons_per_lbs: 1/6,
        stations: [
            { name: "Aceite (6 Qts)", arm_in: -9.09, id: "oil", type: "single_weight", default_value: 11 },
            { name: "Piloto y Pasajero", arm_in: 39.0, id: "front_pax", type: "paired_weight" },
            { name: "Combustible Usable (Gal)", arm_in: 42.2, id: "fuel", type: "paired_fuel", max_gallons: 35.0 },
            { name: "Equipaje Área 1 (Max 120 lbs)", arm_in: 64.0, id: "baggage1", type: "paired_weight", max_lbs: 120 },
            { name: "Equipaje Área 2 (Max 40 lbs)", arm_in: 84.0, id: "baggage2", type: "paired_weight", max_lbs: 40 }
        ],
        limits: {
            maxTakeOffWeight_lbs: 1600, maxLandingWeight_lbs: 1600,
            cgEnvelopeUtility: [ {x:36.1,y:1150},{x:40.5,y:1285},{x:52.8,y:1600},{x:60.0,y:1600},{x:49.48,y:1285},{x:44.97,y:1150} ],
            maxCombinedBaggage_lbs: 120, defaultCategory: "Utilitaria"
        }
    },
    {
        id: "c150l_kug",
        name: "Cessna 150L Commuter",
        registration: "CC-KUG",
        category: "Entrenador",
        tipoAvion: "Monomotor",
        emptyWeight_lbs: 1103.4, emptyMoment_lb_in: 37567.0, fuel_gallons_per_lbs: 1/6,
        stations: [
            { name: "Aceite (6 Qts)", arm_in: -9.09, id: "oil", type: "single_weight", default_value: 11 },
            { name: "Piloto y Pasajero", arm_in: 39.0, id: "front_pax", type: "paired_weight" },
            { name: "Combustible Usable (Gal)", arm_in: 42.2, id: "fuel", type: "paired_fuel", max_gallons: 22.5 },
            { name: "Equipaje Área 1 (Max 120 lbs)", arm_in: 64.0, id: "baggage1", type: "paired_weight", max_lbs: 120 },
            { name: "Equipaje Área 2 (Max 40 lbs)", arm_in: 84.0, id: "baggage2", type: "paired_weight", max_lbs: 40 }
        ],
        limits: {
            maxTakeOffWeight_lbs: 1600, maxLandingWeight_lbs: 1600,
            cgEnvelopeUtility: [ {x:34.5,y:1100},{x:40.0,y:1320},{x:52.5,y:1600},{x:60.0,y:1600},{x:49.53,y:1320},{x:41.3,y:1100} ],
            maxCombinedBaggage_lbs: 120, defaultCategory: "Utilitaria"
        }
    },
    {
        id: "c150l_kuh",
        name: "Cessna 150L Commuter",
        registration: "CC-KUH",
        category: "Entrenador",
        tipoAvion: "Monomotor",
        emptyWeight_lbs: 1140.9, emptyMoment_lb_in: 39945.8, fuel_gallons_per_lbs: 1/6,
        stations: [
            { name: "Aceite (6 Qts)", arm_in: -9.09, id: "oil", type: "single_weight", default_value: 11 },
            { name: "Piloto y Pasajero", arm_in: 39.0, id: "front_pax", type: "paired_weight" },
            { name: "Combustible Usable (Gal)", arm_in: 42.2, id: "fuel", type: "paired_fuel", max_gallons: 22.5 },
            { name: "Equipaje Área 1 (Max 120 lbs)", arm_in: 64.0, id: "baggage1", type: "paired_weight", max_lbs: 120 },
            { name: "Equipaje Área 2 (Max 40 lbs)", arm_in: 84.0, id: "baggage2", type: "paired_weight", max_lbs: 40 }
        ],
        limits: {
            maxTakeOffWeight_lbs: 1600, maxLandingWeight_lbs: 1600,
            cgEnvelopeUtility: [ {x:34.5,y:1100},{x:40.0,y:1320},{x:52.5,y:1600},{x:60.0,y:1600},{x:49.53,y:1320},{x:41.3,y:1100} ],
            maxCombinedBaggage_lbs: 120, defaultCategory: "Utilitaria"
        }
    },
    {
        id: "c172m_kua",
        name: "Cessna 172M Skyhawk",
        registration: "CC-KUA",
        category: "Entrenador",
        tipoAvion: "Monomotor",
        emptyWeight_lbs: 1457.5, emptyMoment_lb_in: 61350.0, fuel_gallons_per_lbs: 1/6,
        stations: [
            { name: "Aceite (8 Qts)", arm_in: -13.33, id: "oil", type: "single_weight", default_value: 15 },
            { name: "Piloto y Pas. Delantero", arm_in: 37.1, id: "front_pax", type: "paired_weight" },
            { name: "Pasajeros Traseros", arm_in: 73.0, id: "rear_pax", type: "paired_weight" },
            { name: "Combustible Usable", arm_in: 47.8, id: "fuel", type: "paired_fuel", max_gallons: 38 },
            { name: "Equipaje Área 1", arm_in: 90.9, id: "baggage1", type: "paired_weight", max_lbs: 120 },
            { name: "Equipaje Área 2", arm_in: 123.0, id: "baggage2", type: "paired_weight", max_lbs: 50 }
        ],
        limits: {
            maxRampWeight_lbs: 2307.5, maxTakeOffWeight_lbs: 2300, maxLandingWeight_lbs: 2300,
            cgEnvelopeNormal: [ {x:52.5,y:1500},{x:68.25,y:1950},{x:88.5,y:2300},{x:108.8,y:2300},{x:92.3,y:1950},{x:71.0,y:1500} ],
            maxUtilityWeight_lbs: 2000,
            cgEnvelopeUtility: [ {x:52.5,y:1500},{x:68.25,y:1950},{x:71.2,y:2000},{x:81.5,y:2000},{x:60.6,y:1500} ],
            maxCombinedBaggage_lbs: 120
        }
    },
    {
        id: "c182g_klc",
        name: "Cessna 182G Skylane",
        registration: "CC-KLC",
        category: "Turismo",
        tipoAvion: "Monomotor",
        emptyWeight_lbs: 1728.0, emptyMoment_lb_in: 62157.0, fuel_gallons_per_lbs: 1/6,
        stations: [
            { name: "Aceite (12 Qts)", arm_in: -13.64, id: "oil", type: "single_weight", default_value: 22 },
            { name: "Piloto y Pas. Delantero", arm_in: 36.0, id: "front_pax", type: "paired_weight" },
            { name: "Pasajeros Traseros", arm_in: 71.0, id: "rear_pax", type: "paired_weight" },
            { name: "Combustible Usable (Gal)", arm_in: 48.0, id: "fuel", type: "paired_fuel", max_gallons: 79.0 },
            { name: "Equipaje", arm_in: 97.5, id: "baggage", type: "paired_weight", max_lbs: 120 }
        ],
        limits: {
            maxTakeOffWeight_lbs: 2800, maxLandingWeight_lbs: 2800,
            cgEnvelopeNormal: [ {x:59.0,y:1800},{x:74.0,y:2250},{x:107.5,y:2800},{x:133.5,y:2800},{x:107.1,y:2250},{x:85.5,y:1800} ],
            defaultCategory: "Normal"
        }
    }
];
