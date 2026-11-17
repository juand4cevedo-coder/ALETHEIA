# Política de seguridad

ALETHEIA preserva evidencia digital para abogados en Colombia. Un reporte de seguridad serio se atiende con prioridad.

## Versiones con soporte

Solo recibe parches de seguridad la versión publicada en `main`, desplegada en producción. Las etiquetas anteriores no se mantienen.

## Cómo reportar una vulnerabilidad

No abras un issue público. Escribe a **contacto@aletheia.sbs** con:

- Una descripción clara del problema y su impacto.
- Los pasos para reproducirlo, o una prueba de concepto si aplica.
- La versión o el commit donde lo encontraste.

Confirmo la recepción dentro de 72 horas y te aviso cuando el parche esté desplegado. Pido no divulgar el detalle público hasta que la corrección esté en producción.

## Alcance

Cubre el código de este repositorio (`backend`, `frontend`, `infra`) y su despliegue en `aletheia.sbs`. Quedan fuera los servicios de terceros (AWS, GitHub, Hostinger) salvo que la causa esté en cómo ALETHEIA los usa.
