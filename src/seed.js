'use strict';
/**
 * Datos de ejemplo de la demo.
 *
 * 1) Catálogo: productos, recetas, insumos y partidas (el stock inicial).
 * 2) Historial: órdenes en todos los estados, para que el Panel no arranque vacío.
 *    Se generan corriendo los MISMOS servicios que usa la aplicación, con un reloj simulado
 *    (clock.js). Así los datos de ejemplo siempre cumplen las reglas del sistema.
 */
const { db, tx, crearEsquema, borrarEsquema, hayEsquema } = require('./db');
const { fijarReloj, liberarReloj, ahoraISO } = require('./clock');
const { USUARIOS } = require('./config');
const { auditar, fechaLocal } = require('./services/comun');
const ordenes = require('./services/ordenes');
const calidad = require('./services/calidad');
const deposito = require('./services/deposito');

const MARTIN = USUARIOS.find((u) => u.rol === 'PRODUCCION');
const LUCIA = USUARIOS.find((u) => u.rol === 'CALIDAD');
const DIEGO = USUARIOS.find((u) => u.rol === 'DEPOSITO');

/* ------------------------------------------------------------------ */
/* 1) Catálogo                                                          */
/* ------------------------------------------------------------------ */

function cargarCatalogo() {
  const insertar = (sql, ...datos) => db.prepare(sql).run(...datos);

  insertar("INSERT INTO linea(id,nombre) VALUES (1,'Línea de mezclado 1'), (2,'Línea de mezclado 2')");

  // id, código, nombre, línea sugerida, color esperado
  const productos = [
    [1, 'MRC01', 'Mezcla rebozadora clásica', 1, 'Crema uniforme'],
    [2, 'PPN02', 'Premezcla para pan', 2, 'Blanco crema'],
    [3, 'RMA03', 'Rebozador de maíz', 1, 'Amarillo uniforme'],
    [4, 'MML01', 'Mezcla para milanesas', 2, 'Crema uniforme'],
    [5, 'PPI02', 'Premezcla para pizza', 2, 'Blanco crema'],
  ];
  for (const [id, codigo, nombre, linea, color] of productos) {
    // bolsas de 20 kg, vida útil 6 meses, especificación de ejemplo: humedad ≤ 14 %, pH 5,5–7,0, ≤ 10.000 UFC/g
    insertar(`INSERT INTO producto(id,codigo,nombre,linea_id,presentacion_kg,vida_util_meses,humedad_max,ph_min,ph_max,ufc_max,color_esperado)
              VALUES (?,?,?,?,20,6,14.0,5.5,7.0,10000,?)`, id, codigo, nombre, linea, color);
  }

  // id, código, nombre, tipo, unidad, crítico, stock mínimo
  const insumos = [
    [1, 'MP-001', 'Harina de trigo', 'MP', 'kg', 1, 500],
    [2, 'MP-002', 'Harina de maíz', 'MP', 'kg', 1, 200],
    [3, 'MP-003', 'Sal fina', 'MP', 'kg', 1, 50],
    [4, 'MP-004', 'Mezcla de especias', 'MP', 'kg', 1, 30],
    [5, 'MP-005', 'Almidón', 'MP', 'kg', 1, 150],
    [6, 'MP-006', 'Levadura seca', 'MP', 'kg', 1, 20],
    [7, 'MP-007', 'Azúcar', 'MP', 'kg', 1, 50],
    [8, 'ENV-020', 'Bolsa kraft de 20 kg', 'ME', 'un.', 1, 100],
    [9, 'ETQ-MRC', 'Etiqueta de producto', 'ME', 'un.', 1, 100],
    [10, 'ETQ-PPN', 'Etiqueta de producto', 'ME', 'un.', 1, 100],
    [11, 'ETQ-RMA', 'Etiqueta de producto', 'ME', 'un.', 1, 100],
    [12, 'ETQ-MML', 'Etiqueta de producto', 'ME', 'un.', 1, 100],
    [13, 'ETQ-PPI', 'Etiqueta de producto', 'ME', 'un.', 1, 100],
    [14, 'FIL-STR', 'Film estirable para pallets', 'ME', 'rollos', 0, 20],
  ];
  for (const i of insumos) {
    insertar('INSERT INTO insumo(id,codigo,nombre,tipo,unidad,critico,stock_minimo) VALUES (?,?,?,?,?,?,?)', ...i);
  }

  // Recetas: cantidades cada 100 kg de producto. Los ids de insumo son los de arriba.
  // id receta = id producto. [código, versión, vigente desde, [[insumo, cantidad], ...]]
  const recetas = [
    [1, 'REC-MRC01', 3, '2026-09-01', [[1, 85], [2, 10], [3, 3], [4, 2], [8, 5], [9, 5]]],
    [2, 'REC-PPN02', 2, '2026-08-15', [[1, 90], [3, 2], [6, 3], [7, 5], [8, 5], [10, 5]]],
    [3, 'REC-RMA03', 1, '2026-07-01', [[2, 70], [1, 20], [3, 5], [4, 5], [8, 5], [11, 5]]],
    [4, 'REC-MML01', 2, '2026-08-01', [[1, 70], [5, 20], [3, 5], [4, 5], [8, 5], [12, 5]]],
    [5, 'REC-PPI02', 1, '2026-07-15', [[1, 85], [6, 3], [3, 2], [7, 5], [5, 5], [8, 5], [13, 5]]],
  ];
  for (const [id, codigo, version, desde, items] of recetas) {
    insertar('INSERT INTO receta(id,codigo,producto_id,version,vigente_desde,base_kg,activa) VALUES (?,?,?,?,?,100,1)', id, id === 0 ? 0 : codigo, id, version, desde);
    for (const [insumoId, cantidad] of items) {
      insertar('INSERT INTO receta_item(receta_id,insumo_id,cantidad_base) VALUES (?,?,?)', id, insumoId, cantidad);
    }
  }

  // Partidas de proveedor: [insumo, lote de origen, proveedor, vencimiento, remito]
  const partidas = [
    [1, 'MF-261001', 'Molinos Florencia SAU', '2027-04-01', 'REM-MF-261001'],
    [1, 'MF-261015', 'Molinos Florencia SAU', '2027-04-15', 'REM-MF-261015'],
    [1, 'MF-261020', 'Molinos Florencia SAU', '2027-05-10', 'REM-MF-261020'],
    [2, 'HM-261012', 'Maíces del Sur S.A.', '2027-04-12', 'REM-MS-261012'],
    [3, 'SAL-261005', 'Salinas del Centro S.R.L.', '2028-10-05', 'REM-SC-261005'],
    [4, 'ESP-261008', 'Aromas del Campo S.R.L.', '2027-10-08', 'REM-AC-261008'],
    [5, 'ALM-261003', 'Almidones del Litoral S.A.', '2027-08-03', 'REM-AL-261003'],
    [6, 'LEV-261009', 'Levaduras Pampeanas S.A.', '2027-03-09', 'REM-LP-261009'],
    [7, 'AZU-261011', 'Azucarera del Norte S.A.', '2028-02-11', 'REM-AN-261011'],
    [8, 'ENV-261010', 'Cartocor S.A.', null, 'REM-CA-261010'],
    [9, 'ETQ-261010', 'Etiquetas del Centro S.A.', null, 'REM-EC-261010'],
    [10, 'ETQ-261011', 'Etiquetas del Centro S.A.', null, 'REM-EC-261011'],
    [11, 'ETQ-261012', 'Etiquetas del Centro S.A.', null, 'REM-EC-261012'],
    [12, 'ETQ-261013', 'Etiquetas del Centro S.A.', null, 'REM-EC-261013'],
    [13, 'ETQ-261014', 'Etiquetas del Centro S.A.', null, 'REM-EC-261014'],
    [14, 'FIL-261002', 'Plásticos Industriales S.A.', null, 'REM-PI-261002'],
  ];
  // Arrancan con un saldo enorme para que el historial pueda consumir sin problemas.
  // Al terminar el historial se ajustan al saldo real (ver ajustarSaldosFinales).
  for (const [insumoId, lote, proveedor, vence, remito] of partidas) {
    insertar(`INSERT INTO partida_insumo(insumo_id,nro_lote,proveedor,cantidad,vencimiento,documento_origen,estado,ingreso)
              VALUES (?,?,?,?,?,?,'LIBERADO',?)`, insumoId, lote, proveedor, 1000000, vence, remito, ahoraISO());
  }
}

/** Stock con el que arranca la demo (después del historial). */
function ajustarSaldosFinales() {
  const saldos = {
    'MF-261001': 500, 'MF-261015': 3000, 'MF-261020': 2500,   // harina de trigo
    'HM-261012': 900, 'SAL-261005': 300, 'ESP-261008': 150,
    'ALM-261003': 80,                                          // almidón: queda por debajo del mínimo (150)
    'LEV-261009': 60, 'AZU-261011': 200, 'ENV-261010': 480,
    'ETQ-261010': 400, 'ETQ-261011': 300, 'ETQ-261012': 300, 'ETQ-261013': 300, 'ETQ-261014': 300,
    'FIL-261002': 12,                                          // film: por debajo del mínimo (20)
  };
  for (const [lote, saldo] of Object.entries(saldos)) {
    db.prepare('UPDATE partida_insumo SET cantidad = ? WHERE nro_lote = ?').run(saldo, lote);
  }
}

/* ------------------------------------------------------------------ */
/* 2) Historial simulado                                                */
/* ------------------------------------------------------------------ */

function cargarHistorial() {
  const AHORA_REAL = new Date();
  let cursor = new Date(AHORA_REAL.getTime());
  fijarReloj(() => new Date(cursor.getTime()));

  const productoPorCodigo = (codigo) => db.prepare('SELECT * FROM producto WHERE codigo = ?').get(codigo);

  // Fecha de hace N días hábiles (0 = hoy)
  function diaHabil(atras) {
    const d = new Date(AHORA_REAL.getFullYear(), AHORA_REAL.getMonth(), AHORA_REAL.getDate());
    let faltan = atras;
    while (faltan > 0) {
      d.setDate(d.getDate() - 1);
      if (d.getDay() !== 0 && d.getDay() !== 6) faltan--;
    }
    return d;
  }
  // Mueve el reloj a un día y hora (sin pasar nunca de "ahora")
  function irA(dia, hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    const t = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), h, m);
    cursor = t > AHORA_REAL ? new Date(AHORA_REAL.getTime()) : t;
  }
  function avanzar(minutos) {
    const t = new Date(cursor.getTime() + minutos * 60000);
    cursor = t > AHORA_REAL ? new Date(AHORA_REAL.getTime()) : t;
  }

  /**
   * Corre una orden por el circuito real hasta el punto indicado:
   * CREADA, PLANIFICADA, CANCELADA, PAUSADA, CUARENTENA, LIBERADO, RECHAZADA o FINALIZADA.
   */
  function simular({ atras, hora, producto, kg, hasta, observaciones = '', despachoKg = 0 }) {
    const prod = productoPorCodigo(producto);
    const dia = diaHabil(atras);
    const [h, m] = hora.split(':').map(Number);
    irA(dia, `${String(Math.max(h - 1, 0)).padStart(2, '0')}:${String(m).padStart(2, '0')}`); // se crea una hora antes
    const orden = ordenes.crearOrden(MARTIN, {
      producto_id: prod.id, linea_id: prod.linea_id, cantidad_kg: kg, fecha_proyectada: fechaLocal(dia),
      hora_prevista: hora, observaciones, accion: hasta === 'CREADA' ? 'BORRADOR' : 'PLANIFICAR',
    });
    if (hasta === 'CREADA' || hasta === 'PLANIFICADA') return orden;
    if (hasta === 'CANCELADA') {
      avanzar(15);
      return ordenes.cancelarOrden(MARTIN, orden.id, 'Se cancela por cambio en el pedido del cliente');
    }

    irA(dia, hora);
    ordenes.iniciarProduccion(MARTIN, orden.id);
    if (hasta === 'PAUSADA') {
      avanzar(40);
      return ordenes.pausarLinea(MARTIN, orden.id, 'Ajuste del dosificador');
    }

    avanzar(100);
    const bultos = Math.round((kg * 0.98) / prod.presentacion_kg); // merma de proceso de alrededor del 2 %
    const fin = ordenes.finalizarElaboracion(MARTIN, orden.id, {
      consumos: ordenes.getOrden(orden.id).consumo_sugerido,
      cantidad_real_kg: bultos * prod.presentacion_kg,
      bultos,
    });
    if (hasta === 'CUARENTENA') return fin;

    avanzar(65);
    const ensayo = { humedad: 12.4, ph: 6.2, aroma: 'Característico', color: prod.color_esperado, sabor: 'Característico', ufc: 320 };
    if (hasta === 'RECHAZADA') {
      calidad.registrarControlCalidad(LUCIA, fin.lote_id, {
        ...ensayo, ufc: 45000, dictamen: 'RECHAZAR_BLOQUEAR',
        observaciones: 'Recuento microbiológico fuera de especificación. Se bloquea el lote y se informa a jefatura de planta.',
      });
      return fin;
    }
    calidad.registrarControlCalidad(LUCIA, fin.lote_id, {
      ...ensayo, dictamen: 'APROBAR_LIBERAR', observaciones: 'Resultados dentro de la especificación de ejemplo. Sin desvíos observados.',
    });
    if (hasta === 'LIBERADO') return fin;

    avanzar(45);
    const rack = { MRC01: 'A02', PPN02: 'A01', RMA03: 'A03', MML01: 'A04', PPI02: 'A05' }[producto];
    deposito.ingresarProductoTerminado(DIEGO, {
      op_id: orden.id, bultos_recibidos: bultos, kg_conformes: bultos * prod.presentacion_kg, bultos_danados: 0, merma_kg: 0,
      deposito: 'Producto terminado', sector: 'Secos · Ambiente', rack, nivel: '02',
    });
    if (despachoKg > 0) {
      avanzar(24 * 60);
      deposito.despachar(DIEGO, { lote_id: fin.lote_id, cliente: 'Distribuidora Mayorista del Litoral S.R.L.', cantidad_kg: despachoKg });
    }
    return fin;
  }

  const obs = 'Elaboración del turno mañana. Presentación en bolsas de 20 kg; verificar limpieza de línea antes del inicio.';

  // Semana anterior: sirve para calcular la variación del gráfico "Producción reciente"
  simular({ atras: 9, hora: '07:00', producto: 'MRC01', kg: 1000, hasta: 'FINALIZADA' });
  simular({ atras: 8, hora: '07:00', producto: 'PPN02', kg: 800, hasta: 'FINALIZADA' });
  simular({ atras: 7, hora: '07:00', producto: 'MML01', kg: 750, hasta: 'FINALIZADA' });
  simular({ atras: 6, hora: '07:00', producto: 'RMA03', kg: 600, hasta: 'FINALIZADA' });
  simular({ atras: 6, hora: '10:00', producto: 'PPI02', kg: 500, hasta: 'FINALIZADA' });

  // Días anteriores: producción terminada (alimenta el gráfico "Producción reciente")
  simular({ atras: 5, hora: '07:00', producto: 'PPN02', kg: 800, hasta: 'FINALIZADA' });
  simular({ atras: 5, hora: '09:30', producto: 'MRC01', kg: 1000, hasta: 'FINALIZADA' });  // 112
  simular({ atras: 5, hora: '12:00', producto: 'RMA03', kg: 600, hasta: 'FINALIZADA' });   // 113
  simular({ atras: 4, hora: '07:00', producto: 'MML01', kg: 750, hasta: 'FINALIZADA' });   // 114
  simular({ atras: 4, hora: '10:00', producto: 'PPI02', kg: 500, hasta: 'FINALIZADA' });   // 115
  simular({ atras: 4, hora: '12:30', producto: 'MRC01', kg: 1000, hasta: 'FINALIZADA' });  // 116
  simular({ atras: 3, hora: '07:00', producto: 'PPN02', kg: 800, hasta: 'FINALIZADA' });   // 117
  simular({ atras: 3, hora: '09:30', producto: 'MRC01', kg: 1000, hasta: 'FINALIZADA' });  // 118
  simular({ atras: 3, hora: '12:00', producto: 'RMA03', kg: 800, hasta: 'FINALIZADA' });   // 119
  simular({ atras: 2, hora: '07:00', producto: 'MML01', kg: 750, hasta: 'FINALIZADA', despachoKg: 300 }); // 120 (con despacho)
  const lotePendiente1 = simular({ atras: 2, hora: '10:00', producto: 'PPI02', kg: 500, hasta: 'CUARENTENA' }); // 121
  const lotePendiente2 = simular({ atras: 1, hora: '13:00', producto: 'MRC01', kg: 1000, hasta: 'CUARENTENA' }); // 122
  simular({ atras: 1, hora: '11:00', producto: 'RMA03', kg: 400, hasta: 'CANCELADA' });   // 123
  simular({ atras: 1, hora: '10:00', producto: 'PPN02', kg: 600, hasta: 'RECHAZADA' });    // 124
  simular({ atras: 1, hora: '08:00', producto: 'MML01', kg: 750, hasta: 'LIBERADO' });     // 125 (espera recepción en depósito)

  // Hoy
  simular({ atras: 0, hora: '06:00', producto: 'RMA03', kg: 600, hasta: 'CUARENTENA' });   // 126
  simular({ atras: 0, hora: '07:00', producto: 'PPN02', kg: 800, hasta: 'PAUSADA' });      // 127

  // Dos lotes viejos ya tienen el análisis empezado (borrador guardado); el de hoy todavía no
  for (const lote of [lotePendiente1, lotePendiente2]) {
    calidad.guardarBorrador(LUCIA, lote.lote_id, { humedad: 12.6, ph: 6.3, aroma: 'Característico' });
  }

  // El stock con el que arranca la demo se fija acá, antes de las últimas órdenes
  ajustarSaldosFinales();

  simular({ atras: 0, hora: '08:30', producto: 'MRC01', kg: 1000, hasta: 'PLANIFICADA', observaciones: obs });  // 128
  simular({ atras: 0, hora: '11:30', producto: 'MML01', kg: 750, hasta: 'CREADA', observaciones: 'Falta almidón: esperando reposición.' }); // 129 (borrador con faltante)
  simular({ atras: 0, hora: '12:00', producto: 'MRC01', kg: 1000, hasta: 'PLANIFICADA', observaciones: obs });  // 130

  liberarReloj();
}

/* ------------------------------------------------------------------ */
/* Funciones públicas                                                   */
/* ------------------------------------------------------------------ */

function cargarDatosDeEjemplo() {
  tx(() => {
    crearEsquema();
    cargarCatalogo();
    try {
      cargarHistorial();
    } finally {
      liberarReloj();
    }
  });
}

/** Si la base está vacía (primera vez), la crea con los datos de ejemplo. */
function asegurarDatos() {
  if (!hayEsquema()) cargarDatosDeEjemplo();
}

/** Botón "Reiniciar demo": borra todo y vuelve a cargar los datos de ejemplo. */
function reiniciarDemo(usuario) {
  borrarEsquema();
  cargarDatosDeEjemplo();
  auditar(usuario, 'REINICIO_DEMO', 'DEMO', 'Se restauraron los datos de ejemplo');
  return { ok: true };
}

module.exports = { asegurarDatos, cargarDatosDeEjemplo, reiniciarDemo };
