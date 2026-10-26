'use strict';
/* SIGTA demo · código compartido por todas las pantallas.
   Todo vive en un objeto global llamado "S" para que sea fácil de encontrar:
   S.api(...), S.kg(...), S.montar(...), S.modal(...), S.aviso(...)  */
const S = {};

/* ---------- Tema claro / oscuro ---------- */
// Por defecto es claro. La elección se recuerda en el navegador (si no hay almacenamiento, simplemente no se recuerda).
S.tema = () => { try { return localStorage.getItem('sigta_tema') === 'oscuro' ? 'oscuro' : 'claro'; } catch { return 'claro'; } };
S.aplicarTema = (tema) => { document.documentElement.dataset.tema = tema; };
S.pintarBotonTema = () => {
  const b = document.getElementById('btn-tema');
  if (!b) return;
  const oscuro = S.tema() === 'oscuro';
  b.innerHTML = S.ico(oscuro ? 'sol' : 'luna');
  b.title = oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  b.setAttribute('aria-label', b.title);
};
S.cambiarTema = () => {
  const nuevo = S.tema() === 'oscuro' ? 'claro' : 'oscuro';
  try { localStorage.setItem('sigta_tema', nuevo); } catch { /* sin almacenamiento */ }
  S.aplicarTema(nuevo);
  S.pintarBotonTema();
};
S.aplicarTema(S.tema());

/* ---------- Íconos (SVG simples, todos del mismo estilo) ---------- */
const ICONOS = {
  panel: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  ordenes: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>',
  ejecucion: '<path d="M3 21V10l5 3V8l5 3V6l5 3v12z"/><path d="M3 21h18"/>',
  calidad: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3"/><path d="M8 15h8"/>',
  deposito: '<path d="M4 8l8-4 8 4v12H4z"/><path d="M8 12h8M8 16h8"/>',
  trazabilidad: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M4 12h16"/>',
  compras: '<path d="M3 4h2l2.4 11h10.2L20 7H6"/><circle cx="9" cy="19" r="1.3"/><circle cx="17" cy="19" r="1.3"/>',
  inventario: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
  ventas: '<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="18" r="1.5"/><circle cx="17" cy="18" r="1.5"/>',
  reportes: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  ayuda: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>',
  planta: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
  chevAbajo: '<path d="M6 9l6 6 6-6"/>',
  chevDer: '<path d="M9 6l6 6-6 6"/>',
  chevIzq: '<path d="M15 6l-6 6 6 6"/>',
  campana: '<path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  buscar: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  filtro: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  checkCirculo: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
  candado: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  guardar: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
  libro: '<path d="M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2zM12 6v14"/>',
  pausa: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
  play: '<path d="M7 5l12 7-12 7z"/>',
  flecha: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  dividir: '<path d="M12 21v-8M12 13L6 6M12 13l6-7M6 6v4M6 6h4M18 6v4M18 6h-4"/>',
  escudo: '<path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  caja: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  documento: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h4"/>',
  externo: '<path d="M7 17L17 7M9 7h8v8"/>',
  descargar: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  escanear: '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M7 12h10"/>',
  barras: '<path d="M5 5v14M8 5v14M12 5v14M15 5v14M19 5v14"/>',
  firma: '<path d="M4 20h16M6 15c2-1 3-5 5-7s3 2 2 4-2 4 0 4 3-3 5-3"/>',
  cuarentena: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3"/>',
  trigo: '<path d="M12 21V9M12 9c-3 0-4-2-4-5 3 0 4 2 4 5zM12 9c3 0 4-2 4-5-3 0-4 2-4 5zM12 15c-3 0-4-2-4-5 3 0 4 2 4 5zM12 15c3 0 4-2 4-5-3 0-4 2-4 5z"/>',
  camion: '<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="18" r="1.5"/><circle cx="17" cy="18" r="1.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
  luna: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
};
S.ico = (nombre, tamano) => {
  const estilo = tamano ? ` style="width:${tamano}px;height:${tamano}px"` : '';
  return `<svg class="ico" viewBox="0 0 24 24"${estilo}>${ICONOS[nombre] || ''}</svg>`;
};

/* ---------- Texto seguro: siempre escapar lo que viene de la base ---------- */
S.esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- Formatos (estilo argentino: 1.000,5) ---------- */
S.num = (n, dec = 0) => (n == null || Number.isNaN(Number(n)) ? '—' : Number(n).toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec }));
S.kg = (n) => `${S.num(n, Number.isInteger(Number(n)) ? 0 : 1)} kg`;
const pad = (n) => String(n).padStart(2, '0');
S.hora = (iso) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
S.fecha = (iso) => { if (!iso) return '—'; const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
S.fechaHora = (iso) => (iso ? `${S.fecha(iso)} · ${S.hora(iso)}` : '—');
S.hoyTexto = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
S.fechaCorta = (texto) => {
  // "Hoy · 08:30" si es de hoy, "23/10 · 13:00" si no
  const [a, m, d] = texto.split('-');
  return texto === S.hoyTexto() ? 'Hoy' : `${d}/${m}`;
};
S.fechaLarga = () => {
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const d = new Date();
  return `${dias[d.getDay()]} ${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
};

/* ---------- Estados con su color ---------- */
const ESTADOS_OP = {
  CREADA: ['Creada', 'gris'], PLANIFICADA: ['Planificada', 'ambar'], EN_PRODUCCION: ['En producción', 'ambar'],
  EN_CONTROL_CALIDAD: ['En control de calidad', 'azul'], FINALIZADA: ['Finalizada', 'verde'],
  RECHAZADA_SCRAP: ['Rechazada (Scrap)', 'rojo'], CANCELADA: ['Cancelada', 'gris'],
};
const ESTADOS_LOTE = {
  CUARENTENA: ['Cuarentena', 'ambar'], APROBADO_LIBERADO: ['Aprobado y liberado', 'verde'], RECHAZADO_BLOQUEADO: ['Rechazado y bloqueado', 'rojo'],
};
S.estadosOP = ESTADOS_OP;
S.estadosLote = ESTADOS_LOTE;
S.pill = (texto, color) => `<span class="pill ${color}"><span class="punto"></span>${S.esc(texto)}</span>`;
S.pillOP = (estado) => { const [t, c] = ESTADOS_OP[estado] || [estado, 'gris']; return S.pill(t, c); };
S.pillLote = (estado) => { const [t, c] = ESTADOS_LOTE[estado] || [estado, 'gris']; return S.pill(t, c); };

/* ---------- Usuario activo y llamadas a la API ---------- */
S.usuarios = [];
S.rol = () => { try { return localStorage.getItem('sigta_rol') || 'PRODUCCION'; } catch { return 'PRODUCCION'; } };
S.usuario = () => S.usuarios.find((u) => u.rol === S.rol()) || S.usuarios[0];
S.puede = (...roles) => roles.includes(S.rol());
S.cambiarRol = (rol) => { try { localStorage.setItem('sigta_rol', rol); } catch { /* sin almacenamiento */ } location.reload(); };

S.api = async (metodo, ruta, cuerpo) => {
  const u = S.usuario();
  const opciones = { method: metodo, headers: { 'Content-Type': 'application/json', 'x-rol': S.rol(), 'x-usuario': u ? encodeURIComponent(u.nombre) : '' } };
  if (cuerpo !== undefined && metodo !== 'GET') opciones.body = JSON.stringify(cuerpo);
  const respuesta = await fetch(ruta, opciones);
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const error = new Error(datos.error || 'Ocurrió un error inesperado');
    error.estado = respuesta.status;
    throw error;
  }
  return datos;
};
S.get = (ruta) => S.api('GET', ruta);
S.post = (ruta, cuerpo) => S.api('POST', ruta, cuerpo || {});
S.put = (ruta, cuerpo) => S.api('PUT', ruta, cuerpo || {});
S.param = (nombre) => new URLSearchParams(location.search).get(nombre);

/* ---------- Avisos flotantes y ventanas ---------- */
S.aviso = (texto, tipo = '') => {
  let caja = document.querySelector('.tostadas');
  if (!caja) { caja = document.createElement('div'); caja.className = 'tostadas'; document.body.appendChild(caja); }
  const t = document.createElement('div');
  t.className = `tostada ${tipo}`;
  t.textContent = texto;
  caja.appendChild(t);
  setTimeout(() => t.remove(), tipo === 'error' ? 6500 : 3800);
};
S.error = (e) => S.aviso(e.message || String(e), 'error');

/** Muestra una ventana. botones: [{texto, primario, peligro, alHacer}] — devuelve una función para cerrarla. */
S.modal = ({ titulo, html, botones = [{ texto: 'Cerrar' }], ancho }) => {
  const cortina = document.createElement('div');
  cortina.className = 'cortina';
  cortina.innerHTML = `<div class="modal" role="dialog" aria-modal="true" ${ancho ? `style="max-width:${ancho}px"` : ''}>
    <h2>${S.esc(titulo)}</h2><div class="cuerpo">${html}</div><div class="pie-modal"></div></div>`;
  const cerrar = () => cortina.remove();
  const pie = cortina.querySelector('.pie-modal');
  botones.forEach((b) => {
    const el = document.createElement('button');
    el.className = `btn ${b.primario ? 'primario' : ''} ${b.peligro ? 'peligro' : ''}`;
    el.textContent = b.texto;
    el.onclick = async () => {
      if (!b.alHacer) return cerrar();
      const sigue = await b.alHacer(cortina);
      if (sigue !== false) cerrar();
    };
    pie.appendChild(el);
  });
  cortina.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });
  cortina.tabIndex = -1;
  cortina.addEventListener('mousedown', (e) => { if (e.target === cortina) cerrar(); });
  document.body.appendChild(cortina);
  cortina.focus();
  return cerrar;
};
S.confirmar = (titulo, texto, textoBoton = 'Confirmar') => new Promise((resolver) => {
  S.modal({
    titulo, html: `<p>${S.esc(texto)}</p>`,
    botones: [{ texto: 'Cancelar', alHacer: () => resolver(false) }, { texto: textoBoton, primario: true, alHacer: () => resolver(true) }],
  });
});

/* ---------- Pasos del proceso (los 4 casos de uso) ---------- */
S.proceso = (actual) => {
  const pasos = ['Planificación', 'Elaboración', 'Control de calidad', 'Ingreso y cierre'];
  return `<div class="proceso">${pasos.map((p, i) => {
    const n = i + 1;
    const clase = n < actual ? 'hecho' : n === actual ? 'activo' : '';
    return `<div class="paso ${clase}"><span class="num">${n < actual ? '✓' : n}</span>${p}<span class="flecha">${S.ico('chevDer', 16)}</span></div>`;
  }).join('')}</div>`;
};
S.pasoDeOP = (estado, loteEstado) => {
  if (['CREADA', 'PLANIFICADA'].includes(estado)) return 1;
  if (estado === 'EN_PRODUCCION') return 2;
  if (estado === 'EN_CONTROL_CALIDAD') return loteEstado === 'APROBADO_LIBERADO' ? 4 : 3;
  if (estado === 'FINALIZADA') return 5;
  return 3;
};

/* ---------- Estructura de la página: menú lateral + barra superior ---------- */
const MENU = [
  { id: 'panel', texto: 'Panel', icono: 'panel', url: 'index.html' },
  { id: 'ordenes', texto: 'Nueva orden', icono: 'ordenes', url: 'orden-nueva.html' },
  { id: 'ejecucion', texto: 'Ejecución y consumo', icono: 'ejecucion', url: 'ejecucion.html' },
  { id: 'calidad', texto: 'Control de calidad', icono: 'calidad', url: 'calidad.html' },
  { id: 'deposito', texto: 'Ingreso a depósito', icono: 'deposito', url: 'deposito.html' },
  { id: 'trazabilidad', texto: 'Trazabilidad de lote', icono: 'trazabilidad', url: 'trazabilidad.html' },
];
const _MENU_ADMIN = [
  { texto: 'Compras', icono: 'compras' }, { texto: 'Inventario', icono: 'inventario' },
  { texto: 'Ventas y despacho', icono: 'ventas' }, { texto: 'Reportes', icono: 'reportes' },
];
const LOGO = '<img class="logo" src="img/logo.png" alt="Agrifood Argentina" width="176" height="57">';

/** Arma el esqueleto de la pantalla. `activo` = id del menú; `miga` = texto del camino; devuelve el contenedor donde dibujar. */
S.montar = async ({ activo, miga }) => {
  S.usuarios = await fetch('/api/usuarios').then((r) => r.json());
  const config = await fetch('/api/config').then((r) => r.json());
  S.config = config;
  const u = S.usuario();
  const iniciales = u.iniciales || u.nombre.split(' ').map((p) => p[0]).join('');
  document.body.innerHTML = `
  <div class="app" id="app">
    <div class="sidebar-fondo" id="sidebar-fondo"></div>
    <aside class="sidebar" aria-label="Menú principal">
      <div class="marca">${LOGO}<div class="sigta"><b>SIGTA</b><span>GESTIÓN<br>INDUSTRIAL</span></div></div>
      <div class="menu-titulo">Producción y trazabilidad</div>
      <nav class="menu">${MENU.map((m) => `<a href="${m.url}" class="${m.id === activo ? 'activo' : ''}">${S.ico(m.icono)}<span>${m.texto}</span></a>`).join('')}</nav>
      <div class="espacio"></div>
      <button class="ayuda" id="btn-ayuda">${S.ico('ayuda')}<span>Ayuda y procedimientos</span></button>
      <div class="version">SIGTA · v1.0</div>
    </aside>
    <div class="principal">
      <header class="topbar">
        <button class="btn-icono btn-menu" id="btn-menu" aria-label="Abrir menú">${S.ico('menu')}</button>
        <div class="fecha">${S.esc(config.planta)} · ${S.fechaLarga()}</div>
        <div class="derecha">
          <button class="chip-demo" id="btn-demo"><span class="punto"></span>Datos de ejemplo</button>
          <button class="btn-icono" id="btn-tema" type="button"></button>
          <button class="campana" id="btn-campana" aria-label="Alertas">${S.ico('campana')}</button>
          <button class="usuario" id="btn-usuario"><span><b>${S.esc(u.nombre)}</b><small>${S.esc(u.cargo)}</small></span><span class="avatar">${S.esc(iniciales)}</span></button>
        </div>
      </header>
      <main class="contenido"><div class="miga">${S.esc(miga)}</div><div id="pantalla"><div class="cargando">Cargando…</div></div></main>
    </div>
  </div>`;

  document.getElementById('btn-ayuda').onclick = S.verAyuda;
  document.getElementById('btn-tema').onclick = S.cambiarTema;
  S.pintarBotonTema();
  const alternarMenu = () => document.getElementById('app').classList.toggle('menu-abierto');
  document.getElementById('btn-menu').onclick = alternarMenu;
  document.getElementById('sidebar-fondo').onclick = alternarMenu;
  document.getElementById('btn-usuario').onclick = (e) => desplegable(e, menuUsuarios());
  document.getElementById('btn-demo').onclick = (e) => desplegable(e, menuDemo());
  document.getElementById('btn-campana').onclick = (e) => alertas(e);
  cargarContadorAlertas();
  if (u.rol === 'DIRECCION') {
    document.getElementById('pantalla').insertAdjacentHTML('beforebegin', `<div class="aviso solo-lectura">${S.ico('info')}<div><b>Modo de sólo lectura</b>Estás como ${S.esc(u.cargo)}: podés consultar todo, pero no registrar movimientos.</div></div>`);
  }
  return document.getElementById('pantalla');
};

/** Texto de "este botón no es para tu rol". */
S.titleRol = (roles) => (S.puede(...roles) ? '' : `Sólo ${roles.map((r) => S.usuarios.find((u) => u.rol === r)?.cargo.toLowerCase()).join(' o ')} puede hacer esto. Cambiá de usuario arriba a la derecha.`);

function desplegable(evento, html) {
  evento.stopPropagation();
  document.querySelectorAll('.desplegable').forEach((d) => d.remove());
  const caja = document.createElement('div');
  caja.className = 'desplegable';
  caja.innerHTML = html;
  document.querySelector('.topbar').appendChild(caja);
  setTimeout(() => document.addEventListener('click', () => caja.remove(), { once: true }), 0);
  return caja;
}
function menuUsuarios() {
  return `<h4>Elegí con qué rol operar</h4>${S.usuarios.map((u) => `
    <button class="op" onclick="S.cambiarRol('${u.rol}')"><span class="avatar">${S.esc(u.iniciales || '')}</span><span><b>${S.esc(u.nombre)}</b><small>${S.esc(u.cargo)}${u.rol === S.rol() ? ' · activo' : ''}</small></span></button>`).join('')}
    <hr><div class="vacio">Demo sin contraseñas: cada rol sólo puede hacer lo que le corresponde.</div>`;
}
function menuDemo() {
  return `<h4>Herramientas de la demo</h4>
    <button class="op" onclick="S.reponerStock()"><span>${S.ico('caja')}</span><span><b>Reponer stock de insumos</b><small>Simula la llegada de mercadería de Compras</small></span></button>
    <button class="op" onclick="S.reiniciarDemo()"><span>${S.ico('reloj')}</span><span><b>Reiniciar la demo</b><small>Vuelve a cargar los datos de ejemplo</small></span></button>`;
}
async function cargarContadorAlertas() {
  try {
    const lista = await S.get('/api/alertas');
    if (lista.length) document.getElementById('btn-campana').insertAdjacentHTML('beforeend', `<span class="n">${lista.length}</span>`);
  } catch { /* sin alertas */ }
}
async function alertas(evento) {
  const caja = desplegable(evento, '<h4>Alertas recientes</h4><div class="vacio">Cargando…</div>');
  try {
    const lista = await S.get('/api/alertas');
    caja.innerHTML = '<h4>Alertas recientes</h4>' + (lista.length
      ? lista.map((a) => `<div class="alerta-item">${S.esc(a.detalle)}<small>${S.esc(a.usuario)} · ${S.fechaHora(a.fecha)}</small></div>`).join('')
      : '<div class="vacio">No hay alertas.</div>');
  } catch (e) { caja.innerHTML = `<div class="vacio">${S.esc(e.message)}</div>`; }
}
S.reponerStock = async () => {
  try {
    const bajos = (await S.get('/api/insumos')).filter((i) => i.bajo);
    if (!bajos.length) return S.aviso('Ningún insumo está por debajo del mínimo.');
    for (const i of bajos) await S.post('/api/demo/reponer', { insumo_id: i.id, cantidad: i.stock_minimo * 3 });
    S.aviso(`Se repuso stock de ${bajos.length} insumo(s)`, 'ok');
    setTimeout(() => location.reload(), 700);
  } catch (e) { S.error(e); }
};
S.reiniciarDemo = async () => {
  if (!(await S.confirmar('Reiniciar la demo', 'Se borran todos los movimientos y se vuelven a cargar los datos de ejemplo.', 'Reiniciar'))) return;
  try { await S.post('/api/demo/reset'); S.aviso('Demo reiniciada', 'ok'); setTimeout(() => { location.href = 'index.html'; }, 600); } catch (e) { S.error(e); }
};
S.verAyuda = () => S.modal({
  titulo: 'Ayuda y procedimientos',
  html: `<p>Esta demo recorre el módulo <b>Gestión de Producción y Trazabilidad Industrial</b>:</p>
  <ol><li><b>Nueva orden</b> (Producción): elegí producto y cantidad; el sistema calcula insumos y verifica stock.</li>
  <li><b>Ejecución y consumo</b> (Producción): iniciá, asigná lotes de origen y finalizá. El lote queda en <b>cuarentena</b>.</li>
  <li><b>Control de calidad</b> (Calidad): cargá las determinaciones y firmá el dictamen.</li>
  <li><b>Ingreso a depósito</b> (Depósito): recibí el lote liberado; la OP se cierra.</li>
  <li><b>Trazabilidad</b>: buscá cualquier lote y mirá su recorrido completo.</li></ol>
  <p style="margin-top:10px">Cambiá de rol con tu nombre (arriba a la derecha) para ver qué puede hacer cada persona.</p>`,
});
