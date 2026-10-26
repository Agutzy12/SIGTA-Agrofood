'use strict';
/* Pantalla 4 · Control de calidad (CU-P03) */
let pendientes = [];
let historial = [];
let lote = null;           // lote seleccionado (con su especificación)
let dictamen = 'APROBAR_LIBERAR';
let textoBusqueda = '';

const aNum = (v) => { const n = Number(String(v).replace(',', '.')); return String(v).trim() === '' || Number.isNaN(n) ? null : n; };

/** Evalúa cada determinación contra la especificación de ejemplo. null = todavía sin cargar. */
function evaluar(esp, v) {
  const h = aNum(v.humedad), ph = aNum(v.ph), ufc = aNum(v.ufc);
  return {
    humedad: h == null ? null : h <= esp.humedad_max,
    ph: ph == null ? null : ph >= esp.ph_min && ph <= esp.ph_max,
    aroma: v.aroma ? v.aroma === esp.aroma.esperado : null,
    color: v.color ? v.color === esp.color.esperado : null,
    sabor: v.sabor ? v.sabor === esp.sabor.esperado : null,
    ufc: ufc == null ? null : ufc <= esp.ufc_max,
  };
}
const pillContraste = (ok) => (ok == null ? S.pill('Sin cargar', 'gris') : ok ? S.pill('Conforme', 'verde') : S.pill('No conforme', 'rojo'));

function valores() {
  const v = (id) => document.getElementById(id).value;
  return { humedad: v('humedad'), ph: v('ph'), aroma: v('aroma'), color: v('color'), sabor: v('sabor'), ufc: v('ufc') };
}

/* ---------- Columna izquierda ---------- */
function listaLotes() {
  const t = textoBusqueda.trim().toLowerCase();
  const visibles = pendientes.filter((l) => !t || `${l.codigo} ${l.producto_nombre}`.toLowerCase().includes(t));
  const kgTotal = pendientes.reduce((a, l) => a + l.cantidad_kg, 0);
  document.getElementById('lista-lotes').innerHTML = `
    <h2>En cuarentena</h2><p class="sub">${pendientes.length} lote${pendientes.length === 1 ? '' : 's'} · ${S.kg(kgTotal)}</p>
    <label class="buscador" style="margin:16px 0;border:1px solid var(--linea);border-radius:9px;padding:11px 12px">${S.ico('buscar', 18)}<input id="buscar-lote" placeholder="Buscar lote o producto" value="${S.esc(textoBusqueda)}" style="width:100%"></label>
    ${visibles.map((l) => {
      const hoy = l.creado_en.slice(0, 10) === S.hoyTexto();
      const estadoAnalisis = lote && lote.id === l.id ? 'Seleccionado' : l.borrador ? 'Análisis en curso' : 'Análisis pendiente';
      return `<div class="lote-item ${lote && lote.id === l.id ? 'sel' : ''}" data-lote="${l.id}"><span class="cod">${S.esc(l.codigo)}</span><b>${S.esc(l.producto_nombre)}</b>
        <small>${S.kg(l.cantidad_kg)} · ${hoy ? 'Hoy' : S.fecha(l.creado_en).slice(0, 5)}, ${S.hora(l.creado_en)}</small><small class="est">${estadoAnalisis}</small></div>`;
    }).join('') || '<div class="vacio-grande" style="padding:20px 0">No hay lotes que coincidan.</div>'}`;
  const b = document.getElementById('buscar-lote');
  b.oninput = () => { textoBusqueda = b.value; listaLotes(); const n = document.getElementById('buscar-lote'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
  document.querySelectorAll('[data-lote]').forEach((el) => { el.onclick = () => elegir(Number(el.dataset.lote)); });
}

function elegir(id) {
  lote = pendientes.find((l) => l.id === id) || null;
  const b = lote && lote.borrador;
  dictamen = b && b.dictamen ? b.dictamen : 'APROBAR_LIBERAR';
  listaLotes();
  dibujarLote();
  history.replaceState(null, '', `calidad.html?id=${id}`);
}

/* ---------- Detalle del lote ---------- */
function dibujarLote() {
  const cont = document.getElementById('detalle');
  const docs = document.getElementById('docs');
  if (!lote) {
    cont.innerHTML = `<section class="tarjeta"><div class="vacio-grande"><h3>No hay lotes en cuarentena</h3>Cuando Producción finalice una elaboración, el lote aparece acá para su análisis.</div></section>`;
    docs.innerHTML = '';
    return;
  }
  const e = lote.especificacion;
  const b = lote.borrador || {};
  const puede = S.puede('CALIDAD');
  const dis = puede ? '' : 'disabled';
  const u = S.usuario();
  const opciones = (lista, actual) => lista.map((o) => `<option ${o === actual ? 'selected' : ''}>${S.esc(o)}</option>`).join('');
  const sel = (campo) => (b[campo] || e[campo].esperado);

  cont.innerHTML = `
  <section class="tarjeta"><div class="tarjeta-cab"><div><h2>Protocolo R.BPM.01V01</h2><p class="sub">Registro de control de calidad · Pendiente de firma</p></div>${S.pill('Cuarentena', 'ambar')}</div>
    <h2 style="font-size:26px;margin:6px 0 18px">${S.esc(lote.producto_nombre)}</h2>
    <div class="rejilla col-3"><div class="dato"><small>Lote</small><b>${S.esc(lote.codigo)}</b></div><div class="dato"><small>Orden de producción</small><b>${S.esc(lote.op_numero)}</b></div>
      <div class="dato"><small>Cantidad neta / Vencimiento</small><b>${S.kg(lote.cantidad_kg)} · ${S.fecha(lote.vencimiento)}</b></div></div>
    <p class="sub" style="margin-top:16px;font-size:13px">Elaboración finalizada: ${S.fechaHora(lote.op_fin)}. Estado de OP: En control de calidad.</p></section>

  <section class="tarjeta"><div class="tarjeta-cab"><div><h2>Determinaciones del producto</h2><p class="sub">Especificación de ejemplo · ${S.esc(lote.producto_codigo)} · Criterios ilustrativos, no límites normativos.</p></div>
      <div style="display:flex;gap:10px;align-items:center"><span id="conformes"></span><button class="btn chico" id="btn-ejemplo" ${dis} title="Completa resultados dentro de especificación para agilizar la demo">Cargar resultados de ejemplo</button></div></div>
    <table class="tabla"><thead><tr><th>Determinación</th><th style="width:240px">Resultado</th><th>Especificación de ejemplo</th><th>Contraste</th></tr></thead><tbody>
      <tr><td><b>Humedad</b></td><td><div class="con-unidad"><input class="entrada" id="humedad" inputmode="decimal" value="${S.esc(b.humedad ?? '')}" ${dis}><span>%</span></div></td><td>≤ ${S.num(e.humedad_max, 1)} %</td><td id="c-humedad"></td></tr>
      <tr><td><b>pH</b></td><td><div class="con-unidad"><input class="entrada" id="ph" inputmode="decimal" value="${S.esc(b.ph ?? '')}" ${dis}><span>pH</span></div></td><td>${S.num(e.ph_min, 1)} a ${S.num(e.ph_max, 1)}</td><td id="c-ph"></td></tr>
      <tr><td><b>Aroma</b></td><td><select class="entrada" id="aroma" ${dis}>${opciones(e.aroma.opciones, sel('aroma'))}</select></td><td>${S.esc(e.aroma.texto)}</td><td id="c-aroma"></td></tr>
      <tr><td><b>Color</b></td><td><select class="entrada" id="color" ${dis}>${opciones(e.color.opciones, sel('color'))}</select></td><td>${S.esc(e.color.texto)}</td><td id="c-color"></td></tr>
      <tr><td><b>Sabor</b></td><td><select class="entrada" id="sabor" ${dis}>${opciones(e.sabor.opciones, sel('sabor'))}</select></td><td>${S.esc(e.sabor.texto)}</td><td id="c-sabor"></td></tr>
      <tr><td><b>Recuento microbiológico</b></td><td><div class="con-unidad"><input class="entrada" id="ufc" inputmode="numeric" value="${S.esc(b.ufc ?? '')}" ${dis}><span>UFC/g</span></div></td><td>≤ ${S.num(e.ufc_max)} UFC/g</td><td id="c-ufc"></td></tr>
    </tbody></table></section>

  <section class="tarjeta"><h2>Dictamen y firma</h2><p class="sub">Elegí el resultado que se aplicará al firmar el protocolo.</p>
    <div class="opciones-dictamen">
      <label class="opcion-dictamen" data-d="APROBAR_LIBERAR"><b><input type="radio" name="dict" value="APROBAR_LIBERAR" ${dis}> Aprobado y liberado</b><span>Habilita la recepción en depósito. La OP continúa En control de calidad.</span></label>
      <label class="opcion-dictamen" data-d="RECHAZAR_BLOQUEAR"><b><input type="radio" name="dict" value="RECHAZAR_BLOQUEAR" ${dis}> Rechazado y bloqueado</b><span>Bloquea el lote, pasa la OP a Rechazada (Scrap) y alerta a jefatura.</span></label></div>
    <div class="campo"><label for="obs">Observaciones del técnico</label><textarea class="entrada" id="obs" rows="3" ${dis} placeholder="Describí el resultado del análisis. Es obligatorio si rechazás el lote.">${S.esc(b.observaciones ?? '')}</textarea></div>
    <div class="rejilla col-2" style="margin-top:20px"><div class="campo"><label>Técnica responsable</label><div class="con-unidad"><input class="entrada" readonly value="${S.esc(u.nombre)} · ${S.esc(u.cargo)}"><span>${S.ico('candado', 16)}</span></div></div>
      <div class="campo"><label>Fecha y hora de firma prevista</label><div class="con-unidad"><input class="entrada" readonly value="${S.fecha(new Date().toISOString())} · ${S.hora(new Date())}"><span>${S.ico('candado', 16)}</span></div></div></div>
    <p class="sub" style="margin-top:16px;display:flex;gap:10px;align-items:center">${S.ico('escudo', 18)} Al guardar se genera el protocolo CC-${S.esc(lote.op_numero.slice(3))} con firma inmutable. La aprobación no finaliza la OP ni incrementa el stock vendible.</p></section>

  <div class="barra-acciones"><span class="nota" id="nota-dictamen"></span>
    <div class="botones"><button class="btn" id="btn-borrador" ${dis} title="${S.titleRol(['CALIDAD'])}">${S.ico('guardar')} Guardar borrador</button>
      <button class="btn primario" id="btn-firmar" ${dis} title="${S.titleRol(['CALIDAD'])}">${S.ico('firma')} Guardar y firmar protocolo</button></div></div>`;

  docs.innerHTML = `
    <section class="aviso ambar" style="margin-bottom:22px">${S.ico('candado', 22)}<div><b>Bloqueo preventivo</b>Los lotes en cuarentena no pueden consumirse, venderse ni despacharse hasta su liberación.</div></section>
    <section class="tarjeta"><h2>Documentos del lote</h2><div style="margin-top:10px">${lote.documentos.map((d) => `<div class="doc-item">${S.ico('documento')}<div><b>${S.esc(d.tipo)}</b><small>${S.esc(d.codigo)} · ${S.hora(d.fecha)}</small></div><span class="ext">${S.ico('externo', 16)}</span></div>`).join('')}</div></section>`;

  ['humedad', 'ph', 'ufc', 'aroma', 'color', 'sabor'].forEach((id) => document.getElementById(id).addEventListener('input', recalcular));
  document.querySelectorAll('[name=dict]').forEach((r) => r.addEventListener('change', () => { dictamen = r.value; recalcular(); }));
  document.getElementById('btn-ejemplo').onclick = () => {
    document.getElementById('humedad').value = '12,4'; document.getElementById('ph').value = '6,2'; document.getElementById('ufc').value = '320';
    document.getElementById('aroma').value = e.aroma.esperado; document.getElementById('color').value = e.color.esperado; document.getElementById('sabor').value = e.sabor.esperado;
    if (!document.getElementById('obs').value.trim()) document.getElementById('obs').value = 'Resultados dentro de la especificación de ejemplo. Evaluación sensorial conforme. Sin desvíos observados.';
    recalcular();
  };
  document.getElementById('btn-borrador').onclick = guardarBorrador;
  document.getElementById('btn-firmar').onclick = firmar;
  recalcular();
}

function recalcular() {
  const r = evaluar(lote.especificacion, valores());
  Object.entries(r).forEach(([k, ok]) => { document.getElementById(`c-${k}`).innerHTML = pillContraste(ok); });
  const conformes = Object.values(r).filter((x) => x === true).length;
  const fuera = Object.values(r).filter((x) => x === false).length;
  document.getElementById('conformes').innerHTML = S.pill(`${conformes}/6 conformes`, fuera ? 'rojo' : conformes === 6 ? 'verde' : 'gris');
  document.querySelectorAll('.opcion-dictamen').forEach((el) => {
    const activo = el.dataset.d === dictamen;
    el.classList.toggle('sel', activo);
    el.querySelector('input').checked = activo;
  });
  const texto = dictamen === 'APROBAR_LIBERAR' ? 'Aprobado y liberado' : 'Rechazado y bloqueado';
  document.getElementById('nota-dictamen').textContent = `Dictamen seleccionado: ${texto} · El lote permanece en cuarentena hasta la firma.`;
}

function cuerpo() {
  const v = valores();
  // El servidor espera números con punto: "12,4" se convierte en 12.4
  return { ...v, humedad: aNum(v.humedad) ?? '', ph: aNum(v.ph) ?? '', ufc: aNum(v.ufc) ?? '', dictamen, observaciones: document.getElementById('obs').value.trim() };
}

async function guardarBorrador() {
  try {
    const r = await S.put(`/api/calidad/${lote.id}/borrador`, cuerpo());
    lote.borrador = r.borrador || cuerpo();
    S.aviso('Borrador guardado. El lote sigue en cuarentena.', 'ok');
    listaLotes();
  } catch (e) { S.error(e); }
}

async function firmar() {
  const r = evaluar(lote.especificacion, valores());
  if (Object.values(r).some((x) => x == null)) return S.aviso('Completá todas las determinaciones antes de firmar.', 'error');
  if (dictamen === 'APROBAR_LIBERAR' && Object.values(r).some((x) => x === false)) return S.aviso('Hay determinaciones fuera de especificación: no se puede aprobar el lote. Corregí los datos o rechazalo.', 'error');
  if (dictamen === 'RECHAZAR_BLOQUEAR' && !document.getElementById('obs').value.trim()) return S.aviso('Para rechazar el lote escribí el motivo en las observaciones.', 'error');
  const aprobar = dictamen === 'APROBAR_LIBERAR';
  if (!(await S.confirmar('Firmar protocolo', aprobar ? 'El lote quedará aprobado y liberado. La firma no se puede modificar después.' : 'El lote quedará rechazado y bloqueado, y la orden pasará a Rechazada (Scrap). La firma no se puede modificar después.', 'Firmar'))) return;
  try {
    const res = await S.post(`/api/calidad/${lote.id}`, cuerpo());
    const protocolo = res.protocolo || (res.control && res.control.protocolo) || `CC-${lote.op_numero.slice(3)}`;
    S.modal({
      titulo: aprobar ? 'Lote aprobado y liberado' : 'Lote rechazado y bloqueado',
      html: `<div class="aviso ${aprobar ? 'verde' : 'rojo'}" style="margin:0">${S.ico(aprobar ? 'checkCirculo' : 'info')}<div><b>Protocolo ${S.esc(protocolo)} firmado</b>${aprobar ? 'Depósito ya puede recibir el lote. La OP se cierra recién al confirmar el ingreso.' : 'El lote quedó bloqueado: no puede ingresar a depósito ni despacharse. Se alertó a jefatura de planta.'}</div></div>`,
      botones: aprobar
        ? [{ texto: 'Seguir en Calidad', alHacer: () => { location.href = 'calidad.html'; } }, { texto: 'Ir a Ingreso a depósito', primario: true, alHacer: () => { location.href = `deposito.html?op=${lote.op_id}`; } }]
        : [{ texto: 'Seguir en Calidad', alHacer: () => { location.href = 'calidad.html'; } }, { texto: 'Ver trazabilidad', primario: true, alHacer: () => { location.href = `trazabilidad.html?q=${encodeURIComponent(lote.codigo)}`; } }],
    });
  } catch (e) { S.error(e); }
}

/* ---------- Historial de dictámenes ---------- */
function dibujarHistorial() {
  document.getElementById('historial').innerHTML = historial.length ? `
    <section class="tarjeta"><h2>Dictámenes firmados</h2><p class="sub">Protocolos de calidad ya emitidos. Son inalterables.</p>
    <table class="tabla" style="margin-top:14px"><thead><tr><th>Protocolo</th><th>Lote</th><th>Producto</th><th>Dictamen</th><th>Firmó</th><th></th></tr></thead><tbody>
    ${historial.slice(0, 8).map((h) => `<tr><td><b>${S.esc(h.protocolo)}</b></td><td>${S.esc(h.lote_codigo)}</td><td>${S.esc(h.producto_nombre)}</td>
      <td>${h.dictamen === 'APROBAR_LIBERAR' ? S.pill('Aprobado y liberado', 'verde') : S.pill('Rechazado y bloqueado', 'rojo')}</td>
      <td>${S.esc(h.analista)}<span class="peq">${S.fechaHora(h.fecha)}</span></td><td><button class="enlace" data-protocolo="${h.lote_id}">Ver protocolo →</button></td></tr>`).join('')}</tbody></table></section>` : '';
  document.querySelectorAll('[data-protocolo]').forEach((b) => { b.onclick = () => verProtocolo(Number(b.dataset.protocolo)); });
}

async function verProtocolo(id) {
  try {
    const p = await S.get(`/api/calidad/${id}/protocolo`);
    const c = p.protocolo, e = p.especificacion, r = p.resultados;
    const fila = (n, v, esp, ok) => `<tr><td><b>${n}</b></td><td>${v}</td><td>${esp}</td><td>${pillContraste(ok)}</td></tr>`;
    S.modal({
      titulo: `Protocolo ${c.protocolo}`, ancho: 720,
      html: `<p class="sub" style="color:var(--texto-suave)">${S.esc(c.formulario)} · ${S.esc(p.lote.producto_nombre)} · Lote ${S.esc(p.lote.codigo)}</p>
      <table class="tabla" style="margin:14px 0"><thead><tr><th>Determinación</th><th>Resultado</th><th>Especificación</th><th>Contraste</th></tr></thead><tbody>
        ${fila('Humedad', `${S.num(c.humedad, 1)} %`, `≤ ${S.num(e.humedad_max, 1)} %`, r.humedad)}${fila('pH', S.num(c.ph, 1), `${S.num(e.ph_min, 1)} a ${S.num(e.ph_max, 1)}`, r.ph)}
        ${fila('Aroma', S.esc(c.aroma), S.esc(e.aroma.texto), r.aroma)}${fila('Color', S.esc(c.color), S.esc(e.color.texto), r.color)}${fila('Sabor', S.esc(c.sabor), S.esc(e.sabor.texto), r.sabor)}
        ${fila('Recuento microbiológico', `${S.num(c.ufc)} UFC/g`, `≤ ${S.num(e.ufc_max)} UFC/g`, r.ufc)}</tbody></table>
      <p><b>Dictamen:</b> ${c.dictamen === 'APROBAR_LIBERAR' ? 'Aprobado y liberado' : 'Rechazado y bloqueado'}</p><p style="margin-top:6px"><b>Observaciones:</b> ${S.esc(c.observaciones || '—')}</p>
      <p style="margin-top:6px;color:var(--texto-suave)">Firmado por ${S.esc(c.analista)} · ${S.fechaHora(c.fecha)}</p>`,
    });
  } catch (e) { S.error(e); }
}

(async () => {
  try {
    await S.montar({ activo: 'calidad', miga: 'Calidad y trazabilidad / Lotes en cuarentena' });
    [pendientes, historial] = await Promise.all([S.get('/api/calidad/pendientes'), S.get('/api/calidad/historial')]);
    document.getElementById('pantalla').innerHTML = `
    <div class="cabecera"><div><h1>Control de calidad</h1><p>Registrá las determinaciones y emití el dictamen del lote seleccionado.</p></div>
      <div class="acciones"><button class="btn" id="btn-proc">${S.ico('libro')} Ver procedimientos</button></div></div>
    ${S.proceso(3)}
    <div style="display:grid;grid-template-columns:300px minmax(0,1fr);gap:24px;align-items:start">
      <div><section class="tarjeta" id="lista-lotes"></section><div id="docs"></div></div>
      <div id="detalle"></div></div>
    <div id="historial" style="margin-top:6px"></div>`;
    document.getElementById('btn-proc').onclick = () => S.modal({ titulo: 'Procedimiento de control de calidad', html: '<ol><li>Seleccioná un lote en cuarentena.</li><li>Cargá humedad, pH, aroma, color, sabor y recuento microbiológico.</li><li>Verificá que cada resultado esté conforme con la especificación de ejemplo.</li><li>Elegí el dictamen y firmá el protocolo (R.BPM.01V01).</li></ol><p style="margin-top:10px">Los valores de especificación son <b>ilustrativos</b> de la demo, no límites normativos.</p>' });
    const id = Number(S.param('id'));
    lote = pendientes.find((l) => l.id === id) || pendientes[0] || null;
    if (lote && lote.borrador && lote.borrador.dictamen) dictamen = lote.borrador.dictamen;
    listaLotes();
    dibujarLote();
    dibujarHistorial();
  } catch (e) { S.error(e); }
})();
