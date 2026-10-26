'use strict';
/* Pantalla 1 · Panel general de producción */
const POR_PAGINA = 8;
const estado = { ordenes: [], pestana: 'todas', pagina: 1, texto: '', filtroEstado: '', filtroLinea: '', desde: '', hasta: '' };

const PESTANAS = [
  ['todas', 'Todas', () => true],
  ['curso', 'En curso', (o) => o.estado === 'PLANIFICADA' || o.estado === 'EN_PRODUCCION'],
  ['cc', 'En calidad', (o) => o.estado === 'EN_CONTROL_CALIDAD'],
];

/** Qué dice el enlace de cada fila y a dónde lleva. */
function accionDeOrden(o) {
  switch (o.estado) {
    case 'CREADA': return { texto: 'Completar', url: `orden-nueva.html?id=${o.id}` };
    case 'PLANIFICADA': return { texto: 'Ver orden', url: `ejecucion.html?id=${o.id}` };
    case 'EN_PRODUCCION': return { texto: 'Ver avance', url: `ejecucion.html?id=${o.id}` };
    case 'EN_CONTROL_CALIDAD': return { texto: 'Ver lote', url: `trazabilidad.html?q=${encodeURIComponent(o.lote_codigo || o.numero)}` };
    case 'FINALIZADA': return { texto: 'Ver cierre', url: `trazabilidad.html?q=${encodeURIComponent(o.lote_codigo || o.numero)}` };
    case 'RECHAZADA_SCRAP': return { texto: 'Ver motivo', url: `trazabilidad.html?q=${encodeURIComponent(o.lote_codigo || o.numero)}` };
    default: return { texto: 'Ver detalle', modal: true };
  }
}

function filtradas() {
  const pestana = PESTANAS.find((p) => p[0] === estado.pestana)[2];
  const t = estado.texto.trim().toLowerCase();
  return estado.ordenes.filter((o) => pestana(o)
    && (!t || `${o.numero} ${o.producto_nombre} ${o.producto_codigo}`.toLowerCase().includes(t))
    && (!estado.filtroEstado || o.estado === estado.filtroEstado)
    && (!estado.filtroLinea || String(o.linea_id) === estado.filtroLinea)
    && (!estado.desde || o.fecha_proyectada >= estado.desde)
    && (!estado.hasta || o.fecha_proyectada <= estado.hasta));
}

function filaOrden(o) {
  const a = accionDeOrden(o);
  const pausa = o.estado === 'EN_PRODUCCION' && o.pausada ? ` · Pausada: ${S.esc(o.motivo_pausa || '')}` : '';
  const enlace = a.url
    ? `<a class="enlace" href="${a.url}">${a.texto} →</a>`
    : `<button class="enlace" data-detalle="${o.id}">${a.texto} →</button>`;
  return `<tr>
    <td><b>${S.esc(o.numero)}</b></td>
    <td><b>${S.esc(o.producto_nombre)}</b><span class="peq">${S.fechaCorta(o.fecha_proyectada)} · ${S.esc(o.hora_prevista)} · ${S.esc(o.linea_nombre || '')}${pausa}</span></td>
    <td class="num">${S.kg(o.cantidad_kg)}</td>
    <td>${S.pillOP(o.estado)}</td>
    <td>${enlace}</td></tr>`;
}

function dibujarTabla() {
  const lista = filtradas();
  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  estado.pagina = Math.min(estado.pagina, paginas);
  const visibles = lista.slice((estado.pagina - 1) * POR_PAGINA, estado.pagina * POR_PAGINA);

  document.getElementById('pestanas').innerHTML = PESTANAS.map(([id, texto, f]) =>
    `<button class="${id === estado.pestana ? 'activa' : ''}" data-pestana="${id}">${texto} · ${estado.ordenes.filter(f).length}</button>`).join('')
    + `<label class="buscador">${S.ico('buscar', 18)}<input id="buscar" placeholder="Buscar OP o producto" value="${S.esc(estado.texto)}"></label>`;
  document.getElementById('filas').innerHTML = visibles.length
    ? visibles.map(filaOrden).join('')
    : '<tr><td colspan="5"><div class="vacio-grande"><h3>No hay órdenes para mostrar</h3>Probá con otro filtro o creá una nueva orden.</div></td></tr>';

  const desde = lista.length ? (estado.pagina - 1) * POR_PAGINA + 1 : 0;
  document.getElementById('pie-tabla').innerHTML = `
    <span>Mostrando ${desde ? `${desde}–${desde + visibles.length - 1}` : 0} de ${lista.length} órdenes</span>
    <div class="paginas"><button data-pag="${estado.pagina - 1}" ${estado.pagina === 1 ? 'disabled' : ''}>${S.ico('chevIzq', 16)}</button>
    ${Array.from({ length: paginas }, (_, i) => `<button class="${i + 1 === estado.pagina ? 'activa' : ''}" data-pag="${i + 1}">${i + 1}</button>`).join('')}
    <button data-pag="${estado.pagina + 1}" ${estado.pagina === paginas ? 'disabled' : ''}>${S.ico('chevDer', 16)}</button></div>`;

  document.querySelectorAll('[data-pestana]').forEach((b) => { b.onclick = () => { estado.pestana = b.dataset.pestana; estado.pagina = 1; dibujarTabla(); }; });
  document.querySelectorAll('[data-pag]').forEach((b) => { b.onclick = () => { estado.pagina = Number(b.dataset.pag); dibujarTabla(); }; });
  document.querySelectorAll('[data-detalle]').forEach((b) => { b.onclick = () => detalleOrden(Number(b.dataset.detalle)); });
  const buscador = document.getElementById('buscar');
  buscador.oninput = () => {
    estado.texto = buscador.value; estado.pagina = 1; dibujarTabla();
    const nuevo = document.getElementById('buscar'); nuevo.focus(); nuevo.setSelectionRange(nuevo.value.length, nuevo.value.length);
  };
}

/** Las órdenes canceladas no tienen lote: se muestran en una ventana. */
async function detalleOrden(id) {
  try {
    const o = await S.get(`/api/ordenes/${id}`);
    S.modal({
      titulo: o.numero,
      html: `<p>${S.pillOP(o.estado)}</p><div class="rejilla col-2" style="margin-top:14px">
        <div class="dato"><small>Producto</small><b>${S.esc(o.producto_nombre)}</b></div>
        <div class="dato"><small>Objetivo</small><b>${S.kg(o.cantidad_kg)}</b></div>
        <div class="dato"><small>Programada</small><b>${S.fecha(o.fecha_proyectada)} · ${S.esc(o.hora_prevista)}</b></div>
        <div class="dato"><small>Creada por</small><b>${S.esc(o.creado_por)}</b></div></div>
        <p style="margin-top:14px;color:var(--texto-suave)">${S.esc(o.observaciones || 'Sin observaciones.')}</p>`,
    });
  } catch (e) { S.error(e); }
}

function abrirFiltros() {
  S.modal({
    titulo: 'Filtrar órdenes',
    html: `<div class="rejilla col-2">
      <div class="campo"><label>Estado</label><select class="entrada" id="f-estado"><option value="">Todos</option>
        ${['CREADA', 'PLANIFICADA', 'EN_PRODUCCION', 'EN_CONTROL_CALIDAD', 'FINALIZADA', 'RECHAZADA_SCRAP', 'CANCELADA'].map((e) => `<option value="${e}" ${estado.filtroEstado === e ? 'selected' : ''}>${S.estadosOP[e][0]}</option>`).join('')}</select></div>
      <div class="campo"><label>Línea</label><select class="entrada" id="f-linea"><option value="">Todas</option>
        ${(window.LINEAS || []).map((l) => `<option value="${l.id}" ${estado.filtroLinea === String(l.id) ? 'selected' : ''}>${S.esc(l.nombre)}</option>`).join('')}</select></div>
      <div class="campo"><label>Desde</label><input type="date" class="entrada" id="f-desde" value="${estado.desde}"></div>
      <div class="campo"><label>Hasta</label><input type="date" class="entrada" id="f-hasta" value="${estado.hasta}"></div></div>`,
    botones: [
      { texto: 'Limpiar', alHacer: () => { Object.assign(estado, { filtroEstado: '', filtroLinea: '', desde: '', hasta: '', pagina: 1 }); dibujarTabla(); } },
      { texto: 'Aplicar', primario: true, alHacer: () => {
        estado.filtroEstado = document.getElementById('f-estado').value;
        estado.filtroLinea = document.getElementById('f-linea').value;
        estado.desde = document.getElementById('f-desde').value;
        estado.hasta = document.getElementById('f-hasta').value;
        estado.pagina = 1; dibujarTabla();
      } },
    ],
  });
}

function dibujarPanel(p) {
  const k = p.kpis;
  const stock = p.atencion.stockBajo;
  const cuarentena = p.atencion.cuarentena[0];
  const hayAtencion = stock.length > 0 || Boolean(cuarentena);
  const pantalla = document.getElementById('pantalla');

  pantalla.innerHTML = `
  <div class="cabecera">
    <div><h1>Panel de producción</h1><p>Lo que pasa hoy en planta. ${S.esc(p.turno)}.</p></div>
    <div class="acciones"><a class="btn primario" href="orden-nueva.html" style="padding:14px 22px">${S.ico('mas')} Nueva orden</a></div>
  </div>
  <div class="kpis kpis-3">
    <div class="kpi"><div class="t">Órdenes activas</div><div class="v">${k.activas}</div><div class="d">${k.enProduccion} en producción · ${k.planificadas} planificadas</div></div>
    <div class="kpi destacado"><div class="t">Producción de hoy</div><div class="v">${S.num(k.produccionHoyKg)} kg</div><div class="d">${k.objetivoPct} % del objetivo de ${S.num(k.objetivoKg)} kg</div></div>
    <div class="kpi"><div class="t">Lotes en cuarentena</div><div class="v">${k.lotesCuarentena}</div><div class="d">Esperan el dictamen de Calidad</div></div>
  </div>

  ${hayAtencion ? `<section class="tarjeta atencion">
    <h2>Para resolver</h2>
    ${stock.length ? `<div class="atencion-caja"><b>Stock bajo · ${p.atencion.stockBajoTotal} insumo${p.atencion.stockBajoTotal === 1 ? '' : 's'}</b>
      ${stock.map((i) => `<div>${S.esc(i.nombre)}: ${S.num(i.disponible)} ${S.esc(i.unidad)} (mínimo ${S.num(i.minimo)})</div>`).join('')}
      <button class="enlace" id="avisar" style="margin-top:6px">Avisar a Compras →</button></div>` : ''}
    ${cuarentena ? `<div class="atencion-caja neutra"><b>${p.atencion.cuarentenaTotal} lote${p.atencion.cuarentenaTotal === 1 ? '' : 's'} esperando dictamen</b>
      <div>${S.esc(cuarentena.codigo)} · ${S.kg(cuarentena.cantidad_kg)}${p.atencion.cuarentenaTotal > 1 ? ` y ${p.atencion.cuarentenaTotal - 1} más` : ''}</div>
      <a class="enlace" href="calidad.html">Ir a Control de calidad →</a></div>` : ''}
  </section>` : ''}

  <section class="tarjeta">
    <div class="tarjeta-cab"><div><h2>Órdenes de producción</h2></div>
      <button class="btn" id="btn-filtrar">${S.ico('filtro')} Filtrar</button></div>
    <div class="pestanas" id="pestanas"></div>
    <table class="tabla"><thead><tr><th>Orden</th><th>Producto</th><th>Objetivo</th><th>Estado</th><th></th></tr></thead><tbody id="filas"></tbody></table>
    <div class="paginado" id="pie-tabla"></div>
  </section>`;

  document.getElementById('btn-filtrar').onclick = abrirFiltros;
  const avisar = document.getElementById('avisar');
  if (avisar) {
    avisar.onclick = async () => {
      if (!S.puede('PRODUCCION')) return S.aviso(S.titleRol(['PRODUCCION']), 'error');
      try { for (const i of stock) await S.post('/api/panel/avisar-compras', { insumo_id: i.insumo_id }); S.aviso('Compras y Suministros fue notificado', 'ok'); } catch (e) { S.error(e); }
    };
  }
}

(async () => {
  try {
    await S.montar({ activo: 'panel', miga: 'Inicio / Producción' });
    const [panel, ordenes, lineas] = await Promise.all([S.get('/api/panel'), S.get('/api/ordenes'), S.get('/api/lineas')]);
    window.LINEAS = lineas;
    estado.ordenes = ordenes.sort((a, b) => (b.fecha_proyectada + b.hora_prevista + String(b.secuencia).padStart(6, '0')).localeCompare(a.fecha_proyectada + a.hora_prevista + String(a.secuencia).padStart(6, '0')));
    dibujarPanel(panel);
    dibujarTabla();
  } catch (e) { S.error(e); }
})();
