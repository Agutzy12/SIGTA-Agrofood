'use strict';
/**
 * Cosas que usan todos los servicios: errores, auditoría y pequeñas funciones de ayuda.
 */
const { db } = require('../db');
const { ahoraISO } = require('../clock');

/** Error que el servidor convierte en una respuesta HTTP (400, 404, 409...). */
class HttpError extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status;
  }
}
const datosInvalidos = (m) => new HttpError(400, m);   // faltan datos o están mal
const noExiste = (m) => new HttpError(404, m);         // no se encontró lo pedido
const noSePuede = (m) => new HttpError(409, m);        // el estado actual no lo permite

/** Redondea a N decimales (evita 0.30000000000000004). */
function redondear(numero, decimales = 3) {
  const f = 10 ** decimales;
  return Math.round(numero * f) / f;
}

/** 7 -> "00007" */
function rellenar(numero, largo) {
  return String(numero).padStart(largo, '0');
}

/** Convierte a número. Si viene vacío o no es número devuelve NaN. */
function aNumero(valor) {
  return valor === '' || valor === null || valor === undefined ? NaN : Number(valor);
}

/** Fecha local como "AAAA-MM-DD". */
function fechaLocal(fecha) {
  return `${fecha.getFullYear()}-${rellenar(fecha.getMonth() + 1, 2)}-${rellenar(fecha.getDate(), 2)}`;
}

/** Suma meses a una fecha y devuelve "AAAA-MM-DD". */
function sumarMeses(fecha, meses) {
  const nueva = new Date(fecha.getTime());
  nueva.setMonth(nueva.getMonth() + meses);
  return fechaLocal(nueva);
}

/** Número de semana del año (ISO 8601) y año al que pertenece esa semana. */
function semanaISO(fecha) {
  const t = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
  const dia = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dia);
  const anio = t.getUTCFullYear();
  const semana = Math.ceil(((t - Date.UTC(anio, 0, 1)) / 86400000 + 1) / 7);
  return { anio, semana };
}

/**
 * Guarda un renglón en el historial (tabla auditoria).
 * extras: { op_id, lote_id, resultado } sirven para armar el historial de un lote.
 */
function auditar(usuario, accion, entidad, detalle, extras = {}) {
  db.prepare(`INSERT INTO auditoria(fecha,usuario,rol,accion,entidad,detalle,resultado,op_id,lote_id)
              VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(ahoraISO(), usuario?.nombre || 'Sistema', usuario?.rol || '-', accion, entidad ?? null,
      detalle ?? null, extras.resultado ?? null, extras.op_id ?? null, extras.lote_id ?? null);
}

/** Convierte los objetos de node:sqlite (sin prototipo) en objetos comunes. */
function filas(lista) {
  return lista.map((f) => ({ ...f }));
}

module.exports = {
  HttpError, datosInvalidos, noExiste, noSePuede,
  redondear, rellenar, aNumero, fechaLocal, sumarMeses, semanaISO, auditar, filas,
};
