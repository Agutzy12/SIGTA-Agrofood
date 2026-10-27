'use strict';
// Esta demo usa SQLite integrado en Node (node:sqlite), disponible sin opciones extra desde Node 22.13.
const [mayor, menor] = process.versions.node.split('.').map(Number);
if (mayor < 22 || (mayor === 22 && menor < 13)) {
  console.error(`SIGTA necesita Node 22.13 o superior y tenés Node ${process.versions.node}.\nDescargá la versión LTS desde https://nodejs.org y volvé a probar.`);
  process.exit(1);
}

const express = require('express');
const path = require('path');
const { handle } = require('./routes');
const seed = require('./seed');

const app = express();
app.disable('x-powered-by');
app.use(express.json());
// Fuentes e imágenes casi no cambian: el navegador las guarda una hora. El resto se revalida (rápido, responde 304 si no cambió).
app.use(express.static(path.join(__dirname, '..', 'public'), {
  setHeaders: (res, archivo) => {
    if (/\.(woff2?|png|ico)$/i.test(archivo)) res.setHeader('Cache-Control', 'public, max-age=3600');
  },
}));

// Todo lo que empieza con /api lo resuelve routes.handle() (permisos, validaciones y errores).
app.use('/api', (req, res) => {
  const respuesta = handle({
    metodo: req.method,
    ruta: '/api' + req.path,
    consulta: req.query,
    cabeceras: req.headers,
    cuerpo: req.body,
  });
  res.status(respuesta.estado).json(respuesta.cuerpo);
});

// Si llega un JSON mal formado u otro error inesperado
app.use((err, req, res, _next) => {
  res.status(err.status || 500).json({ error: err.status === 400 ? 'El pedido no es un JSON válido' : 'Ocurrió un error interno en el servidor' });
});

const PUERTO = process.env.PORT || 3000;
if (require.main === module) {
  seed.asegurarDatos(); // la primera vez crea la base con los datos de ejemplo
  app.listen(PUERTO, () => {
    console.log(`SIGTA demo escuchando en http://localhost:${PUERTO}`);
  });
}

module.exports = app;
