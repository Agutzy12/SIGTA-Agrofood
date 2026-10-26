'use strict';
/**
 * Datos del Panel general de producción (indicadores, gráfico y avisos).
 */
const { db } = require('../db');
const { ahora } = require('../clock');
const { PLANTA, OBJETIVO_DIARIO_KG } = require('../config');
const { redondear, fechaLocal, auditar, noExiste, filas } = require('./comun');
const { stockInsumos } = require('./inventario');
const { lotesCuarentena } = require('./calidad');

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Los últimos `cantidad` días hábiles (lunes a viernes) hasta hoy, del más viejo al más nuevo. */
function ultimosDiasHabiles(hoy, cantidad, saltear = 0) {
  const dias = [];
  const cursor = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  let salteados = 0;
  while (dias.length < cantidad) {
    const finDeSemana = cursor.getDay() === 0 || cursor.getDay() === 6;
    if (!finDeSemana) {
      if (salteados < saltear) salteados++;
      else dias.unshift(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return dias;
}

function turnoTexto(fecha) {
  const h = fecha.getHours();
  if (h >= 6 && h < 14) return 'Turno mañana · 06:00 a 14:00';
  if (h >= 14 && h < 22) return 'Turno tarde · 14:00 a 22:00';
  return 'Turno noche · 22:00 a 06:00';
}

function getPanel() {
  const hoy = ahora();
  const hoyTexto = fechaLocal(hoy);

  // Kilos netos elaborados por día (sin contar lotes rechazados)
  const lotes = db.prepare("SELECT creado_en, cantidad_kg FROM lote_produccion WHERE estado <> 'RECHAZADO_BLOQUEADO'").all();
  const kgPorDia = new Map();
  for (const l of lotes) {
    const dia = fechaLocal(new Date(l.creado_en));
    kgPorDia.set(dia, (kgPorDia.get(dia) || 0) + l.cantidad_kg);
  }
  const kgHoy = redondear(kgPorDia.get(hoyTexto) || 0, 0);

  const ultimos = ultimosDiasHabiles(hoy, 5);
  const anteriores = ultimosDiasHabiles(hoy, 5, 5);
  const recientes = ultimos.map((d) => {
    const clave = fechaLocal(d);
    return { fecha: clave, etiqueta: `${d.getDate()} ${MESES[d.getMonth()]}`, kg: redondear(kgPorDia.get(clave) || 0, 0), hoy: clave === hoyTexto };
  });
  const totalReciente = recientes.reduce((a, d) => a + d.kg, 0);
  const totalPrevio = anteriores.reduce((a, d) => a + (kgPorDia.get(fechaLocal(d)) || 0), 0);
  const variacion = totalPrevio > 0 ? redondear(((totalReciente - totalPrevio) / totalPrevio) * 100, 1) : null;

  // Contadores de órdenes
  const contar = (estado) => db.prepare('SELECT COUNT(*) AS n FROM orden_produccion WHERE estado = ?').get(estado).n;
  const enProduccion = contar('EN_PRODUCCION');
  const planificadas = contar('PLANIFICADA');
  const creadas = contar('CREADA');
  const enCalidad = contar('EN_CONTROL_CALIDAD');

  const cuarentena = lotesCuarentena();
  const sinAnalisis = cuarentena.filter((l) => !l.borrador).length;
  const bajoStock = stockInsumos().filter((i) => i.bajo);

  const proximas = filas(db.prepare(`
    SELECT o.hora_prevista AS hora, o.numero, o.cantidad_kg, o.estado, p.nombre AS producto_nombre
    FROM orden_produccion o JOIN producto p ON p.id = o.producto_id
    WHERE o.fecha_proyectada = ? AND o.estado IN ('CREADA','PLANIFICADA')
    ORDER BY o.hora_prevista, o.secuencia LIMIT 4`).all(hoyTexto));

  return {
    planta: PLANTA,
    hoy: hoyTexto,
    turno: turnoTexto(hoy),
    kpis: {
      activas: creadas + planificadas + enProduccion + enCalidad,
      enProduccion,
      planificadas,
      enCalidad,
      produccionHoyKg: kgHoy,
      objetivoKg: OBJETIVO_DIARIO_KG,
      objetivoPct: Math.round((kgHoy / OBJETIVO_DIARIO_KG) * 100),
      lotesCuarentena: cuarentena.length,
      cuarentenaSinAnalisis: sinAnalisis,
      alertasAbastecimiento: bajoStock.length,
    },
    recientes: { dias: recientes, totalKg: totalReciente, variacionPct: variacion },
    proximas,
    atencion: {
      stockBajo: bajoStock.slice(0, 2).map((i) => ({
        insumo_id: i.id, nombre: i.nombre, disponible: i.disponible, minimo: i.stock_minimo, unidad: i.unidad,
      })),
      stockBajoTotal: bajoStock.length,
      cuarentena: cuarentena.slice(0, 1).map((l) => ({ id: l.id, codigo: l.codigo, cantidad_kg: l.cantidad_kg })),
      cuarentenaTotal: cuarentena.length,
    },
  };
}

/** Botón "Avisar a Compras": deja registrado el aviso por stock bajo. */
function avisarCompras(usuario, insumoId) {
  const insumo = stockInsumos().find((i) => i.id === Number(insumoId));
  if (!insumo) throw noExiste('Insumo inexistente');
  auditar(usuario, 'ALERTA_COMPRAS', insumo.codigo,
    `Compras y Suministros: stock bajo de ${insumo.nombre} (${insumo.disponible} ${insumo.unidad}, mínimo ${insumo.stock_minimo})`);
  return { ok: true };
}

/** Últimas alertas (campanita de la cabecera). */
function listAlertas() {
  return filas(db.prepare("SELECT * FROM auditoria WHERE accion LIKE 'ALERTA%' ORDER BY id DESC LIMIT 8").all());
}

module.exports = { getPanel, avisarCompras, listAlertas };
