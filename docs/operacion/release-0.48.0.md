# Aletheia 0.48.0

**ALETHEIA estrena identidad: violeta tinta, una marca dibujada con geometría propia, una portada que muestra el producto y un espacio de trabajo que ya no salta al cargar.**

- **Identidad Tinta violeta (ADR-060).** El violeta pasa de `#820AD1`, idéntico al de Nubank, a un violeta tinta `#55278A`, con un latón que solo aparece donde hay sello o custodia. Geist reemplaza a Inter en la interfaz y Newsreader llega para los títulos editoriales. Los botones dejan el halo y los focos de luz desaparecen del sitio. Todos los colores cumplen WCAG AA en los dos modos.
- **Marca nueva.** El símbolo es un ojo con la pupila de latón. El emblema suma un anillo de 64 marcas, por los 64 caracteres de una huella SHA-256 en ocho grupos, una banda de guilloché y una leyenda. El logotipo está dibujado trazo por trazo, con las A como lambdas por la raíz griega del nombre. Todo sale de `src/brand/geometria.ts`, y `scripts/marca.mjs` genera los íconos, el favicon y los archivos. Las imágenes para compartir se rehicieron con la marca nueva.
- **Portada.** La foto de banco se reemplaza por una escena del producto. Una ficha de sello calcula su huella y se estampa, la cadena de custodia la acompaña y el emblema se dibuja al entrar. En escritorio las capas siguen al puntero y todo respeta el movimiento reducido. El fondo lleva un grabado de guilloché.
- **Menú.** Un indicador sigue al puntero por todas las opciones y un punto de latón marca la página actual. Los paneles llevan el grabado de la marca y una franja para empezar la prueba, y una línea bajo el encabezado avanza con la lectura. El grupo «ALETHEIA» pasa a llamarse «Nosotros».
- **Blog.** Cada artículo tiene una lámina ilustrada propia en SVG. El más reciente va destacado a todo el ancho y las tarjetas en 3:2 con títulos en serif.
- **Carruseles.** Cada captura va en un marco con una leve inclinación en 3D que se endereza al llegar. Los capítulos muestran el nombre de su diapositiva y el recorrido del producto usa pestañas con barra de tinta.
- **Imágenes.** Ya no quedan fotos de banco: el paso a paso, el carrusel, el ingreso y el pie usan láminas, el emblema o el grabado. Las siete capturas del producto se rehicieron con la identidad nueva, en 640, 1260 y 2520 px para pantallas retina.
- **Espacio de trabajo.** El CLS de las pantallas internas baja de entre 0,17 y 0,92 a 0, y a 0,075 en el inicio del panel. Los títulos bajan de tamaño, los indicadores pierden la sombra y las pestañas del caso usan una barra de tinta.
- **Sello de tiempo (ADR-059).** DigiCert y Sectigo quedan aceptados como autoridades de producción. Cierra el #149.
- **Rendimiento.** La carga inicial de la portada queda en 119,97 KB, dentro del presupuesto de 120.

## Al desplegar

1. No hay migraciones.
2. Los navegadores toman el favicon nuevo por el cambio de versión en los enlaces (`?v=4`).
