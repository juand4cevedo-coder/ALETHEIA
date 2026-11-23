# Aletheia 0.24.0

- Mensajes del cliente en el portal (ADR-054). En su espacio, el cliente tiene un cuadro «Escribirle al despacho»: un mensaje de texto de hasta 2000 caracteres, sin archivos. Ve sus propios mensajes y no los de otros clientes. No puede escribir antes de aceptar el aviso de datos ni en un caso archivado. Tope: 10 mensajes por acceso cada 15 minutos.
- En la pestaña «Portal del cliente» del caso hay un bloque nuevo, «Mensajes de clientes», con quién escribió y cuándo. Al abrir la pestaña, lo nuevo se marca como leído. Para responder, el abogado publica un aviso o usa sus canales de siempre.
- Los dueños y abogados que son miembros del caso reciben un correo cuando un cliente escribe. El correo no copia el mensaje (viaja fuera de ALETHEIA): dice quién escribió y lleva al caso. Si llegan varios seguidos, sale un solo correo por cada 15 minutos. Quedan en la auditoría del despacho, sin el texto (acción nueva `client_portal_message_sent`).
- Migración 0046: tabla `client_portal_messages` con aislamiento por organización y la acción de auditoría. Rutas nuevas: `POST /api/v1/client-portal/messages` (pública), `GET /api/v1/cases/{id}/portal/messages` y `POST .../portal/messages/read`.
- Presupuesto de JavaScript inicial: la página del portal se carga aparte.

Para verlo después de desplegar: con un cliente de prueba que ya aceptó el aviso, escriba un mensaje desde su enlace; debe aparecer en su lista. Con la cuenta del abogado del caso debe llegar un correo «… le escribió desde el portal del cliente», y al abrir el caso, pestaña «Portal del cliente», el mensaje con su fecha. Escriba 11 mensajes seguidos: el último debe pedir esperar.
