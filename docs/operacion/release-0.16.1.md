# Aletheia 0.16.1

- Portada: la fotografía principal se precarga desde el HTML con prioridad alta, en lugar de pedirse cuando React la dibuja. Antes empezaba a descargarse a los 1158 ms; ahora el navegador la pide en cuanto lee la página, lo que adelanta el contenido más grande visible. Las demás rutas, en una primera visita, también descargan esa foto (40 KB que quedan en caché).
- Accesibilidad táctil: los puntos del carrusel pasan de 12 × 4 px a una zona de 88 × 24 px (el mínimo de WCAG 2.2, criterio 2.5.8) y los enlaces sueltos del pie y de «Comparar los planes» miden al menos 28 px de alto, y 44 px en pantallas táctiles.
- Informe de la revisión de rendimiento y accesibilidad del sitio desplegado en `docs/operacion/rendimiento.md`, con lo que estaba bien, lo corregido, lo que falta medir y las recomendaciones (red de distribución, agrupar los íconos, medir con visitantes reales).
- El presupuesto de JavaScript no cambia: 119,25 KB de 120.

Esta versión no trae migraciones ni cambios en la API ni en el servidor.

Para verlo después de desplegar: abra https://aletheia.sbs con `Ctrl F5`; en las herramientas del navegador, pestaña Red, la foto `hero-real-1280.webp` debe empezar a descargarse junto al HTML y no después del script principal. Los puntos de abajo del carrusel se ven igual, pero ahora se tocan con más facilidad.
