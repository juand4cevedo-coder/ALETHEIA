# Aletheia 0.49.0

**El sitio y el espacio de trabajo cambian de cara: modo claro lavanda y crema, fotos de abogados, el emblema como logo en todas partes y textos que hablan de lo que el abogado gana.**

- **Logo y favicon.** El emblema aprobado reemplaza al cuadro violeta con un ojo, que se confundía con el logo anterior. Va reducido en el menú, en los íconos de la aplicación, en el logo de los correos y en el comprobante, y en su versión mínima en la pestaña del navegador. Todos los enlaces a íconos, al manifiesto y a la marca pasan a `?v=5` para que los navegadores dejen de mostrar el ícono guardado.
- **Modo claro.** El fondo deja el blanco plano: es lavanda suave, algunas bandas van en crema y las tarjetas blancas se levantan con sombras de tinte violeta. Entre una banda y otra el color pasa con un degradado.
- **Fotos.** Doce fotos de Unsplash con licencia gratuita, casi todas de la misma sesión, en WebP de 640 a 2560 px. La guía de imágenes registra autor y fuente de cada una.
- **Portada.** Abre con un equipo joven de abogados a pantalla completa y el título «Sus pruebas digitales, listas para el juzgado». Siguen tres beneficios con foto, una cinta con las áreas del derecho, cifras que cuentan solas, el recorrido del producto, el equipo, los planes, las preguntas y un cierre con la foto de una firma. La huella, la cadena, el comprobador y las normas salen de la portada y siguen en sus páginas.
- **Menú.** Es una píldora de vidrio que flota separada del borde. Los paneles de Equipos y Nosotros llevan fotos.
- **Ingreso y registro.** El panel izquierdo muestra una foto bajo la tinta de la marca. Crear la cuenta con correo es un botón del mismo peso que Google, con un separador.
- **Aviso de cookies.** Es una tarjeta flotante en la esquina en lugar de una franja de borde a borde.
- **Espacio de trabajo.** El inicio abre con una bienvenida sobre la foto de un despacho. Todos los títulos de pantalla y de panel usan la serif de la marca y las cifras de los indicadores van en serif violeta. Las pestañas del caso se llaman Historial, Pruebas y Expediente.
- **Blog y precios.** Cada artículo lleva una foto de portada. La entrada de precios explica lo que traen los planes sin tecnicismos.
- **Capturas del producto.** Las siete se rehicieron con el diseño nuevo, en 640, 1260 y 2520 px.
- **Rendimiento.** Las animaciones de la portada son CSS y la carga inicial queda en 119,97 KB, dentro del presupuesto de 120.

## Al desplegar

1. No hay migraciones.
2. Los navegadores piden el favicon, los íconos y la marca nuevos por el cambio a `?v=5`.
