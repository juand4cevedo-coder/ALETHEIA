# Vigilancia de la plataforma

El objetivo es enterarse antes de que algo falle y, si falla, enterarse en menos de cinco minutos. Hay tres capas:

1. **Métricas desde el servidor.** `infra/prod/metricas.sh` corre cada minuto y publica en CloudWatch, en el espacio `ALETHEIA/Produccion`: peticiones, errores 5xx, latencia p95, errores registrados por la API y por el trabajador, contenedores activos, memoria, disco y tiempo de respuesta de la salud. Sale de los registros JSON que la API ya escribe; no agrega dependencias ni toca la aplicación.
2. **Alarmas y panel en AWS.** `infra/aws/observabilidad.sh` crea las alarmas, un tema de avisos por correo y el panel `ALETHEIA`.
3. **Sonda externa.** Un flujo de GitHub (`.github/workflows/sonda.yml`) pide `https://aletheia.sbs/api/v1/health` cada 10 minutos desde fuera de AWS y revisa que el certificado no venza en menos de 10 días. Si falla, GitHub avisa por correo a quien administra el repositorio. Cubre lo que el servidor no puede ver de sí mismo: caída total, certificado vencido o DNS roto. No usa Route 53 porque el plan gratuito de AWS bloquea la región de Norte de Virginia, donde viven sus métricas.

## Alarmas

Avisan antes de la falla:

| Alarma | Se activa cuando |
| --- | --- |
| `aletheia-disco` | El disco pasa del 75 % |
| `aletheia-memoria` | La memoria pasa del 88 % durante 15 minutos |
| `aletheia-cpu` | La CPU pasa del 80 % durante 15 minutos |
| `aletheia-creditos-cpu` | Quedan menos de 40 créditos de CPU; la instancia se frenaría |
| `aletheia-latencia` | La latencia p95 de la API pasa de 1,5 s durante 15 minutos |
| `aletheia-correos-rebotados` y `aletheia-correos-quejas` | La reputación de SES se acerca al límite que suspende el envío |

Avisan de una falla en curso:

| Alarma | Se activa cuando |
| --- | --- |
| Flujo «Sonda externa» de GitHub | Desde fuera, el sitio no responde tras tres intentos, o el certificado vence en menos de 10 días |
| `aletheia-salud-api` | La API o la base no responden desde el servidor |
| `aletheia-sin-metricas` | El servidor dejó de publicar métricas: puede estar apagado |
| `aletheia-errores-5xx` | Cinco o más errores 5xx en cinco minutos, dos veces seguidas |
| `aletheia-errores-trabajador` | El trabajador registra errores sostenidos |
| `aletheia-contenedores` | Hay menos de cuatro contenedores activos |
| `aletheia-estado-instancia` | AWS marca la instancia con una comprobación fallida |

## Instalación, una sola vez

La hace la persona administradora. Cuesta cerca de 4 dólares al mes: nueve métricas propias y las alarmas que pasan de las diez gratuitas. El plan gratuito de AWS solo permite trabajar en Ohio, y el script no usa otra región.

**A. En AWS (CloudShell, región Ohio).**

1. Entre a la consola de AWS con el usuario administrador y MFA.
2. Verifique que arriba a la derecha dice «Ohio» (us-east-2). Abra CloudShell con el ícono `>_` de la barra superior.
3. Descargue el repositorio: `git clone --depth 1 https://github.com/juand4cevedo-coder/ALETHEIA.git`
4. Ejecute: `bash ALETHEIA/infra/aws/observabilidad.sh su-correo@ejemplo.com`
5. Abra su correo y confirme la suscripción de Amazon SNS. Sin ese clic no llega ningún aviso.

**B. En el servidor (Session Manager, como root).**

1. Actualice el repositorio del servidor: `cd /opt/aletheia && git fetch --tags && git checkout <última etiqueta>`
2. `cp infra/prod/systemd/aletheia-metricas.* /etc/systemd/system/`
3. `systemctl daemon-reload && systemctl enable --now aletheia-metricas.timer`
4. Pruebe una vez a mano: `systemctl start aletheia-metricas.service && journalctl -u aletheia-metricas -n 20`. No debe mostrar errores.
5. En la consola de CloudWatch, «Panel» > `ALETHEIA`: a los dos minutos deben verse puntos en todos los gráficos.

## Cómo se responde a un aviso

| Aviso | Primer paso |
| --- | --- |
| Sonda externa o salud de la API | `docker compose ps` en el servidor; si un contenedor cayó, `journalctl` y los registros de ese contenedor; si fue un despliegue, `desplegar.sh revertir` |
| Errores 5xx | Buscar `"level": "ERROR"` en los registros de la API; cada uno trae su `request_id` |
| Disco | Revisar el volumen de PostgreSQL y las imágenes viejas de Docker: `docker image prune` |
| Memoria o créditos de CPU | Ver qué contenedor consume más con `docker stats`; si es sostenido, subir a una instancia mayor |
| Correos | Revisar en SES los rebotes y quejas antes de que AWS suspenda el envío |

## Pendiente

- Una alarma de respaldo vencido con `respaldar.sh --revisar`.
- Un panel de métricas del negocio (casos, evidencias, uso por despacho) dentro del producto.
