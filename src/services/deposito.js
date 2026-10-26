'use strict';
/**
 * CU-P04 Registrar Ingreso de Producto Terminado y Cierre de OP
 * Más el despacho de ejemplo, que sirve para mostrar el bloqueo de lotes no liberados.
 */
const { db, tx } = require('../db');
const { ahoraISO } = require('../clock');
const { BULTOS_POR_PALLET, UBICACIONES } = require('../config');
const {
  HttpError, datosInvalidos, noExiste, noSePuede, redondear, rellenar, aNumero, auditar, filas,
} = require('./comun');

/** Lotes liberados por calidad que todavía no entraron a depósito. */
function recepcionesPendientes() {
  return filas(db.prepare(`
    SELECT o.id AS op_id, o.numero AS op_numero, l.id AS lote_id, l.codigo AS lote_codigo,
           l.cantidad_kg, l.bultos, l.vencimiento, p.codigo AS producto_codigo, p.nombre AS producto_nombre,
           c.fecha AS liberado_en
    FROM orden_produccion o
    JOIN lote_produccion l ON l.op_id = o.id
    JOIN producto p ON p.id = o.producto_id
    JOIN control_calidad c ON c.lote_id = l.id
    WHERE o.estado = 'EN_CONTROL_CALIDAD' AND l.estado = 'APROBADO_LIBERADO'
    ORDER BY c.fecha DESC`).all());
}

/**
 * Reparte las bolsas en pallets de BULTOS_POR_PALLET.
 * Ejemplo: 49 bolsas -> un pallet de 25 y otro de 24. Los kilos se reparten en proporción.
 */
function armarPallets(bultos, kg, anio) {
  const ultimo = db.prepare('SELECT COUNT(*) AS n FROM pallet').get().n;
  const cantidad = Math.ceil(bultos / BULTOS_POR_PALLET);
  const pallets = [];
  let kgAsignados = 0;
  for (let i = 0; i < cantidad; i++) {
    const enEste = i < cantidad - 1 ? BULTOS_POR_PALLET : bultos - BULTOS_POR_PALLET * (cantidad - 1);
    const esElUltimo = i === cantidad - 1;
    const kgEste = esElUltimo ? redondear(kg - kgAsignados, 2) : redondear((kg * enEste) / bultos, 2);
    kgAsignados += kgEste;
    pallets.push({ codigo: `PAL-${anio}-${rellenar(ultimo + i + 1, 5)}`, bultos: enEste, kg: kgEste });
  }
  return pallets;
}

/** Datos de la pantalla de ingreso a depósito para una orden. */
function getRecepcion(opId) {
  const op = db.prepare('SELECT * FROM orden_produccion WHERE id = ?').get(Number(opId));
  if (!op) throw noExiste('Orden de producción inexistente');
  const lote = db.prepare('SELECT * FROM lote_produccion WHERE op_id = ?').get(op.id);
  if (!lote) throw noSePuede('Esta orden todavía no generó un lote');
  const producto = db.prepare('SELECT * FROM producto WHERE id = ?').get(op.producto_id);
  const control = db.prepare('SELECT * FROM control_calidad WHERE lote_id = ?').get(lote.id);

  let habilitado = true;
  let motivo = null;
  if (op.estado === 'FINALIZADA') { habilitado = false; motivo = 'Este lote ya fue recibido en depósito.'; }
  else if (lote.estado === 'CUARENTENA') { habilitado = false; motivo = 'El lote está en cuarentena: no se puede recibir hasta que Calidad lo libere.'; }
  else if (lote.estado === 'RECHAZADO_BLOQUEADO') { habilitado = false; motivo = 'El lote fue rechazado y bloqueado por Calidad.'; }
  else if (op.estado !== 'EN_CONTROL_CALIDAD') { habilitado = false; motivo = `La orden está en estado ${op.estado}.`; }

  const anio = (op.cierre || ahoraISO()).slice(0, 4);
  return {
    habilitado,
    motivo,
    op: { ...op },
    lote: { ...lote },
    producto: { ...producto },
    certificado: control ? { ...control } : null,
    pallets_previstos: armarPallets(lote.bultos, lote.cantidad_kg, anio),
    comprobante: `REC-${op.numero.slice(3)}`,
    ubicaciones: UBICACIONES,
  };
}

function ingresarProductoTerminado(usuario, cuerpo) {
  return tx(() => {
    const op = db.prepare('SELECT * FROM orden_produccion WHERE id = ?').get(Number(cuerpo.op_id));
    if (!op) throw noExiste('Orden de producción inexistente');
    const lote = db.prepare('SELECT * FROM lote_produccion WHERE op_id = ?').get(op.id);
    if (!lote) throw noSePuede('La orden todavía no generó un lote');
    if (lote.estado !== 'APROBADO_LIBERADO') {
      throw noSePuede('Sólo se pueden recibir lotes aprobados y liberados. Este lote está en estado ' + lote.estado + '.');
    }
    if (op.estado !== 'EN_CONTROL_CALIDAD') throw noSePuede(`La orden debe estar EN_CONTROL_CALIDAD (actual: ${op.estado})`);

    const bultos = Math.round(aNumero(cuerpo.bultos_recibidos));
    const kg = aNumero(cuerpo.kg_conformes);
    const danados = Number.isNaN(aNumero(cuerpo.bultos_danados)) ? 0 : Math.round(aNumero(cuerpo.bultos_danados));
    const merma = Number.isNaN(aNumero(cuerpo.merma_kg)) ? 0 : aNumero(cuerpo.merma_kg);
    if (!(bultos > 0)) throw datosInvalidos('Ingresá los bultos recibidos');
    if (!(kg > 0)) throw datosInvalidos('Ingresá los kilogramos conformes');
    if (danados < 0 || merma < 0) throw datosInvalidos('Los bultos dañados y la merma no pueden ser negativos');
    if (bultos > lote.bultos) throw noSePuede(`Se informan ${bultos} bultos y el lote sólo tiene ${lote.bultos}`);

    const diferencia = redondear(lote.cantidad_kg - kg - merma, 2);
    if (diferencia < 0) throw noSePuede('Los kilos conformes más la merma superan lo elaborado');
    const hayDesvio = danados > 0 || merma > 0 || diferencia > 0;
    if (hayDesvio && !String(cuerpo.justificacion || '').trim()) {
      throw datosInvalidos('Justificá el daño, la merma o la diferencia de kilos');
    }

    const { deposito, sector, rack, nivel } = cuerpo;
    if (!deposito || !sector || !rack || !nivel) throw datosInvalidos('Completá depósito, sector, rack y nivel');
    const llevaCamara = UBICACIONES.sectoresConCamara.includes(sector);
    if (llevaCamara && !cuerpo.camara) throw datosInvalidos('Elegí la cámara de frío');

    const pallets = armarPallets(bultos, kg, ahoraISO().slice(0, 4));
    const comprobante = `REC-${op.numero.slice(3)}`;
    const ahoraTexto = ahoraISO();

    for (const pallet of pallets) {
      db.prepare('INSERT INTO pallet(codigo,lote_id,bultos,kg) VALUES (?,?,?,?)').run(pallet.codigo, lote.id, pallet.bultos, pallet.kg);
    }
    // El trigger de la base rechaza este INSERT si el lote no está aprobado y liberado
    db.prepare(`INSERT INTO stock_pt
      (lote_id,comprobante,deposito,sector,rack,nivel,camara,bultos,pallets,kg_recibidos,cantidad_kg,bultos_danados,merma_kg,justificacion,recibido_por,fecha)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(lote.id, comprobante, deposito, sector, rack, nivel, llevaCamara ? cuerpo.camara : null, bultos, pallets.length,
        kg, kg, danados, merma, cuerpo.justificacion || null, usuario.nombre, ahoraTexto);
    db.prepare("UPDATE orden_produccion SET estado='FINALIZADA', cierre=? WHERE id=?").run(ahoraTexto, op.id);
    auditar(usuario, 'OP_FINALIZADA', op.numero, `Recepción de ${pallets.length} pallets · ${kg} kg`,
      { op_id: op.id, lote_id: lote.id, resultado: 'OP Finalizada' });
    return { comprobante, pallets, orden_id: op.id, lote_id: lote.id };
  });
}

function stockPT() {
  return filas(db.prepare(`
    SELECT s.*, l.codigo AS lote_codigo, l.vencimiento, p.nombre AS producto_nombre
    FROM stock_pt s JOIN lote_produccion l ON l.id = s.lote_id JOIN producto p ON p.id = l.producto_id
    WHERE s.cantidad_kg > 0 ORDER BY s.id`).all());
}

/**
 * Despacho de ejemplo: descuenta stock de un lote.
 * Si el lote no está aprobado y liberado, el sistema lo bloquea (código 423).
 */
function despachar(usuario, cuerpo) {
  const lote = db.prepare('SELECT * FROM lote_produccion WHERE id = ?').get(Number(cuerpo.lote_id));
  if (!lote) throw noExiste('Lote inexistente');
  const kg = aNumero(cuerpo.cantidad_kg);
  if (!(kg > 0)) throw datosInvalidos('La cantidad a despachar debe ser mayor a 0');
  if (!String(cuerpo.cliente || '').trim()) throw datosInvalidos('Indicá el cliente');

  if (lote.estado !== 'APROBADO_LIBERADO') {
    // Se anota fuera de la transacción para que el intento quede registrado
    auditar(usuario, 'DESPACHO_BLOQUEADO', lote.codigo, 'Intento de despacho bloqueado',
      { op_id: lote.op_id, lote_id: lote.id, resultado: `Rechazado: lote ${lote.estado}` });
    throw new HttpError(423, `Despacho bloqueado: el lote ${lote.codigo} está en estado ${lote.estado} y sólo se pueden despachar lotes aprobados y liberados.`);
  }

  return tx(() => {
    const stock = db.prepare('SELECT * FROM stock_pt WHERE lote_id = ? AND cantidad_kg > 0 ORDER BY id').all(lote.id);
    const disponible = stock.reduce((a, s) => a + s.cantidad_kg, 0);
    if (kg > disponible + 1e-9) throw noSePuede(`Stock insuficiente del lote ${lote.codigo}: hay ${redondear(disponible)} kg`);

    let resto = kg;
    for (const fila of stock) {
      const tomar = Math.min(resto, fila.cantidad_kg);
      db.prepare('UPDATE stock_pt SET cantidad_kg = cantidad_kg - ? WHERE id = ?').run(tomar, fila.id);
      resto -= tomar;
      if (resto <= 1e-9) break;
    }
    db.prepare('INSERT INTO despacho(lote_id,cliente,cantidad_kg,fecha,usuario) VALUES (?,?,?,?,?)')
      .run(lote.id, cuerpo.cliente, kg, ahoraISO(), usuario.nombre);
    auditar(usuario, 'DESPACHO', lote.codigo, `Despacho de ${kg} kg a ${cuerpo.cliente}`,
      { op_id: lote.op_id, lote_id: lote.id, resultado: 'Stock descontado' });
    return { ok: true, lote: lote.codigo, cantidad_kg: kg, cliente: cuerpo.cliente };
  });
}

module.exports = { recepcionesPendientes, getRecepcion, ingresarProductoTerminado, stockPT, despachar };
