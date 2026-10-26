'use strict';
/**
 * Tabla de rutas de la API + permisos por rol.
 * Cada renglón dice: método, ruta, qué roles pueden usarla y qué función ejecuta.
 * Es independiente de Express: server.js la conecta y los tests la llaman directo con handle().
 */
const { PLANTA, USUARIOS, UBICACIONES, MOTIVOS_PAUSA } = require('./config');
const { HttpError } = require('./services/comun');
const inventario = require('./services/inventario');
const ordenes = require('./services/ordenes');
const calidad = require('./services/calidad');
const deposito = require('./services/deposito');
const trazabilidad = require('./services/trazabilidad');
const panel = require('./services/panel');
const seed = require('./seed');

const ROLES = USUARIOS.map((u) => u.rol);
const PRODUCCION = ['PRODUCCION'];
const CALIDAD = ['CALIDAD'];
const DEPOSITO = ['DEPOSITO'];

// roles: null  -> cualquier usuario puede usarla (sólo lectura o ayudas)
// publica: true -> ni siquiera hace falta haber elegido un usuario
const rutas = [
  // Datos generales
  { metodo: 'GET', ruta: '/api/usuarios', publica: true, ejecutar: () => USUARIOS },
  { metodo: 'GET', ruta: '/api/config', publica: true, ejecutar: () => ({ planta: PLANTA, ubicaciones: UBICACIONES, motivos_pausa: MOTIVOS_PAUSA }) },
  { metodo: 'GET', ruta: '/api/productos', roles: null, ejecutar: () => inventario.listProductos() },
  { metodo: 'GET', ruta: '/api/lineas', roles: null, ejecutar: () => inventario.listLineas() },
  { metodo: 'GET', ruta: '/api/recetas/:id', roles: null, ejecutar: ({ params }) => inventario.getReceta(params.id) },
  { metodo: 'GET', ruta: '/api/insumos', roles: null, ejecutar: () => inventario.listInsumos() },
  { metodo: 'GET', ruta: '/api/alertas', roles: null, ejecutar: () => panel.listAlertas() },

  // Panel general
  { metodo: 'GET', ruta: '/api/panel', roles: null, ejecutar: () => panel.getPanel() },
  { metodo: 'POST', ruta: '/api/panel/avisar-compras', roles: PRODUCCION, ejecutar: ({ usuario, cuerpo }) => panel.avisarCompras(usuario, cuerpo.insumo_id) },

  // CU-P01 Registrar Orden de Producción
  { metodo: 'GET', ruta: '/api/ordenes', roles: null, ejecutar: () => ordenes.listOrdenes() },
  { metodo: 'GET', ruta: '/api/ordenes/proximo-numero', roles: null, ejecutar: () => ordenes.proximoNumero() },
  { metodo: 'POST', ruta: '/api/ordenes/verificar', roles: null, ejecutar: ({ cuerpo }) => ordenes.verificarDisponibilidad(cuerpo) },
  { metodo: 'POST', ruta: '/api/ordenes', roles: PRODUCCION, ejecutar: ({ usuario, cuerpo }) => ordenes.crearOrden(usuario, cuerpo) },
  { metodo: 'GET', ruta: '/api/ordenes/:id', roles: null, ejecutar: ({ params }) => ordenes.getOrden(params.id) },
  { metodo: 'PUT', ruta: '/api/ordenes/:id', roles: PRODUCCION, ejecutar: ({ usuario, params, cuerpo }) => ordenes.completarBorrador(usuario, params.id, cuerpo) },
  { metodo: 'POST', ruta: '/api/ordenes/:id/planificar', roles: PRODUCCION, ejecutar: ({ usuario, params }) => ordenes.planificarOrden(usuario, params.id) },
  { metodo: 'POST', ruta: '/api/ordenes/:id/cancelar', roles: PRODUCCION, ejecutar: ({ usuario, params, cuerpo }) => ordenes.cancelarOrden(usuario, params.id, cuerpo.motivo) },

  // CU-P02 Registrar Ejecución de Producción y Consumo
  { metodo: 'POST', ruta: '/api/ordenes/:id/iniciar', roles: PRODUCCION, ejecutar: ({ usuario, params }) => ordenes.iniciarProduccion(usuario, params.id) },
  { metodo: 'POST', ruta: '/api/ordenes/:id/pausar', roles: PRODUCCION, ejecutar: ({ usuario, params, cuerpo }) => ordenes.pausarLinea(usuario, params.id, cuerpo.motivo) },
  { metodo: 'POST', ruta: '/api/ordenes/:id/reanudar', roles: PRODUCCION, ejecutar: ({ usuario, params }) => ordenes.reanudarLinea(usuario, params.id) },
  { metodo: 'PUT', ruta: '/api/ordenes/:id/avance', roles: PRODUCCION, ejecutar: ({ usuario, params, cuerpo }) => ordenes.guardarAvance(usuario, params.id, cuerpo) },
  { metodo: 'POST', ruta: '/api/ordenes/:id/finalizar-elaboracion', roles: PRODUCCION, ejecutar: ({ usuario, params, cuerpo }) => ordenes.finalizarElaboracion(usuario, params.id, cuerpo) },

  // CU-P03 Registrar Control de Calidad de Lote
  { metodo: 'GET', ruta: '/api/calidad/pendientes', roles: null, ejecutar: () => calidad.lotesCuarentena() },
  { metodo: 'GET', ruta: '/api/calidad/historial', roles: null, ejecutar: () => calidad.historialCalidad() },
  { metodo: 'GET', ruta: '/api/calidad/:id', roles: null, ejecutar: ({ params }) => calidad.getLoteCalidad(params.id) },
  { metodo: 'GET', ruta: '/api/calidad/:id/protocolo', roles: null, ejecutar: ({ params }) => calidad.getProtocoloFirmado(params.id) },
  { metodo: 'PUT', ruta: '/api/calidad/:id/borrador', roles: CALIDAD, ejecutar: ({ usuario, params, cuerpo }) => calidad.guardarBorrador(usuario, params.id, cuerpo) },
  { metodo: 'POST', ruta: '/api/calidad/:id', roles: CALIDAD, ejecutar: ({ usuario, params, cuerpo }) => calidad.registrarControlCalidad(usuario, params.id, cuerpo) },

  // CU-P04 Registrar Ingreso de Producto Terminado y Cierre de OP
  { metodo: 'GET', ruta: '/api/depositos/pendientes', roles: null, ejecutar: () => deposito.recepcionesPendientes() },
  { metodo: 'GET', ruta: '/api/depositos/recepcion/:id', roles: null, ejecutar: ({ params }) => deposito.getRecepcion(params.id) },
  { metodo: 'POST', ruta: '/api/depositos/ingreso', roles: DEPOSITO, ejecutar: ({ usuario, cuerpo }) => deposito.ingresarProductoTerminado(usuario, cuerpo) },
  { metodo: 'GET', ruta: '/api/stock-pt', roles: null, ejecutar: () => deposito.stockPT() },
  { metodo: 'POST', ruta: '/api/despachos', roles: DEPOSITO, ejecutar: ({ usuario, cuerpo }) => deposito.despachar(usuario, cuerpo) },

  // Trazabilidad
  { metodo: 'GET', ruta: '/api/trazabilidad', roles: null, ejecutar: ({ consulta }) => trazabilidad.buscar(consulta.q) },

  // Herramientas de la demo
  { metodo: 'POST', ruta: '/api/demo/reponer', roles: null, ejecutar: ({ usuario, cuerpo }) => inventario.reponerStock(usuario, cuerpo) },
  { metodo: 'POST', ruta: '/api/demo/reset', roles: null, ejecutar: ({ usuario }) => seed.reiniciarDemo(usuario) },
];

// Se convierte cada ruta en una expresión regular para poder leer :id
const compiladas = rutas.map((r) => {
  const nombres = [];
  const patron = r.ruta.replace(/:([a-zA-Z]+)/g, (_, nombre) => { nombres.push(nombre); return '([^/]+)'; });
  return { ...r, regex: new RegExp(`^${patron}/?$`), nombres };
});

function buscarRuta(metodo, ruta) {
  for (const r of compiladas) {
    if (r.metodo !== metodo) continue;
    const m = r.regex.exec(ruta);
    if (m) return { ruta: r, params: Object.fromEntries(r.nombres.map((n, i) => [n, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}

/** Quién hace el pedido: viene en las cabeceras x-rol y x-usuario. */
function identificar(cabeceras) {
  const rol = String(cabeceras['x-rol'] || '').toUpperCase();
  const base = USUARIOS.find((u) => u.rol === rol);
  if (!base) throw new HttpError(401, 'Elegí un usuario para operar en el sistema');
  let nombre = base.nombre;
  if (cabeceras['x-usuario']) {
    try { nombre = decodeURIComponent(String(cabeceras['x-usuario'])); } catch { /* se usa el nombre por defecto */ }
  }
  return { rol, nombre };
}

function respuestaDeError(error) {
  if (error instanceof HttpError) return { estado: error.status, cuerpo: { error: error.message } };
  // Errores que lanzan los triggers de la base (bloqueo lógico, protocolo inalterable)
  if (error && error.code === 'ERR_SQLITE_ERROR') {
    const mensaje = String(error.message);
    if (mensaje.startsWith('Bloqueo lógico')) return { estado: 423, cuerpo: { error: mensaje } };
    if (mensaje.includes('inalterable') || mensaje.includes('no puede eliminarse')) return { estado: 409, cuerpo: { error: mensaje } };
  }
  console.error(error);
  return { estado: 500, cuerpo: { error: 'Ocurrió un error interno en el servidor' } };
}

/** Punto de entrada único de la API. Devuelve { estado, cuerpo }. */
function handle({ metodo, ruta, consulta = {}, cabeceras = {}, cuerpo = {} }) {
  try {
    const encontrada = buscarRuta(String(metodo).toUpperCase(), ruta);
    if (!encontrada) throw new HttpError(404, 'Ruta inexistente');
    const { ruta: r, params } = encontrada;
    const usuario = r.publica ? null : identificar(cabeceras);
    if (r.roles && !r.roles.includes(usuario.rol)) {
      const quien = USUARIOS.find((u) => u.rol === usuario.rol);
      throw new HttpError(403, `${quien.cargo} no tiene permiso para esta acción`);
    }
    return { estado: 200, cuerpo: r.ejecutar({ usuario, params, consulta, cuerpo: cuerpo || {} }) };
  } catch (error) {
    return respuestaDeError(error);
  }
}

module.exports = { handle, rutas, ROLES };
