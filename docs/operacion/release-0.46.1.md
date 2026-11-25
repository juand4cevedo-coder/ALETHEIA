# Aletheia 0.46.1

**Corrige la prueba de humo que devolvió la 0.46.0 a la versión anterior.**

- **Prueba de humo.** La 0.46.0 se desplegó bien, pero la comprobación del `noindex` en la página 404 marcó falla sin haberla. Con `pipefail`, `grep --quiet` cierra el tubo al encontrar la etiqueta, curl termina con el código 23 y el resultado del tubo cuenta como error. Ahora la página se guarda primero y luego se busca la etiqueta, como en las demás comprobaciones.
- El resto del contenido es el de la 0.46.0.

## Al desplegar

1. Las migraciones 0062 a 0065 corren solas, igual que en la 0.46.0.
2. La prueba de humo debe pasar completa, incluida la línea "la página 404 lleva noindex".
