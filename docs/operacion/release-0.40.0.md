# Aletheia 0.40.0

- **Editar los planes desde la plataforma.** En Facturación de la plataforma, cada plan tiene un botón **Editar**: precio mensual y anual, usuarios incluidos, precio del usuario adicional y si aparece en la página de precios. Hasta ahora esos valores solo se cambiaban con una migración (así se subió la prueba a tres personas). Lo que se guarda rige para los pagos nuevos y para el cupo de los despachos desde su siguiente petición; lo ya cobrado no cambia. El cambio se rechaza si deja un plan público de pago sin precio mensual o con el anual más caro que doce meses. Ruta nueva: `PATCH /api/v1/platform/plans/{code}`, solo para la cuenta propietaria de la plataforma.
- **Cada cambio de plan queda auditado**, con los valores de antes y de después, en la auditoría de la plataforma (acción nueva `plan_updated`).
- **Llevarse el índice del archivo queda auditado.** Cada descarga del índice del Banco de datos deja un evento `archive_exported` en la auditoría del despacho, con quién, cuándo, cuántas filas salieron y si se descargó con filtros. Antes el índice salía sin dejar rastro.
- **Corrección de la auditoría del despacho.** El traspaso de titularidad (0.34.0) y los nuevos eventos no tenían rótulo en español y aparecían con su código; ahora dicen «Despacho entregado a otra persona» e «Índice del archivo descargado», y se pueden filtrar.
- Migración 0054: las dos acciones nuevas en la auditoría.

**Límites conocidos**
- Cambiar el precio de un plan no cambia lo que ya se cobró ni una renovación en curso: rige para los cobros nuevos.
- Las pruebas de base de datos de este cambio las ejecuta la CI.
