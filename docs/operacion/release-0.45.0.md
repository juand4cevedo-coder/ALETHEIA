# Aletheia 0.45.0

**Verificación de persona, comprobante de pago rediseñado y políticas del despacho más limpias.**

- **Verificación de persona en los formularios de acceso.** Ingresar, crear una cuenta, recuperar la contraseña y reenviar la verificación del correo exigen resolver un reto de prueba de trabajo que firma la API. El navegador lo resuelve solo, en un hilo aparte y en menos de un segundo, sin rompecabezas, sin cookies y sin servicios de terceros. Cada solución sirve una sola vez y vence a los 10 minutos (migración 0061). En producción no se puede apagar.
- **Comprobante de pago con formato de factura profesional.** Símbolo de Aletheia, datos de quien emite y de quien paga en dos columnas, tabla de detalle, totales con el IVA explicado, recuadro con los datos del pago y pie legal. Se sigue llamando comprobante de pago: el operador no es responsable de IVA ni expide factura electrónica.
- **Políticas del despacho.** Ya no muestran el plazo de conservación, que es igual para todos y no depende del despacho.
- **Privacidad.** La sección de seguridad explica la verificación de persona.
