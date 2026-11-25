# Aletheia 0.46.0

**El sitio explica qué hace ALETHEIA, cobra bien los usuarios adicionales y cada página pública llega ya dibujada.**

- **Portada nueva.** El titular nombra la evidencia digital y el público: abogados independientes y despachos en Colombia. El paquete de preservación tiene una sección fija con su contenido real y las tres formas en que un tercero lo comprueba. Los títulos de sección dicen lo que hace el producto. El llamado principal es "Probar 14 días gratis" en todo el sitio.
- **Precios.** Una línea aclara que todos los planes traen las mismas funciones. Hay botón debajo de las tarjetas, una franja con medios de pago, retracto y exportación, el equivalente mensual del pago anual con el ahorro en pesos y ocho preguntas de compra. Corporativo lleva al formulario de cotización.
- **Usuarios adicionales.** Profesional los admite a 19.900 al mes (migración 0062). El pago, la renovación y Nequi cobran el plan más las personas que pasan de las incluidas; en el pago anual cada adicional vale 10 meses. El desglose se ve antes de pagar y en el comprobante (migración 0063). Antes Firma no cobraba los adicionales.
- **Correos de la prueba.** Los días 0, 3, 7, 11 y 14 el propietario recibe un correo con el siguiente paso; cada uno sale una sola vez por despacho y en hora de Bogotá (migración 0064).
- **Cotizaciones del plan Corporativo.** Formulario en /empresa#cotizar, con verificación de persona y límite de intentos. Llega a la consola de soporte del dueño de la plataforma con radicado (migración 0065).
- **Panel.** Cuenta regresiva de la prueba desde el primer día, aviso a quien no puede pagar y un vencimiento que distingue la prueba del plan.
- **Registro e ingreso.** Botón de Google con su "G" a color y los colores de su guía de marca, en claro y oscuro. Ingresar con un Google que no tiene cuenta lleva a crearla. El registro con correo ya no pide confirmar la contraseña y recuerda los 14 días sin tarjeta.
- **Contenido.** Nosotros presenta al fundador con su foto y sus datos públicos. Seguridad describe los controles que existen. Soporte muestra canales y plazos reales. El blog tiene autor y fecha, enlaces internos y dos guías nuevas: conservar un chat, un correo o un video como evidencia, y ALETHEIA frente al estampado cronológico. El comprobador ya no menciona un límite de 32 MB que no existe.
- **SEO.** Cada página pública se genera en el build con su HTML, título, descripción, canónica, vista previa para redes y datos estructurados (Organization, WebSite, SoftwareApplication, Article, BreadcrumbList y FAQPage). Una ruta inventada responde 404. El mapa del sitio se genera con fecha y los archivos se sirven comprimidos con Brotli.
- **Aviso de cookies.** Barra baja de dos botones que ya no tapa el contenido en el celular; se descarga aparte para no pesar en la portada.
- **Términos.** Explican el cobro de usuarios adicionales (versión legal 2026-11-26).

## Al desplegar

1. Las migraciones 0062 a 0065 corren solas.
2. La imagen de Caddy trae `rutas-aplicacion.caddy`, generado en el build; `caddy validate` lo comprueba al construirla.
3. Correr `infra/prod/prueba-de-humo.sh`: revisa el 404, la descripción única, el og:url propio, el JSON-LD y Brotli.
