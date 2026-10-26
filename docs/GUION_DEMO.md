# Guion de la demo (unos 10 minutos)

Antes de empezar: `npm start`, abrir http://localhost:3000 y, si ya probaste cosas, **Datos de ejemplo → Reiniciar la demo**.

## 1. Panel (rol: Martín Pérez)
Mostrar los 3 indicadores, el cuadro **Para resolver** (almidón y film bajo el mínimo) y la tabla de órdenes con sus estados. Clic en *Avisar a Compras*.

## 2. Nueva orden (CU-P01)
*Nueva orden* → producto MRC01, 1.000 kg. Ver el cálculo de insumos y el cartel "Sin faltantes".
Probar con una cantidad enorme (por ejemplo 100000): aparecen faltantes y **no deja planificar**; sí deja *Guardar borrador*.
Volver a 1.000 kg → *Confirmar y planificar*.

## 3. Ejecución y consumo (CU-P02)
*Iniciar elaboración*: se asigna el lote (L-MRC01-AAAASS-NN) y el vencimiento. Mostrar los lotes de origen sugeridos por FEFO y *Dividir consumo*.
Probar *Pausar línea* (con motivo) y *Reanudar*. Completar el peso neto (la merma se calcula sola) → *Finalizar elaboración*.
**Idea clave:** el lote queda en **cuarentena** y recién ahí se descuenta el stock.

## 4. Bloqueo preventivo
Cambiar a **Diego Acosta** → Ingreso a depósito: el lote en cuarentena no aparece como recibible. En *Trazabilidad* buscar el lote → *Registrar despacho de ejemplo* → el sistema **lo bloquea**.

## 5. Control de calidad (CU-P03)
Cambiar a **Lucía Benítez**. Elegir el lote, *Cargar ejemplo*, mirar los contrastes "Conforme".
Mostrar que con una humedad de 19 % no deja aprobar. *Guardar y firmar protocolo*.

## 6. Ingreso a depósito (CU-P04)
Cambiar a **Diego Acosta**. Ver el certificado verificado, los pallets (25 + 24 bolsas), la ubicación y el balance. *Confirmar ingreso y cerrar OP* → comprobante REC y OP *Finalizada*.

## 7. Trazabilidad
Buscar el lote: recorrido en 5 etapas, insumos y proveedores (hacia atrás), historial de auditoría y documentos.
Buscar un lote de origen (por ejemplo `MF-261015`) para ver **a qué lotes llegó** esa harina (hacia adelante).

## 8. Rechazo (opcional)
Repetir con otro lote cargando un recuento de 45.000 UFC/g: sólo permite *Rechazado y bloqueado*, exige observaciones, la OP pasa a *Rechazada (Scrap)* y se alerta a jefatura (campanita).

## Si algo sale mal
**Datos de ejemplo → Reiniciar la demo** deja todo como al principio.
