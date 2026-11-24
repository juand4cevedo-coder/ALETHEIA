# Aletheia 0.42.0

**Renovación automática, etapa 2: el cobro, los reintentos y los avisos (apagada).** Sigue apagada con `ALETHEIA_RECURRING_PAYMENTS_ENABLED`: nada se cobra ni cambia para nadie mientras no se encienda.

- **El cobro.** Un día antes de que venza el periodo pagado, una tarea cobra la renovación a la fuente de pago vinculada. Antes de cobrar comprueba de nuevo que valga la pena: función encendida, fuente activa, plan sin renovar, ningún cobro en curso. Un cobro en curso frena cualquier repetición, así que la tarea nunca cobra dos veces.
- **El resultado entra como cualquier pago.** La activación, la suma del nuevo periodo y el comprobante numerado salen por el mismo camino que un pago manual, y al aprobarse queda agendado el cobro del periodo siguiente.
- **Reintentos.** Si el cobro no entra, otro intento a los 3 días, hasta 3 intentos. Si el tercero tampoco entra, se avisa por correo al responsable («No pudimos renovar el plan…») y el plan sigue su curso.
- **Avisos.** El aviso de siete días antes ahora dice, si hay renovación automática, cuándo se cobra, cuánto, a qué Nequi (últimos cuatro dígitos) y cómo cancelar. El aviso sin renovación automática ya no manda a «Organización, Suscripción» (que ya no existe) sino a Plan y facturación.
- Migración 0056: tipo de tarea nuevo `renewal_charge`. Sin rutas nuevas.

**Para encenderla.** No antes de probarla con las llaves de pruebas de Wompi (`pub_test_`, `prv_test_`) en un entorno de pruebas. Lo que la documentación de Wompi no aclara: si cada cobro con una fuente Nequi vuelve a pedir aprobación en el celular (si es así, no sirve para renovar solo), y si la firma de integridad es obligatoria en esos cobros.

**Límites conocidos**
- Las pruebas de base de datos de este cambio las ejecuta la CI. El cobro real no se ha probado contra Wompi.
- La tarjeta sigue fuera.
