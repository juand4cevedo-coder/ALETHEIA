# Aletheia 0.33.1

- **El acceso con Google ya dice por qué falla.** Cuando Google devolvía a la persona a «No pudimos comprobar la identidad con Google», el servidor descartaba la causa sin dejar rastro. Ahora registra el motivo (cookie del flujo ausente o vencida, `state` distinto, o el código con que Google rechazó el intercambio, como `invalid_client` o `redirect_uri_mismatch`). Nunca se registra el cuerpo de la respuesta ni ningún secreto.
- No cambia el comportamiento hacia la persona ni hay migración. Sirve para diagnosticar el fallo de crear cuenta e ingresar con Google en producción.
