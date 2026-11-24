# Aletheia 0.36.0

- **Plan y facturación.** Nueva sección en el menú para la persona responsable del despacho (`/app/facturacion`): el plan, su estado, hasta cuándo está pagado y el pago. Antes el pago vivía dentro de Mi cuenta y solo aparecía durante la prueba o con el plan vencido, así que con el plan activo (o en pago pendiente o cancelado) no había por dónde pagar ni cambiar de plan. Mi cuenta ahora resume el plan y enlaza a esta sección.
- **Renovar y cambiar de plan.** Con el plan activo se puede pagar desde Plan y facturación. Renovar el mismo plan suma el nuevo periodo al que ya estaba pagado; elegir otro plan empieza hoy. Con el plan activo el pago es por la página de Wompi, donde se elige tarjeta, PSE, Nequi u otro medio. Durante la prueba o con el plan vencido sigue la elección entre la página de Wompi y el cobro directo a Nequi.
- Al volver de Wompi, la persona llega a Plan y facturación, que confirma el pago con el servidor como antes.
- Sin migración ni rutas nuevas. `POST /api/v1/billing/checkout-web` ya no se niega cuando el plan está activo.

**Pendiente de decidir**
- Las facturas: ALETHEIA entrega hoy el comprobante de pago por correo, no una factura electrónica. Si el contador confirma que el operador no está obligado a facturar, no hace falta más; si no, hay que integrar un facturador electrónico y pedir los datos de facturación del despacho.
