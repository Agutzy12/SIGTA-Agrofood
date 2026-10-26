'use strict';
/* Pantalla 6 · Trazabilidad de lote */
let ficha = null;

const nombreDictamen = (d) => (d === 'APROBAR_LIBERAR' ? 'Aprobado y liberado' : 'Rechazado y bloqueado');

async function buscar(texto) {
  const q = String(texto || '').trim();
  document.getElementById('q').value = q;
  const cont = document.getElementById('resultado');
  if (!q) { cont.innerHTML = vacio('Ingresá un código para empezar', 'Podés buscar por lote, orden de producción, pallet o lote de origen de un insumo.'); return; }
  try {
    const r = await S.get(`/api/trazabilidad?q=${encodeURIComponent(q)}`);
    history.replaceState(null, '', `trazabilidad.html?q=${encodeURIComponent(q)}`);
    if (r.tipo === 'LOTE') { ficha = r; cont.innerHTML = fichaLote(r); enlazar(); }
    else if (r.tipo === 'LISTA') cont.innerHTML = listaLotes(r.lotes);
    else cont.innerHTML = fichaPartida(r.partidas);
    enlazar();
  } catch (e) {
    cont.innerHTML = vacio('No encontramos resultados', e.message);
  }
}
const vacio = (t, d) => `<section class="tarjeta"><div class="vacio-grande"><h3>${S.esc(t)}</h3>${S.esc(d)}</div></section>`;

function listaLotes(lotes) {
  return `<section class="tarjeta"><h2>Varios lotes coinciden</h2><p class="sub">Elegí uno para ver su recorrido.</p><table class="tabla clic" style="margin-top:14px"><tbody>
    ${lotes.map((l) => `<tr data-buscar="${S.esc(l.codigo)}"><td><b>${S.esc(l.codigo)}</b><span class="peq">${S.esc(l.producto_nombre)}</span></td><td>${S.kg(l.cantidad_kg)}</td><td>${S.pillLote(l.estado)}</td></tr>`).join('')}</tbody></table></section>`;
}

/** Búsqueda por lote de origen: de un insumo del proveedor hacia los lotes que lo usaron. */
function fichaPartida(partidas) {
  return partidas.map((p) => `<section class="tarjeta"><div class="tarjeta-cab"><div><div class="codigo" style="font-size:12px;text-transform:uppercase">Lote de origen · Insumo</div><h2>${S.esc(p.insumo_nombre)} · ${S.esc(p.nro_lote)}</h2>
    <p class="sub">${S.esc(p.proveedor || 'Proveedor no informado')} · Remito ${S.esc(p.documento_origen || '—')} · Saldo actual ${S.num(p.cantidad)}</p></div></div>
    <h3 style="margin:8px 0 10px;font-size:17px">Hacia adelante · Lotes elaborados con esta partida</h3>
    ${p.lotes.length ? `<table class="tabla clic"><thead><tr><th>Lote</th><th>Producto</th><th>Estado</th><th>Destino</th></tr></thead><tbody>
      ${p.lotes.map((l) => `<tr data-buscar="${S.esc(l.codigo)}"><td><b>${S.esc(l.codigo)}</b></td><td>${S.esc(l.producto_nombre)}</td><td>${S.pillLote(l.estado)}</td>
      <td>${l.despachos.length ? l.despachos.map((d) => `${S.esc(d.cliente)} · ${S.kg(d.cantidad_kg)}`).join('<br>') : 'Sin despachos'}</td></tr>`).join('')}</tbody></table>` : '<p class="sub">Esta partida todavía no se usó en ningún lote.</p>'}</section>`).join('');
}

function fichaLote(f) {
  const { lote, op, calidad: cal, ingreso } = f;
  const destino = f.despachos.length;
  const bolsas = lote.bultos;

  return `
  <section class="tarjeta"><div class="tarjeta-cab"><div><div class="codigo" style="font-size:12px;text-transform:uppercase">${S.esc(lote.producto_codigo)} · Producto terminado</div>
      <h2 style="font-size:28px;margin:4px 0">${S.esc(lote.producto_nombre)}</h2><p class="sub">${S.esc(lote.codigo)} · ${S.esc(op.numero)}</p></div>
      ${S.pill(S.estadosLote[lote.estado][0], S.estadosLote[lote.estado][1])}</div>
    <div class="rejilla col-3">
      <div class="dato"><small>Elaborado · Vence</small><b>${S.fecha(op.inicio_real || lote.creado_en)} · ${S.fecha(lote.vencimiento)}</b></div>
      <div class="dato"><small>Cantidad</small><b>${S.kg(lote.cantidad_kg)} · ${bolsas} bolsas de ${lote.presentacion_kg} kg</b></div>
      <div class="dato"><small>Stock vendible</small><b>${S.kg(f.stock_vendible_kg)}</b></div></div></section>

  <h2 style="font-size:20px;margin:6px 0 12px">Recorrido del lote</h2>
  <div class="recorrido">
    <div class="etapa">${etapa('trigo', 'Origen')}<h3>${f.resumen_origen.insumos} insumos</h3><p>${f.resumen_origen.partidas} lotes de proveedores.</p></div>
    <div class="etapa sel">${etapa('ejecucion', 'Producción')}<h3>${S.esc(op.numero)}</h3><p>${S.kg(f.kg_consumidos)} → ${S.kg(lote.cantidad_kg)}. Merma ${S.num(op.merma_pct, 1)} %.</p></div>
    <div class="etapa">${etapa('calidad', 'Calidad')}${cal ? `<h3>${S.esc(cal.protocolo)}</h3><p>${S.fecha(cal.fecha)} · ${S.esc(cal.analista)}</p>${S.pill(nombreDictamen(cal.dictamen), cal.dictamen === 'APROBAR_LIBERAR' ? 'verde' : 'rojo')}`
      : `<h3>Pendiente</h3><p>En cuarentena, esperando análisis.</p>${S.pill('Cuarentena', 'ambar')}`}</div>
    <div class="etapa">${etapa('deposito', 'Depósito')}${ingreso ? `<h3>${S.esc(ingreso.rack)} / ${S.esc(ingreso.nivel)}</h3><p>${S.kg(ingreso.kg_recibidos)} recibidos.</p>${S.pill('Stock vendible', 'verde')}`
      : `<h3>Sin ingreso</h3><p>${lote.estado === 'APROBADO_LIBERADO' ? 'Liberado, espera recepción.' : lote.estado === 'RECHAZADO_BLOQUEADO' ? 'Bloqueado: no puede ingresar.' : 'Todavía no puede ingresar.'}</p>`}</div>
    <div class="etapa">${etapa('camion', 'Destino')}<h3>${destino ? `${destino} despacho${destino === 1 ? '' : 's'}` : 'Sin despachos'}</h3><p>${destino ? `${S.kg(f.despachado_kg)} despachados.` : 'Todavía no salió.'}</p></div>
  </div>

  <section class="tarjeta"><h2>Hacia atrás · Insumos y proveedores</h2>
    ${f.origen.length ? `<table class="tabla" style="margin-top:14px"><thead><tr><th>Insumo</th><th>Proveedor</th><th>Lote de origen</th><th>Consumo</th></tr></thead><tbody>
    ${f.origen.map((g) => `<tr><td><b>${S.esc(g.insumo_nombre)}</b></td><td>${S.esc(g.proveedores.join(', ') || '—')}</td>
      <td class="apilado">${g.lotes.map((l) => `<div><button class="enlace" data-buscar="${S.esc(l.nro_lote)}">${S.esc(l.nro_lote)} · ${S.num(l.cantidad)} ${S.esc(g.unidad)}</button><span class="peq">${S.esc(l.documento_origen || '')}</span></div>`).join('')}</td>
      <td class="num">${S.num(g.total)} ${S.esc(g.unidad)}</td></tr>`).join('')}</tbody></table>` : '<p class="sub">Esta orden no tiene consumos registrados.</p>'}</section>

  <section class="tarjeta"><div class="tarjeta-cab"><div><h2>Hacia adelante · Destino</h2><p class="sub">${destino ? f.despachos.map((d) => `${S.esc(d.cliente)} · ${S.kg(d.cantidad_kg)} · ${S.fecha(d.fecha)}`).join('<br>') : 'Este lote todavía no tiene despachos.'}</p></div>
      <button class="btn" id="btn-despacho">Registrar despacho de ejemplo</button></div>
    <details class="plegable"><summary>Ver historial del lote</summary>
      <table class="tabla"><thead><tr><th>Fecha y hora</th><th>Evento</th><th>Usuario</th><th>Resultado</th></tr></thead><tbody>
      ${f.historial.map((h) => `<tr><td class="num">${S.fecha(h.fecha)} · ${S.hora(h.fecha)}</td><td>${S.esc(h.evento)}</td><td>${S.esc(h.usuario)}</td><td>${S.esc(h.resultado || '')}</td></tr>`).join('')}</tbody></table></details></section>`;
}
const etapa = (icono, titulo) => `<div class="tt">${S.ico(icono, 18)} ${titulo}</div>`;

function enlazar() {
  document.querySelectorAll('[data-buscar]').forEach((el) => { el.onclick = () => buscar(el.dataset.buscar); });
  const d = document.getElementById('btn-despacho');
  if (d) d.onclick = despacho;
}

/** El despacho de ejemplo sirve para ver el bloqueo lógico: un lote no liberado NO puede salir. */
function despacho() {
  if (!S.puede('DEPOSITO')) return S.aviso(S.titleRol(['DEPOSITO']), 'error');
  const max = ficha.stock_vendible_kg;
  S.modal({
    titulo: `Despacho de ejemplo · ${ficha.lote.codigo}`,
    html: `<p style="margin-bottom:14px;color:var(--texto-suave)">Si el lote no está aprobado y liberado, el sistema bloquea el despacho.</p>
      <div class="rejilla col-2"><div class="campo"><label>Cliente</label><input class="entrada" id="d-cliente" value="Distribuidora Mayorista del Litoral S.R.L."></div>
      <div class="campo"><label>Cantidad</label><div class="con-unidad"><input class="entrada" id="d-kg" value="${Math.max(1, Math.min(100, Math.floor(max || 100)))}"><span>kg</span></div></div></div>`,
    botones: [{ texto: 'Cancelar' }, { texto: 'Despachar', primario: true, alHacer: async () => {
      try {
        await S.post('/api/despachos', { lote_id: ficha.lote.id, cliente: document.getElementById('d-cliente').value.trim(), cantidad_kg: Number(String(document.getElementById('d-kg').value).replace(',', '.')) });
        S.aviso('Despacho registrado', 'ok'); buscar(ficha.lote.codigo);
      } catch (e) {
        S.error(e);
        if (e.estado === 423) buscar(ficha.lote.codigo);   // se muestra en el historial el intento bloqueado
      }
    } }],
  });
}

async function escanear() {
  const [stock, pend] = await Promise.all([S.get('/api/stock-pt'), S.get('/api/calidad/pendientes')]);
  const codigos = [...new Set([...pend.map((l) => l.codigo), ...stock.slice(-4).map((s) => s.lote_codigo)])];
  S.modal({
    titulo: 'Escanear código', html: `<p style="margin-bottom:12px;color:var(--texto-suave)">Simulación del lector de códigos de barras. Elegí uno de los lotes recientes:</p>
      <table class="tabla clic"><tbody>${codigos.map((c) => `<tr data-escaneo="${S.esc(c)}"><td><span style="margin-right:10px">${S.ico('barras', 18)}</span><b>${S.esc(c)}</b></td></tr>`).join('')}</tbody></table>`,
  });
  document.querySelectorAll('.modal [data-escaneo]').forEach((tr) => { tr.onclick = () => { document.querySelector('.cortina').remove(); buscar(tr.dataset.escaneo); }; });
}

(async () => {
  try {
    await S.montar({ activo: 'trazabilidad', miga: 'Calidad y trazabilidad / Consulta de lote' });
    document.getElementById('pantalla').innerHTML = `
    <div class="solo-impresion"><img src="img/logo.png" alt="Agrifood Argentina"><div style="text-align:right"><b>Ficha de trazabilidad de lote</b><br><small>Emitida el ${S.fecha(new Date().toISOString())} · ${S.hora(new Date())} · Datos de ejemplo</small></div></div>
    <div class="cabecera"><div><h1>Trazabilidad de lote</h1><p>Seguí un lote desde sus insumos hasta el cliente.</p></div>
      <div class="acciones"><button class="btn" id="btn-exportar">${S.ico('descargar')} Imprimir ficha</button></div></div>
    <form class="buscar-barra" id="form-buscar">${S.ico('trazabilidad', 26)}<div class="caja"><small>Lote, orden o lote de origen</small><input id="q" autocomplete="off" placeholder="Ej.: L-MRC01-202644-01 u OP-2026-00128"></div>
      <button class="btn primario" type="submit">${S.ico('buscar')} Buscar</button><button class="btn" type="button" id="btn-escanear">${S.ico('barras')} Escanear código</button></form>
    <div id="resultado"></div>`;
    document.getElementById('form-buscar').onsubmit = (e) => { e.preventDefault(); buscar(document.getElementById('q').value); };
    document.getElementById('btn-exportar').onclick = () => window.print();
    document.getElementById('btn-escanear').onclick = escanear;
    let q = S.param('q');
    if (!q) { const stock = await S.get('/api/stock-pt'); q = stock.length ? stock[stock.length - 1].lote_codigo : ''; }
    await buscar(q);
  } catch (e) { S.error(e); }
})();
