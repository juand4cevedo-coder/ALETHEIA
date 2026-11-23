# Aletheia 0.20.1

- Más margen en el presupuesto de JavaScript inicial: pasa de 119,52 KB a 118,52 KB de 120. Los íconos de los cuatro grupos del menú (Producto, Equipos, Recursos y Aletheia) y el detalle de un grupo en el menú móvil ya no viajan con la entrada del sitio: se descargan cuando se abre un menú. El menú móvil empieza a cargar el detalle al tocar el botón «Menú», para que al elegir un grupo ya esté listo.
- Lo que se midió: de los 255 KB de la entrada (80,8 KB comprimidos), 207 KB son `react-dom` y otros 74 KB `react-router`; el código propio que queda en la entrada es de unos 10 KB comprimidos. Sin cambiar de marco no hay mucho más que recuperar. La página de error y de «no encontrada» se queda en la entrada a propósito: existe justamente para cuando falla la descarga de otro archivo.
- Sin cambios visibles.

Esta versión no trae migraciones ni cambios en la API ni en el servidor.

Para verlo después de desplegar: abra https://aletheia.sbs con `Ctrl F5` desde un teléfono (o con la vista de teléfono de las herramientas del navegador), pulse «Menú», toque «Producto»: debe verse el ícono, el título y sus opciones, y «Volver al menú principal» debe regresar a la lista. En el menú de escritorio, al pasar el cursor por «Producto», el panel debe mostrar su ícono y la captura como antes.
