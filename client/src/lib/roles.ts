import type { Rol } from './tipos';

/** Qué hace cada rol, en una línea (pantalla de ingreso y menú de usuario). */
export const QUE_HACE: Record<Rol, string> = {
  PRODUCCION: 'Planifica órdenes y registra la elaboración',
  CALIDAD: 'Analiza los lotes y firma el dictamen',
  DEPOSITO: 'Recibe el producto liberado y despacha',
  DIRECCION: 'Consulta todo, sin modificar nada',
};
