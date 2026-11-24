# Aletheia 0.37.0

- **Comprobante de pago de ALETHEIA.** Cada pago aprobado deja un comprobante propio, numerado en orden (`CP-2026-000001`), con el vendedor, el despacho comprador, el plan, el periodo cubierto, el valor, el medio de pago y el identificador de la transacción de Wompi. El responsable del despacho lo descarga en PDF desde Plan y facturación, y el correo del pago ahora lleva su número y el enlace. Un comprobante emitido no se edita ni se borra, y un mismo pago nunca emite dos. Migración 0052.
- **Reemplaza a la factura mientras no se esté obligado a facturar.** El operador es persona natural no responsable de IVA y no está obligado a expedir factura electrónica mientras no supere el tope de ingresos (3.500 UVT). El comprobante lo dice con todas sus letras: no es una factura electrónica.
- **Ingresos del año frente al tope.** En Facturación de la plataforma, un panel nuevo suma lo cobrado en el año (con los comprobantes, en hora de Colombia), lo compara con el tope en pesos y avisa al llegar al 80 % y al superarlo, para hablar con el contador. El tope y el valor de la UVT salen de la configuración (`ALETHEIA_INVOICING_THRESHOLD_UVT`, 3.500, y `ALETHEIA_UVT_VALUE_COP`, 52.374): el contador debe confirmar el valor de la UVT cada año.
- Rutas nuevas: `GET /api/v1/billing/receipts` y `GET /api/v1/billing/receipts/{id}/pdf`, solo para quien administra la facturación. `GET /api/v1/platform/billing` agrega las cifras del año.
- Los términos de uso dicen ahora que el comprobante es de ALETHEIA, por correo y en PDF. Es una aclaración de cómo se entrega lo mismo que ya se entregaba, así que no cambia la versión de los textos legales.

**Límites conocidos**
- Los pagos aprobados antes de esta versión no tienen comprobante numerado; el correo que se envió entonces sigue siendo su soporte.
- El valor de la UVT de 2026 que trae la configuración debe confirmarlo el contador antes de fiarse del porcentaje.
- Las pruebas de base de datos de este cambio las ejecuta la CI.
