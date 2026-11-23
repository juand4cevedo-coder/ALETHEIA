# Aletheia 0.14.0

- Compartir una evidencia con un enlace que vence: en el detalle de una evidencia, el propietario, el administrador o el abogado del caso crea un enlace a ese único archivo, con vigencia de 1 hora a 30 días y una nota opcional. El enlace se muestra una sola vez y se puede revocar en cualquier momento. Un asistente no comparte, porque tampoco descarga originales.
- Página pública `/compartido`: quien recibe el enlace no necesita cuenta. Ve el nombre, el tamaño y la huella SHA-256 del archivo y descarga el original, que ALETHEIA verifica entero contra su huella antes de entregarlo. La página no se indexa y el enlace no viaja en la dirección: va en el fragmento y en el cuerpo de la petición.
- Trazabilidad: cada creación, revocación y descarga queda en la cadena de custodia del caso (`evidence_link_created`, `evidence_link_revoked` y `evidence_link_downloaded`, esta última con actor nulo). La descarga deja además la IP y el navegador en la auditoría del despacho, no en la cadena, porque la cadena viaja en los paquetes de preservación.
- Seguridad: el enlace va firmado y no se guarda; en la base solo viven su identificador, su vigencia, su revocación y su uso. Un enlace inexistente, vencido, revocado o alterado responde igual, 404. Límite de 30 consultas por IP cada 15 minutos.
- API: `GET`, `POST` y `DELETE` en `/api/v1/cases/{id}/evidences/{id}/share-links` y, sin sesión, `POST /api/v1/shared-evidence/inspect` y `/download`.

Esta versión incluye una migración (0039: tabla `evidence_share_links` y tres acciones nuevas en la cadena de custodia y una en la auditoría). El despliegue la aplica antes de actualizar la API y no se revierte; la API anterior sigue funcionando con la tabla extra. Las acciones nuevas de la cadena de custodia quedan en su lista cerrada para siempre: la cadena es de solo inserción.

Después de desplegar: cree un enlace de una hora para una evidencia de prueba, ábralo en una ventana de incógnito, descargue el archivo y compruebe que la descarga aparece en los eventos de la evidencia como «Original descargado con un enlace». Luego revóquelo y confirme que la página dice que el enlace ya no existe.
