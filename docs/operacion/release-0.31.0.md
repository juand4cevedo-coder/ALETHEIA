# Aletheia 0.31.0

- **Portal del cliente según el estado del despacho.** Hasta ahora el portal comprobaba que el despacho estuviera activo solo al abrirlo, no al descargar un documento ni al aceptar el aviso, y trataba el plan vencido (solo lectura) como si el despacho estuviera cerrado. Ahora: con el plan vencido el cliente puede seguir leyendo y descargando pero no escribir mensajes, y con el despacho suspendido o cerrado el portal deja de servir en todas sus rutas, incluida la descarga de documentos. Pedir un enlace nuevo sigue respondiendo lo mismo en todos los casos.
- **Segundo factor.** El dibujo del QR ya no se borra desde dentro de un efecto de React (aviso de calidad pendiente desde la 0.20): se guarda junto al enlace del que salió y deja de valer si el enlace cambia.
- Sin migración ni rutas nuevas.

Para verlo después de desplegar: con un cliente de prueba, el portal debe seguir funcionando igual con el despacho activo. Con el plan del despacho de prueba vencido, el cliente puede ver sus avisos y descargar documentos, pero al escribir un mensaje el enlace le responde que ya no sirve.
