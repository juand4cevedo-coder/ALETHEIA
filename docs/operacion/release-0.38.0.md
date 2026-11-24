# Aletheia 0.38.0

- **La prueba gratuita incluye tres personas.** Con una sola persona incluida, quien abría una cuenta independiente no podía invitar a nadie: la página de miembros no mostraba el botón de invitar por falta de cupo, y no había forma de probar el equipo antes de pagar. Ahora la prueba incluye al responsable, un abogado y un asistente. El cambio es la migración 0053, que solo actúa si el plan sigue con su valor de origen (una persona), para no pisar un ajuste hecho a mano. Los planes de pago no cambian: Esencial incluye 1, Profesional 2 y Firma 8, con usuarios adicionales.
- **«Miembros» pasa a llamarse «Equipo»**, en el menú, en el título de la página y en la documentación, que es como se busca.
- **El aviso de cupo lleno dice qué hacer.** «Su plan incluye 1 usuario y todas están en uso. Para sumar abogados o asistentes, cambie de plan en Plan y facturación o revoque una invitación pendiente.» El responsable recibe el enlace a Plan y facturación; el administrador, que no cambia el plan, recibe la indicación de pedírselo a la persona responsable del despacho.
- Sin rutas nuevas.

**Límites conocidos**
- Las cuentas que ya estaban en prueba reciben el nuevo cupo al aplicarse la migración.
- Las pruebas de base de datos de este cambio las ejecuta la CI.
