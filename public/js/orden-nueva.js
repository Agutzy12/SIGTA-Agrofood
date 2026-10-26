'use strict';
/* Pantalla 2 · Nueva orden de producción (CU-P01) */
let productos = [];
let lineas = [];
let borrador = null;      // si se abre una orden CREADA para completarla
let numeroOP = '';
let ultimaVerificacion = null;

const horas = Array.from({ length: 33 }, (_, i) => `${String(6 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);

function formulario() {
  const b = borrador;
  const hoy = S.hoyTexto();
  const ahora = new Date();
  const horaSug = horas.find((h) => h > `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`) || '08:00';
  const u = S.usuario();
  const puede = S.puede('PRODUCCION');
  const dis = puede ? '' : 'disabled';
  document.getElementById('pantalla').innerHTML = `
  <div class="cabecera"><div><h1>${b ? 'Completar orden de producción' : 'Nueva orden de producción'}</h1><p>Definí la elaboración y verificá los insumos antes de planificar.</p></div>
    <div class="acciones">${S.pill('Creada', 'gris')}</div></div>
  ${S.proceso(1)}

  <section class="tarjeta">
    <div class="tarjeta-cab"><div><h2>Datos de la orden</h2><p class="sub">Los campos con * son obligatorios.</p></div>${S.pill(numeroOP, 'ambar')}</div>
    <div class="rejilla col-3">
      <div class="campo"><label for="producto">Producto terminado *</label>
        <select class="entrada" id="producto" ${dis}>${productos.map((p) => `<option value="${p.id}" ${b && b.producto_id === p.id ? 'selected' : ''}>${S.esc(p.codigo)} · ${S.esc(p.nombre)}</option>`).join('')}</select></div>
      <div class="campo"><label>Receta estándar vigente *</label>
        <div class="con-unidad"><input class="entrada" id="receta" readonly><span>${S.ico('candado', 16)}</span></div><span class="ayuda" id="vigente"></span></div>
      <div class="campo"><label for="linea">Línea de producción *</label>
        <select class="entrada" id="linea" ${dis}>${lineas.map((l) => `<option value="${l.id}">${S.esc(l.nombre)}</option>`).join('')}</select></div>
    </div>
    <div class="rejilla col-4" style="margin-top:20px">
      <div class="campo"><label for="cantidad">Cantidad a elaborar *</label><div class="con-unidad"><input class="entrada" id="cantidad" inputmode="decimal" value="${b ? b.cantidad_kg : '1000'}" ${dis}><span>kg</span></div><span class="ayuda">Base de cálculo de la formulación</span></div>
      <div class="campo"><label>Unidad *</label><select class="entrada" disabled><option>Kilogramos (kg)</option></select></div>
      <div class="campo"><label for="fecha">Fecha programada *</label><input type="date" class="entrada" id="fecha" min="${hoy}" value="${b ? b.fecha_proyectada : hoy}" ${dis}></div>
      <div class="campo"><label for="hora">Hora de inicio prevista *</label><select class="entrada" id="hora" ${dis}>${horas.map((h) => `<option ${h === (b ? b.hora_prevista : horaSug) ? 'selected' : ''}>${h}</option>`).join('')}</select></div>
    </div>
    <div class="campo" style="margin-top:20px"><label for="obs">Observaciones</label>
      <input class="entrada" id="obs" maxlength="200" placeholder="Ej.: Presentación en bolsas de 20 kg; verificar limpieza de línea antes del inicio." value="${S.esc(b ? b.observaciones || '' : '')}" ${dis}></div>
    <div class="rejilla col-2" style="margin-top:22px"><div class="dato"><small>Creada por</small><b>${S.esc(b ? b.creado_por : u.nombre)} · ${S.esc(u.cargo)}</b></div>
      <div class="dato"><small>Fecha y hora de registro</small><b>${S.fecha(new Date().toISOString())} · ${S.hora(new Date())}</b></div></div>
  </section>

  <div class="dos-col">
    <section class="tarjeta"><h2>Cálculo proporcional de insumos</h2><p class="sub" id="sub-calculo"></p>
      <div id="calculo" style="margin-top:18px"></div></section>
    <div id="lateral"></div>
  </div>

  <div class="barra-acciones"><span class="nota">La planificación no descuenta stock. Los lotes de origen se asignan en la elaboración.</span>
    <div class="botones"><a class="btn" href="index.html">Cancelar</a>
      <button class="btn" id="btn-borrador" ${dis} title="${S.titleRol(['PRODUCCION'])}">${S.ico('guardar')} Guardar borrador</button>
      <button class="btn primario" id="btn-planificar" ${dis} title="${S.titleRol(['PRODUCCION'])}">${S.ico('check')} Confirmar y planificar</button></div></div>`;

  if (b) document.getElementById('linea').value = String(b.linea_id);
  ['producto', 'cantidad'].forEach((id) => document.getElementById(id).addEventListener('input', verificar));
  document.getElementById('producto').addEventListener('change', () => { alAcambiarProducto(); verificar(); });
  document.getElementById('btn-borrador').onclick = () => guardar('BORRADOR');
  document.getElementById('btn-planificar').onclick = () => guardar('PLANIFICAR');
  alAcambiarProducto(!b);
  verificar();
}

function productoActual() { return productos.find((p) => p.id === Number(document.getElementById('producto').value)); }

/** Al elegir otro producto se sugiere su línea y se muestra su receta vigente. */
function alAcambiarProducto(sugerirLinea = true) {
  const p = productoActual();
  document.getElementById('receta').value = `${p.receta_codigo} · Versión ${p.receta_version}`;
  document.getElementById('vigente').textContent = `Vigente desde el ${S.fecha(p.receta_vigente_desde)}`;
  if (sugerirLinea) document.getElementById('linea').value = String(p.linea_id);
}

let temporizador;
function verificar() {
  clearTimeout(temporizador);
  temporizador = setTimeout(async () => {
    const p = productoActual();
    const kg = Number(String(document.getElementById('cantidad').value).replace(',', '.'));
    const calculo = document.getElementById('calculo');
    if (!(kg > 0)) {
      ultimaVerificacion = null;
      calculo.innerHTML = '<div class="vacio-grande">Ingresá una cantidad mayor a 0 para calcular los insumos.</div>';
      document.getElementById('lateral').innerHTML = '';
      return;
    }
    try {
      const r = await S.post('/api/ordenes/verificar', { producto_id: p.id, cantidad_kg: kg, op_id: borrador ? borrador.id : undefined });
      ultimaVerificacion = r;
      dibujarCalculo(r, kg);
    } catch (e) { S.error(e); }
  }, 180);
}

function dibujarCalculo(r, kg) {
  document.getElementById('sub-calculo').textContent = `Receta base: ${S.num(r.receta.base_kg)} kg · Factor aplicado: ×${S.num(r.factor, 2).replace(',00', '')} · Stock utilizable, sin cuarentena`;
  const bolsas = r.items.find((i) => i.tipo === 'ME' && /bolsa/i.test(i.nombre));
  const etiquetas = r.items.find((i) => i.tipo === 'ME' && /etiqueta/i.test(i.nombre));
  document.getElementById('calculo').innerHTML = `
    <table class="tabla"><thead><tr><th>Materia prima / empaque</th><th>Requerido</th><th>Disponible</th><th>Faltante</th><th>Estado</th></tr></thead><tbody>
    ${r.items.map((i) => `<tr><td><b>${S.esc(i.nombre)}</b><span class="peq">${S.esc(i.codigo)} · ${i.tipo === 'MP' ? 'Materia prima' : i.critico ? 'Empaque crítico' : 'Empaque'}</span></td>
      <td class="num">${S.num(i.requerido)} ${S.esc(i.unidad)}</td><td class="num">${S.num(i.disponible)} ${S.esc(i.unidad)}</td>
      <td class="num">${S.num(i.faltante)} ${S.esc(i.unidad)}</td>
      <td>${i.ok ? S.pill('Suficiente', 'verde') : S.pill('Faltante', 'rojo')}</td></tr>`).join('')}</tbody></table>
    <div style="display:flex;justify-content:space-between;margin-top:14px;font-size:14px"><b>Materias primas: ${S.num(r.kgMateriaPrima)} kg</b>
      <span style="color:var(--texto-suave)">Empaque: ${bolsas ? `${S.num(bolsas.requerido)} bolsas` : '—'}${etiquetas ? ` + ${S.num(etiquetas.requerido)} etiquetas` : ''}</span></div>`;

  const ok = r.planificable;
  document.getElementById('lateral').innerHTML = `
    <section class="tarjeta"><h2>Lista para planificar</h2>
      <div style="margin:14px 0"><span class="fraccion">${r.criticosOk}/${r.criticosTotal}</span> <span style="color:var(--texto-suave)">insumos críticos disponibles</span></div>
      <div class="check">${S.ico('checkCirculo')}Receta vigente verificada</div>
      <div class="check">${S.ico('checkCirculo')}Cantidad y unidad válidas</div>
      <div class="check ${ok ? '' : 'mal'}">${S.ico(ok ? 'checkCirculo' : 'info')}Disponibilidad ${ok ? 'confirmada' : 'insuficiente'}</div>
      <div class="aviso ${ok ? 'verde' : 'rojo'}" style="margin:16px 0 0">${S.ico(ok ? 'check' : 'info')}<div><b>${ok ? 'Sin faltantes' : 'Hay faltantes críticos'}</b>${ok ? 'Podés confirmar la orden. La OP pasará de Creada a Planificada.' : 'No se puede planificar. Guardá un borrador y SIGTA avisa a Compras.'}</div></div></section>
    <section class="aviso gris" style="margin-bottom:0">${S.ico('info')}<div><b>Si cambia la disponibilidad</b>Con faltantes críticos, la confirmación se bloquea. Podés guardar un borrador y SIGTA avisa a Compras.</div></section>`;
}

async function guardar(accion) {
  const p = productoActual();
  const kg = Number(String(document.getElementById('cantidad').value).replace(',', '.'));
  const cuerpo = {
    producto_id: p.id, linea_id: Number(document.getElementById('linea').value), cantidad_kg: kg,
    fecha_proyectada: document.getElementById('fecha').value, hora_prevista: document.getElementById('hora').value,
    observaciones: document.getElementById('obs').value.trim(), accion,
  };
  const botones = document.querySelectorAll('.barra-acciones button');
  botones.forEach((b) => { b.disabled = true; });
  try {
    const orden = borrador ? await S.put(`/api/ordenes/${borrador.id}`, cuerpo) : await S.post('/api/ordenes', cuerpo);
    if (accion === 'PLANIFICAR') {
      S.aviso(`${orden.numero} planificada`, 'ok');
      setTimeout(() => { location.href = `ejecucion.html?id=${orden.id}`; }, 700);
    } else {
      const falta = ultimaVerificacion && ultimaVerificacion.hayFaltantes;
      S.aviso(falta ? `${orden.numero} guardada como borrador. Se avisó a Compras por los faltantes.` : `${orden.numero} guardada como borrador`, 'ok');
      setTimeout(() => { location.href = 'index.html'; }, 900);
    }
  } catch (e) {
    S.error(e);
    botones.forEach((b) => { b.disabled = !S.puede('PRODUCCION'); });
  }
}

(async () => {
  try {
    await S.montar({ activo: 'ordenes', miga: 'Producción / Órdenes de producción / Nueva orden' });
    [productos, lineas] = await Promise.all([S.get('/api/productos'), S.get('/api/lineas')]);
    const id = S.param('id');
    if (id) {
      borrador = await S.get(`/api/ordenes/${id}`);
      if (borrador.estado !== 'CREADA') { location.replace(`ejecucion.html?id=${id}`); return; }
      numeroOP = borrador.numero;
    } else {
      numeroOP = (await S.get('/api/ordenes/proximo-numero')).numero;
    }
    formulario();
  } catch (e) { S.error(e); }
})();
