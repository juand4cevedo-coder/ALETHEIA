# Aletheia 0.26.0

- Aviso de novedades al cliente (ADR-054). Cuando el despacho publica un aviso o sube un documento, los clientes con acceso vigente que ya aceptaron el aviso de datos reciben un correo que dice que hay novedades en su espacio y lleva a su enlace. El correo no copia el aviso ni nombra el archivo ni el caso, porque viaja fuera de ALETHEIA. Varios cambios seguidos se juntan en un solo correo por cliente por hora. Quien no entró todavía o ya no tiene acceso no recibe nada.
- La pestaña «Portal del cliente» lo dice junto al campo de avisos y al subir documentos, para que el abogado sepa qué le llega al cliente.
- No hay migración ni rutas nuevas.

Para verlo después de desplegar: con un cliente de prueba que ya aceptó el aviso, publique un aviso desde la pestaña del caso. Al correo del cliente debe llegar «Hay novedades en su espacio de …», sin el texto del aviso. Publique otro de inmediato: no debe llegar un segundo correo en esa hora.
