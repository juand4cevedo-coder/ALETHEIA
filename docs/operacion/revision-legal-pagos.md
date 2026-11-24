# Revisión legal de los pagos, la renovación automática y los avisos

**Para un abogado.** Esto lo redactó el equipo técnico, no un abogado. Reduce riesgos conocidos, pero no los elimina ni garantiza que no haya reclamaciones: cada cláusula necesita revisión de un abogado antes de darla por buena. Los textos vigentes están en `frontend/src/features/legal/` (términos, privacidad, reembolsos, cookies) y se identifican por la fecha desde la que rigen: **24/11/2026**. Quien ya tenía cuenta debe aceptarlos de nuevo en su siguiente ingreso.

## Qué se cambió y por qué

| Riesgo | Qué decía antes | Qué dice ahora | Dónde |
| --- | --- | --- | --- |
| Cobrar sin que el cliente lo espere | Los términos decían que el plan **se renueva automáticamente** por omisión. No era cierto: la renovación era manual. | Por omisión **no se renueva solo**; se avisa siete días antes. La renovación automática es opcional. | Términos, «Duración y renovación» |
| Autorización de cobros recurrentes | No existía. | Sección «Renovación automática (opcional)»: quién la activa, el texto exacto que se acepta, cuándo y cuánto cobra, aviso previo, cancelación inmediata, reintentos, qué le corresponde al cliente, qué datos se guardan y devolución de cobros no autorizados. | Términos; `payment_sources` guarda versión del texto, fecha, IP |
| Cobro tras cancelar | No cubierto. | Se devuelve completo, sin plazo. | Reembolsos, «Cobros duplicados o por error» |
| Datos de pago | Solo mencionaba la tarjeta. | Menciona la fuente de pago vinculada: identificador en la pasarela, últimos cuatro dígitos y registro de la autorización. | Privacidad |
| Plazos procesales vencidos | Nada. | ALETHEIA **no vigila términos procesales**; los plazos y recordatorios son una ayuda y pueden fallar. | Términos, «Lo que ALETHEIA no hace» |
| Eliminación de casos | Nada, y es irreversible. | Eliminar un caso cerrado es definitivo, exige confirmación, no se recupera ni por soporte y la conservación legal es del despacho. | Términos, «Cancelación, archivo y conservación» |
| Portal del cliente | Nada. | Sección propia: el despacho decide qué comparte y responde por tener la autorización de su cliente; el cliente acepta un aviso antes de entrar; el enlace es personal y revocable. | Términos, «Portal del cliente» |
| Aviso al pagar | Ninguno. | Bajo «Ir a pagar»: enlaces a términos y reembolsos, y que el plan no se renueva solo. En el panel de renovación: enlace a la sección y a reembolsos. | Interfaz |

El comprobante de pago (PDF y correo) ya dice que **no es una factura electrónica** y por qué.

## Lo que necesita decisión de un abogado

1. **Suficiencia de la autorización de cobros recurrentes.** ¿El texto, la casilla propia, el registro (versión, fecha, IP) y el aviso de siete días bastan para Colombia? ¿Hay un aviso o un plazo mínimo que la regulación de pagos recurrentes exija? ¿Los contratos de la pasarela (Wompi) agregan obligaciones que deban reflejarse?
2. **Derecho de retracto.** La política ya concede cinco días hábiles en cada cobro, también en renovaciones, aunque la ley excluye los servicios ya iniciados. ¿Se mantiene así, o se limita?
3. **¿Aplica el Estatuto del Consumidor a un despacho?** Si los clientes son personas jurídicas o abogados que contratan para su actividad, quizá no. Eso cambia el alcance de las cláusulas de reembolso y de responsabilidad.
4. **Límite de responsabilidad.** La cláusula actual solo dice qué no cubre. ¿Conviene un tope en dinero, y es exigible frente a consumidores?
5. **Portal del cliente.** Sigue pendiente (ver `revision-legal-portal.md`): si ALETHEIA y el despacho son corresponsables o ALETHEIA es encargada; si basta la autorización con un clic; qué pasa con los datos del cliente al revocar su acceso.
6. **Eliminación de casos.** ¿La confirmación expresa y la constancia en la auditoría bastan como prueba de que el despacho decidió borrar, y qué pasa si el cliente del despacho reclama después?
7. **Plazos y recordatorios.** ¿La advertencia de que no sustituyen la vigilancia de términos es suficiente para una herramienta que muestra plazos de casos?
8. **Reaceptación.** La fecha nueva obliga a aceptar de nuevo. ¿Conviene además un aviso por correo previo?
9. **Base de datos y registro.** Si el operador debe inscribir sus bases de datos en el Registro Nacional de Bases de Datos de la SIC.
10. **Conservación de comprobantes.** Por cuánto tiempo, y si el comprobante de ALETHEIA cumple como soporte mientras no se esté obligado a facturar (el contador lo confirma con el tope de 3.500 UVT).
