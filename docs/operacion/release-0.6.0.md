# Aletheia 0.6.0

- La cuenta propietaria de la plataforma queda separada del trabajo de los despachos: administra cuentas, planes, soporte y auditoría sin recibir acceso a expedientes. Sus listados incorporan búsqueda y filtros de servidor.
- El acceso social se concentra en Google mediante Authorization Code, PKCE, `state` y `nonce`. La vinculación exige una sesión autenticada y no asocia cuentas solo por compartir correo.
- Cerrar un caso lo mueve al archivo histórico sin borrar evidencias, llaves ni eventos. El archivo incorpora búsqueda, filtros de conservación, bloqueo jurídico, revisión y reapertura trazable.
- Los casos incorporan tareas, responsables, prioridades, vencimientos y bandejas diferenciadas para propietario, administrador, abogado y asistente.
- La cadena de custodia puede anclarse mediante RFC 3161 al exportar y de forma periódica. La verificación indica hasta qué evento llega el último anclaje sin exponer el token criptográfico.
- La persona puede solicitar el cierre de su cuenta; sus datos identificadores se anonimizan mientras los registros que deban conservarse mantienen su trazabilidad.
- Se aplica la identidad visual aprobada de Aletheia al símbolo, favicon, iconos instalables y recursos de correo, junto con mejoras de navegación, acceso, responsive y legibilidad.

La activación efectiva de Google y la validación operativa de DigiCert o Sectigo dependen de configurar y comprobar sus credenciales y condiciones en producción. Esta versión no presenta esas validaciones externas como realizadas.
