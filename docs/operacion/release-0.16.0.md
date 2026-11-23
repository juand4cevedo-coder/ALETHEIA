# Aletheia 0.16.0

- Portada: la fotografía se desplaza más lento que la página al bajar, un parallax suave que da profundidad. Es solo CSS (`animation-timeline: scroll()`), sin JavaScript, y solo donde el navegador lo admite y la persona no pidió movimiento reducido.
- Encabezado del sitio público: gana una línea y una sombra suave en cuanto la página empieza a moverse.
- Botones: la flecha del final avanza un poco al apuntarlos.
- Acabados: el violeta de la marca en la selección de texto y en los controles nativos, barra de desplazamiento más fina y mejor reparto del último renglón en los párrafos.
- El presupuesto de JavaScript no cambia: 119,26 KB de 120.

Esta versión no trae migraciones ni cambios en la API ni en el servidor.

Para verlo después de desplegar: abra la portada con `Ctrl F5` en un navegador reciente (Chrome o Edge) y desplácese despacio. La fotografía debe moverse más lento que el texto y el encabezado debe ganar su sombra. En un navegador sin soporte o con el movimiento reducido activado, la página se ve estática, como antes.
