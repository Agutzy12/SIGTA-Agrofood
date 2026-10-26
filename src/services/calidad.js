'use strict';
/**
 * CU-P03 Registrar Control de Calidad de Lote
 * El analista carga las determinaciones, el sistema las compara con la especificación
 * y el analista firma el dictamen: lote liberado o lote bloqueado.
 */
const { db, tx } = require('../db');
const { ahoraISO } = require('../clock');
const { datosInvalidos, noExiste, noSePuede, aNumero, auditar, filas } = require('./comun');

const FORMULARIO = 'R.BPM.01V01';

/**
 * Especificación de ejemplo de un producto (NO son límites normativos: son valores de la demo).
 * `opciones` son las que aparecen en las listas desplegables de la pantalla.
 */
function especificacion(producto) {
  return {
    humedad_max: producto.humedad_max,
    ph_min: producto.ph_min,
    ph_max: producto.ph_max,
    ufc_max: producto.ufc_max,
    aroma: { esperado: 'Característico', texto: 'Característico, sin olores extraños', opciones: ['Característico', 'Atípico'] },
    color: { esperado: producto.color_esperado, texto: producto.color_esperado, opciones: [producto.color_esperado, 'No uniforme'] },
    sabor: { esperado: 'Característico', texto: 'Característico, sin notas extrañas', opciones: ['Característico', 'Extraño'] },
  };
}

/** Compara los resultados contra la especificación. Devuelve true/false por determinación. */
function evaluarEnsayo(espec, e) {
  return {
    humedad: e.humedad <= espec.humedad_max,
    ph: e.ph >= espec.ph_min && e.ph <= espec.ph_max,
    aroma: e.aroma === espec.aroma.esperado,
    color: e.color === espec.color.esperado,
    sabor: e.sabor === espec.sabor.esperado,
    ufc: e.ufc <= espec.ufc_max,
  };
}

function leerLote(id) {
  const lote = db.prepare(`
    SELECT l.*, o.numero AS op_numero, o.id AS op_id, o.estado AS op_estado, o.fin_elaboracion AS op_fin,
           p.codigo AS producto_codigo, p.nombre AS producto_nombre, p.humedad_max, p.ph_min, p.ph_max,
           p.ufc_max, p.color_esperado
    FROM lote_produccion l
    JOIN orden_produccion o ON o.id = l.op_id
    JOIN producto p ON p.id = l.producto_id
    WHERE l.id = ?`).get(Number(id));
  if (!lote) throw noExiste('Lote inexistente');
  return lote;
}

function conBorrador(lote) {
  const resultado = { ...lote, borrador: lote.borrador_json ? JSON.parse(lote.borrador_json) : null };
  delete resultado.borrador_json;
  return resultado;
}

/** Lista de lotes esperando análisis (la columna izquierda de la pantalla). */
function lotesCuarentena() {
  const lista = db.prepare(`
    SELECT l.id FROM lote_produccion l WHERE l.estado = 'CUARENTENA' ORDER BY l.creado_en DESC, l.id DESC`).all();
  return lista.map((f) => getLoteCalidad(f.id));
}

/** Todo lo que necesita la pantalla de calidad para un lote. */
function getLoteCalidad(id) {
  const lote = conBorrador(leerLote(id));
  return {
    ...lote,
    especificacion: especificacion(lote),
    documentos: [
      { tipo: 'Parte de elaboración', codigo: lote.op_numero, fecha: lote.op_fin },
      { tipo: 'Ensayo microbiológico', codigo: `LAB-${lote.creado_en.slice(0, 4)}-${String(lote.id + 441).padStart(5, '0')}`, fecha: lote.creado_en },
    ],
  };
}

function leerEnsayo(cuerpo) {
  const ensayo = {
    humedad: aNumero(cuerpo.humedad), ph: aNumero(cuerpo.ph), ufc: aNumero(cuerpo.ufc),
    aroma: cuerpo.aroma, color: cuerpo.color, sabor: cuerpo.sabor,
  };
  if ([ensayo.humedad, ensayo.ph, ensayo.ufc].some((v) => Number.isNaN(v))) {
    throw datosInvalidos('Completá humedad, pH y recuento microbiológico');
  }
  if (!ensayo.aroma || !ensayo.color || !ensayo.sabor) throw datosInvalidos('Completá la evaluación sensorial (aroma, color y sabor)');
  return ensayo;
}

/** "Guardar borrador": conserva lo cargado, pero el lote sigue en cuarentena. */
function guardarBorrador(usuario, loteId, cuerpo) {
  const lote = leerLote(loteId);
  if (lote.estado !== 'CUARENTENA') throw noSePuede('El lote ya fue dictaminado');
  const borrador = {
    humedad: cuerpo.humedad ?? '', ph: cuerpo.ph ?? '', ufc: cuerpo.ufc ?? '',
    aroma: cuerpo.aroma ?? '', color: cuerpo.color ?? '', sabor: cuerpo.sabor ?? '',
    dictamen: cuerpo.dictamen ?? '', observaciones: cuerpo.observaciones ?? '',
    guardado_por: usuario.nombre, guardado_en: ahoraISO(),
  };
  db.prepare('UPDATE lote_produccion SET borrador_json = ? WHERE id = ?').run(JSON.stringify(borrador), lote.id);
  return getLoteCalidad(lote.id);
}

function registrarControlCalidad(usuario, loteId, cuerpo) {
  return tx(() => {
    const lote = leerLote(loteId);
    if (lote.estado !== 'CUARENTENA') {
      throw noSePuede(`El lote ya fue dictaminado (${lote.estado}). El protocolo firmado no se puede modificar.`);
    }
    const espec = especificacion(lote);
    const ensayo = leerEnsayo(cuerpo);
    if (!['APROBAR_LIBERAR', 'RECHAZAR_BLOQUEAR'].includes(cuerpo.dictamen)) throw datosInvalidos('Elegí el dictamen: aprobado o rechazado');

    const resultados = evaluarEnsayo(espec, ensayo);
    const fuera = Object.entries(resultados).filter(([, ok]) => !ok).map(([nombre]) => nombre);
    if (cuerpo.dictamen === 'APROBAR_LIBERAR' && fuera.length > 0) {
      throw noSePuede(`No se puede aprobar: hay determinaciones fuera de especificación (${fuera.join(', ')}). Corresponde rechazar y bloquear el lote.`);
    }
    if (cuerpo.dictamen === 'RECHAZAR_BLOQUEAR' && !String(cuerpo.observaciones || '').trim()) {
      throw datosInvalidos('Para rechazar un lote detallá la no conformidad en las observaciones');
    }

    const protocolo = `CC-${lote.op_numero.slice(3)}`; // OP-2026-00128 -> CC-2026-00128
    db.prepare(`INSERT INTO control_calidad
      (lote_id,protocolo,formulario,humedad,ph,aroma,color,sabor,ufc,dictamen,observaciones,analista,fecha)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(lote.id, protocolo, FORMULARIO, ensayo.humedad, ensayo.ph, ensayo.aroma, ensayo.color, ensayo.sabor,
        ensayo.ufc, cuerpo.dictamen, cuerpo.observaciones || null, usuario.nombre, ahoraISO());

    if (cuerpo.dictamen === 'APROBAR_LIBERAR') {
      db.prepare("UPDATE lote_produccion SET estado='APROBADO_LIBERADO', borrador_json=NULL WHERE id=?").run(lote.id);
      auditar(usuario, 'LOTE_LIBERADO', lote.codigo, 'Firma de protocolo de calidad',
        { op_id: lote.op_id, lote_id: lote.id, resultado: 'Lote liberado · OP en CC' });
    } else {
      db.prepare("UPDATE lote_produccion SET estado='RECHAZADO_BLOQUEADO', borrador_json=NULL WHERE id=?").run(lote.id);
      db.prepare("UPDATE orden_produccion SET estado='RECHAZADA_SCRAP', cierre=? WHERE id=?").run(ahoraISO(), lote.op_id);
      auditar(usuario, 'LOTE_BLOQUEADO', lote.codigo, 'Firma de protocolo de calidad · lote rechazado',
        { op_id: lote.op_id, lote_id: lote.id, resultado: 'Lote bloqueado · OP rechazada' });
      auditar(usuario, 'ALERTA_NO_CONFORMIDAD', lote.codigo,
        `Jefatura de planta: desvío en el lote ${lote.codigo} (${lote.op_numero}). Lote bloqueado y orden a Scrap. ${cuerpo.observaciones}`,
        { op_id: lote.op_id, lote_id: lote.id });
    }
    return { protocolo, resultados, lote: getLoteCalidad(lote.id) };
  });
}

/** Protocolo firmado completo (botón "Ver protocolo firmado"). */
function getProtocoloFirmado(loteId) {
  const lote = leerLote(loteId);
  const control = db.prepare('SELECT * FROM control_calidad WHERE lote_id = ?').get(lote.id);
  if (!control) throw noExiste('Este lote todavía no tiene un protocolo firmado');
  const espec = especificacion(lote);
  return {
    protocolo: { ...control },
    lote: { codigo: lote.codigo, producto_nombre: lote.producto_nombre, cantidad_kg: lote.cantidad_kg, estado: lote.estado },
    especificacion: espec,
    resultados: evaluarEnsayo(espec, control),
  };
}

function historialCalidad() {
  return filas(db.prepare(`
    SELECT c.*, l.codigo AS lote_codigo, p.nombre AS producto_nombre
    FROM control_calidad c JOIN lote_produccion l ON l.id = c.lote_id JOIN producto p ON p.id = l.producto_id
    ORDER BY c.id DESC`).all());
}

module.exports = {
  FORMULARIO, especificacion, evaluarEnsayo,
  lotesCuarentena, getLoteCalidad, guardarBorrador, registrarControlCalidad, getProtocoloFirmado, historialCalidad,
};
