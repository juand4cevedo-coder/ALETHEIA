# Pruebas manuales con sesión real

Lo que las pruebas automáticas solo cubren con datos simulados. Cada recorrido dice qué hacer y qué debe verse. Si algo no coincide, anótelo con la hora y lo que apareció en pantalla, sin llaves ni contraseñas.

Antes de empezar: use alias de su correo (`usuario+prueba1@gmail.com`) para las cuentas de prueba. Llegan a su bandeja normal y el sistema los trata como correos distintos.

## 1. Equipo (cuenta independiente en prueba)

1. Cree una cuenta con correo en `/registro/correo` y verifique el correo.
2. Entre a **Equipo**: debe verse «1 de 3 usuarios en uso» y el botón **Invitar a una persona**.
3. Invite un **Abogado** y un **Asistente** con alias. Acepte cada invitación en una ventana privada.
4. Con 3 de 3: el botón de invitar desaparece y aparece el aviso con el enlace a **Plan y facturación**.
5. Como responsable, pruebe **Entregar el despacho** al abogado, con su contraseña. Después, entre como el abogado: debe ver **Plan y facturación**; quien entregó debe seguir con el rol elegido.

## 2. Casos, evidencia y archivo

1. Como abogado, abra un caso y suba una evidencia (cualquier PDF).
2. Cierre el caso. Entre a **Banco de datos**: debe aparecer en las cifras y en la lista.
3. Busque por parte del nombre del archivo y por los primeros 8 caracteres de su huella SHA-256 (se ve en la pantalla de la evidencia): ambos deben encontrar el caso.
4. Filtre por año y por especialidad. Pulse **Descargar el índice (CSV)**, ábralo en Excel y compruebe las tildes.
5. Como asistente que no es miembro de ese caso: **Banco de datos** no debe mostrarlo.

## 3. Portal del cliente

1. En un caso, invite a un cliente con otro alias. El correo debe traer el enlace.
2. Abra el enlace en una ventana privada: debe pedir aceptar el aviso de datos antes de mostrar nada.
3. Envíe un mensaje y suba un documento como cliente. Como abogado, debe verse en el caso y llegar el correo de novedades.
4. Revoque el acceso: el enlace debe dejar de funcionar. Renueve el enlace y compruebe que el nuevo sí abre.

## 4. Cadena de custodia y sello de tiempo

1. En la evidencia, revise la cadena: cada evento con su huella, y el sello de tiempo (pendiente, obtenido o fallido).
2. Si un sello falló, pulse **Pedir el sello otra vez**: debe quedar en la auditoría del despacho.
3. Pida un **Paquete de preservación** y descárguelo: debe traer los originales, el manifiesto y el informe.

## 5. Pago y comprobante (con dinero real, el plan más barato)

1. Con la cuenta del responsable, **Plan y facturación**, elija el plan y pulse **Ir a pagar**.
2. En la página de Wompi, pague con el medio que prefiera. Al volver debe decir «Su pago quedó aprobado y el plan ya está activo».
3. Debe llegar el correo con el número de comprobante, y en **Comprobantes de pago** debe aparecer `CP-AAAA-000001` con su PDF.
4. En Wompi, **Transacciones**, el cobro debe figurar aprobado. En la plataforma, **Facturación**, lo cobrado del año debe subir.
5. Cierre la pestaña de Wompi antes de volver, en otro pago: el plan igual debe activarse por el aviso de Wompi (webhook) en unos minutos.

## 6. Plataforma (cuenta propietaria)

1. **Facturación**: planes, suscripciones por estado, notificaciones de pago y el panel de ingresos del año frente al tope.
2. **Cuentas**: bloquear y desbloquear una cuenta de prueba, y eliminarla definitivamente.
3. **Rendimiento**: las cifras de carga de las páginas reales.

## Cómo anotar un fallo

La hora aproximada, la pantalla, lo que esperaba y lo que vio. Si la pantalla muestra un código de referencia, cópielo: permite encontrar el registro del servidor.
