# Aletheia 0.42.2

- **El contenedor recibe la configuración de la renovación automática.** `compose.prod.yaml` no pasaba `ALETHEIA_RECURRING_PAYMENTS_ENABLED` ni `ALETHEIA_UVT_VALUE_COP` a la API ni al trabajador, así que cambiarlas en `/etc/aletheia/entorno.env` no tenía efecto. Ahora se pasan, con la renovación automática apagada (`false`) y la UVT en 52.374 por omisión. La API y el trabajador comparten la misma configuración.
- Sin cambios de comportamiento mientras `entorno.env` no diga lo contrario. Sin migración.

**Para encender la renovación automática:** agregar `ALETHEIA_RECURRING_PAYMENTS_ENABLED=true` a `/etc/aletheia/entorno.env` y volver a levantar la API y el trabajador. Para apagarla, ponerla en `false` (los cobros ya agendados no se hacen mientras esté apagada, y las fuentes vinculadas se conservan).
**Para cambiar el valor de la UVT:** `ALETHEIA_UVT_VALUE_COP=<valor>` en el mismo archivo.
