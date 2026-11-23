# Aletheia 0.9.1

- Vigilancia solo en Ohio: el plan gratuito de AWS bloquea Norte de Virginia, así que la sonda externa pasa a un flujo programado de GitHub (`sonda.yml`) que revisa la salud de la API y el certificado cada 10 minutos y abre una incidencia con la etiqueta `sonda-externa` si falla.
- Alarma de respaldo vencido: el servidor publica la edad del último respaldo y AWS avisa si pasa de 26 horas.
- Respaldos: el servicio corre con `bash` y los scripts quedan ejecutables. Nuevo `ensayar-restauracion.sh`, que restaura una copia en una base temporal y compara esquema y filas sin tocar producción. El primer ensayo, sobre la 0.9.0, salió correcto.
- Presupuesto mensual `aletheia-mensual` (30 USD, sin contar créditos) con avisos al 50 % y 80 %, y recordatorios abiertos para rotar la llave de despliegue y pasar la cuenta a un plan de pago.

Esta versión no trae migraciones ni cambios en la aplicación.

Después de desplegar: volver a ejecutar `infra/aws/observabilidad.sh` en CloudShell para crear la alarma de respaldo, y copiar las unidades de systemd actualizadas en el servidor (`cp /opt/aletheia/infra/prod/systemd/* /etc/systemd/system/ && systemctl daemon-reload`).
