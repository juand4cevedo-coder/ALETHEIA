# Aletheia 0.23.0

- Un cliente cuyo enlace del portal venció puede pedir uno nuevo desde la misma página, sin llamar al despacho. El enlace nuevo llega siempre al correo con que se lo invitó, no a quien lo pide, y el anterior deja de servir. Responde lo mismo haya o no un acceso que renovar. Sirve con el enlace más reciente hasta 90 días después de vencido; uno ya reemplazado o de un acceso quitado no renueva nada. Tope: 3 renovaciones por acceso cada 15 minutos. Queda en la auditoría del despacho (acción nueva `client_portal_renewed`).
- Migración 0045: solo agrega esa acción de auditoría. Ruta pública nueva: `POST /api/v1/client-portal/renew`.
- Revisión de seguridad y accesibilidad del portal y de la recuperación del segundo factor: `/portal` ya no se indexa (robots.txt) y la pantalla del portal con el caso a la vista pasa la revisión de accesibilidad automática.
- Documento nuevo para el abogado: `docs/operacion/revision-legal-portal.md`. Señala que el aviso del portal habla de corresponsables y la política vigente dice que ALETHEIA es encargada del contenido de los casos, y propone el texto para cada camino. El portal sigue sin usarse con clientes reales hasta que se decida.

Para verlo después de desplegar: invite un correo suyo de prueba, deje que venza el enlace (o use uno de hace más de un mes) y ábralo; debe ofrecer «Pedir un enlace nuevo» y, al pulsarlo, llegar un correo nuevo con asunto «Su enlace nuevo a …».
