# Tareas del proyecto SIGTA (demo)

Marcá con `[x]` a medida que se completan.

## Hechas en la demo

- [x] Modelo de datos (SQLite) con reglas y *triggers* de bloqueo
- [x] Catálogo de ejemplo: 5 productos, 14 insumos, recetas por 100 kg, partidas con vencimiento
- [x] Historial de ejemplo (25 órdenes en todos los estados) para que el Panel no arranque vacío
- [x] API con roles (Producción, Calidad, Depósito, Dirección)
- [x] CU-P01 Nueva orden de producción (cálculo proporcional, borrador, planificar)
- [x] CU-P02 Ejecución y consumo (lotes de origen FEFO, dividir consumo, pausa, merma)
- [x] CU-P03 Control de calidad (determinaciones, dictamen, protocolo inalterable)
- [x] CU-P04 Ingreso a depósito (pallets, ubicación, balance, cierre de OP)
- [x] Panel general de producción
- [x] Trazabilidad de lote (hacia atrás, hacia adelante, historial)
- [x] Cambio de rol, reponer stock y reiniciar demo
- [x] Logo real de Agrifood y favicon
- [x] Modo claro (por defecto) y modo oscuro con botón en la barra superior
- [x] Versión adaptable a celular (menú lateral desplegable)
- [x] Cabecera con logo al imprimir la ficha de trazabilidad
- [x] 12 pruebas automáticas del flujo completo
- [x] README, guía del código y guion de la demo

## Para seguir (tesis y programa final)

- [ ] Reemplazar `public/img/logo.png` por el logo original en SVG o PNG de mayor resolución (hoy está recortado de una captura de la web)
- [ ] Login real con usuarios y contraseñas (hoy se elige el rol)
- [ ] Reemplazar los valores de especificación de ejemplo por los reales de Calidad
- [ ] Revisar con Agrifood los códigos (OP, lote, protocolo, pallet) y las vidas útiles
- [ ] Módulo Compras (alta de remitos, aprobación de partidas de insumo)
- [ ] Módulo Inventario (movimientos, ajustes, inventarios cíclicos)
- [ ] Módulo Ventas y despacho (pedidos, remitos de salida)
- [ ] Reportes (producción, merma, rechazos) y exportación real de la ficha de trazabilidad a PDF
- [ ] Lector de códigos de barras real (hoy "Escanear código" es una simulación)
- [ ] Pasar de SQLite a la base definitiva (por ejemplo PostgreSQL)
- [ ] Pruebas de interfaz automáticas (Playwright)
- [ ] Definir despliegue (servidor, copias de seguridad)
- [ ] Capturas y diagramas del sistema para el informe final de la tesis

## Antes de pasar a `main`

- [x] `npm test` en verde
- [ ] Recorrer el guion de la demo completo en el navegador
- [ ] Revisar que no queden datos ni claves personales en el repositorio
