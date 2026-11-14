# Versión 0.4.3

14 de noviembre de 2026.

## Cambios

- La portada presenta un emblema de custodia sin textos ni datos simulados: núcleo protegido, anillos, reflejos y órbitas de color con movimiento continuo. La animación no tiene control de pausa y conserva sus ciclos aunque el sistema solicite movimiento reducido.
- La cuenta propietaria de la plataforma entra a la consola administrativa. Su menú muestra cuentas, facturación, solicitudes de usuarios, auditoría, miembros de su propio despacho y su cuenta. No muestra el inicio jurídico, casos ni el formulario de soporte para clientes.
- Las rutas de casos y de soporte para clientes rechazan a la cuenta propietaria en la API. Las capacidades anunciadas en `/me` tampoco incluyen crear o leer casos para esa cuenta. Los demás roles conservan sus permisos del despacho.

## Verificación

- Compilar el frontend y ejecutar pruebas de navegación, permisos, contrato y estilo.
- Ejecutar Ruff, mypy y pruebas de backend en CI con PostgreSQL.
- En producción, comprobar navegación y acceso denegado a casos con la cuenta propietaria, y revisar el movimiento de la portada en escritorio y móvil.

La etiqueta firmada `v0.4.3` inicia la publicación. El entorno `production` requiere aprobación manual.
