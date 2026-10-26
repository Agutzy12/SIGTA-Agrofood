# SIGTA · Demo del módulo de Producción y Trazabilidad

**Sistema Integral de Gestión y Trazabilidad Alimentaria** · Agrifood Argentina S.A.
Tesis de Benítez Agustín (Analista de Sistemas) · Basada en el *Informe Técnico V5*.

Esta demo cubre el módulo **Gestión de Producción y Trazabilidad Industrial**:

| Caso de uso | Pantalla | Quién lo usa |
|---|---|---|
| CU-P01 Registrar Orden de Producción | Nueva orden de producción | Producción |
| CU-P02 Registrar ejecución y consumo | Ejecución y consumo | Producción |
| CU-P03 Registrar control de calidad de lote | Control de calidad | Calidad |
| CU-P04 Registrar ingreso de PT y cierre de OP | Ingreso a depósito | Depósito |
| Consulta | Panel general · Trazabilidad de lote | Todos (Dirección: sólo lectura) |

> Los datos y los valores de especificación son **de ejemplo**: no son límites normativos.

## Cómo correrla

Necesitás **Node.js 22.5 o superior** (usa el SQLite que ya trae Node, no hay que instalar una base de datos).

```bash
npm install        # instala Express
npm start          # abre http://localhost:3000
```

**Todo está en la raíz del repo**: un solo `package.json`, sin carpetas `client/` ni `server/`. El servidor entrega las pantallas (`public/`) y la API (`/api`) en el mismo puerto, así que se corre un solo comando en una sola terminal.

Pasos en Windows (CMD o PowerShell), partiendo de cero:

```
git clone -b developer https://github.com/Agutzy12/SIGTA-Agrofood.git
cd SIGTA-Agrofood
node -v            # tiene que decir v22.5 o más
npm install
npm start
```

Después abrí **http://localhost:3000**. Usá siempre `npm` (no mezcles con pnpm). Si instalaste antes con otro gestor y falla, borrá la carpeta `node_modules` y volvé a correr `npm install`. Los avisos `npm warn` no son errores.

La primera vez se crea la base (`data/sigta.db`) con datos de ejemplo. Otros comandos:

```bash
npm run seed       # vuelve a cargar los datos de ejemplo
npm test           # corre las pruebas automáticas (12 pruebas del flujo completo)
npm run dev        # reinicia el servidor solo cuando cambiás un archivo
```

También podés reiniciar los datos desde la pantalla: clic en **"Datos de ejemplo"** (arriba a la derecha) → *Reiniciar la demo*.

## Cómo usarla

El botón del sol/luna (barra superior) cambia entre **modo claro** (por defecto) y **modo oscuro**; se recuerda en tu navegador.

Arriba a la derecha, clic en tu nombre para **cambiar de rol** (no hay contraseñas en la demo):

- **Martín Pérez** · Responsable de producción → crea órdenes, elabora y pausa la línea.
- **Lucía Benítez** · Analista de calidad → carga el ensayo y firma el dictamen.
- **Diego Acosta** · Encargado de depósito → recibe el producto terminado y despacha.
- **Valeria Ruiz** · Gerencia → sólo consulta.

El recorrido completo está en [`docs/GUION_DEMO.md`](docs/GUION_DEMO.md).

## Reglas importantes que la demo hace cumplir

- Un lote recién elaborado queda en **cuarentena**: no se puede recibir en depósito ni despachar.
- Sólo **Calidad** puede liberarlo. Un lote **rechazado** queda bloqueado y su OP pasa a *Rechazada (Scrap)*.
- El **bloqueo lógico** se verifica en dos niveles: en la aplicación (error 423) y en la base de datos (*triggers*).
- El protocolo de calidad firmado es **inalterable**.
- Planificar una orden **no descuenta stock**; el stock se descuenta al finalizar la elaboración.
- Las partidas se sugieren por **FEFO** (primero vence, primero sale).
- Merma de proceso = (kg de materia prima consumidos − kg netos) / kg consumidos.

## Estructura del proyecto

```
public/        Pantallas (HTML + JavaScript simple) y estilos
src/           Servidor y reglas de negocio
  services/    Una carpeta de "servicios" por tema (órdenes, calidad, depósito...)
test/          Pruebas automáticas
docs/          Tareas, guía del código y guion de la demo
scripts/       Utilidades (recargar datos de ejemplo)
```

Para entender el código paso a paso leé [`docs/GUIA_CODIGO.md`](docs/GUIA_CODIGO.md).
La lista de tareas (hechas y pendientes) está en [`docs/TAREAS.md`](docs/TAREAS.md).

## Flujo de trabajo con Git

- Se trabaja en la rama **`developer`**.
- Cuando todo está probado se integra a **`main`**.
