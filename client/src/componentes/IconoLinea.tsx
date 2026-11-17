import type { CSSProperties } from 'react';
import { useSesion } from '../contexto/Sesion';

/** Líneas de producto de Agrifood, con el archivo de su ícono (public/img/lineas). */
export const LINEAS_PRODUCTO: { codigo: string; nombre: string; archivo: string }[] = [
  { codigo: 'DESHIDRATADOS', nombre: 'Deshidratados', archivo: 'deshidratados' },
  { codigo: 'PRE_ELABORADOS', nombre: 'Pre elaborados', archivo: 'pre-elaborados' },
  { codigo: 'FRUTOS_SECOS', nombre: 'Frutos secos', archivo: 'frutos-secos' },
  { codigo: 'PRE_MEZCLAS', nombre: 'Pre mezclas', archivo: 'pre-mezclas' },
  { codigo: 'PASTAS_SECAS', nombre: 'Pastas secas', archivo: 'pastas-secas' },
];

/** Ícono de una línea de producto. El archivo es sólo la forma: el color lo pone el CSS (.ico-linea). */
export function IconoLinea({ codigo }: { codigo: string }) {
  const linea = LINEAS_PRODUCTO.find((l) => l.codigo === codigo);
  if (!linea) return null;
  return <span className="ico-linea" aria-hidden="true" style={{ '--forma': `url('/img/lineas/${linea.archivo}.png')` } as CSSProperties} />;
}

/** El ícono de la línea a la que pertenece un producto (por su nombre o su código), dentro de una pastilla. */
export function IconoProducto({ de, grande = false }: { de: string | null | undefined; grande?: boolean }) {
  const { lineaDe } = useSesion();
  const codigo = lineaDe(de);
  if (!codigo) return null;
  const nombre = LINEAS_PRODUCTO.find((l) => l.codigo === codigo)?.nombre;
  return <span className={`ico-prod ${grande ? 'grande' : ''}`} title={nombre ? `Línea ${nombre}` : undefined}><IconoLinea codigo={codigo} /></span>;
}
