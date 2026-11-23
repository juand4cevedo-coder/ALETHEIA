# Revisión legal del portal del cliente

Documento para un abogado. Reúne lo que hace el portal con datos personales, el texto que hoy ve el cliente, lo que la política de privacidad pública dice y no dice, y el cambio propuesto. Nada de esto se publicó: la política vigente no se tocó.

## Qué hace el portal con datos personales

- **Quién es la persona.** Un cliente de un despacho, sin cuenta en ALETHEIA.
- **Qué datos entran.** Su nombre y su correo, que escribe el despacho al invitarlo. La fecha en que aceptó el aviso de datos y la fecha de su última visita. Los avisos que el despacho escribe para él, que pueden contener datos del caso, y el título y el estado del caso.
- **Qué datos no entran.** Notas internas, tareas, equipo, evidencias y cadena de custodia no llegan al portal.
- **De dónde vienen.** Del despacho, no del cliente. El cliente no los entrega: se enteran de que existen cuando recibe el correo.
- **Cuánto duran.** El acceso vale 30 días desde cada envío del enlace. El despacho puede quitarlo en cualquier momento. Los datos del acceso (nombre, correo, fechas) se conservan mientras exista el caso; no hay hoy una supresión automática al revocar.
- **Qué queda registrado.** En la auditoría del despacho: invitación, revocación, renovación del enlace, aceptación del aviso y publicación de cada aviso (sin su texto), con la IP y el navegador de quien actúa.

## La contradicción que hay que resolver

La política vigente (`frontend/src/features/legal/privacy.tsx`) dice que ALETHEIA es **responsable** de los datos de cuenta y **encargado** del contenido que el despacho carga en sus casos, y que el responsable es una persona natural identificada con NIT.

El aviso del portal, como se decidió, dice que el despacho y ALETHEIA son **corresponsables**. Eso no coincide con la política: ante la superintendencia, el mismo servicio no puede ser encargado del contenido de los casos y corresponsable de los datos del cliente en el portal sin explicarlo.

Hay dos caminos y le corresponde elegir a quien revise:

1. **Despacho responsable, ALETHEIA encargada** (la lógica de la política actual). El aviso al cliente lo da el despacho, y ALETHEIA aparece como quien procesa por su cuenta. Es coherente con el resto del producto y deja menos deberes a la plataforma.
2. **Corresponsables.** Hay que cambiar la política para explicar los dos papeles, definir quién atiende las solicitudes del cliente y revisar el registro de bases de datos de la plataforma. Es lo que hoy dice el aviso.

Mientras no se decida, el portal no debe usarse con clientes reales.

## Texto actual del aviso al cliente

> {Despacho} y ALETHEIA son corresponsables del tratamiento de sus datos en este espacio, conforme a la Ley 1581 de 2012.
>
> Usamos su nombre, su correo y la información de su caso que el despacho decida compartirle, solo para que usted pueda seguirlo. No la usamos para publicidad ni la entregamos a terceros ajenos al servicio.
>
> Usted puede conocer, actualizar o corregir sus datos y pedir que se supriman, escribiendo al despacho o a contacto@aletheia.sbs. Más detalles en la política de privacidad.

Preguntas para el abogado:

- ¿El aviso cumple el contenido mínimo del artículo 13 del Decreto 1377 de 2013 (finalidad, derechos, canal, responsable)? Hoy no nombra al responsable con NIT ni da un plazo de respuesta.
- ¿Basta aceptar un aviso con un botón como prueba de autorización, o hace falta una autorización previa y expresa del cliente al despacho antes de que este cargue sus datos en ALETHEIA?
- ¿Los avisos pueden contener datos sensibles del caso (salud, antecedentes) y qué cambia si los contienen?

## Cambio propuesto a la política (si se elige el camino 1)

Agregar a «A quién se aplica» y a «Qué datos recogemos»:

> **Clientes de un despacho.** Si un despacho le abre un espacio en ALETHEIA para que siga su caso, recibimos su nombre y su correo, que el despacho nos entrega, y registramos cuándo acepta el aviso de datos y cuándo ingresa. Sobre esos datos y sobre los avisos que el despacho le publica, el despacho es el responsable y ALETHEIA es encargada: los guardamos y procesamos por su cuenta. Para ejercer sus derechos puede escribir al despacho o a contacto@aletheia.sbs, y trasladaremos su solicitud al despacho.

Y cambiar el aviso del portal por:

> {Despacho} es el responsable del tratamiento de sus datos en este espacio. ALETHEIA, como encargada, los guarda y procesa por su cuenta, conforme a la Ley 1581 de 2012. Los usamos solo para que usted siga su caso. Puede conocer, actualizar, corregir o pedir la supresión de sus datos escribiendo al despacho o a contacto@aletheia.sbs.

## Pendientes técnicos que dependen de la decisión

- Borrar el nombre y el correo del cliente cuando se quite el acceso, si el abogado lo exige (hoy se conservan como parte de la auditoría).
- Registrar qué versión del aviso aceptó el cliente, para poder pedir aceptación de nuevo si el texto cambia.
- Nombrar en el aviso al despacho con su razón social y datos de contacto, no solo su nombre comercial.
