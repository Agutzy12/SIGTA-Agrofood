'use strict';
// Punto de entrada para Vercel: atiende todo lo que empieza con /api.
// Vercel sólo permite escribir en /tmp, así que la base de la demo vive ahí y se carga con los datos de ejemplo al arrancar.
process.env.DB_PATH = process.env.DB_PATH || '/tmp/sigta.db';
const app = require('../src/server');
require('../src/seed').asegurarDatos();
module.exports = app;
