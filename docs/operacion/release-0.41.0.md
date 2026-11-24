# Aletheia 0.41.0

**Renovación automática, etapa 1: vincular y cancelar la fuente de pago (apagada).** Nace apagada: nadie ve nada nuevo hasta que se encienda con `ALETHEIA_RECURRING_PAYMENTS_ENABLED=true`.

- En **Plan y facturación**, un panel «Renovación automática» (solo con la función encendida). La persona responsable escribe su celular Nequi, lee y marca la autorización con el texto exacto («Autorizo a ALETHEIA a cobrar, al vencer cada periodo, el valor del plan de mi despacho a mi Nequi, hasta que yo lo cancele…»), aprueba la vinculación en la app de Nequi y la pantalla se actualiza sola. Cancelar es un botón, inmediato.
- **El consentimiento queda registrado:** versión del texto, fecha, quién lo dio y desde qué IP. Si el texto cambia entre que la persona lo lee y lo envía, se rechaza y se le pide leerlo de nuevo.
- **Nunca se guarda un dato de pago:** solo el identificador de la fuente en Wompi y los últimos cuatro dígitos del celular.
- Vincular y cancelar quedan en la auditoría del despacho. **Cerrar la cuenta del despacho cancela la renovación automática.** Una sola fuente viva por despacho.
- Migración 0055 (tabla `payment_sources`, bajo Row-Level Security, con dos acciones nuevas de auditoría). Rutas nuevas: `GET`, `POST` y `DELETE /api/v1/billing/payment-source` y `POST /api/v1/billing/payment-source/confirm`.

**Qué NO hace todavía.** No cobra: vincular una fuente no genera ningún cargo. El cobro automático, el aviso siete días antes, los reintentos y el comprobante de cada cobro son la etapa 2 (ADR-058). Antes de construirla hay que probar en el entorno de pruebas de Wompi lo que su documentación no aclara: si cada cobro con Nequi pide aprobación en el celular, y si la firma de integridad es obligatoria con una fuente.

**Para encenderla en producción (no antes de probarla con llaves de pruebas):** agregar `ALETHEIA_RECURRING_PAYMENTS_ENABLED=true` a `/etc/aletheia/entorno.env`, pasar la variable en `compose.prod.yaml` y reiniciar. Hoy no se pasa, así que sigue apagada.
