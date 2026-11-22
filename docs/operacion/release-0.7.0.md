# Aletheia 0.7.0

- Nueva identidad visual coherente en el sitio público, el acceso y los paneles internos: una sola paleta violeta en `tokens.css`, un símbolo nuevo (un ojo sobre un recuadro violeta), favicon de tres tamaños, íconos instalables e imagen social. Se corrigieron variables CSS sin definir que dejaban sin fondo el avatar y quitaban márgenes, y una prueba impide que vuelva a pasar.
- Las ventanas aparecen y se cierran con una transición; en el celular suben desde abajo como una hoja. Cada cambio de página entra con un fundido corto y los botones responden al tacto. Los filtros de las listas de plataforma se pliegan en el celular.
- Carga más rápida: las fotografías pasan de unos 350 KB a entre 17 y 70 KB en tres anchos WebP, se retira la fuente con serif, el pool de conexiones de la API queda dimensionado de forma explícita y quien tiene sesión precarga el espacio de trabajo.
- Seguridad de borde: Caddy corta en 1 MiB todo cuerpo hacia la API, salvo la subida de evidencias, que admite hasta 2,2 GB. Las fotografías y la marca se guardan una semana en el navegador y se publica `security.txt`. La prueba de humo posterior al despliegue comprueba esos tres puntos.
- Operación: respaldo diario de PostgreSQL hacia S3 con su temporizador (`infra/prod/respaldar.sh`), revisión de solo lectura de la cuenta de AWS (`infra/prod/auditar-aws.sh`), rol de auditoría sin acceso a datos y guía de credenciales.
- El acceso con Google es obligatorio para desplegar en producción: el despliegue se niega a continuar, o revierte, si falta el ID del cliente, el parámetro del secreto o si el estado de Google no queda habilitado.
- Documentación: ADR-049 con la identidad vigente, guía de identidad y de imágenes actualizadas, y retiro de los documentos de proceso del rediseño anterior.

Después de desplegar hay dos tareas manuales en el servidor: instalar el temporizador del respaldo (pasos en `docs/operacion/produccion.md`) y probar una restauración. El respaldo diario no corre solo hasta que se instale.
