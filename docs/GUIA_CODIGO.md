# Guía del código (para entenderlo sin ser experto)

La idea es simple: **el navegador pide datos, el servidor aplica las reglas y la base de datos guarda todo.**

```
Navegador (public/)  ──pide──▶  routes.js  ──llama──▶  services/*.js  ──lee/escribe──▶  SQLite (db.js)
```

## Servidor (`src/`)

| Archivo | Para qué sirve |
|---|---|
| `server.js` | Arranca Express: entrega las pantallas y manda todo lo que empieza con `/api` a `routes.js`. |
| `routes.js` | **Tabla de rutas.** Cada renglón dice: método, dirección, qué roles pueden usarla y qué función ejecuta. Acá se controlan los permisos. |
| `config.js` | Datos fijos: usuarios de la demo, objetivo diario, ubicaciones del depósito, motivos de pausa. |
| `db.js` | Crea las tablas y los *triggers* (reglas que la base hace cumplir sola). `tx()` agrupa varios cambios: o se guardan todos o ninguno. |
| `clock.js` | Reloj del sistema. El seed lo "viaja" al pasado para generar historial. |
| `seed.js` | Carga el catálogo y simula un historial **usando los mismos servicios** que la aplicación. |

### Servicios (`src/services/`)
- `ordenes.js` → CU-P01 y CU-P02 (crear, planificar, iniciar, pausar, finalizar).
- `calidad.js` → CU-P03 (ensayo, dictamen, protocolo).
- `deposito.js` → CU-P04 (ingreso, pallets, despacho).
- `trazabilidad.js` → búsqueda y armado de la ficha del lote.
- `panel.js` → indicadores y tabla del Panel.
- `inventario.js` → stock, partidas y FEFO.
- `comun.js` → errores y funciones de ayuda (redondeo, fechas, auditoría).

**Patrón que se repite en cada servicio:** validar → hacer los cambios dentro de `tx(...)` → registrar en auditoría → devolver el resultado. Si algo está mal se lanza un error con un mensaje claro en español.

## Pantallas (`public/`)

- `css/styles.css`: colores en variables (`:root`) para cambiarlos en un solo lugar.
- `js/common.js`: lo compartido (menú, barra superior, llamadas a la API, ventanas, formatos). Todo está dentro del objeto `S`: `S.get`, `S.post`, `S.modal`, `S.aviso`...
- Una pantalla = un `.html` casi vacío + un `.js` con su lógica (`panel.js`, `orden-nueva.js`, `ejecucion.js`, `calidad.js`, `deposito.js`, `trazabilidad.js`).
- Todo texto que viene de la base se pasa por `S.esc(...)` para evitar inyección de HTML.

## Estados

- **Orden (OP):** Creada → Planificada → En producción (pausada o no) → En control de calidad → Finalizada. Alternativas: Rechazada (Scrap) y Cancelada.
- **Lote:** Cuarentena → Aprobado y liberado, o Rechazado y bloqueado.

## Cómo agregar algo nuevo (ejemplo: un campo en la orden)

1. Agregar la columna en `db.js` (`ESQUEMA`).
2. Guardarla/leerla en el servicio de `ordenes.js`.
3. Mostrarla en la pantalla (`orden-nueva.js`).
4. Agregar una prueba en `test/flujo.test.js` y correr `npm test`.
5. Borrar `data/sigta.db` o usar *Reiniciar la demo* para recrear las tablas.

## Navegación sin recarga
El menú lateral y la barra superior se dibujan una sola vez. Al hacer clic en un enlace, `S.ir()` (en `common.js`) pide el HTML y el script de la pantalla destino y reemplaza sólo el contenido central; así no hay parpadeos. Si algo falla, cae en una navegación común. Cada script de pantalla corre aislado, por lo que sus variables no chocan con las de otras pantallas. Para ir a otra pantalla desde el código se usa `S.ir('calidad.html')` (no `location.href`).

