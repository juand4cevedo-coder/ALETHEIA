# Planes de cortesía y vencimiento de suscripciones

## Objetivo

La cuenta propietaria de la plataforma puede conceder a un despacho cualquiera uno de los
planes del catálogo sin crear un cobro ni pasar por una pasarela. La concesión cubre a todos los
miembros de ese despacho y respeta los límites del plan elegido. También sirve para un despacho
propio de trabajo jurídico, administrado con una cuenta distinta de la propietaria de plataforma.

## Estado actual y dependencias

La consola de facturación solo lee el catálogo y cuenta suscripciones. El registro crea una
prueba de 14 días y agenda su vencimiento en el trabajador. Al vencer, la suscripción pasa a
`expired` y el despacho a `read_only` en una transacción. La migración 0018 agenda también las
pruebas creadas antes de esta implementación. Las cortesías todavía no se conceden desde la
consola; HU-116 usará `courtesy_ends_at` y la misma tarea. Los cobros y las facturas siguen
sin integración.

## Reglas de la entrega

1. La acción se autoriza contra `users.is_platform_admin` en la base en cada petición. No da
   acceso a casos, evidencias ni miembros de otros despachos.
2. La cuenta propietaria busca al titular por correo y confirma el despacho de destino. El
   servidor resuelve la pertenencia sin exponer un listado general de datos de despachos.
3. El formulario exige plan, motivo breve y vencimiento opcional. `null` significa cortesía sin
   fecha de fin. La pantalla muestra la fecha exacta antes de guardar y pide confirmación.
4. Una concesión cambia el plan y deja la suscripción activa con origen `courtesy`. Guarda
   quién la concedió, cuándo, el motivo y el vencimiento. `gateway_subscription_id` queda nulo;
   no se crea `PaymentEvent` ni se afirma que hubo un pago.
5. Una renovación actualiza la fecha y deja un nuevo evento de auditoría. Revocar la cortesía
   coloca el despacho en solo lectura para operaciones nuevas, sin quitarle la consulta ni las
   futuras vías de descarga y exportación de sus datos.
6. La prueba gratis vence según `trial_ends_at`; la cortesía, según su fecha si tiene una. El
   trabajador procesa el vencimiento de forma idempotente. Cada transición actualiza
   `subscriptions.status` y `organizations.status` en la misma transacción y deja auditoría.
   La tarea comprueba el estado y la fecha actuales bajo candado, de modo que una tarea antigua
   no venza una renovación; si encuentra una fecha futura, agenda la nueva fecha.
7. El propietario de plataforma puede ver el tipo de acceso, plan, fecha de fin y última acción
   en su consola. El titular ve su plan y su vencimiento sin ver el motivo interno.
8. Los límites de usuarios se leen del plan vigente; al llegar HU-018 se aplican del mismo modo
   los límites de almacenamiento y tamaño por archivo. Conceder un plan no habilita funciones
   que aún no se han implementado.

## Criterios de aceptación

- Solo la cuenta propietaria concede, renueva o revoca una cortesía; otra cuenta recibe 403.
- Un correo ajeno o inexistente no permite modificar otro despacho y no revela sus casos.
- Elegir Esencial, Profesional, Firma o Corporativo aplica sus límites sin registrar pago.
- La concesión sin vencimiento sigue activa; una con vencimiento pasa a solo lectura al llegar
  la fecha, aunque el trabajador repita la tarea.
- La prueba de 14 días también vence automáticamente. Un trabajo retrasado comprueba la fecha
  antes de cambiar el estado y no revoca una renovación posterior.
- Cada cambio deja auditoría con actor, despacho, plan, fecha y motivo, sin contenido de casos.
- Las pruebas cubren concurrencia, aislamiento entre despachos, vencimiento, renovación y
  conservación del acceso a los datos ya creados.
