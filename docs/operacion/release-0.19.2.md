# Aletheia 0.19.2

- Precarga de la conexión a la red de distribución: con `CDN_URL` activa, el `index.html` declara al principio del `head` dos `preconnect` a `cdn.aletheia.sbs`, uno con `crossorigin` (para el script y las fuentes) y otro sin él (para las imágenes). El navegador abre conexiones distintas para cada caso, y cada una paga su saludo de DNS, TCP y TLS; así esos saludos corren mientras baja el HTML y no después. Sin `CDN_URL`, el HTML no cambia.
- Motivo: la medición de Lighthouse sobre la 0.19.1 (CDN encendido) bajó de 98 a 88-90 en móvil, con el FCP de 1,7 a 2,6 s y el LCP de 2,1 a 3,1 s. Una prueba con `curl` desde Colombia mostró lo contrario para una conexión real: el archivo principal llega en 0,45 a 0,7 s desde el nodo de Bogotá, contra 0,8 a 1,2 s desde el servidor de Ohio. Esta versión busca recuperar la medición de laboratorio sin perder esa ganancia.
- Presupuesto de JavaScript inicial: sin cambios (119,63 KB de 120).

Esta versión no trae migraciones ni cambios en la API.

Para verlo después de desplegar: abra https://aletheia.sbs con `Ctrl F5` y revise el código fuente de la página: las dos líneas `rel="preconnect"` deben ser lo primero del `head`. Corra Lighthouse en móvil sobre la portada y compare con las cifras de la 0.19.1 y las de antes del CDN (98, FCP 1,7 s, LCP 2,1 s). Si el resultado sigue por debajo del 98, la decisión queda entre dejar el CDN por la ganancia real para el visitante o apagarlo borrando la variable `CDN_URL`.
