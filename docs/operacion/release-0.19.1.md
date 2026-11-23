# Aletheia 0.19.1

- Se enciende la red de distribución (ADR-051): con la variable de repositorio `CDN_URL` definida como `https://cdn.aletheia.sbs`, esta versión se construye pidiendo el JavaScript, las fuentes, el CSS y las imágenes de `/assets/`, `/media/` y `/brand/` a `cdn.aletheia.sbs`. El HTML, el manifiesto, los íconos y la API siguen saliendo de `aletheia.sbs`.
- No hay cambios de código respecto de la 0.19.0: solo cambia la construcción de la imagen web por la variable.
- Medición de partida, sin la red de distribución (Lighthouse 12, móvil, Inicio, tres corridas sobre la 0.19.0): rendimiento 98, FCP 1,6 a 1,7 s, LCP 2,0 a 2,1 s, TBT 90 a 100 ms, CLS 0, 554 KB transferidos.

Esta versión no trae migraciones ni cambios en la API.

Para verlo después de desplegar: abra https://aletheia.sbs con `Ctrl F5` y, en la pestaña Red de las herramientas del navegador, compruebe que `index-*.js`, las fuentes y las fotografías se piden a `cdn.aletheia.sbs` y que la consola no muestra errores de CSP ni de CORS. Recargue una segunda vez: los archivos deben llegar con `x-cache: Hit from cloudfront`. Compare con las cifras de arriba corriendo Lighthouse otra vez.

Para deshacerlo: borrar la variable `CDN_URL` en GitHub y publicar una versión nueva; el sitio vuelve a servir todo del origen.
