'use strict';
/* Pantalla 3 · Ejecución y consumo (CU-P02) */
let orden = null;
let filas = [];            // [{ insumo_id, partida_id, cantidad, teorico }]

const itemDe = (insumoId) => orden.items.find((i) => i.insumo_id === insumoId);
const partidaDe = (fila) => (itemDe(fila.insumo_id).partidas || []).find((p) => p.id === fila.partida_id);
const aNum = (v) => { const n = Number(String(v).replace(',', '.')); return Number.isNaN(n) ? 0 : n; };

/* ---------- Sin orden elegida: lista para escoger ---------- */
async function listaParaElegir() {
  const todas = await S.get('/api/ordenes');
  const utiles = todas.filter((o) => ['PLANIFICADA', 'EN_PRODUCCION'].includes(o.estado));
  document.getElementById('pantalla').innerHTML = `
    <div class="cabecera"><div><h1>Ejecución y consumo</h1><p>Elegí la orden con la que vas a trabajar.</p></div></div>
    <section class="tarjeta">${utiles.length ? `<table class="tabla clic"><thead><tr><th>Orden</th><th>Producto y línea</th><th>Programación</th><th>Estado</th><th></th></tr></thead><tbody>
      ${utiles.map((o) => `<tr onclick="location.href='ejecucion.html?id=${o.id}'"><td><b>${S.esc(o.numero)}</b></td><td><b>${S.esc(o.producto_nombre)}</b><span class="peq">${S.esc(o.linea_nombre || '')}</span></td>
      <td class="num">${S.fechaCorta(o.fecha_proyectada)} · ${S.esc(o.hora_prevista)}</td><td>${S.pillOP(o.estado)}</td><td><span class="enlace">Abrir →</span></td></tr>`).join('')}</tbody></table>`
    : '<div class="vacio-grande"><h3>No hay órdenes para elaborar</h3>Planificá una orden nueva para empezar.<br><br><a class="btn primario" href="orden-nueva.html">Nueva orden de producción</a></div>'}</section>`;
}

/* ---------- Encabezado de la orden ---------- */
function transcurrido() {
  const min = Math.max(0, Math.round((Date.now() - new Date(orden.inicio_real).getTime()) / 60000));
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
}
function cabeceraOrden() {
  const o = orden;
  const pill = o.estado === 'EN_PRODUCCION'
    ? (o.pausada ? S.pill('Pausada · ' + (o.motivo_pausa || ''), 'rojo') : S.pill(`En curso · ${transcurrido()}`, 'ambar'))
    : S.pillOP(o.estado);
  const enProd = o.estado === 'EN_PRODUCCION';
  return `
  <div class="cabecera"><div><h1>Ejecución y consumo</h1><p>${S.esc(o.producto_nombre)} · ${S.esc(o.linea_nombre || '')} · ${S.esc(o.hora_prevista < '14:00' ? 'Turno mañana' : 'Turno tarde')}</p></div>
    <div class="acciones"><button class="btn" id="btn-receta">${S.ico('libro')} Ver receta</button></div></div>
  ${S.proceso(2)}
  <section class="tarjeta"><div class="tarjeta-cab"><div><h2>${S.esc(o.numero)}</h2><p class="sub">Receta ${S.esc(o.receta_codigo)} v${o.receta_version} · Objetivo ${S.kg(o.cantidad_kg)}</p></div>${enProd ? pill : ''}</div>
    <div class="rejilla col-3">
      <div class="dato"><small>${enProd ? 'Inicio real' : 'Inicio previsto'}</small><b>${enProd ? S.fechaHora(o.inicio_real) : `${S.fecha(o.fecha_proyectada)} · ${S.esc(o.hora_prevista)}`}</b></div>
      <div class="dato"><small>Lote</small><b>${S.esc(o.lote_codigo_previsto || 'Se asigna al iniciar')}</b></div>
      <div class="dato"><small>Vencimiento previsto</small><b>${o.vencimiento_previsto ? S.fecha(o.vencimiento_previsto) : `${o.vida_util_meses} meses de vida útil`}</b></div></div></section>`;
}

/* ---------- Orden PLANIFICADA: todavía no se empezó ---------- */
function vistaPlanificada() {
  const o = orden;
  const puede = S.puede('PRODUCCION');
  document.getElementById('pantalla').innerHTML = cabeceraOrden() + `
  <section class="tarjeta"><h2>Insumos previstos</h2><p class="sub">Según la receta. Los lotes se eligen al iniciar.</p>
    <table class="tabla" style="margin-top:16px"><thead><tr><th>Insumo</th><th>Teórico</th></tr></thead><tbody>
    ${o.items.map((i) => `<tr><td><b>${S.esc(i.nombre)}</b><span class="peq">${S.esc(i.codigo)} · ${i.tipo === 'MP' ? 'Materia prima' : 'Empaque crítico'}</span></td><td class="num">${S.num(i.cantidad_teorica)} ${S.esc(i.unidad)}</td></tr>`).join('')}</tbody></table></section>
  <div class="barra-acciones"><span class="nota">Al iniciar se asigna el número de lote.</span>
    <div class="botones"><button class="btn peligro" id="btn-cancelar" ${puede ? '' : 'disabled'} title="${S.titleRol(['PRODUCCION'])}">Cancelar orden</button>
    <button class="btn primario" id="btn-iniciar" ${puede ? '' : 'disabled'} title="${S.titleRol(['PRODUCCION'])}">${S.ico('play')} Iniciar elaboración</button></div></div>`;
  enlazarReceta();
  document.getElementById('btn-iniciar').onclick = async () => {
    try { orden = await S.post(`/api/ordenes/${o.id}/iniciar`); S.aviso(`Elaboración iniciada · lote ${orden.lote_codigo_previsto}`, 'ok'); prepararFilas(); vistaEjecucion(); } catch (e) { S.error(e); }
  };
  document.getElementById('btn-cancelar').onclick = () => {
    S.modal({
      titulo: 'Cancelar la orden', html: `<div class="campo"><label>Motivo de la cancelación</label><input class="entrada" id="motivo-cancel" placeholder="Ej.: cambio en el pedido del cliente"></div>`,
      botones: [{ texto: 'Volver' }, { texto: 'Cancelar orden', peligro: true, alHacer: async () => {
        try { await S.post(`/api/ordenes/${o.id}/cancelar`, { motivo: document.getElementById('motivo-cancel').value.trim() }); S.aviso('Orden cancelada', 'ok'); setTimeout(() => { location.href = 'index.html'; }, 600); } catch (e) { S.error(e); return false; }
      } }],
    });
  };
}

/* ---------- Orden ya elaborada (o cerrada): sólo resumen ---------- */
function vistaCerrada() {
  const o = orden;
  const destino = o.estado === 'CANCELADA' ? '' : `<a class="btn primario" href="trazabilidad.html?q=${encodeURIComponent(o.lote_codigo || o.numero)}">${S.ico('trazabilidad')} Ver trazabilidad del lote</a>`;
  document.getElementById('pantalla').innerHTML = cabeceraOrden() + `
  <section class="tarjeta"><div class="vacio-grande"><h3>${o.estado === 'CANCELADA' ? 'La orden fue cancelada' : 'La elaboración ya fue registrada'}</h3>
    ${o.cantidad_real_kg ? `Se elaboraron ${S.kg(o.cantidad_real_kg)} netos (${o.bultos} bolsas). Merma de proceso: ${S.num(o.merma_pct, 2)} %.<br><br>` : ''}${destino}</div></section>`;
  enlazarReceta();
}

function enlazarReceta() {
  const b = document.getElementById('btn-receta');
  if (!b) return;
  b.onclick = async () => {
    try {
      const r = await S.get(`/api/recetas/${orden.receta_id}`);
      S.modal({ titulo: `${r.codigo} · Versión ${r.version}`, ancho: 560,
        html: `<p class="sub" style="color:var(--texto-suave)">${S.esc(r.producto_nombre)} · cantidades cada ${S.num(r.base_kg)} kg · vigente desde ${S.fecha(r.vigente_desde)}</p>
        <table class="tabla" style="margin-top:12px"><thead><tr><th>Insumo</th><th>Cantidad base</th></tr></thead><tbody>${r.items.map((i) => `<tr><td><b>${S.esc(i.nombre)}</b><span class="peq">${S.esc(i.codigo)}</span></td><td class="num">${S.num(i.cantidad_base)} ${S.esc(i.unidad)}</td></tr>`).join('')}</tbody></table>` });
    } catch (e) { S.error(e); }
  };
}

/* ---------- Orden EN_PRODUCCION: carga del consumo real ---------- */
function prepararFilas() {
  const sugeridas = orden.consumo_sugerido || [];
  const avance = orden.avance_json ? JSON.parse(orden.avance_json) : null;
  const base = avance && avance.consumos.length ? avance.consumos : sugeridas;
  filas = base.map((f) => {
    const sug = sugeridas.find((s) => s.insumo_id === f.insumo_id && s.partida_id === f.partida_id);
    return { insumo_id: f.insumo_id, partida_id: f.partida_id, cantidad: f.cantidad, teorico: sug ? sug.cantidad : 0 };
  });
  orden._avance = avance;
}

function mpConsumidos() { return filas.filter((f) => itemDe(f.insumo_id).tipo === 'MP').reduce((a, f) => a + aNum(f.cantidad), 0); }

/** Devuelve [texto, color] de la validación de una fila. */
function validar(f, indice) {
  if (!f.partida_id) return ['Sin lote', 'rojo'];
  const p = partidaDe(f);
  if (!p) return ['Lote inválido', 'rojo'];
  const total = filas.filter((x) => x.partida_id === f.partida_id).reduce((a, x) => a + aNum(x.cantidad), 0);
  if (p.vencimiento && p.vencimiento < S.hoyTexto()) return ['Lote vencido', 'rojo'];
  if (total > p.cantidad + 1e-9) return ['Saldo insuficiente', 'rojo'];
  if (!(aNum(f.cantidad) > 0)) return ['Falta cantidad', 'ambar'];
  return ['Lote válido', 'verde'];
}

function filaHTML(f, i) {
  const item = itemDe(f.insumo_id);
  const mismos = filas.map((x, j) => (x.insumo_id === f.insumo_id ? j : -1)).filter((j) => j >= 0);
  const nro = mismos.indexOf(i) + 1;
  const p = partidaDe(f);
  const dis = S.puede('PRODUCCION') && !orden.pausada ? '' : 'disabled';
  return `<tr data-i="${i}">
    <td><b>${S.esc(item.nombre)}</b><span class="peq">${S.esc(item.codigo)}${mismos.length > 1 ? ` · Partida ${nro} de ${mismos.length}` : item.tipo === 'ME' ? ' · Empaque crítico' : ''}</span></td>
    <td style="min-width:230px"><select class="entrada sel-partida" ${dis}>${f.partida_id ? '' : '<option value="">Elegí un lote</option>'}
      ${(item.partidas || []).map((x) => `<option value="${x.id}" ${x.id === f.partida_id ? 'selected' : ''}>${S.esc(x.nro_lote)} · saldo ${S.num(x.cantidad)}</option>`).join('')}</select><span class="peq venc"></span></td>
    <td class="num">${f.teorico ? `${S.num(f.teorico)} ${S.esc(item.unidad)}` : '—'}</td>
    <td><div class="con-unidad" style="width:130px"><input class="entrada inp-real" inputmode="decimal" value="${S.esc(String(f.cantidad ?? ''))}" ${dis}><span>${S.esc(item.unidad)}</span></div></td>
    <td class="validacion"></td></tr>`;
}

function refrescarCalculos() {
  document.querySelectorAll('#cuerpo-consumo tr').forEach((tr) => {
    const f = filas[Number(tr.dataset.i)];
    const [t, c] = validar(f);
    tr.querySelector('.validacion').innerHTML = S.pill(t, c);
    const p = partidaDe(f);
    tr.querySelector('.venc').textContent = p && p.vencimiento ? `Vence ${S.fecha(p.vencimiento)}` : '';
  });
  const invalidas = filas.filter((f) => validar(f)[1] === 'rojo').length;
  const criticosSinLote = orden.items.filter((i) => i.critico && !filas.some((f) => f.insumo_id === i.insumo_id && f.partida_id && aNum(f.cantidad) > 0)).length;
  const asignadas = filas.filter((f) => f.partida_id && aNum(f.cantidad) > 0).length;
  const ok = invalidas === 0 && criticosSinLote === 0;
  const mp = mpConsumidos();
  document.getElementById('resumen-consumo').innerHTML = `
    <span style="color:${ok ? 'var(--verde)' : 'var(--rojo)'};font-weight:600;display:flex;gap:8px;align-items:center">${S.ico(ok ? 'checkCirculo' : 'info')}${ok ? 'Todos los lotes son válidos' : `${invalidas + criticosSinLote} para revisar`}</span>
    <span style="color:var(--texto-suave);font-size:14px">Total materias primas: ${S.num(mp, 0)} kg</span>`;

  // Resultado y merma
  const neto = aNum(document.getElementById('neto').value);
  const merma = mp > 0 ? ((mp - neto) / mp) * 100 : 0;
  document.getElementById('merma').innerHTML = `${S.num(Math.max(0, merma), 2)} % <small style="font-size:14px;font-weight:600;margin-left:6px">${S.num(Math.max(0, mp - neto), 1)} kg</small>`;
  document.getElementById('formula-merma').textContent = 'Merma = (kg consumidos − kg netos) / kg consumidos.';

  // Aviso previo
  document.getElementById('aviso-final').innerHTML = `${S.ico('escudo', 22)}<div><b>Al finalizar, el lote queda en cuarentena</b>Se descuenta el stock de los insumos y el lote no se puede vender ni despachar hasta que Calidad lo libere.</div>`;
  document.getElementById('btn-finalizar').disabled = !S.puede('PRODUCCION') || orden.pausada;
}
function empaque() {
  const suma = (re) => filas.filter((f) => itemDe(f.insumo_id).tipo === 'ME' && re.test(itemDe(f.insumo_id).nombre)).reduce((a, f) => a + aNum(f.cantidad), 0);
  return { bolsas: S.num(suma(/bolsa/i)), etiquetas: S.num(suma(/etiqueta/i)) };
}

function vistaEjecucion() {
  const o = orden;
  const puede = S.puede('PRODUCCION');
  const presentacion = o.presentacion_kg;
  const avance = o._avance;
  const mp0 = mpConsumidos();
  const netoInicial = avance && avance.cantidad_real_kg != null ? avance.cantidad_real_kg : Math.round((mp0 * 0.98) / presentacion) * presentacion;
  const bultosInicial = avance && avance.bultos != null ? avance.bultos : Math.round(netoInicial / presentacion);
  const dis = puede && !o.pausada ? '' : 'disabled';

  document.getElementById('pantalla').innerHTML = cabeceraOrden() + `
  ${o.pausada ? `<div class="aviso rojo">${S.ico('pausa')}<div><b>Línea pausada · ${S.esc(o.motivo_pausa || '')}</b>Reanudá la línea para seguir.</div></div>` : ''}
  <section class="tarjeta"><div class="tarjeta-cab"><div><h2>Consumo real por lote de origen</h2><p class="sub">Elegí el lote de cada insumo. El stock se descuenta al finalizar.</p></div>
    <button class="btn" id="btn-dividir" ${dis}>${S.ico('dividir')} Dividir consumo</button></div>
    <table class="tabla"><thead><tr><th>Insumo</th><th>Lote de origen</th><th>Teórico</th><th>Real</th><th></th></tr></thead><tbody id="cuerpo-consumo">${filas.map(filaHTML).join('')}</tbody></table>
    <div style="display:flex;justify-content:space-between;margin-top:16px;gap:16px;flex-wrap:wrap" id="resumen-consumo"></div></section>

  <div class="dos-col" style="grid-template-columns:minmax(0,1fr) 360px">
    <section class="tarjeta"><h2>Resultado</h2>
      <div class="rejilla col-3" style="margin-top:18px">
        <div class="campo"><label>Kg netos elaborados *</label><div class="con-unidad"><input class="entrada" id="neto" inputmode="decimal" value="${netoInicial}" ${dis}><span>kg</span></div></div>
        <div class="campo"><label>Bolsas</label><div class="con-unidad"><input class="entrada" id="bolsas" inputmode="numeric" value="${bultosInicial}" ${dis}><span>× ${presentacion} kg</span></div></div>
        <div class="campo"><label>Merma</label><div class="entrada" id="merma" style="background:var(--ambar-suave);border-color:var(--ambar-suave);color:var(--ambar-oscuro);font-size:24px;font-weight:600;padding:8px 14px"></div></div></div>
      <p class="ayuda" style="margin-top:14px;color:var(--texto-suave);font-size:13px" id="formula-merma"></p></section>
    <section class="tarjeta"><h2>Pausa de línea</h2>
      <div class="campo" style="margin-top:14px"><label>Motivo para pausar *</label><select class="entrada" id="motivo" ${o.pausada || !puede ? 'disabled' : ''}>${S.config.motivos_pausa.map((m) => `<option>${S.esc(m)}</option>`).join('')}</select></div>
      <div style="height:12px"></div>
      ${o.pausada ? `<button class="btn primario" id="btn-reanudar" ${puede ? '' : 'disabled'}>${S.ico('play')} Reanudar línea</button>` : `<button class="btn" id="btn-pausar" ${puede ? '' : 'disabled'}>${S.ico('pausa')} Pausar línea</button>`}</section>
  </div>

  <div class="confirmacion" id="aviso-final"></div>
  <div class="barra-acciones"><span class="nota">Podés guardar el avance y seguir después.</span>
    <div class="botones"><button class="btn" id="btn-avance" ${puede ? '' : 'disabled'} title="${S.titleRol(['PRODUCCION'])}">${S.ico('guardar')} Guardar avance</button>
      <button class="btn primario" id="btn-finalizar" title="${S.titleRol(['PRODUCCION'])}">${S.ico('flecha')} Finalizar y enviar a Calidad</button></div></div>`;

  enlazarReceta();
  // Cambios en la tabla
  const cuerpo = document.getElementById('cuerpo-consumo');
  cuerpo.addEventListener('input', (e) => {
    if (!e.target.classList.contains('inp-real')) return;
    filas[Number(e.target.closest('tr').dataset.i)].cantidad = e.target.value;
    refrescarCalculos();
  });
  cuerpo.addEventListener('change', (e) => {
    if (!e.target.classList.contains('sel-partida')) return;
    filas[Number(e.target.closest('tr').dataset.i)].partida_id = Number(e.target.value);
    refrescarCalculos();
  });
  document.getElementById('neto').addEventListener('input', () => {
    const neto = aNum(document.getElementById('neto').value);
    document.getElementById('bolsas').value = Math.round(neto / presentacion);
    refrescarCalculos();
  });
  document.getElementById('bolsas').addEventListener('input', refrescarCalculos);
  document.getElementById('btn-dividir').onclick = dividir;
  document.getElementById('btn-avance').onclick = guardarAvance;
  document.getElementById('btn-finalizar').onclick = finalizar;
  const pausar = document.getElementById('btn-pausar');
  if (pausar) pausar.onclick = async () => { try { orden = await S.post(`/api/ordenes/${o.id}/pausar`, { motivo: document.getElementById('motivo').value }); orden._avance = o._avance; S.aviso('Línea pausada', 'ok'); vistaEjecucion(); } catch (e) { S.error(e); } };
  const reanudar = document.getElementById('btn-reanudar');
  if (reanudar) reanudar.onclick = async () => { try { orden = await S.post(`/api/ordenes/${o.id}/reanudar`); orden._avance = o._avance; S.aviso('Línea reanudada', 'ok'); vistaEjecucion(); } catch (e) { S.error(e); } };
  refrescarCalculos();
}

/** "Dividir consumo": agrega otra fila del mismo insumo para usar una segunda partida. */
function dividir() {
  const opciones = orden.items.filter((i) => (i.partidas || []).length > 1);
  if (!opciones.length) return S.aviso('Ningún insumo tiene más de una partida disponible.');
  S.modal({
    titulo: 'Dividir consumo', html: `<div class="campo"><label>¿Qué insumo querés repartir entre dos partidas?</label><select class="entrada" id="div-insumo">${opciones.map((i) => `<option value="${i.insumo_id}">${S.esc(i.nombre)}</option>`).join('')}</select></div>`,
    botones: [{ texto: 'Cancelar' }, { texto: 'Agregar partida', primario: true, alHacer: () => {
      const insumoId = Number(document.getElementById('div-insumo').value);
      const usadas = filas.filter((f) => f.insumo_id === insumoId).map((f) => f.partida_id);
      const libre = itemDe(insumoId).partidas.find((p) => !usadas.includes(p.id));
      if (!libre) { S.aviso('Ya usaste todas las partidas de ese insumo.', 'error'); return false; }
      const ultima = filas.map((f, i) => (f.insumo_id === insumoId ? i : -1)).filter((i) => i >= 0).pop();
      filas.splice(ultima + 1, 0, { insumo_id: insumoId, partida_id: libre.id, cantidad: 0, teorico: 0 });
      cargarTabla();
    } }],
  });
}
function cargarTabla() { document.getElementById('cuerpo-consumo').innerHTML = filas.map(filaHTML).join(''); refrescarCalculos(); }

function cuerpoEnvio() {
  return {
    consumos: filas.filter((f) => f.partida_id && aNum(f.cantidad) > 0).map((f) => ({ insumo_id: f.insumo_id, partida_id: f.partida_id, cantidad: aNum(f.cantidad) })),
    cantidad_real_kg: aNum(document.getElementById('neto').value),
    bultos: Math.round(aNum(document.getElementById('bolsas').value)),
  };
}
async function guardarAvance() {
  try { const c = cuerpoEnvio(); const r = await S.put(`/api/ordenes/${orden.id}/avance`, { ...c, consumos: filas.map((f) => ({ insumo_id: f.insumo_id, partida_id: f.partida_id, cantidad: aNum(f.cantidad) })) }); orden._avance = r.avance_json ? JSON.parse(r.avance_json) : null; S.aviso('Avance guardado. No se descontó stock.', 'ok'); } catch (e) { S.error(e); }
}
async function finalizar() {
  const c = cuerpoEnvio();
  if (!(c.cantidad_real_kg > 0)) return S.aviso('Ingresá la cantidad neta elaborada.', 'error');
  if (!(await S.confirmar('Finalizar elaboración', `Se descontarán los insumos del stock y el lote de ${S.num(c.cantidad_real_kg)} kg quedará en cuarentena hasta que Calidad lo libere.`, 'Finalizar y enviar a CC'))) return;
  const boton = document.getElementById('btn-finalizar');
  boton.disabled = true;
  try {
    const r = await S.post(`/api/ordenes/${orden.id}/finalizar-elaboracion`, c);
    S.modal({
      titulo: 'Elaboración finalizada', html: `<div class="aviso verde" style="margin:0">${S.ico('checkCirculo')}<div><b>El lote quedó en cuarentena</b>Calidad ya puede analizarlo y firmar el protocolo.</div></div>`,
      botones: [{ texto: 'Volver al panel', alHacer: () => { location.href = 'index.html'; } }, { texto: 'Ver trazabilidad', primario: true, alHacer: () => { location.href = `trazabilidad.html?q=${encodeURIComponent(r.orden.lote_codigo_previsto || orden.numero)}`; } }],
    });
  } catch (e) { S.error(e); boton.disabled = false; }
}

(async () => {
  try {
    await S.montar({ activo: 'ejecucion', miga: 'Producción / Ejecución y consumo' });
    const id = S.param('id');
    if (!id) return await listaParaElegir();
    orden = await S.get(`/api/ordenes/${id}`);
    document.querySelector('.miga').textContent = `Producción / ${orden.numero} / Elaboración`;
    if (orden.estado === 'CREADA') return location.replace(`orden-nueva.html?id=${id}`);
    if (orden.estado === 'PLANIFICADA') return vistaPlanificada();
    if (orden.estado !== 'EN_PRODUCCION') return vistaCerrada();
    prepararFilas();
    vistaEjecucion();
  } catch (e) { S.error(e); }
})();
