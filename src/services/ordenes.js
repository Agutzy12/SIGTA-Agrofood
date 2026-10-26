'use strict';
/**
 * CU-P01 Registrar Orden de Producción
 * CU-P02 Registrar Ejecución de Producción y Consumo
 *
 * Estados de la orden:
 * CREADA -> PLANIFICADA -> EN_PRODUCCION -> EN_CONTROL_CALIDAD -> FINALIZADA
 *                                              (rechazo de calidad) -> RECHAZADA_SCRAP
 * y CANCELADA mientras no haya llegado a control de calidad.
 */
const { db, tx } = require('../db');
const { ahora, ahoraISO } = require('../clock');
const { PRIMERA_OP, MOTIVOS_PAUSA } = require('../config');
const {
  datosInvalidos, noExiste, noSePuede, redondear, rellenar, aNumero,
  fechaLocal, sumarMeses, semanaISO, auditar, filas,
} = require('./comun');
const { stockInsumos, partidasDisponibles } = require('./inventario');

/* ------------------------------------------------------------------ */
/* Ayudas                                                               */
/* ------------------------------------------------------------------ */

function getOpRow(id) {
  const op = db.prepare('SELECT * FROM orden_produccion WHERE id = ?').get(Number(id));
  if (!op) throw noExiste('Orden de producción inexistente');
  return op;
}

function validarKg(valor) {
  const kg = aNumero(valor);
  if (!(kg > 0)) throw datosInvalidos('La cantidad a elaborar debe ser mayor a 0');
  return kg;
}

function textoFaltantes(items) {
  return items.filter((i) => !i.ok).map((i) => `${i.nombre}: faltan ${i.faltante} ${i.unidad}`).join('; ');
}

/**
 * Calcula cuánto de cada insumo necesita una receta para `kg` de producto
 * y lo compara con lo que hay disponible (stock menos lo reservado por otras órdenes).
 */
function requerimientos(productoId, kg) {
  const producto = db.prepare('SELECT * FROM producto WHERE id = ?').get(Number(productoId));
  if (!producto) throw noExiste('Producto inexistente');
  const receta = db.prepare('SELECT * FROM receta WHERE producto_id = ? AND activa = 1 ORDER BY version DESC LIMIT 1').get(producto.id);
  if (!receta) throw noSePuede('El producto no tiene una receta vigente');

  const stock = new Map(stockInsumos().map((s) => [s.id, s]));
  const items = db.prepare(`
    SELECT ri.insumo_id, ri.cantidad_base, i.codigo, i.nombre, i.tipo, i.unidad, i.critico
    FROM receta_item ri JOIN insumo i ON i.id = ri.insumo_id
    WHERE ri.receta_id = ? ORDER BY i.tipo DESC, i.id`).all(receta.id)
    .map((r) => {
      let requerido = (r.cantidad_base * kg) / receta.base_kg;
      // los kilos se redondean; las bolsas y etiquetas se redondean hacia arriba (no hay media bolsa)
      requerido = r.unidad === 'kg' ? redondear(requerido) : Math.ceil(redondear(requerido, 6));
      const disponible = stock.get(r.insumo_id).disponible;
      const faltante = Math.max(0, redondear(requerido - disponible));
      return { ...r, requerido, disponible, faltante, ok: faltante === 0 };
    });

  const kgMateriaPrima = items.filter((i) => i.tipo === 'MP').reduce((a, i) => a + i.requerido, 0);
  return {
    producto: { ...producto },
    receta: { ...receta },
    factor: kg / receta.base_kg,
    items,
    kgMateriaPrima: redondear(kgMateriaPrima),
    criticosTotal: items.filter((i) => i.critico).length,
    criticosOk: items.filter((i) => i.critico && i.ok).length,
    planificable: items.filter((i) => i.critico).every((i) => i.ok),
    hayFaltantes: items.some((i) => !i.ok),
  };
}

function verificarDisponibilidad({ producto_id, cantidad_kg }) {
  return requerimientos(producto_id, validarKg(cantidad_kg));
}

function proximoNumero() {
  const fila = db.prepare('SELECT MAX(secuencia) AS ultima FROM orden_produccion').get();
  const secuencia = (fila.ultima ?? PRIMERA_OP - 1) + 1;
  return { secuencia, numero: `OP-${ahora().getFullYear()}-${rellenar(secuencia, 5)}` };
}

/* ------------------------------------------------------------------ */
/* CU-P01 Registrar Orden de Producción                                 */
/* ------------------------------------------------------------------ */

/**
 * Crea una orden nueva o completa un borrador (si viene opId).
 * accion = 'PLANIFICAR' (reserva los insumos) o 'BORRADOR' (queda CREADA y avisa a Compras si falta algo).
 */
function guardarOrden(usuario, cuerpo, opId = null) {
  const kg = validarKg(cuerpo.cantidad_kg);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(cuerpo.fecha_proyectada || ''))) throw datosInvalidos('Ingresá una fecha programada válida');
  const hora = cuerpo.hora_prevista || '08:00';
  if (!/^\d{2}:\d{2}$/.test(hora)) throw datosInvalidos('La hora de inicio prevista no es válida');
  if (!['PLANIFICAR', 'BORRADOR'].includes(cuerpo.accion)) throw datosInvalidos("La acción debe ser 'PLANIFICAR' o 'BORRADOR'");

  return tx(() => {
    const req = requerimientos(cuerpo.producto_id, kg);
    if (cuerpo.accion === 'PLANIFICAR' && !req.planificable) {
      throw noSePuede(`Hay faltantes críticos, no se puede planificar. ${textoFaltantes(req.items)}`);
    }
    const estado = cuerpo.accion === 'PLANIFICAR' ? 'PLANIFICADA' : 'CREADA';
    const lineaId = aNumero(cuerpo.linea_id) || req.producto.linea_id;
    let id;
    let numero;
    let esNueva = true;

    if (opId) {
      const op = getOpRow(opId);
      if (op.estado !== 'CREADA') throw noSePuede('Sólo se puede completar una orden en estado CREADA');
      db.prepare(`UPDATE orden_produccion SET producto_id=?, receta_id=?, linea_id=?, cantidad_kg=?,
                  fecha_proyectada=?, hora_prevista=?, estado=?, observaciones=? WHERE id=?`)
        .run(req.producto.id, req.receta.id, lineaId, kg, cuerpo.fecha_proyectada, hora, estado, cuerpo.observaciones || null, op.id);
      db.prepare('DELETE FROM op_item WHERE op_id = ?').run(op.id);
      id = op.id;
      numero = op.numero;
      esNueva = false;
    } else {
      const siguiente = proximoNumero();
      const r = db.prepare(`INSERT INTO orden_produccion
        (secuencia,numero,producto_id,receta_id,linea_id,cantidad_kg,fecha_proyectada,hora_prevista,estado,observaciones,creado_por,creado_en)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(siguiente.secuencia, siguiente.numero, req.producto.id, req.receta.id, lineaId, kg, cuerpo.fecha_proyectada,
          hora, estado, cuerpo.observaciones || null, usuario.nombre, ahoraISO());
      id = Number(r.lastInsertRowid);
      numero = siguiente.numero;
    }

    for (const item of req.items) {
      db.prepare('INSERT INTO op_item(op_id,insumo_id,cantidad_teorica) VALUES (?,?,?)').run(id, item.insumo_id, item.requerido);
    }

    if (esNueva) {
      auditar(usuario, 'OP_CREADA', numero, 'Creación de la orden', { op_id: id, resultado: 'OP Creada' });
    }
    if (estado === 'PLANIFICADA') {
      auditar(usuario, 'OP_PLANIFICADA', numero, 'Confirmación de disponibilidad', { op_id: id, resultado: 'OP Planificada' });
    } else if (req.hayFaltantes) {
      auditar(usuario, 'ALERTA_COMPRAS', numero,
        `Compras y Suministros: la ${numero} necesita abastecimiento. ${textoFaltantes(req.items)}`, { op_id: id });
    }
    return getOrden(id);
  });
}

function crearOrden(usuario, cuerpo) {
  return guardarOrden(usuario, cuerpo, null);
}

function completarBorrador(usuario, id, cuerpo) {
  return guardarOrden(usuario, cuerpo, id);
}

function cancelarOrden(usuario, id, motivo) {
  return tx(() => {
    const op = getOpRow(id);
    if (!['CREADA', 'PLANIFICADA', 'EN_PRODUCCION'].includes(op.estado)) {
      throw noSePuede(`No se puede cancelar una orden en estado ${op.estado}`);
    }
    db.prepare("UPDATE orden_produccion SET estado='CANCELADA', pausada=0, cierre=? WHERE id=?").run(ahoraISO(), op.id);
    auditar(usuario, 'OP_CANCELADA', op.numero, `Cancelación de la orden · ${motivo || 'sin motivo informado'}`,
      { op_id: op.id, resultado: 'OP Cancelada' });
    return getOrden(op.id);
  });
}

/* ------------------------------------------------------------------ */
/* Lectura de órdenes                                                   */
/* ------------------------------------------------------------------ */

function listOrdenes() {
  return filas(db.prepare(`
    SELECT o.*, p.codigo AS producto_codigo, p.nombre AS producto_nombre, l.nombre AS linea_nombre,
           lo.codigo AS lote_codigo, lo.estado AS lote_estado, lo.id AS lote_id
    FROM orden_produccion o
    JOIN producto p ON p.id = o.producto_id
    LEFT JOIN linea l ON l.id = o.linea_id
    LEFT JOIN lote_produccion lo ON lo.op_id = o.id
    ORDER BY o.secuencia DESC`).all());
}

/**
 * Reparte lo que necesita cada insumo entre las partidas disponibles,
 * empezando por la que vence antes. Es la sugerencia inicial de la pantalla de ejecución.
 */
function sugerirConsumo(items) {
  const filasSugeridas = [];
  for (const item of items) {
    let resto = item.cantidad_teorica;
    let ultima = null;
    for (const partida of partidasDisponibles(item.insumo_id)) {
      if (resto <= 0) break;
      const tomar = redondear(Math.min(resto, partida.cantidad));
      filasSugeridas.push({ insumo_id: item.insumo_id, partida_id: partida.id, cantidad: tomar });
      resto = redondear(resto - tomar);
      ultima = partida;
    }
    if (resto > 0) {
      // no alcanza el stock: queda una fila con lo que falta para que se vea en pantalla
      filasSugeridas.push({ insumo_id: item.insumo_id, partida_id: ultima ? ultima.id : null, cantidad: resto });
    }
  }
  return filasSugeridas;
}

function getOrden(id) {
  const op = db.prepare(`
    SELECT o.*, p.codigo AS producto_codigo, p.nombre AS producto_nombre, p.presentacion_kg, p.vida_util_meses,
           l.nombre AS linea_nombre, r.codigo AS receta_codigo, r.version AS receta_version,
           r.vigente_desde AS receta_vigente_desde
    FROM orden_produccion o
    JOIN producto p ON p.id = o.producto_id
    JOIN receta r ON r.id = o.receta_id
    LEFT JOIN linea l ON l.id = o.linea_id
    WHERE o.id = ?`).get(Number(id));
  if (!op) throw noExiste('Orden de producción inexistente');

  const items = filas(db.prepare(`
    SELECT oi.insumo_id, oi.cantidad_teorica, i.codigo, i.nombre, i.tipo, i.unidad, i.critico
    FROM op_item oi JOIN insumo i ON i.id = oi.insumo_id
    WHERE oi.op_id = ? ORDER BY i.tipo DESC, i.id`).all(op.id));

  const resultado = { ...op, items, avance: op.avance_json ? JSON.parse(op.avance_json) : null };
  delete resultado.avance_json;

  const lote = db.prepare('SELECT * FROM lote_produccion WHERE op_id = ?').get(op.id);
  resultado.lote = lote ? { ...lote } : null;

  if (op.estado === 'EN_PRODUCCION') {
    for (const item of items) item.partidas = partidasDisponibles(item.insumo_id);
    resultado.consumo_sugerido = sugerirConsumo(items);
  }
  return resultado;
}

/* ------------------------------------------------------------------ */
/* CU-P02 Registrar Ejecución de Producción y Consumo                   */
/* ------------------------------------------------------------------ */

function planificarOrden(usuario, id) {
  const op = getOpRow(id);
  if (op.estado !== 'CREADA') throw noSePuede(`Sólo se puede planificar una orden CREADA (actual: ${op.estado})`);
  return guardarOrden(usuario, {
    producto_id: op.producto_id, linea_id: op.linea_id, cantidad_kg: op.cantidad_kg,
    fecha_proyectada: op.fecha_proyectada, hora_prevista: op.hora_prevista,
    observaciones: op.observaciones, accion: 'PLANIFICAR',
  }, op.id);
}

function iniciarProduccion(usuario, id) {
  return tx(() => {
    const op = getOpRow(id);
    if (op.estado !== 'PLANIFICADA') throw noSePuede(`La orden debe estar PLANIFICADA para iniciar (actual: ${op.estado})`);
    const producto = db.prepare('SELECT * FROM producto WHERE id = ?').get(op.producto_id);

    // Código del lote: L-[producto]-[año][semana]-[número de lote de la semana]
    const { anio, semana } = semanaISO(ahora());
    const prefijo = `L-${producto.codigo}-${anio}${rellenar(semana, 2)}-`;
    const usados = db.prepare('SELECT COUNT(*) AS n FROM orden_produccion WHERE lote_codigo_previsto LIKE ?').get(`${prefijo}%`).n;
    const codigoLote = `${prefijo}${rellenar(usados + 1, 2)}`;
    const vencimiento = sumarMeses(ahora(), producto.vida_util_meses);

    db.prepare(`UPDATE orden_produccion SET estado='EN_PRODUCCION', inicio_real=?, operador=?,
                lote_codigo_previsto=?, vencimiento_previsto=? WHERE id=?`)
      .run(ahoraISO(), usuario.nombre, codigoLote, vencimiento, op.id);
    auditar(usuario, 'OP_INICIADA', op.numero, 'Inicio de elaboración y asignación de lote',
      { op_id: op.id, resultado: 'OP En producción' });
    return getOrden(op.id);
  });
}

function pausarLinea(usuario, id, motivo) {
  return tx(() => {
    const op = getOpRow(id);
    if (op.estado !== 'EN_PRODUCCION') throw noSePuede('Sólo se puede pausar una orden EN_PRODUCCION');
    if (op.pausada) throw noSePuede('La línea ya está pausada');
    const texto = String(motivo || '').trim();
    if (!texto) throw datosInvalidos('Indicá el motivo de la pausa');
    db.prepare('UPDATE orden_produccion SET pausada=1, motivo_pausa=? WHERE id=?').run(texto, op.id);
    auditar(usuario, 'LINEA_PAUSADA', op.numero, `Pausa de línea · ${texto}`, { op_id: op.id, resultado: 'En producción (pausada)' });
    return getOrden(op.id);
  });
}

function reanudarLinea(usuario, id) {
  return tx(() => {
    const op = getOpRow(id);
    if (op.estado !== 'EN_PRODUCCION' || !op.pausada) throw noSePuede('La línea no está pausada');
    db.prepare('UPDATE orden_produccion SET pausada=0 WHERE id=?').run(op.id);
    auditar(usuario, 'LINEA_REANUDADA', op.numero, 'Reanudación de línea', { op_id: op.id, resultado: 'OP En producción' });
    return getOrden(op.id);
  });
}

/** "Guardar avance": deja anotado lo cargado hasta ahora, sin descontar stock ni cerrar nada. */
function guardarAvance(usuario, id, cuerpo) {
  const op = getOpRow(id);
  if (op.estado !== 'EN_PRODUCCION') throw noSePuede('Sólo se puede guardar el avance de una orden EN_PRODUCCION');
  const avance = {
    consumos: Array.isArray(cuerpo.consumos) ? cuerpo.consumos : [],
    cantidad_real_kg: cuerpo.cantidad_real_kg ?? null,
    bultos: cuerpo.bultos ?? null,
    guardado_por: usuario.nombre,
    guardado_en: ahoraISO(),
  };
  db.prepare('UPDATE orden_produccion SET avance_json = ? WHERE id = ?').run(JSON.stringify(avance), op.id);
  return getOrden(op.id);
}

/**
 * Cierra la elaboración: descuenta las partidas usadas, calcula la merma y crea el lote en CUARENTENA.
 * Todo ocurre dentro de una transacción: o se hace completo o no se hace nada.
 */
function finalizarElaboracion(usuario, id, cuerpo) {
  return tx(() => {
    const op = getOpRow(id);
    if (op.estado !== 'EN_PRODUCCION') throw noSePuede(`La orden debe estar EN_PRODUCCION (actual: ${op.estado})`);
    if (op.pausada) throw noSePuede('La línea está pausada: reanudala antes de finalizar la elaboración');

    const neto = aNumero(cuerpo.cantidad_real_kg);
    if (!(neto > 0)) throw datosInvalidos('Ingresá la cantidad neta elaborada');
    const producto = db.prepare('SELECT * FROM producto WHERE id = ?').get(op.producto_id);
    const bultos = Number.isNaN(aNumero(cuerpo.bultos)) ? Math.round(neto / producto.presentacion_kg) : Math.round(aNumero(cuerpo.bultos));
    if (bultos < 0) throw datosInvalidos('Las bolsas conformadas no pueden ser negativas');
    if (!Array.isArray(cuerpo.consumos)) throw datosInvalidos('Faltan los consumos de insumos');

    const items = db.prepare(`
      SELECT oi.insumo_id, i.nombre, i.tipo, i.critico
      FROM op_item oi JOIN insumo i ON i.id = oi.insumo_id WHERE oi.op_id = ?`).all(op.id);

    // 1) Validar cada fila de consumo
    const porInsumo = new Map();   // total consumido de cada insumo
    const porPartida = new Map();  // total pedido a cada partida
    const validos = [];
    for (const fila of cuerpo.consumos) {
      const cantidad = aNumero(fila.cantidad);
      if (!(cantidad > 0)) continue; // las filas en cero se ignoran
      const partida = db.prepare('SELECT * FROM partida_insumo WHERE id = ?').get(Number(fila.partida_id));
      if (!partida) throw datosInvalidos('Hay un consumo sin lote de origen');
      if (partida.insumo_id !== Number(fila.insumo_id)) throw datosInvalidos(`La partida ${partida.nro_lote} no corresponde a ese insumo`);
      if (!items.some((i) => i.insumo_id === partida.insumo_id)) throw datosInvalidos(`La partida ${partida.nro_lote} no pertenece a la receta de la orden`);
      if (partida.estado !== 'LIBERADO') throw noSePuede(`La partida ${partida.nro_lote} no está liberada`);
      porInsumo.set(partida.insumo_id, (porInsumo.get(partida.insumo_id) || 0) + cantidad);
      porPartida.set(partida.id, (porPartida.get(partida.id) || 0) + cantidad);
      validos.push({ insumo_id: partida.insumo_id, partida_id: partida.id, cantidad });
    }

    // 2) Saldo suficiente en cada partida (si no alcanza, hay que dividir el consumo)
    for (const [partidaId, total] of porPartida) {
      const partida = db.prepare('SELECT * FROM partida_insumo WHERE id = ?').get(partidaId);
      if (total > partida.cantidad + 1e-9) {
        throw noSePuede(`La partida ${partida.nro_lote} tiene saldo ${redondear(partida.cantidad)} y se intenta consumir ${redondear(total)}. Dividí el consumo en otra partida.`);
      }
    }

    // 3) Trazabilidad: cada insumo crítico necesita al menos un lote de origen
    for (const item of items.filter((i) => i.critico)) {
      if (!porInsumo.get(item.insumo_id)) {
        throw noSePuede(`Falta asignar un lote de origen para "${item.nombre}"`);
      }
    }

    // 4) Merma = materias primas consumidas - kilos netos elaborados
    const kgConsumidos = items.filter((i) => i.tipo === 'MP').reduce((a, i) => a + (porInsumo.get(i.insumo_id) || 0), 0);
    if (neto > kgConsumidos + 1e-9) {
      throw noSePuede(`La cantidad neta (${neto} kg) no puede superar las materias primas consumidas (${redondear(kgConsumidos)} kg)`);
    }
    const mermaKg = redondear(kgConsumidos - neto, 2);
    const mermaPct = kgConsumidos > 0 ? redondear((mermaKg / kgConsumidos) * 100, 2) : 0;

    // 5) Descontar stock y registrar el consumo real
    for (const fila of validos) {
      db.prepare('UPDATE partida_insumo SET cantidad = cantidad - ? WHERE id = ?').run(fila.cantidad, fila.partida_id);
      db.prepare('INSERT INTO consumo(op_id,insumo_id,partida_id,cantidad) VALUES (?,?,?,?)').run(op.id, fila.insumo_id, fila.partida_id, fila.cantidad);
    }

    // 6) Crear el lote en CUARENTENA y pasar la orden a control de calidad
    const fin = ahoraISO();
    const lote = db.prepare(`INSERT INTO lote_produccion(codigo,op_id,producto_id,cantidad_kg,bultos,vencimiento,estado,creado_en)
      VALUES (?,?,?,?,?,?,'CUARENTENA',?)`)
      .run(op.lote_codigo_previsto, op.id, op.producto_id, neto, bultos, op.vencimiento_previsto, fin);
    db.prepare(`UPDATE orden_produccion SET estado='EN_CONTROL_CALIDAD', cantidad_real_kg=?, bultos=?,
                merma_kg=?, merma_pct=?, fin_elaboracion=?, avance_json=NULL WHERE id=?`)
      .run(neto, bultos, mermaKg, mermaPct, fin, op.id);
    const loteId = Number(lote.lastInsertRowid);
    auditar(usuario, 'LOTE_EN_CUARENTENA', op.lote_codigo_previsto, `Fin de elaboración · ${neto} kg netos`,
      { op_id: op.id, lote_id: loteId, resultado: 'Lote Cuarentena' });
    return { orden: getOrden(op.id), lote_id: loteId, merma_kg: mermaKg, merma_pct: mermaPct };
  });
}

module.exports = {
  MOTIVOS_PAUSA,
  requerimientos, verificarDisponibilidad, proximoNumero,
  crearOrden, completarBorrador, planificarOrden, cancelarOrden,
  listOrdenes, getOrden, sugerirConsumo,
  iniciarProduccion, pausarLinea, reanudarLinea, guardarAvance, finalizarElaboracion,
};
