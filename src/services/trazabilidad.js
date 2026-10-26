'use strict';
/**
 * Trazabilidad de lote: de dónde vinieron los insumos (hacia atrás),
 * qué pasó en planta y calidad, y a dónde fue el producto (hacia adelante).
 */
const { db } = require('../db');
const { datosInvalidos, noExiste, filas } = require('./comun');

/** Arma la ficha completa de un lote. */
function traceLote(loteId) {
  const lote = db.prepare(`
    SELECT l.*, p.codigo AS producto_codigo, p.nombre AS producto_nombre, p.presentacion_kg
    FROM lote_produccion l JOIN producto p ON p.id = l.producto_id WHERE l.id = ?`).get(Number(loteId));
  if (!lote) throw noExiste('Lote inexistente');

  const op = db.prepare(`
    SELECT o.*, li.nombre AS linea_nombre, r.codigo AS receta_codigo, r.version AS receta_version
    FROM orden_produccion o
    LEFT JOIN linea li ON li.id = o.linea_id
    JOIN receta r ON r.id = o.receta_id
    WHERE o.id = ?`).get(lote.op_id);

  // Hacia atrás: cada insumo con las partidas de proveedor que se usaron
  const consumos = db.prepare(`
    SELECT c.insumo_id, c.cantidad, i.codigo AS insumo_codigo, i.nombre AS insumo_nombre, i.unidad, i.tipo,
           pa.nro_lote, pa.proveedor, pa.documento_origen
    FROM consumo c
    JOIN insumo i ON i.id = c.insumo_id
    JOIN partida_insumo pa ON pa.id = c.partida_id
    WHERE c.op_id = ? ORDER BY i.tipo DESC, i.id, c.id`).all(op.id);
  const origen = [];
  for (const c of consumos) {
    let grupo = origen.find((g) => g.insumo_id === c.insumo_id);
    if (!grupo) {
      grupo = { insumo_id: c.insumo_id, insumo_codigo: c.insumo_codigo, insumo_nombre: c.insumo_nombre, unidad: c.unidad, tipo: c.tipo, total: 0, proveedores: [], lotes: [] };
      origen.push(grupo);
    }
    grupo.total += c.cantidad;
    if (c.proveedor && !grupo.proveedores.includes(c.proveedor)) grupo.proveedores.push(c.proveedor);
    grupo.lotes.push({ nro_lote: c.nro_lote, cantidad: c.cantidad, documento_origen: c.documento_origen });
  }
  const partidasUsadas = consumos.length;
  const kgConsumidos = consumos.filter((c) => c.tipo === 'MP').reduce((a, c) => a + c.cantidad, 0);

  const calidad = db.prepare('SELECT * FROM control_calidad WHERE lote_id = ?').get(lote.id);
  const ingreso = db.prepare('SELECT * FROM stock_pt WHERE lote_id = ? ORDER BY id LIMIT 1').get(lote.id);
  const pallets = filas(db.prepare('SELECT * FROM pallet WHERE lote_id = ? ORDER BY id').all(lote.id));
  const stockVendible = db.prepare('SELECT COALESCE(SUM(cantidad_kg),0) AS kg FROM stock_pt WHERE lote_id = ?').get(lote.id).kg;
  const despachos = filas(db.prepare('SELECT * FROM despacho WHERE lote_id = ? ORDER BY id').all(lote.id));

  // Historial: todo lo que pasó con la orden y con el lote (sin las alertas internas)
  const historial = filas(db.prepare(`
    SELECT fecha, detalle AS evento, usuario, resultado FROM auditoria
    WHERE (op_id = ? OR lote_id = ?) AND accion NOT LIKE 'ALERTA%' AND detalle IS NOT NULL
    ORDER BY fecha, id`).all(op.id, lote.id));

  const documentos = [{ tipo: 'Orden y parte de elaboración', codigo: op.numero, fecha: op.creado_en }];
  if (calidad) documentos.push({ tipo: 'Protocolo de calidad firmado', codigo: `${calidad.protocolo} · ${calidad.formulario}`, fecha: calidad.fecha });
  if (ingreso) documentos.push({ tipo: 'Comprobante de recepción', codigo: ingreso.comprobante, fecha: ingreso.fecha });

  return {
    tipo: 'LOTE',
    lote: { ...lote },
    op: { ...op, avance_json: undefined },
    origen,
    resumen_origen: { insumos: origen.length, partidas: partidasUsadas },
    kg_consumidos: kgConsumidos,
    calidad: calidad ? { ...calidad } : null,
    ingreso: ingreso ? { ...ingreso } : null,
    pallets,
    stock_vendible_kg: stockVendible,
    despachos,
    despachado_kg: despachos.reduce((a, d) => a + d.cantidad_kg, 0),
    historial,
    documentos,
    ultimo_movimiento: historial.length ? historial[historial.length - 1] : null,
  };
}

/** Lotes que usaron una partida de insumo (hacia adelante desde el proveedor). */
function lotesDePartida(partida) {
  const lotes = db.prepare(`
    SELECT DISTINCT l.id, l.codigo, l.estado, l.cantidad_kg, p.nombre AS producto_nombre
    FROM consumo c
    JOIN lote_produccion l ON l.op_id = c.op_id
    JOIN producto p ON p.id = l.producto_id
    WHERE c.partida_id = ? ORDER BY l.id`).all(partida.id);
  return filas(lotes).map((l) => {
    const despachos = db.prepare('SELECT cliente, cantidad_kg, fecha FROM despacho WHERE lote_id = ? ORDER BY id').all(l.id);
    return { ...l, despachos: filas(despachos) };
  });
}

/**
 * Busca por código de lote, número de orden, pallet o lote de origen de un insumo.
 * Devuelve la ficha del lote, o la lista de lotes si hay varias coincidencias.
 */
function buscar(texto) {
  const q = String(texto || '').trim();
  if (!q) throw datosInvalidos('Ingresá un lote, una orden o un identificador');

  const lote = db.prepare('SELECT id FROM lote_produccion WHERE codigo = ? COLLATE NOCASE').get(q);
  if (lote) return traceLote(lote.id);

  const porOrden = db.prepare(`
    SELECT l.id FROM lote_produccion l JOIN orden_produccion o ON o.id = l.op_id WHERE o.numero = ? COLLATE NOCASE`).get(q);
  if (porOrden) return traceLote(porOrden.id);

  const porPallet = db.prepare('SELECT lote_id FROM pallet WHERE codigo = ? COLLATE NOCASE').get(q);
  if (porPallet) return traceLote(porPallet.lote_id);

  const partidas = db.prepare(`
    SELECT pa.*, i.nombre AS insumo_nombre FROM partida_insumo pa JOIN insumo i ON i.id = pa.insumo_id
    WHERE pa.nro_lote = ? COLLATE NOCASE`).all(q);
  if (partidas.length) {
    return { tipo: 'PARTIDA', partidas: filas(partidas).map((p) => ({ ...p, lotes: lotesDePartida(p) })) };
  }

  const parecidos = filas(db.prepare(`
    SELECT l.id, l.codigo, l.estado, l.cantidad_kg, p.nombre AS producto_nombre
    FROM lote_produccion l JOIN producto p ON p.id = l.producto_id
    WHERE l.codigo LIKE ? COLLATE NOCASE ORDER BY l.id DESC LIMIT 20`).all(`%${q}%`));
  if (parecidos.length === 1) return traceLote(parecidos[0].id);
  if (parecidos.length > 1) return { tipo: 'LISTA', lotes: parecidos };

  throw noExiste(`No se encontró ningún lote, orden o identificador que coincida con "${q}"`);
}

module.exports = { traceLote, buscar };
