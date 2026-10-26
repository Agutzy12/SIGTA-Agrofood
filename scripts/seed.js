'use strict';
// Reinicia la base de datos con los datos de ejemplo:  npm run seed
const seed = require('../src/seed');

seed.reiniciarDemo({ rol: 'PRODUCCION', nombre: 'Sistema' });
console.log('Base de datos reiniciada con los datos de ejemplo.');
