'use strict';
/**
 * Base de datos SIGTA (SQLite embebido con el módulo `node:sqlite`, Node >= 22.13).
 * Acá sólo está la conexión, las transacciones y el esquema (las tablas).
 * Los datos de ejemplo se cargan en seed.js.
 */
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'sigta.db');
if (DB_PATH !== ':memory:') fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON');
if (DB_PATH !== ':memory:') db.exec('PRAGMA journal_mode = WAL');

/**
 * Transacción "todo o nada": si algo falla a mitad de camino, se deshace todo.
 * Se usa en cada caso de uso que toca varias tablas a la vez.
 */
let nivel = 0;
function tx(funcion) {
  if (nivel > 0) return funcion(); // ya estamos dentro de una transacción
  db.exec('BEGIN IMMEDIATE');
  nivel++;
  try {
    const resultado = funcion();
    db.exec('COMMIT');
    return resultado;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    nivel--;
  }
}

const TABLAS = [
  'auditoria', 'despacho', 'pallet', 'stock_pt', 'control_calidad', 'lote_produccion', 'consumo',
  'op_item', 'orden_produccion', 'partida_insumo', 'receta_item', 'receta', 'insumo', 'producto', 'linea',
];

const ESQUEMA = `
CREATE TABLE linea (
  id INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL
);

CREATE TABLE producto (
  id INTEGER PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,              -- MRC01, PPN02...
  nombre TEXT NOT NULL,
  linea_id INTEGER REFERENCES linea(id),    -- línea sugerida
  presentacion_kg REAL NOT NULL,            -- kg por bolsa
  vida_util_meses INTEGER NOT NULL,
  humedad_max REAL NOT NULL,                -- especificación de ejemplo para calidad
  ph_min REAL NOT NULL,
  ph_max REAL NOT NULL,
  ufc_max INTEGER NOT NULL,
  color_esperado TEXT NOT NULL
);

CREATE TABLE insumo (
  id INTEGER PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,              -- MP-001, ENV-020...
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('MP','ME')),  -- MP materia prima, ME material de empaque
  unidad TEXT NOT NULL,                     -- kg, un., rollos
  critico INTEGER NOT NULL DEFAULT 1,       -- 1 = si falta, no se puede planificar
  stock_minimo REAL NOT NULL DEFAULT 0
);

CREATE TABLE receta (
  id INTEGER PRIMARY KEY,
  codigo TEXT NOT NULL,                     -- REC-MRC01
  producto_id INTEGER NOT NULL REFERENCES producto(id),
  version INTEGER NOT NULL,
  vigente_desde TEXT NOT NULL,
  base_kg REAL NOT NULL,                    -- las cantidades están expresadas cada base_kg
  activa INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE receta_item (
  receta_id INTEGER NOT NULL REFERENCES receta(id),
  insumo_id INTEGER NOT NULL REFERENCES insumo(id),
  cantidad_base REAL NOT NULL,              -- cantidad de insumo cada base_kg de producto
  PRIMARY KEY (receta_id, insumo_id)
);

CREATE TABLE partida_insumo (               -- cada lote de insumo que llegó de un proveedor
  id INTEGER PRIMARY KEY,
  insumo_id INTEGER NOT NULL REFERENCES insumo(id),
  nro_lote TEXT NOT NULL,                   -- lote de origen (MF-261001)
  proveedor TEXT,
  cantidad REAL NOT NULL CHECK (cantidad >= 0),  -- saldo actual
  vencimiento TEXT,
  documento_origen TEXT,                    -- remito del proveedor
  estado TEXT NOT NULL DEFAULT 'LIBERADO',
  ingreso TEXT NOT NULL
);

CREATE TABLE orden_produccion (
  id INTEGER PRIMARY KEY,
  secuencia INTEGER UNIQUE NOT NULL,
  numero TEXT UNIQUE NOT NULL,              -- OP-AAAA-XXXXX
  producto_id INTEGER NOT NULL REFERENCES producto(id),
  receta_id INTEGER NOT NULL REFERENCES receta(id),
  linea_id INTEGER REFERENCES linea(id),
  cantidad_kg REAL NOT NULL,
  fecha_proyectada TEXT NOT NULL,           -- AAAA-MM-DD
  hora_prevista TEXT,                       -- HH:MM
  estado TEXT NOT NULL CHECK (estado IN
    ('CREADA','PLANIFICADA','EN_PRODUCCION','EN_CONTROL_CALIDAD','FINALIZADA','RECHAZADA_SCRAP','CANCELADA')),
  pausada INTEGER NOT NULL DEFAULT 0,
  motivo_pausa TEXT,
  observaciones TEXT,
  creado_por TEXT NOT NULL,
  creado_en TEXT NOT NULL,
  inicio_real TEXT,
  operador TEXT,
  fin_elaboracion TEXT,
  cierre TEXT,
  cantidad_real_kg REAL,
  bultos INTEGER,
  merma_kg REAL,
  merma_pct REAL,
  lote_codigo_previsto TEXT,
  vencimiento_previsto TEXT,
  avance_json TEXT                          -- "Guardar avance" de la ejecución
);

CREATE TABLE op_item (                      -- insumos teóricos de la orden
  op_id INTEGER NOT NULL REFERENCES orden_produccion(id),
  insumo_id INTEGER NOT NULL REFERENCES insumo(id),
  cantidad_teorica REAL NOT NULL,
  PRIMARY KEY (op_id, insumo_id)
);

CREATE TABLE consumo (                      -- trazabilidad hacia atrás: qué partidas entraron a la orden
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  op_id INTEGER NOT NULL REFERENCES orden_produccion(id),
  insumo_id INTEGER NOT NULL REFERENCES insumo(id),
  partida_id INTEGER NOT NULL REFERENCES partida_insumo(id),
  cantidad REAL NOT NULL
);

CREATE TABLE lote_produccion (
  id INTEGER PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,              -- L-MRC01-202644-01
  op_id INTEGER UNIQUE NOT NULL REFERENCES orden_produccion(id),
  producto_id INTEGER NOT NULL REFERENCES producto(id),
  cantidad_kg REAL NOT NULL,
  bultos INTEGER NOT NULL,
  vencimiento TEXT NOT NULL,
  estado TEXT NOT NULL CHECK (estado IN ('CUARENTENA','APROBADO_LIBERADO','RECHAZADO_BLOQUEADO')),
  creado_en TEXT NOT NULL,
  borrador_json TEXT                        -- "Guardar borrador" del control de calidad
);

CREATE TABLE control_calidad (
  id INTEGER PRIMARY KEY,
  lote_id INTEGER UNIQUE NOT NULL REFERENCES lote_produccion(id),
  protocolo TEXT NOT NULL,                  -- CC-AAAA-XXXXX
  formulario TEXT NOT NULL,                 -- R.BPM.01V01
  humedad REAL NOT NULL,
  ph REAL NOT NULL,
  aroma TEXT NOT NULL,
  color TEXT NOT NULL,
  sabor TEXT NOT NULL,
  ufc INTEGER NOT NULL,
  dictamen TEXT NOT NULL CHECK (dictamen IN ('APROBAR_LIBERAR','RECHAZAR_BLOQUEAR')),
  observaciones TEXT,
  analista TEXT NOT NULL,
  fecha TEXT NOT NULL
);

CREATE TABLE stock_pt (                     -- ingreso de producto terminado a depósito
  id INTEGER PRIMARY KEY,
  lote_id INTEGER NOT NULL REFERENCES lote_produccion(id),
  comprobante TEXT NOT NULL,                -- REC-AAAA-XXXXX
  deposito TEXT NOT NULL,
  sector TEXT NOT NULL,
  rack TEXT NOT NULL,
  nivel TEXT NOT NULL,
  camara TEXT,
  bultos INTEGER NOT NULL,
  pallets INTEGER NOT NULL,
  kg_recibidos REAL NOT NULL,
  cantidad_kg REAL NOT NULL CHECK (cantidad_kg >= 0),   -- saldo vendible actual
  bultos_danados INTEGER NOT NULL DEFAULT 0,
  merma_kg REAL NOT NULL DEFAULT 0,
  justificacion TEXT,
  recibido_por TEXT NOT NULL,
  fecha TEXT NOT NULL
);

CREATE TABLE pallet (
  id INTEGER PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,              -- PAL-AAAA-XXXXX
  lote_id INTEGER NOT NULL REFERENCES lote_produccion(id),
  bultos INTEGER NOT NULL,
  kg REAL NOT NULL
);

CREATE TABLE despacho (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lote_id INTEGER NOT NULL REFERENCES lote_produccion(id),
  cliente TEXT NOT NULL,
  cantidad_kg REAL NOT NULL,
  fecha TEXT NOT NULL,
  usuario TEXT NOT NULL
);

CREATE TABLE auditoria (                    -- historial de todo lo que pasa en el sistema
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL,
  usuario TEXT NOT NULL,
  rol TEXT NOT NULL,
  accion TEXT NOT NULL,
  entidad TEXT,
  detalle TEXT,                             -- texto que se muestra en el historial
  resultado TEXT,                           -- estado en el que quedó la orden o el lote
  op_id INTEGER,
  lote_id INTEGER
);

-- El protocolo de calidad firmado no se puede modificar ni borrar (ni desde la base).
CREATE TRIGGER trg_cc_no_update BEFORE UPDATE ON control_calidad
BEGIN SELECT RAISE(ABORT, 'El protocolo de calidad firmado es inalterable'); END;
CREATE TRIGGER trg_cc_no_delete BEFORE DELETE ON control_calidad
BEGIN SELECT RAISE(ABORT, 'El protocolo de calidad firmado no puede eliminarse'); END;

-- Bloqueo lógico: un lote que no esté APROBADO_LIBERADO no puede entrar a stock ni despacharse.
CREATE TRIGGER trg_stock_pt_bloqueo BEFORE INSERT ON stock_pt
WHEN (SELECT estado FROM lote_produccion WHERE id = NEW.lote_id) <> 'APROBADO_LIBERADO'
BEGIN SELECT RAISE(ABORT, 'Bloqueo lógico: el lote no está aprobado y liberado'); END;

CREATE TRIGGER trg_despacho_bloqueo BEFORE INSERT ON despacho
WHEN (SELECT estado FROM lote_produccion WHERE id = NEW.lote_id) <> 'APROBADO_LIBERADO'
BEGIN SELECT RAISE(ABORT, 'Bloqueo lógico: el lote no está aprobado y liberado'); END;
`;

function crearEsquema() {
  db.exec(ESQUEMA);
}

function borrarEsquema() {
  db.exec('PRAGMA foreign_keys = OFF');
  for (const tabla of TABLAS) db.exec(`DROP TABLE IF EXISTS ${tabla}`);
  db.exec('PRAGMA foreign_keys = ON');
}

function hayEsquema() {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='producto'").get();
}

module.exports = { db, tx, crearEsquema, borrarEsquema, hayEsquema, DB_PATH };
