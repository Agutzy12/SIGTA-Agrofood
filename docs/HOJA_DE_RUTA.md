# Hoja de ruta hacia el SIGTA completo

Estado: la demo cubre **Producción y Trazabilidad** (CU-P01 a CU-P04). Faltan los demás módulos del informe (sección 12).

Una "jornada" es una sesión larga de trabajo como las que hicimos para la demo. Los tiempos son aproximados y dependen de qué tan rápido llegue la revisión de cada entrega.

| Paso | Qué incluye | Jornadas |
|---|---|---|
| 0. Base técnica | Decidir la base de datos final (PostgreSQL), estructura para crecer, datos de ejemplo por módulo | 1 |
| 1. Usuarios y permisos | Login real, perfiles (Administrador, Supervisor, Operario, Técnico de Calidad), registro de auditoría | 1–2 |
| 2. Proveedores y compras | Fichas de proveedores, presupuestos, órdenes de compra, cuentas a pagar, ingreso de materia prima con control de calidad (R.BPM.01V01) | 3 |
| 3. Stock e inventarios | Multi-depósito, silos y racks, alarmas de mínimo, auditoría cíclica con recuento a ciegas y ajuste autorizado | 3 |
| 4. Clientes y ventas | Clientes, pedidos, verificación de crédito y stock, remitos, hoja de ruta, factura electrónica simulada, bloqueo de lotes no liberados | 4 |
| 5. Reportes | Tableros de productividad, mermas, rotación de inventario y compras | 2 |
| 6. GS1-128 | Etiqueta con identificadores 01, 10, 17 y 310X y lector simulado | 1–2 |
| 7. Cierre | Pruebas, copias de respaldo, instalación y pulido final | 2 |

**Total estimado: 17 a 19 jornadas**, unas 4 a 6 semanas a razón de 4 o 5 jornadas por semana.

Por cada módulo también hay que escribir la documentación de la tesis (casos de uso con ficha, requerimientos, diagramas y prototipos): es trabajo aparte y conviene hacerlo en paralelo.

Orden recomendado: 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7. Reportes va casi al final porque se arma con los datos de los demás.
