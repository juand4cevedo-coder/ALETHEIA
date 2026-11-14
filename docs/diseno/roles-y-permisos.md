# Roles y permisos vigentes

La identidad de plataforma y la pertenencia a un despacho son ámbitos distintos. El usuario que
administra Aletheia puede gestionar la operación del servicio cuando exista la consola de
plataforma; ese atributo no abre los casos, la facturación ni los miembros de otro despacho.
Cada petición de datos de un despacho conserva el contexto de organización y persona en la
base de datos. Una cuenta pertenece a un solo despacho en la versión actual.

## Capacidades implementadas

| Capacidad | Propietario del despacho | Administrador | Abogado | Asistente | Administrador de plataforma sin membresía |
| --- | :---: | :---: | :---: | :---: | :---: |
| Ver su despacho | Sí | Sí | Sí | Sí | No |
| Gestionar miembros e invitaciones | Sí | Sí | No | No | No |
| Abrir casos | Sí | Sí | Sí | No | No |
| Ver los casos asignados | Sí | Sí | Sí | Sí | No |
| Bloquear y desbloquear cuentas de la plataforma | Solo si se le asigna | Solo si se le asigna | Solo si se le asigna | Solo si se le asigna | Sí |

El propietario nace al crear el despacho y no se puede invitar, cambiar ni retirar desde la
gestión de miembros. El administrador del despacho puede gestionar el equipo, pero no convertirse
en propietario ni cambiar su propio rol. Los cambios de rol se leen de la base en cada petición
y quedan en auditoría. Las pantallas usan las capacidades para orientar, y la API vuelve a
autorizar la operación en el servicio; ocultar un botón no otorga ni revoca permisos.

El atributo `is_platform_admin` habilita la sección `/app/plataforma` y las rutas de cuentas
`/api/v1/platform/users`. La API comprueba ese atributo en la base en cada petición. La primera
operación de la consola lista cuentas y permite bloquearlas o desbloquearlas; bloquear revoca
sus sesiones y ambos cambios dejan auditoría. No muestra ni modifica expedientes, miembros ni
suscripciones de otros despachos. Solo puede haber una cuenta con ese atributo. La
asignación del usuario propietario se hace desde una operación administrativa con el dueño del
esquema, después de verificar que la cuenta existe y su correo está confirmado; su dirección
personal no va en el código ni en una migración. El usuario técnico de la aplicación no puede
insertar ni actualizar ese atributo.

## Módulos siguientes

Los permisos para evidencias, cadena de custodia, auditoría, configuración, suscripción y soporte
se definirán junto con las rutas de cada módulo. Ninguno se concede anticipadamente por la
presencia de un rol en esta tabla. En particular, el acceso a la plataforma no puede saltarse el
aislamiento de los despachos. Cada ruta nueva requiere una regla de autorización en backend y
pruebas de acceso permitido, denegado y entre despachos.
