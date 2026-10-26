'use strict';
/* Pantalla 5 · Ingreso a depósito y cierre de OP (CU-P04) */
let pendientes = [];
let rec = null;            // datos de la recepción elegida
const POR_PALLET = 25;
const aNum = (v) => { const n = Number(String(v).replace(',', '.')); return Number.isNaN(n) ? 0 : n; };

/** Reparte las bolsas en pallets de 25 (igual que el servidor) para mostrar la tabla en pantalla. */
function palletsPrevistos(bultos, kg) {
  const primero = rec.pallets_previstos[0].codigo;                 // PAL-2026-00001
  const [pre, anio, num] = [primero.slice(0, 4), primero.slice(4, 8), Number(primero.slice(9))];
  const cantidad = Math.ceil(bultos / POR_PALLET);
  const lista = [];
  let asignados = 0;
  for (let i = 0; i < cantidad; i++) {
    const enEste = i < cantidad - 1 ? POR_PALLET : bultos - POR_PALLET * (cantidad - 1);
    const ultimo = i === cantidad - 1;
    const kgEste = ultimo ? Math.round((kg - asignados) * 100) / 100 : Math.round(((kg * enEste) / bultos) * 100) / 100;
    asignados += kgEste;
    lista.push({ codigo: `${pre}${anio}-${String(num + i).padStart(5, '0')}`, bultos: enEste, kg: kgEste });
  }
  return lista;
}

/* ---------- Sin lote pendiente ---------- */
async function sinPendientes() {
  document.getElementById('pantalla').innerHTML = `
    <div class="cabecera"><div><h1>Ingreso a depósito y cierre de OP</h1><p>Verificá la recepción física del lote liberado antes de incorporarlo al stock vendible.</p></div></div>
    <section class="tarjeta"><div class="vacio-grande"><h3>No hay lotes liberados esperando recepción</h3>Cuando Calidad apruebe un lote, aparece acá para su ingreso.<br><br><a class="btn" href="calidad.html">Ir a Control de calidad</a></div></section>
    <div id="stock"></div>`;
  await dibujarStock();
}

/* ---------- Pantalla de recepción ---------- */
function dibujar() {
  const { op, lote, producto, certificado: cert } = rec;
  const u = S.usuario();
  const puede = S.puede('DEPOSITO') && rec.habilitado;
  const dis = puede ? '' : 'disabled';
  const U = S.config.ubicaciones;
  document.getElementById('pantalla').innerHTML = `
  <div class="cabecera"><div><h1>Ingreso a depósito y cierre de OP</h1><p>Verificá la recepción física del lote liberado antes de incorporarlo al stock vendible.</p></div>
    <div class="acciones">${S.pill(rec.habilitado ? 'Recepción pendiente' : 'Recepción no habilitada', rec.habilitado ? 'ambar' : 'rojo')}</div></div>
  ${S.proceso(4)}
  ${rec.habilitado ? '' : `<div class="aviso rojo">${S.ico('candado', 22)}<div><b>No se puede recibir este lote</b>${S.esc(rec.motivo)}</div></div>`}

  <section class="tarjeta"><div class="tarjeta-cab"><div><h2>Lote habilitado para recepción</h2><p class="sub">${S.esc(producto.nombre)} · ${S.esc(producto.codigo)} · ${lote.bultos} bolsas de ${producto.presentacion_kg} kg</p></div>
      <button class="btn" id="btn-cambiar">${S.ico('chevAbajo', 16)} Cambiar lote</button></div>
    <div class="metas" style="margin-top:0"><div class="dato"><small>Lote</small><b>${S.esc(lote.codigo)}</b></div><div class="dato"><small>Orden de producción</small><b>${S.esc(op.numero)}</b></div>
      <div class="dato"><small>Cantidad elaborada</small><b>${S.kg(lote.cantidad_kg)} netos</b></div><div class="dato"><small>Vencimiento</small><b>${S.fecha(lote.vencimiento)}</b></div></div>
    <div style="display:flex;gap:14px;align-items:center;margin-top:18px;flex-wrap:wrap;font-size:14px;color:var(--texto-suave)">Estado del lote ${S.pillLote(lote.estado)} Estado de OP ${S.pillOP(op.estado)} <span>La OP se cierra al confirmar el ingreso.</span></div></section>

  <div class="dos-col">
    <div>
      <section class="tarjeta"><h2>Verificación física</h2><p class="sub">Contrastá los bultos recibidos contra el parte de elaboración.</p>
        <div class="rejilla col-3" style="margin-top:18px">
          <div class="campo"><label>Bultos recibidos *</label><div class="con-unidad"><input class="entrada" id="bultos" inputmode="numeric" value="${lote.bultos}" ${dis}><span>bolsas</span></div></div>
          <div class="campo"><label>Pallets recibidos *</label><div class="con-unidad"><input class="entrada" id="pallets" readonly><span>pallets</span></div></div>
          <div class="campo"><label>Kilogramos conformes *</label><div class="con-unidad"><input class="entrada" id="kg" inputmode="decimal" value="${lote.cantidad_kg}" ${dis}><span>kg</span></div></div></div>
        <table class="tabla" style="margin:22px 0"><thead><tr><th>Unidad logística</th><th>Bultos</th><th>Peso neto</th></tr></thead><tbody id="tabla-pallets"></tbody></table>
        <div class="rejilla col-2"><div class="campo"><label>Bultos dañados *</label><div class="con-unidad"><input class="entrada" id="danados" inputmode="numeric" value="0" ${dis}><span>bolsas</span></div></div>
          <div class="campo"><label>Merma secundaria *</label><div class="con-unidad"><input class="entrada" id="merma" inputmode="decimal" value="0" ${dis}><span>kg</span></div></div></div>
        <div class="campo" style="margin-top:18px"><label>Justificación de daño o merma</label><input class="entrada" id="just" ${dis}><span class="ayuda" id="ayuda-just">Obligatoria cuando hay cantidad dañada o merma secundaria mayor que cero.</span></div></section>

      <section class="tarjeta"><h2>Ubicación y registro</h2><p class="sub" id="sub-ubic"></p>
        <div class="rejilla col-2" style="margin-top:18px">
          <div class="campo"><label>Depósito *</label><select class="entrada" id="deposito" ${dis}>${U.depositos.map((d) => `<option>${S.esc(d)}</option>`).join('')}</select></div>
          <div class="campo"><label>Sector *</label><select class="entrada" id="sector" ${dis}>${U.sectores.map((d) => `<option>${S.esc(d)}</option>`).join('')}</select></div></div>
        <div class="rejilla col-3" style="margin-top:18px">
          <div class="campo"><label>Rack *</label><select class="entrada" id="rack" ${dis}>${U.racks.map((d) => `<option>${S.esc(d)}</option>`).join('')}</select></div>
          <div class="campo"><label>Nivel *</label><select class="entrada" id="nivel" ${dis}>${U.niveles.map((d) => `<option>${S.esc(d)}</option>`).join('')}</select></div>
          <div class="campo"><label>Cámara</label><select class="entrada" id="camara" disabled>${U.camaras.map((d) => `<option>${S.esc(d)}</option>`).join('')}</select></div></div>
        <div class="rejilla col-2" style="margin-top:20px"><div class="dato"><small>Responsable</small><b>${S.esc(u.nombre)} · ${S.esc(u.cargo)}</b></div>
          <div class="dato"><small>Fecha y hora de recepción</small><b>${S.fecha(new Date().toISOString())} · ${S.hora(new Date())}</b></div></div></section>
    </div>

    <div>
      <section class="tarjeta"><h2>Certificado previo</h2><p class="sub">Control obligatorio</p>
        ${cert ? `<div class="check" style="margin:14px 0">${S.ico('escudo')}<b style="color:var(--verde)">Liberación verificada</b></div>
        <div class="dato" style="margin-bottom:12px"><small>Protocolo de calidad</small><b>${S.esc(cert.protocolo)}</b></div>
        <div class="dato" style="margin-bottom:12px"><small>Formulario</small><b>${S.esc(cert.formulario)}</b></div>
        <div class="dato" style="margin-bottom:16px"><small>Firmado por</small><b>${S.esc(cert.analista)} · ${S.fechaHora(cert.fecha)}</b></div>
        <button class="btn" id="btn-protocolo">${S.ico('documento')} Ver protocolo firmado</button>` : '<p class="sub">Sin protocolo firmado.</p>'}</section>
      <section class="tarjeta"><h2>Balance de ingreso</h2>
        <div style="display:flex;justify-content:space-between;margin:14px 0"><span>Elaboración neta</span><b>${S.kg(lote.cantidad_kg)}</b></div>
        <div style="display:flex;justify-content:space-between;margin:14px 0"><span>Merma secundaria</span><b id="b-merma"></b></div>
        <div class="atencion-caja" style="margin:16px 0"><small style="color:var(--ambar-oscuro)">Incremento de stock vendible</small><div style="font-size:34px;font-weight:600;color:var(--ambar-oscuro)" id="b-inc"></div><small style="color:var(--ambar-oscuro)" id="b-det"></small></div>
        <p class="sub" style="font-size:13px">Comprobante al confirmar: ${S.esc(rec.comprobante)}. Hasta entonces no se incrementa el stock.</p></section>
      <section class="aviso gris">${S.ico('candado', 22)}<div><b>Sólo lotes liberados</b>No se permite recibir lotes en cuarentena, rechazados o sin protocolo firmado.</div></section>
    </div>
  </div>

  <div class="confirmacion" id="resultado"></div>
  <div class="barra-acciones"><span class="nota" id="nota-control"></span>
    <div class="botones"><a class="btn" href="deposito.html">Volver a pendientes</a>
      <button class="btn primario" id="btn-confirmar" ${dis} title="${S.titleRol(['DEPOSITO'])}">${S.ico('check')} Confirmar ingreso y cerrar OP</button></div></div>
  <div id="stock" style="margin-top:22px"></div>`;

  ['bultos', 'kg', 'danados', 'merma', 'just', 'sector', 'rack', 'nivel', 'deposito'].forEach((id) => document.getElementById(id).addEventListener('input', recalcular));
  document.getElementById('sector').addEventListener('change', recalcular);
  document.getElementById('btn-cambiar').onclick = cambiarLote;
  document.getElementById('btn-confirmar').onclick = confirmar;
  const bp = document.getElementById('btn-protocolo');
  if (bp) bp.onclick = verProtocolo;
  recalcular();
  dibujarStock();
}

function recalcular() {
  const lote = rec.lote;
  const bultos = Math.round(aNum(document.getElementById('bultos').value));
  const kg = aNum(document.getElementById('kg').value);
  const danados = Math.round(aNum(document.getElementById('danados').value));
  const merma = aNum(document.getElementById('merma').value);
  const lista = bultos > 0 ? palletsPrevistos(bultos, kg) : [];
  document.getElementById('pallets').value = lista.length;
  document.getElementById('tabla-pallets').innerHTML = lista.map((p) => `<tr><td>${S.esc(p.codigo)}</td><td>${p.bultos} × ${rec.producto.presentacion_kg} kg</td><td>${S.kg(p.kg)}</td></tr>`).join('')
    || '<tr><td colspan="3" style="color:var(--texto-suave)">Ingresá los bultos recibidos.</td></tr>';
  document.getElementById('sub-ubic').textContent = `Ubicación de almacenamiento asignada ${lista.length > 1 ? 'a todos los pallets' : 'al pallet'}.`;

  const diferencia = Math.round((lote.cantidad_kg - kg - merma) * 100) / 100;
  const hayDesvio = danados > 0 || merma > 0 || diferencia > 0;
  const just = document.getElementById('just');
  just.placeholder = hayDesvio ? 'Explicá el daño, la merma o la diferencia de kilos' : 'No aplica: recepción completa, sin daños ni merma secundaria.';
  document.getElementById('ayuda-just').style.color = hayDesvio && !just.value.trim() ? 'var(--rojo)' : '';

  // Cámara sólo en sectores con frío
  const sector = document.getElementById('sector').value;
  const lleva = S.config.ubicaciones.sectoresConCamara.includes(sector);
  document.getElementById('camara').disabled = !(lleva && S.puede('DEPOSITO') && rec.habilitado);

  document.getElementById('b-merma').textContent = S.kg(merma);
  document.getElementById('b-inc').textContent = `+${S.num(kg, Number.isInteger(kg) ? 0 : 1)} kg`;
  document.getElementById('b-det').textContent = `${bultos} bolsas · ${lista.length} pallets · ${hayDesvio ? `Diferencia ${S.kg(Math.max(0, diferencia))}` : 'Sin diferencias'}`;
  const d = document.getElementById('deposito').value, rack = document.getElementById('rack').value, nivel = document.getElementById('nivel').value;
  document.getElementById('resultado').innerHTML = `${S.ico('caja', 22)}<div><b>Resultado de la confirmación</b>Se incorporarán ${S.num(kg)} kg al stock vendible en PT / ${S.esc(sector.split(' ·')[0])} / ${S.esc(rack)} / ${S.esc(nivel)}. La OP pasará a Finalizada y se emitirá el comprobante de recepción. El lote conservará su estado Aprobado y liberado.</div>`;
  document.getElementById('nota-control').textContent = hayDesvio ? 'Hay diferencias o daños: se exige justificación para confirmar.' : 'Control completo · Certificado válido y cantidades físicas conciliadas.';
}

async function confirmar() {
  const g = (id) => document.getElementById(id).value;
  const sector = g('sector');
  const cuerpo = {
    op_id: rec.op.id, bultos_recibidos: Math.round(aNum(g('bultos'))), kg_conformes: aNum(g('kg')), bultos_danados: Math.round(aNum(g('danados'))),
    merma_kg: aNum(g('merma')), justificacion: g('just').trim(), deposito: g('deposito'), sector, rack: g('rack'), nivel: g('nivel'),
    camara: S.config.ubicaciones.sectoresConCamara.includes(sector) ? g('camara') : null,
  };
  const boton = document.getElementById('btn-confirmar');
  boton.disabled = true;
  try {
    const r = await S.post('/api/depositos/ingreso', cuerpo);
    S.modal({
      titulo: 'Ingreso confirmado',
      html: `<div class="aviso verde" style="margin:0">${S.ico('checkCirculo')}<div><b>Comprobante ${S.esc(r.comprobante)}</b>La OP ${S.esc(rec.op.numero)} quedó Finalizada y ${S.kg(cuerpo.kg_conformes)} ingresaron al stock vendible en ${r.pallets.length} pallet${r.pallets.length === 1 ? '' : 's'}.</div></div>`,
      botones: [{ texto: 'Volver al panel', alHacer: () => { location.href = 'index.html'; } }, { texto: 'Ver trazabilidad', primario: true, alHacer: () => { location.href = `trazabilidad.html?q=${encodeURIComponent(rec.lote.codigo)}`; } }],
    });
  } catch (e) { S.error(e); boton.disabled = false; }
}

function cambiarLote() {
  S.modal({
    titulo: 'Elegir lote para recibir',
    html: pendientes.length ? `<table class="tabla clic"><tbody>${pendientes.map((p) => `<tr data-op="${p.op_id}"><td><b>${S.esc(p.lote_codigo)}</b><span class="peq">${S.esc(p.producto_nombre)}</span></td><td>${S.kg(p.cantidad_kg)}</td><td>${S.esc(p.op_numero)}</td></tr>`).join('')}</tbody></table>` : '<p>No hay otros lotes liberados.</p>',
  });
  document.querySelectorAll('.modal [data-op]').forEach((tr) => { tr.onclick = () => { location.href = `deposito.html?op=${tr.dataset.op}`; }; });
}

async function verProtocolo() {
  try {
    const p = await S.get(`/api/calidad/${rec.lote.id}/protocolo`);
    const c = p.protocolo;
    S.modal({ titulo: `Protocolo ${c.protocolo}`, html: `<p>${S.esc(c.formulario)} · Lote ${S.esc(p.lote.codigo)}</p>
      <p style="margin-top:8px"><b>Dictamen:</b> ${c.dictamen === 'APROBAR_LIBERAR' ? 'Aprobado y liberado' : 'Rechazado y bloqueado'}</p>
      <p>Humedad ${S.num(c.humedad, 1)} % · pH ${S.num(c.ph, 1)} · ${S.num(c.ufc)} UFC/g · ${S.esc(c.aroma)} · ${S.esc(c.color)} · ${S.esc(c.sabor)}</p>
      <p style="margin-top:8px;color:var(--texto-suave)">Firmado por ${S.esc(c.analista)} · ${S.fechaHora(c.fecha)}</p>` });
  } catch (e) { S.error(e); }
}

/* ---------- Stock vendible y despacho de ejemplo ---------- */
async function dibujarStock() {
  const cont = document.getElementById('stock');
  if (!cont) return;
  try {
    const todo = await S.get('/api/stock-pt');
    const stock = todo.slice(-6).reverse();   // los 6 ingresos más recientes
    cont.innerHTML = `<section class="tarjeta"><div class="tarjeta-cab"><div><h2>Stock de producto terminado</h2><p class="sub">Últimos ingresos · Sólo los lotes aprobados y liberados pueden despacharse.</p></div></div>
      ${stock.length ? `<table class="tabla"><thead><tr><th>Lote</th><th>Producto</th><th>Ubicación</th><th>Stock</th><th>Vence</th><th></th></tr></thead><tbody>
      ${stock.map((s) => `<tr><td><b>${S.esc(s.lote_codigo)}</b></td><td>${S.esc(s.producto_nombre)}</td><td>${S.esc(s.sector.split(' ·')[0])} / ${S.esc(s.rack)} / ${S.esc(s.nivel)}</td><td class="num">${S.kg(s.cantidad_kg)}</td><td>${S.fecha(s.vencimiento)}</td>
      <td><button class="enlace" data-despacho="${s.lote_id}" data-cod="${S.esc(s.lote_codigo)}" data-max="${s.cantidad_kg}">Registrar despacho →</button></td></tr>`).join('')}</tbody></table>` : '<div class="vacio-grande">Todavía no hay stock vendible.</div>'}</section>`;
    cont.querySelectorAll('[data-despacho]').forEach((b) => { b.onclick = () => despachar(Number(b.dataset.despacho), b.dataset.cod, Number(b.dataset.max)); });
  } catch (e) { S.error(e); }
}
function despachar(loteId, codigo, max) {
  S.modal({
    titulo: `Despacho de ejemplo · ${codigo}`,
    html: `<div class="rejilla col-2"><div class="campo"><label>Cliente</label><input class="entrada" id="d-cliente" value="Distribuidora Mayorista del Litoral S.R.L."></div>
      <div class="campo"><label>Cantidad (máx. ${S.num(max)} kg)</label><div class="con-unidad"><input class="entrada" id="d-kg" value="${Math.min(100, max)}"><span>kg</span></div></div></div>`,
    botones: [{ texto: 'Cancelar' }, { texto: 'Despachar', primario: true, alHacer: async () => {
      try { await S.post('/api/despachos', { lote_id: loteId, cliente: document.getElementById('d-cliente').value.trim(), cantidad_kg: aNum(document.getElementById('d-kg').value) }); S.aviso('Despacho registrado', 'ok'); dibujarStock(); } catch (e) { S.error(e); return false; }
    } }],
  });
}

(async () => {
  try {
    await S.montar({ activo: 'deposito', miga: 'Depósito / Recepciones de producción' });
    pendientes = await S.get('/api/depositos/pendientes');
    const op = S.param('op');
    const id = op ? Number(op) : pendientes[0] && pendientes[0].op_id;
    if (!id) return await sinPendientes();
    rec = await S.get(`/api/depositos/recepcion/${id}`);
    document.querySelector('.miga').textContent = `Depósito / Recepciones de producción / ${rec.op.numero}`;
    dibujar();
  } catch (e) { S.error(e); }
})();
