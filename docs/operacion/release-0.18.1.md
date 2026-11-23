# Aletheia 0.18.1

- Capturas del producto en dos anchos: las siete capturas (1260 px) tienen ahora una variante de 640 px, un 70 % más liviana, y el carrusel, el recorrido del producto y el menú de escritorio eligen el tamaño según la pantalla con `srcset` y `sizes`. Un teléfono, que las dibuja a unos 340 px, deja de descargar la versión grande. Lighthouse había señalado 219 KB de ahorro posible.
- Medición con Lighthouse sobre el sitio desplegado (versión 0.18.0): rendimiento 98 en móvil y 100 de accesibilidad, prácticas y SEO, con un CLS de 0. El informe, con la tabla de resultados y lo que se dejó señalado (JavaScript sin usar en el archivo de entrada, retraso de pintado por dibujar la página en el navegador), está en `docs/operacion/rendimiento.md`.
- Presupuesto de JavaScript inicial: 119,61 KB de 120.

Esta versión no trae migraciones ni cambios en la API ni en el servidor.

Para verlo después de desplegar: abra https://aletheia.sbs desde un teléfono (o con la vista de teléfono de las herramientas del navegador), desplácese hasta el carrusel y, en la pestaña Red, compruebe que las capturas se piden con el sufijo `-640.webp`. Vuelva a correr Lighthouse en móvil para comparar con el 98 de antes: el peso transferido de la portada debe bajar.
