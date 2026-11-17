// Borra la base y vuelve a cargar los datos iniciales:  npm run db:seed  (sólo para desarrollo)
process.env.TZ ||= 'America/Argentina/Cordoba';
// Con --si-vacia sólo los carga si la base está vacía (lo usa el despliegue en Vercel).
const { asegurarDatos, cargarDatosDeEjemplo } = await import('./seed.js');
const { prisma } = await import('../db.js');

const inicio = Date.now();
if (process.argv.includes('--si-vacia')) await asegurarDatos();
else await cargarDatosDeEjemplo();
console.log(`Datos iniciales listos en ${((Date.now() - inicio) / 1000).toFixed(1)} s.`);
await prisma.$disconnect();
