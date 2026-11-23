# Roles y permisos vigentes

La identidad de plataforma y la pertenencia a un despacho son ámbitos excluyentes durante una
sesión. La cuenta que administra Aletheia gestiona el servicio desde la consola de plataforma;
ese atributo no abre casos, facturación ni miembros de ningún despacho.
Cada petición de datos de un despacho conserva el contexto de organización y persona en la
base de datos. Una cuenta pertenece a un solo despacho en la versión actual.

Aunque una cuenta de plataforma conserve una membresía histórica en la base, al autenticarse no
entra al contexto de ese despacho: `/me` devuelve organización y suscripción vacías y solo la
capacidad `platform.manage`. Los roles jurídicos y el trabajo en expedientes corresponden a las
cuentas del despacho.

## Capacidades implementadas

| Capacidad | Responsable del despacho (`owner`) | Administrador | Abogado | Asistente | Dueño de la plataforma |
| --- | :---: | :---: | :---: | :---: | :---: |
| Ver su despacho | Sí | Sí | Sí | Sí | No |
| Gestionar miembros e invitaciones | Sí | Sí | No | No | No |
| Consultar auditoría de seguridad de su despacho | Sí | Sí | No | No | No |
| Abrir casos | Sí | No | Sí | No | No |
| Ver los casos asignados | Sí | Sí | Sí | Sí | No |
| Asignar y retirar personas de un caso asignado | Sí | Sí | Sí | No | No |
| Cerrar, archivar y reabrir un caso asignado | Sí | Sí | Sí | No | No |
| Subir evidencia a un caso asignado y abierto | Sí | Sí | Sí | Sí | No |
| Consultar los metadatos de evidencia de un caso asignado | Sí | Sí | Sí | Sí | No |
| Descargar el original de una evidencia del caso asignado | Sí | Sí | Sí | No | No |
| Bloquear y desbloquear cuentas de la plataforma | No | No | No | No | Sí |
| Eliminar definitivamente una cuenta, por ejemplo de prueba | No | No | No | No | Sí |
| Eliminar definitivamente un caso cerrado, vencido y sin bloqueo jurídico | Sí | Sí | No | No | No |
| Abrir y consultar solicitudes propias de soporte | Sí | Sí | Sí | Sí | No; atiende desde la consola |
| Resolver solicitudes de soporte | No | No | No | No | Sí |
| Ver resumen comercial y auditoría transversal | No | No | No | No | Sí |

El propietario nace al crear el despacho y no se puede invitar, cambiar ni retirar desde la
gestión de miembros. El administrador del despacho puede gestionar el equipo, pero no convertirse
en propietario ni cambiar su propio rol. Los cambios de rol se leen de la base en cada petición
y quedan en auditoría. Las pantallas usan las capacidades para orientar, y la API vuelve a
autorizar la operación en el servicio; ocultar un botón no otorga ni revoca permisos.
La auditoría del despacho muestra ingresos y cambios administrativos sin contenido de casos.
Solo el propietario y el administrador de ese despacho pueden consultarla. La respuesta se
limita a su organización, pagina los eventos y no incluye los detalles internos del registro.
La dirección IP y el agente de usuario se anonimizan después de 90 días (RN-027).

El atributo `is_platform_admin` habilita la sección `/app/plataforma` y las rutas de cuentas
`/api/v1/platform/users`. La API comprueba ese atributo en la base en cada petición. El
dueño de la plataforma no recibe contexto de despacho ni puede invitar miembros, abrir casos o
consultar expedientes. La consola busca y filtra cuentas en el servidor por nombre, correo,
estado, verificación y ámbito; muestra la cantidad total de coincidencias y permite bloquearlas
o desbloquearlas. La auditoría transversal permite investigar por persona, organización,
objeto, acción y periodo, siempre sin exponer el contenido de los expedientes. Bloquear revoca
sus sesiones y ambos cambios dejan auditoría. También muestra el resumen de planes y estados de
suscripción, la bandeja de solicitudes de soporte y los eventos de auditoría sin contenido de
expedientes. Cada cuenta autenticada puede abrir y consultar sus propias solicitudes; solo quien
administra la plataforma puede resolverlas o reabrirlas. La cuenta de plataforma no usa el
formulario de soporte del cliente: su menú muestra las solicitudes recibidas y la API rechaza
que abra solicitudes propias. El menú separa las tareas del despacho, la consola y la cuenta;
solo muestra miembros a quienes pueden gestionarlos y casos a quienes trabajan en expedientes. Los datos
de organizaciones siguen
protegidos por Row-Level Security y las rutas de plataforma comprueban el cargo en la base.
Solo puede haber una cuenta con ese atributo. La
asignación del usuario propietario se hace desde una operación administrativa con el dueño del
esquema, después de verificar que la cuenta existe y su correo está confirmado; su dirección
personal no va en el código ni en una migración. El usuario técnico de la aplicación no puede
insertar ni actualizar ese atributo.

## Controles de los módulos implementados

HU-016 permite que la persona responsable, el administrador o el abogado asignado a un caso agregue a una
persona activa de su mismo despacho. La lista de candidatos no incluye a quien ya está en el
caso ni a la cuenta propietaria de plataforma. Retirar a una persona del caso no la retira del
despacho; nadie se retira a sí mismo desde esa pantalla. Cada cambio deja un evento inmutable
en la cadena de custodia del caso. La API responde igual por una cuenta de otro despacho y por
una inexistente.

Cerrar un caso lo mueve al archivo histórico, fija una primera revisión de conservación y agrega
eventos a la cadena y a la auditoría. No destruye archivos, llaves ni eventos. La base rechaza una
purga antes de `retention_until` o mientras `legal_hold` esté activo; la supresión posterior sigue
exigiendo la autorización propia de `purge_case` y deja una constancia inmutable.

Ningún permiso se concede anticipadamente por la presencia de un rol en esta tabla. En particular,
el acceso a la plataforma no puede saltarse el aislamiento de los despachos. Cada ruta nueva
requiere una regla de autorización en backend y pruebas de acceso permitido, denegado y entre
despachos.
