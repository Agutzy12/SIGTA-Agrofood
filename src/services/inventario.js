'use strict';
/**
 * Catálogos (productos, líneas, recetas) y stock de insumos.
 */
const { db } = require('../db');
const { ahoraISO } = require('../clock');
const { datosInvalidos, noExiste, redondear, aNumero, auditar, filas } = require('./comun');

/** Stock físico, reservado por órdenes planificadas y disponible de cada insumo. */
function stockInsumos() {
  const lista = db.prepare(`
    SELECT i.*,
      COALESCE((SELECT SUM(p.cantidad) FROM partida_insumo p
                WHERE p.insumo_id = i.id AND p.estado = 'LIBERADO'), 0) AS stock,
      COALESCE((SELECT SUM(oi.cantidad_teorica) FROM op_item oi
                JOIN orden_produccion o ON o.id = oi.op_id
                WHERE oi.insumo_id = i.id AND o.estado IN ('PLANIFICADA','EN_PRODUCCION')), 0) AS reservado
    FROM insumo i ORDER BY i.id`).all();
  return lista.map((i) => {
    const stock = redondear(i.stock);
    const reservado = redondear(i.reservado);
    const disponible = redondear(stock - reservado);
    return { ...i, stock, reservado, disponible, bajo: disponible < i.stock_minimo };
  });
}

/**
 * Partidas con saldo de un insumo, ordenadas por vencimiento (primero la que vence antes: FEFO).
 * Las que no tienen vencimiento (bolsas, etiquetas) van al final por orden de llegada.
 */
function partidasDisponibles(insumoId) {
  return filas(db.prepare(`
    SELECT * FROM partida_insumo
    WHERE insumo_id = ? AND estado = 'LIBERADO' AND cantidad > 0
    ORDER BY vencimiento IS NULL, vencimiento, ingreso, id`).all(insumoId));
}

function listInsumos() {
  return stockInsumos().map((i) => ({ ...i, partidas: partidasDisponibles(i.id) }));
}

function listLineas() {
  return filas(db.prepare('SELECT * FROM linea ORDER BY id').all());
}

/** Productos con su receta vigente. */
function listProductos() {
  return filas(db.prepare(`
    SELECT p.*, r.id AS receta_id, r.codigo AS receta_codigo, r.version AS receta_version,
           r.vigente_desde AS receta_vigente_desde, r.base_kg AS receta_base_kg
    FROM producto p JOIN receta r ON r.producto_id = p.id AND r.activa = 1
    ORDER BY p.id`).all());
}

/** Receta con sus componentes (para el botón "Ver receta"). */
function getReceta(id) {
  const receta = db.prepare(`
    SELECT r.*, p.nombre AS producto_nombre, p.codigo AS producto_codigo
    FROM receta r JOIN producto p ON p.id = r.producto_id WHERE r.id = ?`).get(Number(id));
  if (!receta) throw noExiste('Receta inexistente');
  const items = filas(db.prepare(`
    SELECT i.codigo, i.nombre, i.tipo, i.unidad, i.critico, ri.cantidad_base
    FROM receta_item ri JOIN insumo i ON i.id = ri.insumo_id
    WHERE ri.receta_id = ? ORDER BY i.tipo DESC, i.id`).all(receta.id));
  return { ...receta, items };
}

/** Herramienta de la demo: simula la llegada de mercadería. */
function reponerStock(usuario, { insumo_id, cantidad }) {
  const insumo = db.prepare('SELECT * FROM insumo WHERE id = ?').get(Number(insumo_id));
  if (!insumo) throw noExiste('Insumo inexistente');
  const cant = aNumero(cantidad);
  if (!(cant > 0)) throw datosInvalidos('La cantidad debe ser mayor a 0');
  const hoy = ahoraISO().slice(0, 10).replaceAll('-', '');
  const previas = db.prepare('SELECT COUNT(*) AS n FROM partida_insumo WHERE nro_lote LIKE ?').get(`REP-${hoy}-${insumo.codigo}%`).n;
  const nro = `REP-${hoy}-${insumo.codigo}${previas ? '-' + (previas + 1) : ''}`;
  db.prepare(`INSERT INTO partida_insumo(insumo_id,nro_lote,proveedor,cantidad,vencimiento,documento_origen,estado,ingreso)
              VALUES (?,?,?,?,?,?,?,?)`)
    .run(insumo.id, nro, 'Reposición (demo)', cant, null, `REM-${nro}`, 'LIBERADO', ahoraISO());
  auditar(usuario, 'REPOSICION_STOCK', insumo.codigo, `Ingreso de ${cant} ${insumo.unidad} de ${insumo.nombre}`);
  return { ok: true, partida: nro };
}

module.exports = {
  stockInsumos, partidasDisponibles, listInsumos, listLineas, listProductos, getReceta, reponerStock,
};
