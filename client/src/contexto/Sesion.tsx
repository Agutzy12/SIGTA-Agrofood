/**
 * Sesión del usuario: quién ingresó, qué puede hacer y la configuración general.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, cuandoVenceLaSesion, guardarToken, leerToken } from '../lib/api';
import type { Config, Pendientes, Producto, Rol, Usuario } from '../lib/tipos';

interface Sesion {
  usuario: Usuario | null;
  config: Config | null;
  listo: boolean;
  pendientes: Pendientes | null;
  iniciar: (email: string, clave: string) => Promise<Usuario>;
  ingresarComo: (email: string) => Promise<Usuario>;
  salir: () => void;
  puede: (...roles: Rol[]) => boolean;
  nombreRol: (rol: Rol) => string;
  recargarPendientes: () => void;
  /** Línea de producto (DESHIDRATADOS, PASTAS_SECAS...) a partir del nombre o el código de un producto. */
  lineaDe: (producto: string | null | undefined) => string | null;
}

const Contexto = createContext<Sesion | null>(null);
export const useSesion = () => useContext(Contexto)!;

const NOMBRES_ROL: Record<Rol, string> = {
  PRODUCCION: 'Supervisor de producción', CALIDAD: 'Técnico de calidad', DEPOSITO: 'Operario de depósito', DIRECCION: 'Gerencia',
};

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [pendientes, setPendientes] = useState<Pendientes | null>(null);
  const [listo, setListo] = useState(false);
  const [lineas, setLineas] = useState<Record<string, string>>({});

  const salir = useCallback(() => {
    guardarToken(null);
    setUsuario(null);
    setPendientes(null);
  }, []);

  const cargarDatosDeSesion = useCallback(async () => {
    const [yo, conf] = await Promise.all([api.get<Usuario>('/auth/yo'), api.get<Config>('/config')]);
    setUsuario(yo);
    setConfig(conf);
    // de qué línea es cada producto (para mostrar su ícono); si falla, simplemente no hay íconos
    api.get<Producto[]>('/productos').then((ps) => {
      const mapa: Record<string, string> = {};
      for (const p of ps) if (p.categoria_codigo) { mapa[p.nombre.toLowerCase()] = p.categoria_codigo; mapa[p.codigo.toLowerCase()] = p.categoria_codigo; }
      setLineas(mapa);
    }).catch(() => {});
    return yo;
  }, []);

  useEffect(() => {
    cuandoVenceLaSesion(salir);
    if (!leerToken()) { setListo(true); return; }
    cargarDatosDeSesion().catch(() => salir()).finally(() => setListo(true));
  }, [cargarDatosDeSesion, salir]);

  const iniciar = useCallback(async (email: string, clave: string) => {
    const r = await api.post<{ token: string; usuario: Usuario }>('/auth/login', { email, password: clave });
    guardarToken(r.token);
    return cargarDatosDeSesion();
  }, [cargarDatosDeSesion]);

  /** Acceso rápido de la pantalla de ingreso: entra con un usuario sin escribir la contraseña. */
  const ingresarComo = useCallback(async (email: string) => {
    const accesos = await api.get<{ clave: string }>('/auth/accesos');
    return iniciar(email, accesos.clave);
  }, [iniciar]);

  const recargarPendientes = useCallback(() => {
    if (!leerToken()) return;
    api.get<Pendientes>('/pendientes').then(setPendientes).catch(() => {});
  }, []);

  const valor = useMemo<Sesion>(() => ({
    usuario, config, listo, pendientes, iniciar, ingresarComo, salir, recargarPendientes,
    puede: (...roles) => Boolean(usuario && roles.includes(usuario.rol)),
    nombreRol: (rol) => config?.roles?.[rol] ?? NOMBRES_ROL[rol],
    lineaDe: (producto) => (producto ? lineas[producto.toLowerCase()] ?? null : null),
  }), [usuario, config, listo, pendientes, lineas, iniciar, ingresarComo, salir, recargarPendientes]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
