# Aletheia 0.19.0

- Red de distribución para los archivos estáticos (ADR-051). El sitio sabe pedir el JavaScript, las fuentes y las imágenes a `cdn.aletheia.sbs`, la distribución de CloudFront que ya está creada y responde. En esta versión el interruptor queda apagado: el sitio sigue sirviendo todo desde el servidor de siempre, así que no cambia nada para quien lo visita.
- Cómo funciona el interruptor: al construir la imagen web, `VITE_CDN_URL` reescribe las direcciones de `/assets/`, `/media/` y `/brand/`. Íconos, manifiesto, HTML y API no pasan por la red de distribución. `publicar.yml` toma el valor de la variable de repositorio `CDN_URL`; sin definir, todo sale del mismo origen.
- CSP de Caddy: ahora admite `https://cdn.aletheia.sbs` en `script-src`, `style-src`, `img-src` y `font-src`. Es la única excepción a «solo el mismo origen». Esto sí se despliega con la versión.
- `infra/aws/cdn.sh`: corregido el nombre del parámetro de vigencia de CORS (`AccessControlMaxAgeSec`), que hacía fallar el paso 2/4 al crear la distribución desde cero.
- Presupuesto de JavaScript inicial: 119,63 KB de 120.

Esta versión no trae migraciones ni cambios en la API. Cambia la imagen web (Caddy, con el CSP nuevo).

Para verlo después de desplegar: abra https://aletheia.sbs con `Ctrl F5`; el sitio debe verse y funcionar igual que antes, y la consola no debe mostrar errores. Compruebe el CSP con `curl -sI https://aletheia.sbs | grep -i content-security` y verifique que incluye `https://cdn.aletheia.sbs`.

Para encender la red de distribución (en un paso aparte, para medir antes y después): cree la variable de repositorio `CDN_URL` con el valor `https://cdn.aletheia.sbs` y publique la versión siguiente. La guía completa, con la comprobación y cómo deshacerlo, está en `docs/operacion/produccion.md`, sección «Red de distribución».
