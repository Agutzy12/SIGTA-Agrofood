'use strict';
/**
 * Valores fijos de la demo. Si algo cambia (objetivo diario, bultos por pallet...),
 * se cambia acá y no hay que buscarlo por todo el código.
 */
module.exports = {
  PLANTA: 'Planta principal',
  OBJETIVO_DIARIO_KG: 4000,   // objetivo de producción neta por día (Panel general)
  PRIMERA_OP: 111,            // la primera orden de la base de ejemplo es OP-AAAA-00111
  BULTOS_POR_PALLET: 25,      // cuántas bolsas entran en un pallet

  // Personas de ejemplo. El rol define qué acciones puede hacer cada una.
  USUARIOS: [
    { rol: 'PRODUCCION', nombre: 'Martín Pérez', cargo: 'Responsable de producción', iniciales: 'MP' },
    { rol: 'CALIDAD', nombre: 'Lucía Benítez', cargo: 'Analista de calidad', iniciales: 'LB' },
    { rol: 'DEPOSITO', nombre: 'Diego Acosta', cargo: 'Encargado de depósito', iniciales: 'DA' },
    { rol: 'DIRECCION', nombre: 'Valeria Ruiz', cargo: 'Gerencia (solo lectura)', iniciales: 'VR' },
  ],

  // Opciones de ubicación de guarda para el ingreso a depósito
  UBICACIONES: {
    depositos: ['Producto terminado'],
    sectores: ['Secos · Ambiente', 'Refrigerado'],
    sectoresConCamara: ['Refrigerado'],
    racks: ['A01', 'A02', 'A03', 'A04', 'A05', 'B01', 'B02', 'B03', 'B04', 'B05'],
    niveles: ['01', '02', '03', '04'],
    camaras: ['Cámara 1', 'Cámara 2'],
  },

  // Motivos de pausa de línea
  MOTIVOS_PAUSA: [
    'Ajuste del dosificador',
    'Falta de insumo en tolva',
    'Limpieza de línea',
    'Mantenimiento correctivo',
    'Corte de energía',
    'Otro motivo',
  ],
};
