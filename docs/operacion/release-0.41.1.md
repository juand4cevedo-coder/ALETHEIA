# Aletheia 0.41.1

- **El comprobante aparece solo al aprobarse el pago.** Con el primer pago real (Nequi, 24/11/2026) se comprobó que todo funciona de punta a punta: el pago se aprobó, el plan quedó activo, se emitió el comprobante `CP-2026-000001` y su PDF salió con los datos correctos. Pero la lista de «Comprobantes de pago» seguía diciendo «Todavía no hay pagos aprobados» hasta recargar la página. Ahora la lista se vuelve a pedir en cuanto el pago queda aprobado, tanto con Nequi directo como al volver del Checkout Web de Wompi.
- Sin cambios en el servidor ni migración.

**Lo comprobado con el pago real**
- El cobro directo a Nequi, su confirmación y la activación del plan.
- La emisión del comprobante numerado y su PDF.
- Queda por comprobar en un pago real el camino por el Checkout Web de Wompi (tarjeta, PSE) y que el webhook active el plan sin que la persona vuelva a la página.
