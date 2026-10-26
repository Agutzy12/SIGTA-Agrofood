'use strict';
// Pruebas del flujo completo. Se corren con:  npm test
// Usan una base en memoria, así que no tocan los datos reales de la demo.
process.env.DB_PATH = ':memory:';
const test = require('node:test');
const assert = require('node:assert/strict');
const seed = require('../src/seed');
const { handle } = require('../src/routes');
const { db } = require('../src/db');

seed.cargarDatosDeEjemplo();

/** Atajo para llamar a la API como un rol determinado. */
function api(rol, metodo, ruta, cuerpo, consulta) {
  return handle({ metodo, ruta, cabeceras: { 'x-rol': rol }, cuerpo, consulta });
}
const PROD = 'PRODUCCION', CAL = 'CALIDAD', DEP = 'DEPOSITO', DIR = 'DIRECCION';
const hoy = new Date().toISOString().slice(0, 10);

/** Crea y planifica una orden; devuelve la orden. */
/** Cada prueba arranca con insumos de sobra (el seed deja algunos bajos a propósito para el Panel). */
function reponerTodo() {
  for (let insumo_id = 1; insumo_id <= 14; insumo_id++) api(PROD, 'POST', '/api/demo/reponer', { insumo_id, cantidad: 5000 });
}
function nuevaOrden(producto_id = 1, cantidad_kg = 1000) {
  reponerTodo();
  const r = api(PROD, 'POST', '/api/ordenes', { producto_id, cantidad_kg, fecha_proyectada: hoy, hora_prevista: '08:00', accion: 'PLANIFICAR' });
  assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
  return r.cuerpo;
}
/** Lleva una orden hasta el lote en cuarentena. */
function elaborar(orden, neto = 980) {
  api(PROD, 'POST', `/api/ordenes/${orden.id}/iniciar`);
  const d = api(PROD, 'GET', `/api/ordenes/${orden.id}`).cuerpo;
  const r = api(PROD, 'POST', `/api/ordenes/${orden.id}/finalizar-elaboracion`, { consumos: d.consumo_sugerido, cantidad_real_kg: neto, bultos: neto / 20 });
  assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
  return r.cuerpo;
}
const ensayoOk = { humedad: 12.4, ph: 6.2, aroma: 'Característico', color: 'Crema uniforme', sabor: 'Característico', ufc: 320 };

test('el seed deja datos coherentes: órdenes en todos los estados y stock bajo', () => {
  const ordenes = api(DIR, 'GET', '/api/ordenes').cuerpo;
  const estados = new Set(ordenes.map((o) => o.estado));
  for (const e of ['CREADA', 'PLANIFICADA', 'EN_PRODUCCION', 'EN_CONTROL_CALIDAD', 'FINALIZADA', 'RECHAZADA_SCRAP', 'CANCELADA']) assert.ok(estados.has(e), `falta ${e}`);
  assert.equal(ordenes[ordenes.length - 1].numero, 'OP-2026-00111'.replace('2026', String(new Date().getFullYear())));
  const panel = api(DIR, 'GET', '/api/panel').cuerpo;
  assert.equal(panel.kpis.alertasAbastecimiento, 2);
});

test('sin usuario no se puede operar (401) y cada rol sólo hace lo suyo (403)', () => {
  assert.equal(handle({ metodo: 'GET', ruta: '/api/ordenes', cabeceras: {} }).estado, 401);
  assert.equal(api(CAL, 'POST', '/api/ordenes', {}).estado, 403);
  assert.equal(api(DIR, 'POST', '/api/depositos/ingreso', {}).estado, 403);
  assert.equal(api(PROD, 'POST', '/api/calidad/1', {}).estado, 403);
});

test('el cálculo de insumos es proporcional a la receta base de 100 kg', () => {
  const r = api(PROD, 'POST', '/api/ordenes/verificar', { producto_id: 1, cantidad_kg: 1000 }).cuerpo;
  assert.equal(r.factor, 10);
  assert.equal(r.items.find((i) => i.codigo === 'MP-001').requerido, 850);
  assert.equal(r.items.find((i) => i.codigo === 'ENV-020').requerido, 50);
  assert.equal(r.planificable, true);
});

test('con faltantes críticos no se puede planificar, pero sí guardar borrador (y avisa a Compras)', () => {
  // PPI02 usa almidón y levadura; con 100.000 kg falta casi todo
  const plan = api(PROD, 'POST', '/api/ordenes', { producto_id: 5, cantidad_kg: 100000, fecha_proyectada: hoy, accion: 'PLANIFICAR' });
  assert.equal(plan.estado, 409);
  const borrador = api(PROD, 'POST', '/api/ordenes', { producto_id: 5, cantidad_kg: 100000, fecha_proyectada: hoy, accion: 'BORRADOR' });
  assert.equal(borrador.estado, 200);
  assert.equal(borrador.cuerpo.estado, 'CREADA');
  assert.ok(api(PROD, 'GET', '/api/alertas').cuerpo.some((a) => /Compras/i.test(a.detalle)));
});

test('flujo completo: planificar, elaborar, aprobar, ingresar y trazar', () => {
  reponerTodo();
  const stockAntes = db.prepare('SELECT SUM(cantidad) n FROM partida_insumo WHERE insumo_id = 1').get().n;
  const orden = nuevaOrden();
  // planificar NO descuenta stock
  assert.equal(db.prepare('SELECT SUM(cantidad) n FROM partida_insumo WHERE insumo_id = 1').get().n, stockAntes + 5000);   // sólo sumó la reposición de la prueba

  const fin = elaborar(orden);
  assert.equal(fin.orden.estado, 'EN_CONTROL_CALIDAD');
  assert.equal(fin.merma_kg, 20);                       // (1000 consumidos - 980 netos)
  assert.equal(fin.merma_pct, 2);
  assert.equal(db.prepare('SELECT SUM(cantidad) n FROM partida_insumo WHERE insumo_id = 1').get().n, stockAntes + 5000 - 850);
  const lote = db.prepare('SELECT * FROM lote_produccion WHERE id = ?').get(fin.lote_id);
  assert.equal(lote.estado, 'CUARENTENA');
  assert.match(lote.codigo, /^L-MRC01-\d{6}-\d{2}$/);

  // en cuarentena: no se puede recibir ni despachar
  assert.equal(api(DEP, 'POST', '/api/despachos', { lote_id: lote.id, cliente: 'X', cantidad_kg: 10 }).estado, 423);
  assert.equal(api(DEP, 'POST', '/api/depositos/ingreso', { op_id: orden.id, bultos_recibidos: 49, kg_conformes: 980, deposito: 'Producto terminado', sector: 'Secos · Ambiente', rack: 'A03', nivel: '02' }).estado, 409);

  const cc = api(CAL, 'POST', `/api/calidad/${lote.id}`, { ...ensayoOk, dictamen: 'APROBAR_LIBERAR', observaciones: 'Conforme' });
  assert.equal(cc.estado, 200, JSON.stringify(cc.cuerpo));
  assert.match(cc.cuerpo.protocolo, /^CC-\d{4}-\d{5}$/);
  // la aprobación no finaliza la OP ni suma stock vendible
  assert.equal(db.prepare('SELECT estado FROM orden_produccion WHERE id = ?').get(orden.id).estado, 'EN_CONTROL_CALIDAD');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM stock_pt WHERE lote_id = ?').get(lote.id).n, 0);

  const ing = api(DEP, 'POST', '/api/depositos/ingreso', { op_id: orden.id, bultos_recibidos: 49, kg_conformes: 980, bultos_danados: 0, merma_kg: 0, deposito: 'Producto terminado', sector: 'Secos · Ambiente', rack: 'A03', nivel: '02' });
  assert.equal(ing.estado, 200, JSON.stringify(ing.cuerpo));
  assert.deepEqual(ing.cuerpo.pallets.map((p) => p.bultos), [25, 24]);
  assert.equal(db.prepare('SELECT estado FROM orden_produccion WHERE id = ?').get(orden.id).estado, 'FINALIZADA');

  const des = api(DEP, 'POST', '/api/despachos', { lote_id: lote.id, cliente: 'Cliente de prueba', cantidad_kg: 80 });
  assert.equal(des.estado, 200);

  const traza = api(DIR, 'GET', '/api/trazabilidad', {}, { q: lote.codigo }).cuerpo;
  assert.equal(traza.tipo, 'LOTE');
  assert.equal(traza.despachado_kg, 80);
  assert.equal(traza.stock_vendible_kg, 900);
  assert.ok(traza.origen.length >= 6);
  // también se encuentra por orden y por lote de origen de un insumo
  assert.equal(api(DIR, 'GET', '/api/trazabilidad', {}, { q: orden.numero }).cuerpo.lote.codigo, lote.codigo);
  assert.equal(api(DIR, 'GET', '/api/trazabilidad', {}, { q: 'MF-261015' }).cuerpo.tipo, 'PARTIDA');
});

test('un lote rechazado queda bloqueado, la OP pasa a Scrap y no puede ingresar ni despacharse', () => {
  const orden = nuevaOrden(2, 800);
  const fin = elaborar(orden, 780);
  const mal = api(CAL, 'POST', `/api/calidad/${fin.lote_id}`, { ...ensayoOk, ufc: 50000, dictamen: 'RECHAZAR_BLOQUEAR', observaciones: '' });
  assert.equal(mal.estado, 400);                         // rechazar exige observaciones
  const ok = api(CAL, 'POST', `/api/calidad/${fin.lote_id}`, { ...ensayoOk, ufc: 50000, dictamen: 'RECHAZAR_BLOQUEAR', observaciones: 'Recuento fuera de especificación' });
  assert.equal(ok.estado, 200);
  assert.equal(db.prepare('SELECT estado FROM orden_produccion WHERE id = ?').get(orden.id).estado, 'RECHAZADA_SCRAP');
  assert.equal(api(DEP, 'POST', '/api/despachos', { lote_id: fin.lote_id, cliente: 'X', cantidad_kg: 1 }).estado, 423);
  assert.equal(api(DEP, 'GET', `/api/depositos/recepcion/${orden.id}`).cuerpo.habilitado, false);
});

test('no se puede aprobar un lote con resultados fuera de especificación', () => {
  const orden = nuevaOrden(3, 600);
  const fin = elaborar(orden, 580);
  const r = api(CAL, 'POST', `/api/calidad/${fin.lote_id}`, { ...ensayoOk, color: 'Amarillo uniforme', humedad: 19, dictamen: 'APROBAR_LIBERAR', observaciones: 'x' });
  assert.equal(r.estado, 409);
});

test('las reglas de la base protegen aunque se salte la aplicación (triggers)', () => {
  const cuarentena = db.prepare("SELECT id FROM lote_produccion WHERE estado = 'CUARENTENA' LIMIT 1").get();
  assert.throws(() => db.prepare('INSERT INTO stock_pt(lote_id, cantidad_kg) VALUES (?, 5)').run(cuarentena.id), /Bloqueo lógico/);
  assert.throws(() => db.prepare("UPDATE control_calidad SET observaciones = 'x' WHERE id = 1").run(), /inalterable/);
  assert.throws(() => db.prepare('DELETE FROM control_calidad WHERE id = 1').run());
});

test('en el ingreso, el daño o la merma exigen justificación y no se pueden superar los kilos elaborados', () => {
  const orden = nuevaOrden(4, 750);
  const fin = elaborar(orden, 740);
  api(CAL, 'POST', `/api/calidad/${fin.lote_id}`, { ...ensayoOk, dictamen: 'APROBAR_LIBERAR', observaciones: 'ok' });
  const base = { op_id: orden.id, bultos_recibidos: 37, deposito: 'Producto terminado', sector: 'Secos · Ambiente', rack: 'A04', nivel: '01' };
  assert.equal(api(DEP, 'POST', '/api/depositos/ingreso', { ...base, kg_conformes: 730, bultos_danados: 1, merma_kg: 10 }).estado, 400);
  assert.equal(api(DEP, 'POST', '/api/depositos/ingreso', { ...base, kg_conformes: 800 }).estado, 409);
  assert.equal(api(DEP, 'POST', '/api/depositos/ingreso', { ...base, kg_conformes: 730, bultos_danados: 1, merma_kg: 10, justificacion: 'Una bolsa rota en el traslado' }).estado, 200);
});

test('la consumición respeta el saldo de cada partida y no mezcla insumos', () => {
  const orden = nuevaOrden(1, 1000);
  api(PROD, 'POST', `/api/ordenes/${orden.id}/iniciar`);
  const d = api(PROD, 'GET', `/api/ordenes/${orden.id}`).cuerpo;
  const consumos = d.consumo_sugerido.map((c) => ({ ...c }));
  consumos[0].cantidad = 999999;                         // más que el saldo de la partida
  const r = api(PROD, 'POST', `/api/ordenes/${orden.id}/finalizar-elaboracion`, { consumos, cantidad_real_kg: 900, bultos: 45 });
  assert.equal(r.estado, 409);
  assert.match(r.cuerpo.error, /saldo/i);
});

test('la línea pausada no permite finalizar hasta reanudar', () => {
  const orden = nuevaOrden(1, 500);
  api(PROD, 'POST', `/api/ordenes/${orden.id}/iniciar`);
  assert.equal(api(PROD, 'POST', `/api/ordenes/${orden.id}/pausar`, { motivo: '' }).estado, 400);
  assert.equal(api(PROD, 'POST', `/api/ordenes/${orden.id}/pausar`, { motivo: 'Limpieza de línea' }).estado, 200);
  const d = api(PROD, 'GET', `/api/ordenes/${orden.id}`).cuerpo;
  assert.equal(api(PROD, 'POST', `/api/ordenes/${orden.id}/finalizar-elaboracion`, { consumos: d.consumo_sugerido, cantidad_real_kg: 490, bultos: 24 }).estado, 409);
  assert.equal(api(PROD, 'POST', `/api/ordenes/${orden.id}/reanudar`).estado, 200);
});

test('reiniciar la demo vuelve a los datos de ejemplo', () => {
  api(PROD, 'POST', '/api/demo/reset');
  assert.equal(api(DIR, 'GET', '/api/ordenes').cuerpo.length, 25);
});
