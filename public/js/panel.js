'use strict';
/* Pantalla 1 · Panel general de producción */
const POR_PAGINA = 8;
const estado = { ordenes: [], pestana: 'todas', pagina: 1, texto: '', filtroEstado: '', filtroLinea: '', desde: '', hasta: '' };

const PESTANAS = [
  ['todas', 'Todas las órdenes', () => true],
  ['curso', 'En curso', (o) => o.estado === 'EN_PRODUCCION'],
  ['plan', 'Planificadas', (o) => o.estado === 'PLANIFICADA'],
  ['cc', 'Pendientes de CC', (o) => o.estado === 'EN_CONTROL_CALIDAD'],
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
  const sub = o.estado === 'EN_PRODUCCION' && o.pausada ? `<span class="peq">Pausada · ${S.esc(o.motivo_pausa || '')}</span>` : '';
  const enlace = a.url
    ? `<a class="enlace" href="${a.url}">${a.texto} →</a>`
    : `<button class="enlace" data-detalle="${o.id}">${a.texto} →</button>`;
  return `<tr>
    <td><b>${S.esc(o.numero)}</b></td>
    <td><b>${S.esc(o.producto_nombre)}</b><span class="peq">${S.esc(o.producto_codigo)} · ${S.esc(o.linea_nombre || '')}</span></td>
    <td class="num">${S.fechaCorta(o.fecha_proyectada)} · ${S.esc(o.hora_prevista)}</td>
    <td class="num">${S.kg(o.cantidad_kg)}</td>
    <td>${S.pillOP(o.estado)}${sub}</td>
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
    : '<tr><td colspan="6"><div class="vacio-grande"><h3>No hay órdenes para mostrar</h3>Probá con otro filtro o creá una nueva orden.</div></td></tr>';

  const desde = lista.length ? (estado.pagina - 1) * POR_PAGINA + 1 : 0;
  document.getElementById('pie-tabla').innerHTML = `
    <span>Mostrando ${desde ? `${desde}–${desde + visibles.length - 1}` : 0} de ${lista.length} órdenes · Los estados de lote se consultan en Calidad y Trazabilidad.</span>
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
  const maximo = Math.max(...p.recientes.dias.map((d) => d.kg), 1);
  const variacion = p.recientes.variacionPct;
  const stock = p.atencion.stockBajo;
  const cuarentena = p.atencion.cuarentena[0];
  const pantalla = document.getElementById('pantalla');

  pantalla.innerHTML = `
  <div class="cabecera">
    <div><h1>Panel general de producción</h1><p>La operación de hoy en un solo lugar. ${S.esc(p.turno)}.</p></div>
    <div class="acciones"><a class="btn primario" href="orden-nueva.html" style="padding:14px 22px">${S.ico('mas')} Nueva orden de producción</a></div>
  </div>
  <div class="kpis">
    <div class="kpi"><div class="t">Órdenes activas</div><div class="v">${String(k.activas).padStart(2, '0')}</div><div class="d">${k.enProduccion} en producción · ${k.planificadas} planificadas</div></div>
    <div class="kpi destacado"><div class="t">Producción neta de hoy</div><div class="v">${S.num(k.produccionHoyKg)} kg</div><div class="d">${k.objetivoPct} % del objetivo de ${S.num(k.objetivoKg)} kg</div></div>
    <div class="kpi"><div class="t">Lotes en cuarentena</div><div class="v">${String(k.lotesCuarentena).padStart(2, '0')}</div><div class="d">${k.cuarentenaSinAnalisis} pendiente${k.cuarentenaSinAnalisis === 1 ? '' : 's'} de análisis microbiológico</div></div>
    <div class="kpi"><div class="t">Alertas de abastecimiento</div><div class="v">${String(k.alertasAbastecimiento).padStart(2, '0')}</div><div class="d">Revisar antes del próximo turno</div></div>
  </div>

  <section class="tarjeta">
    <div class="tarjeta-cab"><div><h2>Órdenes de producción</h2><p class="sub">Seguimiento operativo · Actualizado a las ${S.hora(new Date())}</p></div>
      <div style="display:flex;gap:12px"><button class="btn" id="btn-fechas">${S.ico('calendario')}<span id="rango">Todas las fechas</span></button><button class="btn" id="btn-filtrar">${S.ico('filtro')} Filtrar</button></div></div>
    <div class="pestanas" id="pestanas"></div>
    <table class="tabla"><thead><tr><th>Orden</th><th>Producto y línea</th><th>Programación</th><th>Objetivo</th><th>Estado de OP</th><th>Acción</th></tr></thead><tbody id="filas"></tbody></table>
    <div class="paginado" id="pie-tabla"></div>
  </section>

  <div class="tres">
    <section class="tarjeta"><h2>Producción reciente</h2><p class="sub">Kg netos elaborados · Últimos 5 días hábiles</p>
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:18px"><span style="font-size:30px;font-weight:600">${S.num(p.recientes.totalKg)} kg</span>
        ${variacion == null ? '' : `<span style="color:${variacion >= 0 ? 'var(--verde)' : 'var(--rojo)'};font-size:13px">${variacion >= 0 ? '↑' : '↓'} ${S.num(Math.abs(variacion), 1)} % vs. anterior</span>`}</div>
      <div class="barras">${p.recientes.dias.map((d) => `<div class="b ${d.hoy ? 'hoy' : ''}">${S.num(d.kg)}<i style="height:${Math.max(3, Math.round((d.kg / maximo) * 100))}px"></i></div>`).join('')}</div>
      <div class="barras-etiquetas">${p.recientes.dias.map((d) => `<span>${d.hoy ? 'Hoy' : d.etiqueta}</span>`).join('')}</div></section>

    <section class="tarjeta"><h2>Próximas elaboraciones</h2><p class="sub">Plan del turno</p>
      <div class="lista-prox" style="margin-top:12px">${p.proximas.length ? p.proximas.map((x) => `<div class="it"><span class="hora">${S.esc(x.hora)}</span><div><b>${S.esc(x.producto_nombre)}</b><small>${S.esc(x.numero)} · ${S.kg(x.cantidad_kg)}</small></div></div>`).join('') : '<div class="vacio-grande">No hay elaboraciones pendientes hoy.</div>'}</div>
      <a class="enlace" style="display:inline-block;margin-top:10px" href="#" id="ver-plan">Ver planificación completa →</a></section>

    <section class="tarjeta"><h2>Requiere atención</h2><p class="sub">Abastecimiento y calidad</p>
      <div style="margin-top:16px">
      ${stock.length ? `<div class="atencion-caja"><b>Stock bajo · ${p.atencion.stockBajoTotal} insumo${p.atencion.stockBajoTotal === 1 ? '' : 's'}</b>
        ${stock.map((i) => `<div>${S.esc(i.nombre)}: ${S.num(i.disponible)} ${S.esc(i.unidad)} · Mínimo: ${S.num(i.minimo)} ${S.esc(i.unidad)}</div>`).join('')}
        <button class="enlace" id="avisar" style="margin-top:6px">Avisar a Compras →</button></div>` : '<div class="atencion-caja" style="background:var(--verde-suave);color:var(--verde)"><b style="color:var(--verde)">Stock en orden</b><br>Ningún insumo por debajo del mínimo.</div>'}
      ${cuarentena ? `<div style="display:flex;gap:12px">${S.ico('calidad')}<div><b>${p.atencion.cuarentenaTotal} lote${p.atencion.cuarentenaTotal === 1 ? '' : 's'} en cuarentena</b>
        <div style="color:var(--texto-suave);font-size:13px">${S.esc(cuarentena.codigo)} · ${S.kg(cuarentena.cantidad_kg)}${p.atencion.cuarentenaTotal > 1 ? `<br>Más ${p.atencion.cuarentenaTotal - 1} lote${p.atencion.cuarentenaTotal - 1 === 1 ? '' : 's'} pendiente${p.atencion.cuarentenaTotal - 1 === 1 ? '' : 's'} de dictamen.` : ''}</div>
        <a class="enlace" href="calidad.html" style="font-size:13px">Ir a Control de calidad →</a></div></div>` : '<div style="color:var(--texto-suave)">No hay lotes en cuarentena.</div>'}
      </div></section>
  </div>`;

  document.getElementById('btn-filtrar').onclick = abrirFiltros;
  document.getElementById('btn-fechas').onclick = abrirFiltros;
  document.getElementById('ver-plan').onclick = (e) => { e.preventDefault(); estado.pestana = 'plan'; dibujarTabla(); document.getElementById('pestanas').scrollIntoView({ behavior: 'smooth' }); };
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
