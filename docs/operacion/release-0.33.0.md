# Aletheia 0.33.0

- **Pagar con tarjeta, PSE y otros medios.** En Mi cuenta, al pagar el plan hay ahora dos medios: «Tarjeta, PSE u otros medios» (por omisión) y «Nequi, con una notificación a su celular» (como antes). El primero lleva a la página segura de Wompi (Checkout Web), donde la persona elige tarjeta, PSE u otro medio habilitado; los datos de pago los recibe Wompi y ALETHEIA nunca los ve (ADR-057). Al terminar, Wompi devuelve a Mi cuenta, que confirma el resultado con el servidor y dice si el pago quedó aprobado, sigue en proceso (PSE puede tardar unos minutos y la pantalla se actualiza sola) o no se completó.
- **Un pago abandonado ya no bloquea.** Antes, un cobro pendiente impedía iniciar otro mientras no llegara su resultado; con el Checkout Web, abandonar la página de pago es normal. La dirección de pago vale una hora y, pasada una hora y cinco minutos, el cobro pendiente deja de bloquear uno nuevo. Esto aplica también a Nequi.
- Rutas nuevas: `POST /api/v1/billing/checkout-web` y `POST /api/v1/billing/checkout-web/confirm`. Sin migración ni cambios de política de contenido.

**Qué falta comprobar y qué depende de Wompi**
- Los medios que se ofrecen en la página de Wompi (tarjeta, PSE, Nequi, etc.) los decide la configuración de la cuenta de comercio en Wompi: si tarjeta o PSE no aparecen allá, hay que pedírselos a Wompi.
- Esta integración no se probó contra Wompi desde el desarrollo. Antes de anunciarla, haga un pago de prueba (con llaves `pub_test_` en un entorno de pruebas, o un pago real del plan más barato) y compruebe que la dirección se acepta, que el regreso muestra «Su pago quedó aprobado» y que el correo de comprobante llega.
- Queda pendiente vincular Nequi o la tarjeta como fuente de pago para renovar solo (ADR-057): exige decidir el texto de consentimiento y la cancelación.
