'use strict';
/**
 * Reloj del sistema. Todo el código pide la hora acá y no con `new Date()` suelto.
 * ¿Para qué? Para que los datos de ejemplo puedan "viajar en el tiempo":
 * el seed corre los mismos servicios fingiendo que pasaron varios días.
 */
let reloj = null; // si vale null se usa la hora real

function ahora() {
  return reloj ? reloj() : new Date();
}

function ahoraISO() {
  return ahora().toISOString();
}

function fijarReloj(funcion) { reloj = funcion; }
function liberarReloj() { reloj = null; }

module.exports = { ahora, ahoraISO, fijarReloj, liberarReloj };
