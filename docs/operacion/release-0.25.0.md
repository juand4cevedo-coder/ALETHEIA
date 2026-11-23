# Aletheia 0.25.0

- Documentos del portal (ADR-054). En la pestaña «Portal del cliente» del caso hay un bloque nuevo, «Documentos para el cliente»: el despacho sube una copia pensada para el cliente (hasta 25 MB) y la puede quitar. No es evidencia: no entra a la cadena de custodia ni reemplaza al original. Va cifrada con la llave del caso, con sus propios datos asociados, y cuenta para el espacio del plan.
- El cliente ve la lista en su espacio y descarga con un botón. Antes de entregar cada archivo, ALETHEIA comprueba todo el contenido contra su huella SHA-256, igual que con la evidencia. Solo descarga después de aceptar el aviso de datos y mientras su acceso siga vigente; un documento quitado o de otro caso no se descarga.
- Quedan en la auditoría del despacho tres acciones nuevas: documento agregado, retirado y descargado (esta última sin actor, con la IP y el navegador de quien descarga). Quitar un documento lo oculta y bloquea su descarga; el objeto cifrado se conserva hasta que el caso se elimine.
- Migración 0047: tabla `client_portal_documents` con aislamiento por organización y las tres acciones de auditoría. Rutas nuevas: `GET` y `POST /api/v1/cases/{id}/portal/documents`, `DELETE .../documents/{id}` y, sin sesión, `POST /api/v1/client-portal/documents/download`.
- Presupuesto de JavaScript inicial: la página del portal se carga aparte.

Para verlo después de desplegar: con la cuenta del abogado, suba un PDF pequeño en «Documentos para el cliente». Abra el enlace del cliente de prueba (ya con el aviso aceptado): debe aparecer el documento y el botón «Descargar» debe entregar el mismo archivo. Quite el documento y recargue la página del cliente: ya no debe aparecer. En Auditoría del despacho deben verse los tres eventos.
