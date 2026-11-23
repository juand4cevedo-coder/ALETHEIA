# Aletheia 0.8.0

- Calendario de plazos en el espacio de trabajo: vista mensual con las tareas con fecha de los casos abiertos que cada persona ve, en hora de Colombia, con el detalle de cada día y una descarga en formato `.ics` para llevarlas al calendario personal. El asistente solo ve las suyas.
- Notas internas en cada caso: texto libre de quien lleva el expediente, fuera de la cadena de custodia. Solo se agregan; una corrección es una nota nueva. La auditoría registra cada nota con su tamaño y no copia el texto, y un caso archivado conserva sus notas sin admitir nuevas.
- La auditoría de seguridad del despacho se descarga en CSV con los mismos filtros de la lista, hasta 5000 eventos, con las celdas protegidas contra fórmulas de hoja de cálculo. La descarga renueva la sesión si el acceso venció y avisa cuando se recorta.
- Paleta de comandos con `Ctrl K`: salta a cualquier pantalla del rol o a un caso con unas letras. Zona de carga de evidencia con arrastre, nombre, tamaño y barra de avance. Íconos en las tarjetas del tablero.
- Navegación pública con indicador que se desliza, panel flotante con velo y entrada escalonada; carrusel con cruce suave, flechas, teclado y deslizamiento; capturas del producto rehechas con el diseño vigente, sin imágenes repetidas, e íconos en peso duotone.
- Análisis de competidores y hoja de ruta por rol en `docs/producto/`.

Esta versión incluye una migración (0034, tabla `case_notes`). El despliegue la aplica antes de actualizar la API y no se revierte; la API anterior sigue funcionando con la tabla extra.

Las notas todavía no entran al paquete de preservación.
