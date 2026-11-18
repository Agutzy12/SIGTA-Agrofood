/**
 * Conexión a PostgreSQL (con Prisma) y transacciones.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { Prisma, PrismaClient } from '@prisma/client';

/**
 * ¿La dirección es de una conexión "con pool" en modo transacción?
 * - Neon: el host lleva "-pooler".
 * - Supabase: el "Transaction pooler" usa el puerto 6543.
 * Con ese tipo de conexión Prisma no puede usar sentencias preparadas: hay que avisarle (pgbouncer=true).
 */
export const esConexionConPool = (url: string) => url.includes('-pooler.') || /:6543(\/|$|\?)/.test(url);

/** La aplicación usa la conexión con pool; las migraciones, la directa (DATABASE_URL_UNPOOLED). */
function urlDeConexion() {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  process.env.DATABASE_URL_UNPOOLED ||= url;
  return esConexionConPool(url) && !url.includes('pgbouncer=') ? `${url}${url.includes('?') ? '&' : '?'}pgbouncer=true` : url;
}

export const hayBaseConfigurada = () => Boolean(process.env.DATABASE_URL);
export const prisma = new PrismaClient({ datasourceUrl: urlDeConexion() });

type Cliente = Prisma.TransactionClient;
const transaccionActual = new AsyncLocalStorage<Cliente>();

/** Cliente a usar: si hay una transacción en curso, la de esa transacción. */
export function db(): Cliente {
  return transaccionActual.getStore() ?? prisma;
}

/**
 * Transacción "todo o nada": si algo falla a mitad de camino, se deshace todo.
 * Además toma un bloqueo de la base (advisory lock) para que dos operaciones que
 * mueven stock no se pisen (por ejemplo, dos personas consumiendo la misma partida).
 * Si ya estamos dentro de una transacción, se reutiliza.
 */
export async function tx<T>(funcion: () => Promise<T>): Promise<T> {
  if (transaccionActual.getStore()) return funcion();
  return prisma.$transaction(
    async (cliente) => {
      await cliente.$executeRaw`SELECT pg_advisory_xact_lock(20260619)`;
      return transaccionActual.run(cliente, funcion);
    },
    { maxWait: 20_000, timeout: 30_000 },
  );
}
