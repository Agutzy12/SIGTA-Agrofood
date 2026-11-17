/**
 * Estructura de todas las pantallas: menú lateral (con los pasos numerados) + barra superior.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSesion } from '../contexto/Sesion';
import { useDialogos } from '../contexto/Dialogos';
import { api } from '../lib/api';
import { fechaHora, fechaLarga } from '../lib/formato';
import { PASOS } from '../lib/proceso';
import { QUE_HACE } from '../lib/roles';
import type { Pendientes, Rol } from '../lib/tipos';
import { Icono, IsotipoSigta, type NombreIcono } from './Icono';
import { Pill } from './Comunes';
import { BotonInstalar } from './InstalarApp';
import { LateralContexto } from './Lateral';
import { FotoRol } from './Rol';
import { LogoEmpresa, WEB_AGRIFOOD, useTema } from '../contexto/Tema';

const activo = ({ isActive }: { isActive: boolean }) => (isActive ? 'activo' : '');
/** Área que registra cada paso (texto corto para el menú). */
const AREA: Record<Rol, string> = { PRODUCCION: 'Producción', CALIDAD: 'Calidad', DEPOSITO: 'Depósito', DIRECCION: 'Gerencia' };
const CUENTA_DE_PASO: Record<number, keyof Pendientes> = { 1: 'planificar', 2: 'elaborar', 3: 'calidad', 4: 'deposito' };

/** Módulos del informe que llegan en la versión completa. Hoy sólo se describen. */
const PROXIMOS: { texto: string; icono: NombreIcono; resumen: string; puntos: string[] }[] = [
  { texto: 'Proveedores y compras', icono: 'compras', resumen: 'Todo el circuito de abastecimiento, desde la necesidad hasta el pago.',
    puntos: ['Fichas de proveedores', 'Comparativa de presupuestos', 'Órdenes de compra y cuentas a pagar', 'Ingreso de materia prima con control de calidad (R.BPM.01V01)'] },
  { texto: 'Stock e inventarios', icono: 'inventario', resumen: 'Existencias en tiempo real en todos los depósitos.',
    puntos: ['Multi-depósito, silos y racks', 'Alarmas de stock mínimo', 'Auditoría cíclica con recuento a ciegas y ajustes autorizados'] },
  { texto: 'Clientes y ventas', icono: 'ventas', resumen: 'De los pedidos mayoristas al despacho, con el bloqueo de lotes ya funcionando.',
    puntos: ['Pedidos y verificación de crédito y stock', 'Remitos y hojas de ruta', 'Facturación electrónica'] },
  { texto: 'Reportes', icono: 'reportes', resumen: 'Tableros para decidir con datos.', puntos: ['Productividad y mermas', 'Rotación de inventarios', 'Compras y eficiencia operativa'] },
  { texto: 'Administración de usuarios', icono: 'usuarios', resumen: 'Alta y baja de usuarios y perfiles. El inicio de sesión y los permisos por rol ya funcionan.',
    puntos: ['Alta, baja y cambio de contraseña', 'Asignación de perfiles', 'Consulta del registro de auditoría'] },
];

/** Ícono y color del encabezado según la sección en la que se está. */
/** Área de cada pantalla: define el color y la ilustración de su encabezado. */
function seccionDe(ruta: string): { clase: string } {
  if (ruta.startsWith('/ordenes') || ruta.startsWith('/ejecucion')) return { clase: 'produccion' };
  if (ruta.startsWith('/calidad')) return { clase: 'calidad' };
  if (ruta.startsWith('/deposito')) return { clase: 'deposito' };
  if (ruta.startsWith('/trazabilidad') || ruta.startsWith('/catalogo') || ruta.startsWith('/como-funciona')) return { clase: 'consulta' };
  return { clase: 'inicio' };
}

export function Marca() {
  const { salir } = useSesion();
  // El logo vuelve a la pantalla de inicio de sesión (cierra la sesión actual para poder elegir otro perfil)
  return (
    <div className="marca">
      <Link to="/ingresar" className="sigta-titulo" title="Volver al inicio de sesión" onClick={() => salir()}><IsotipoSigta /><b>SIGTA</b></Link>
      <div className="bajada">Gestión y Trazabilidad Alimentaria</div>
      <div className="para"><span>para</span><a className="logo-agrifood" href={WEB_AGRIFOOD} target="_blank" rel="noreferrer" title="Ir a agrifood-argentina.com"><LogoEmpresa siempreClaro /></a></div>
    </div>
  );
}

function Desplegable({ abierto, cerrar, children }: { abierto: boolean; cerrar: () => void; children: ReactNode }) {
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (!caja.current?.contains(e.target as Node)) cerrar(); };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar(); };
    setTimeout(() => document.addEventListener('click', fuera), 0);
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('click', fuera); document.removeEventListener('keydown', tecla); };
  }, [abierto, cerrar]);
  return abierto ? <div className="desplegable" ref={caja}>{children}</div> : null;
}

export function Layout() {
  const { usuario, config, pendientes, recargarPendientes, salir, nombreRol } = useSesion();
  const { modal } = useDialogos();
  const { tema, cambiarTema } = useTema();
  const ubicacion = useLocation();
  const navegar = useNavigate();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [abierto, setAbierto] = useState<'' | 'usuario' | 'alertas'>('');
  const [lateral, setLateral] = useState<HTMLElement | null>(null);
  const [cabecera, setCabecera] = useState<HTMLElement | null>(null);
  const [alertas, setAlertas] = useState<{ id: number; detalle: string; usuario: string; fecha: string; destino?: string }[] | null>(null);

  // Cada vez que se cambia de pantalla: se actualizan los números del menú y se cierra el menú del celular
  useEffect(() => { recargarPendientes(); setMenuAbierto(false); setAbierto(''); window.scrollTo(0, 0); }, [ubicacion.pathname, ubicacion.search, recargarPendientes]);

  // Si la dirección trae una sección (#para-resolver, #faltantes), se baja hasta ella cuando la pantalla terminó de cargar
  useEffect(() => {
    const id = ubicacion.hash.slice(1);
    if (!id) return;
    let intentos = 0;
    const buscar = window.setInterval(() => {
      const destino = document.getElementById(id);
      if (destino || ++intentos > 40) {
        window.clearInterval(buscar);
        destino?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 75);
    return () => window.clearInterval(buscar);
  }, [ubicacion.hash, ubicacion.key]);

  if (!usuario || !config) return null;
  const seccion = seccionDe(ubicacion.pathname);

  const verProximo = (m: (typeof PROXIMOS)[number]) => modal({
    titulo: m.texto, ancho: 520,
    contenido: (<>
      <p><Pill color="ambar">Próximamente</Pill></p>
      <p style={{ margin: '14px 0 10px' }}>{m.resumen}</p>
      <ul className="lista-pronto">{m.puntos.map((x) => <li key={x}>{x}</li>)}</ul>
      <p className="sub" style={{ marginTop: 14, color: 'var(--texto-suave)' }}>Forma parte de la versión completa de SIGTA (ver Informe Técnico, sección 12).</p>
    </>),
  });

  const abrirAlertas = async () => {
    setAbierto(abierto === 'alertas' ? '' : 'alertas');
    setAlertas(null);
    try { setAlertas(await api.get('/alertas')); } catch { setAlertas([]); }
  };

  return (
    <div className={`app ${menuAbierto ? 'menu-abierto' : ''}`}>
      <div className="sidebar-fondo" onClick={() => setMenuAbierto(false)} />
      <aside className="sidebar" aria-label="Menú principal">
        <Marca />
        <nav className="menu" style={{ marginTop: 22 }}>
          <NavLink to="/panel" className={activo}><Icono n="panel" /><span>Panel</span></NavLink>
        </nav>
        <div className="menu-titulo" style={{ marginTop: 18 }}>Circuito de producción</div>
        <nav className="menu">
          {PASOS.map((p) => {
            const cuenta = pendientes?.[CUENTA_DE_PASO[p.n]] ?? 0;
            return (
              <NavLink key={p.n} to={p.ruta} className={activo} title={`${p.cu} · Lo registra: ${nombreRol(p.rol)}`}>
                <span className="paso-n">{p.n}</span>
                <span>{p.titulo}<span className="quien">{AREA[p.rol]}</span></span>
                {cuenta > 0 && <span className="cuenta" aria-label={`${cuenta} pendientes`}>{cuenta}</span>}
              </NavLink>
            );
          })}
        </nav>
        <div className="menu-titulo">Consultas</div>
        <nav className="menu">
          <NavLink to="/trazabilidad" className={activo}><Icono n="trazabilidad" /><span>Trazabilidad de lote</span></NavLink>
          <NavLink to="/catalogo" className={activo}><Icono n="caja" /><span>Catálogo de productos</span></NavLink>
        </nav>
        <div className="menu-titulo">Próximamente</div>
        <nav className="menu">
          {PROXIMOS.map((m) => <button key={m.texto} className="item apagado" onClick={() => verProximo(m)}><Icono n={m.icono} /><span>{m.texto}</span></button>)}
        </nav>
        <div className="espacio" />
        <NavLink to="/como-funciona" className={({ isActive }) => `ayuda ${isActive ? 'activo' : ''}`}><Icono n="ayuda" /><span>¿Cómo funciona SIGTA?</span></NavLink>
        <div className="version">SIGTA · v1.0</div>
      </aside>

      <div className="principal">
        <header className="topbar">
          <button className="btn-icono btn-menu" aria-label="Abrir menú" onClick={() => setMenuAbierto(!menuAbierto)}><Icono n="menu" /></button>
          <div className="fecha">{config.planta} · {fechaLarga()}</div>
          <div className="derecha">
            <BotonInstalar />
            <button className="btn-icono" type="button" onClick={cambiarTema} title={tema === 'oscuro' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              aria-label={tema === 'oscuro' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}><Icono n={tema === 'oscuro' ? 'sol' : 'luna'} /></button>
            <button className="campana" aria-label="Alertas" onClick={abrirAlertas}><Icono n="campana" />{pendientes && pendientes.alertas > 0 && <span className="n">{pendientes.alertas}</span>}</button>
            <button className="usuario" onClick={() => setAbierto(abierto === 'usuario' ? '' : 'usuario')} aria-label={`Usuario: ${usuario.nombre}`}>
              <span><b>{usuario.nombre}</b><small>{usuario.cargo}</small></span><span className={`avatar ${usuario.rol.toLowerCase()}`}>{usuario.iniciales}</span>
            </button>
          </div>

          <Desplegable abierto={abierto === 'usuario'} cerrar={() => setAbierto('')}>
            <h4>Sesión iniciada</h4>
            <div className="sesion-actual"><FotoRol rol={usuario.rol} tam={40} /><span><b>{usuario.nombre}</b><small>{usuario.email}</small><small>{QUE_HACE[usuario.rol]}</small></span></div>
            <hr />
            <button className="op" onClick={() => { salir(); navegar('/ingresar'); }}><Icono n="salir" /><span><b>Cerrar sesión</b></span></button>
          </Desplegable>

          <Desplegable abierto={abierto === 'alertas'} cerrar={() => setAbierto('')}>
            <h4>Alertas recientes</h4>
            {alertas === null ? <div className="vacio">Cargando…</div>
              : alertas.length ? alertas.map((a) => a.destino
                ? <button key={a.id} className="alerta-item" onClick={() => { setAbierto(''); navegar(a.destino!); }}>{a.detalle}<small>{a.usuario} · {fechaHora(a.fecha)}<span className="alerta-ver">Ver dónde →</span></small></button>
                : <div key={a.id} className="alerta-item">{a.detalle}<small>{a.usuario} · {fechaHora(a.fecha)}</small></div>)
                : <div className="vacio">No hay alertas.</div>}
          </Desplegable>
        </header>

        <main className="contenido">
          <LateralContexto.Provider value={{ lateral, cabecera }}>
            <div className={`banner ${seccion.clase}`}>
              <div className="contenido-cabecera" ref={setCabecera} />
            </div>
            <div className="contenido-grid">
              <div className="contenido-principal">
                {usuario.rol === 'DIRECCION' && (
                  <div className="aviso solo-lectura"><Icono n="info" /><div><b>Modo de sólo lectura</b>Estás como {usuario.cargo}: podés consultar todo, pero no registrar movimientos.</div></div>
                )}
                <div key={`${ubicacion.pathname}|${usuario.id}`} className="pantalla-entra"><Outlet /></div>
              </div>
              <aside className="lateral" ref={setLateral} aria-label="Guía del paso" />
            </div>
          </LateralContexto.Provider>
        </main>
      </div>
    </div>
  );
}
