# Producción en AWS

Registro de la infraestructura de producción de ALETHEIA según ADR-017 y de su despliegue según ADR-018: qué existe, cómo quedó configurado y cómo se comprobó. Aquí no hay claves, contraseñas ni llaves privadas. Las claves viven en Parameter Store y la llave SSH solo en el equipo del administrador.

Los identificadores reales de la cuenta (ID de cuenta, IP elástica, ARN de KMS, ID de instancia, nombres de bucket) se mantienen en el runbook interno, fuera de este repositorio público, porque identifican la infraestructura en producción. Esta página documenta el diseño y las comprobaciones sin exponer esos valores.

Última actualización: 17/11/2026, con el endurecimiento de PostgreSQL y de la red `frontal` de la auditoría de seguridad.

## Cuenta y costos

| Elemento | Valor |
| --- | --- |
| Cuenta | Plan gratuito de AWS, con MFA activado |
| Región | us-east-2 (Ohio) |
| Créditos | 200 USD después de completar las cinco actividades de bienvenida. El plan gratuito vence el 29/04/2027 |
| Presupuesto | `aletheia-mensual`: 30 USD al mes sin contar créditos, con alertas al 50 y al 80 % |

## Instancia

| Elemento | Valor |
| --- | --- |
| Nombre | `aletheia-prod` |
| Tipo | t3.small x86 (2 vCPU y 2 GB) |
| Sistema | Debian 13 (trixie), kernel `6.12.113+deb13-cloud-amd64` |
| Disco | EBS gp3 de 30 GiB |
| IP elástica | Fija, reservada para el dominio; el valor real está en el runbook interno |
| Metadatos | IMDSv2 obligatorio, con límite de saltos 2 para que los contenedores reciban las credenciales del rol |
| Perfil de instancia | `aletheia-prod-instancia` |
| Grupo de seguridad | `aletheia-prod-sg`: el 22 solo desde la IP pública del administrador, nunca desde `0.0.0.0/0`; el 80 y el 443 abiertos a internet para Caddy |

## Acceso por SSH

- Usuario `admin`, solo con llave y frase de paso. Sin contraseña y sin acceso directo como root: lo fija `/etc/ssh/sshd_config.d/10-aletheia.conf`.
- La dirección del servidor y la ruta de la llave están en el runbook interno. Esa llave solo sirve para el servidor; la que firma commits y etiquetas es otra.
- Si el 22 deja de responder y no se puede corregir a tiempo, Session Manager abre una consola desde el navegador: EC2 > Instances > `aletheia-prod` > Connect > Session Manager.
- Si la conexión da timeout, casi siempre cambió la IP pública del administrador. Se corrige en EC2 > Security Groups > `aletheia-prod-sg` > Edit inbound rules: en la regla del puerto 22, Source pasa a My IP.
- En la actualización completa del sistema se conservó el `sshd_config` local. La versión que traía el paquete quedó en `/etc/ssh/sshd_config.ucf-dist`.
- Los comandos de Linux funcionan solo dentro del servidor, después de que `ssh` conecta. En PowerShell fallan.

## Red y DNS

- El dominio se compró en Hostinger y su DNS sigue ahí: el registro `A` apunta a la IP elástica del servidor y `CNAME www` al dominio principal, los dos con TTL de 300 segundos. El certificado lo saca Caddy; la sección SSL de Hostinger no aplica.
- El correo también depende de este DNS. Hostinger publica el MX, el SPF de la raíz y las firmas `hostingermail-*` del buzón de contacto. Amazon SES usa tres CNAME `*._domainkey` hacia `dkim.amazonses.com`, y `bounce` lleva su propio MX y su SPF, así que el SPF de la raíz no se toca. El único DMARC es `_dmarc`, con `p=none` y los informes dirigidos al buzón de contacto.
- No hay registros AAAA ni CAA. Un AAAA que apunte a otra parte hace fallar la validación de Let's Encrypt, y la máquina no tiene IPv6.
- LLMNR y mDNS quedaron apagados en `/etc/systemd/resolved.conf.d/10-aletheia.conf`. Venían activos en la imagen de Debian y no tienen función en un servidor en la nube.

## Docker

- Docker Engine 29.9.2 y Compose v5.6.1, instalados desde el repositorio oficial de apt (`/etc/apt/sources.list.d/docker.sources`). Son las mismas versiones de desarrollo: cuando se actualiza uno, se actualiza el otro.
- Arranca con la máquina, y `admin` pertenece al grupo `docker`.
- `/etc/docker/daemon.json` deja registros locales con rotación, para que no llenen el disco. Con `live-restore`, los contenedores siguen corriendo mientras se reinicia el servicio de Docker:

```json
{
  "log-driver": "local",
  "log-opts": { "max-size": "10m", "max-file": "3" },
  "live-restore": true
}
```

## Amazon S3

| Bucket | Uso | Reglas de ciclo de vida |
| --- | --- | --- |
| Evidencias (nombre real en el runbook interno) | Evidencias cifradas y paquetes exportados | `borrar-subidas-incompletas`: descarta al día las subidas que no terminaron |
| Respaldos (nombre real en el runbook interno) | Copias diarias de PostgreSQL (TT-011) | `borrar-subidas-incompletas` y `retencion-7-dias`: borra cada copia a los 7 días |

Los dos buckets tienen el acceso público bloqueado, las ACL desactivadas y cifrado SSE-S3. No usan versionado ni Object Lock. La política `SoloHTTPS` rechaza toda petición que no llegue por TLS.

Hay dos detalles que el código debe tener en cuenta:

- Como el rol no puede listar el bucket de evidencias, S3 responde 403 y no 404 cuando un objeto no existe. El adaptador de almacenamiento lo trata como no encontrado.
- La regla de 7 días cuenta hasta la medianoche UTC siguiente y AWS borra con demora. TT-011 fija un margen para `backups_expire_at` (Arquitectura 8.11).

## AWS KMS

| Elemento | Valor |
| --- | --- |
| Alias | `alias/aletheia-prod-maestra` |
| ARN | En el runbook interno |
| Tipo | RSA_3072, uso cifrar y descifrar, una sola región |
| Política de la llave | La predeterminada: los permisos se conceden por IAM |
| Uso | Envolver con `RSAES_OAEP_SHA_256` la llave de cada caso (ADR-014) |
| Operaciones | La API llama a `Encrypt` al abrir un caso y llamará a `Decrypt` al leer su evidencia, siempre con `RSAES_OAEP_SHA_256`. En producción no hay llave local: la API rechaza `ALETHEIA_LOCAL_KEY_PATH` |

## Amazon SES

| Elemento | Valor |
| --- | --- |
| Identidad | El dominio de producción, verificado el 01/11/2026 en us-east-2 |
| Autenticación | Easy DKIM con llaves de 2048 bits, MAIL FROM `bounce.<dominio>` y DMARC. Gmail confirmó SPF, DKIM y DMARC en `PASS` |
| Remitente | `ALETHEIA`, con las respuestas al buzón de contacto |
| Envío | Solo el trabajador, con la API v2 y el rol de la máquina. No hay credenciales SMTP |
| Lista de supresión | La de la cuenta, activa para rebotes y quejas |
| Plan | Essentials, que cobra 0,16 USD por cada 1.000 correos y se paga con los créditos |
| Producción | Acceso de producción habilitado y envío activo, comprobados el 13/11/2026 con `sesv2:GetAccount`; cuota actual de 50.000 mensajes al día y 14 por segundo |

En desarrollo y en la CI el correo va a Mailpit y nunca sale a internet; la regla vive en `app/adapters/email.py` y depende solo de `ALETHEIA_ENVIRONMENT`.

## IAM

El rol `aletheia-prod-instancia` tiene tres políticas: `aletheia-prod-acceso` para los datos, `aletheia-prod-correo` para enviar correo y `aletheia-ssm-agente` para Systems Manager. Llega a la máquina por el perfil de instancia del mismo nombre. Nada que no esté en esta tabla está permitido.

| Servicio | Recurso | Permitido |
| --- | --- | --- |
| S3 | Bucket de evidencias | `GetObject`, `PutObject`, `DeleteObject` y `AbortMultipartUpload`. No puede listar |
| S3 | Bucket de respaldos | `GetObject`, `PutObject`, `AbortMultipartUpload` y `ListBucket`. No puede borrar |
| KMS | La llave maestra | `Encrypt` y `Decrypt`, solo con `RSAES_OAEP_SHA_256` |
| Parameter Store | Parámetros bajo `/aletheia/prod/` | `GetParameter`, `GetParameters` y `GetParametersByPath`. No puede escribir |
| SES | Identidades de la cuenta en us-east-2 | `SendEmail` con la API v2, solo desde el remitente de notificaciones y con el nombre `ALETHEIA` |
| Systems Manager | El agente de la máquina | Registrarse, recibir órdenes de Run Command y abrir sesiones de Session Manager (`ec2messages` y `ssmmessages`) |

La política de correo aún nombra todas las identidades de la cuenta: se configuró así cuando SES estaba en sandbox y exigía autorización sobre la identidad del destinatario. SES ya tiene acceso de producción. Las condiciones `ses:FromAddress`, `ses:FromDisplayName` y `ses:ApiVersion` restringen el remitente; el alcance de `Resource` puede reducirse en una revisión separada, con una prueba de envío después del cambio.

Desde HU-015 la API llama a `Encrypt` de KMS cada vez que se abre un caso. HU-018, publicada en v0.4.4, usa `Decrypt` para abrir la llave de ese caso antes de cifrar una evidencia. Si KMS no responde o niega la operación, la API devuelve 503 sin registrar la evidencia; al abrir un caso también evita dejar filas incompletas.

El sello externo RFC 3161 de cada evidencia (HU-020) ya pide el sello a DigiCert, con Sectigo como respaldo, en una tarea `tsa_stamp` que se encola al subir la evidencia (`app/adapters/stamping.py`, `app/services/evidence_stamp.py`). La construcción de cada paquete también sella la cabeza exacta de la cadena que incorpora, persiste el token con su número de evento y huella, y lo incluye como `custody/head.tsr`. Sigue pendiente el anclaje periódico diario cuando una cadena cambie sin que se solicite un paquete (ADR-037); eso necesita un disparador recurrente.

La versión `v1` de la política administrada `aletheia-prod-acceso` nombra el ARN de la llave, restringe el algoritmo a `RSAES_OAEP_SHA_256` y autoriza `Encrypt` y `Decrypt`. Se comprobó en AWS el 13/11/2026. `Encrypt` recibe el alias como `KeyId`; `Decrypt` recibe el ARN guardado con cada caso.

### Comprobación de KMS para HU-015

**Aprobada el 13/11/2026.** Una orden de SSM se ejecutó en `aletheia-prod` con su rol de instancia: cifró bytes aleatorios mediante el alias, los descifró mediante el ARN, comparó ambos archivos sin mostrarlos y eliminó los temporales. Terminó con código 0 y `KMS_WRAP_UNWRAP_OK`. El procedimiento paso a paso y los identificadores de la prueba están en el runbook interno.

Si una repetición responde `AccessDeniedException`, se revisa la política `aletheia-prod-acceso` y la política de la llave antes de publicar.

Para leer un `SecureString` cifrado con la llave `aws/ssm`, el rol no necesita permisos adicionales de KMS.

`aletheia-ssm-agente` reemplaza a la política administrada `AmazonSSMManagedInstanceCore`, que se descartó porque da `ssm:GetParameter` sobre todos los parámetros de la cuenta.

### Usuario de despliegue

GitHub Actions no puede usar OIDC: la política de control de servicios del plan gratuito niega crear proveedores de identidad y no se puede modificar (ADR-018). Por eso el despliegue usa un usuario de IAM propio.

| Elemento | Valor |
| --- | --- |
| Usuario | `/ci/aletheia-github-deploy`, sin consola, con etiquetas `proyecto=aletheia` y `uso=despliegue` |
| Política insertada | `aletheia-despliegue-ssm`: `ssm:SendCommand` solo con el documento `aletheia-desplegar` y solo sobre `aletheia-prod`, más `ssm:GetCommandInvocation` |
| Llave | Una sola, guardada como secretos `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY` del entorno `production` de GitHub |
| Comprobación | El simulador de IAM, con la región de Ohio como contexto, da `allowed` con `aletheia-desplegar` e `implicitDeny` con `AWS-RunShellScript` |

La llave se rota al publicar v1.0.0 y ante cualquier sospecha. El procedimiento de rotación está en el runbook interno. Cada llamada del usuario queda en el historial de eventos de CloudTrail, que es gratuito y guarda 90 días.

## Parameter Store

| Parámetro | Tipo | Para qué |
| --- | --- | --- |
| `/aletheia/prod/postgres/admin-password` | SecureString (`aws/ssm`) | Administrador `aletheia`: primer arranque y tareas manuales |
| `/aletheia/prod/postgres/owner-password` | SecureString (`aws/ssm`) | `aletheia_owner`: migraciones |
| `/aletheia/prod/postgres/app-password` | SecureString (`aws/ssm`) | `aletheia_app`: API y trabajador |
| `/aletheia/prod/postgres/support-password` | SecureString (`aws/ssm`) | `aletheia_support`: consultas de solo lectura |
| `/aletheia/prod/app/token-signing-key` | SecureString (`aws/ssm`) | Clave de firma de los enlaces de un solo uso: API y trabajador |
| `/aletheia/prod/google/client-secret` | SecureString (`aws/ssm`) | Secreto OIDC de Google; se crea solo al activar la integración |

Las claves se generaron en CloudShell con 40 letras y números, por una tubería directo a AWS, así que nunca aparecieron en pantalla, en el historial ni como argumento de un comando. El procedimiento exacto está en el runbook interno.

## PostgreSQL

- `infra/compose.prod.yaml` define el proyecto `aletheia-prod` con PostgreSQL 18.6, la misma versión de desarrollo y de la CI. No publica puertos y guarda los datos en el volumen `aletheia-prod_postgres-data`, sobre el disco EBS. El healthcheck consulta por TCP y el contenedor se reinicia solo (`unless-stopped`).
- El servidor tiene una copia del repositorio en `/opt/aletheia`, clonada por HTTPS y sin credenciales de GitHub. Pertenece a root, porque la maneja el agente de SSM, y cada despliegue la deja en la etiqueta que instala.
- El primer arranque se hace una sola vez, con `bash /opt/aletheia/infra/prod/iniciar-postgres.sh`. El script lee las cuatro claves con el rol, levanta PostgreSQL con `compose.prod.init.yaml` para crear los usuarios y luego recrea el contenedor sin ellas. Si el volumen ya existe, se niega a continuar.
- Si el primer arranque falla a mitad de camino, la base queda a medias y se borra con `docker compose -f compose.prod.yaml down --volumes`. Ese comando borra todos los datos, así que solo se usa antes de que exista información real.

| Imagen | Digest |
| --- | --- |
| `postgres:18.6-trixie` | `sha256:979bccfde35445db618c65107d27d08c6c21339d8dc3ad4c830c6633947be0e4` |
| `amazon/aws-cli:2.38.1` | `sha256:733d5be1015825e4038c6016f3fa9954868ddee1f611b73be795a9cc2e706bfd` |

Para revisar el estado:

```bash
cd /opt/aletheia/infra
sudo docker compose --env-file /var/lib/aletheia/despliegue.env -f compose.prod.yaml ps
sudo docker compose --env-file /var/lib/aletheia/despliegue.env -f compose.prod.yaml exec postgres psql -U aletheia -d aletheia -c '\du'
```

## Contenedores

`infra/compose.prod.yaml` define cinco servicios en dos redes. En `frontal` están Caddy y la API; en `datos`, la API, el trabajador, las migraciones y PostgreSQL. Caddy no puede llegar a la base, y solo Caddy publica puertos.

| Servicio | Imagen | Endurecimiento |
| --- | --- | --- |
| `caddy` | `aletheia-web`, por digest | Usuario 10002, solo lectura, sin capacidades salvo abrir puertos, `no-new-privileges`, 256 MB |
| `api` | `aletheia-api`, por digest | Usuario 10001, solo lectura con `/tmp` en memoria, sin capacidades, `no-new-privileges`, 512 MB y healthcheck a `/api/v1/health` |
| `worker` | La misma de la API, con `python -m app.worker` | Igual que la API, 256 MB y 45 segundos para terminar la tarea en curso. Su healthcheck revisa el latido con `python -m app.worker --check` |
| `migrate` | La misma de la API | Igual que la API. Va en el perfil `migraciones` y solo corre con `docker compose run --rm migrate` |
| `postgres` | `postgres:18.6-trixie`, por digest | Solo las capacidades que el entrypoint oficial necesita para arrancar como root y bajar a `postgres` (`CHOWN`, `DAC_OVERRIDE`, `FOWNER`, `SETGID`, `SETUID`), `no-new-privileges`, 768 MB. Sin puertos publicados y solo en la red `datos` |

La API, el trabajador y las migraciones reciben la URL de la base sin clave y el nombre de su parámetro. Leen la clave de Parameter Store al arrancar, con el rol de la máquina, así que `docker inspect` no muestra ninguna. En producción la API no publica `/api/v1/docs` ni `/api/v1/openapi.json`.

La red `frontal` tiene una subred fija (172.28.0.0/24, en `infra/compose.prod.yaml`): `backend/Dockerfile` solo acepta las cabeceras `X-Forwarded-*` de uvicorn desde esa subred, en vez de confiar en cualquier origen interno.

Las imágenes base van fijadas por digest en `backend/Dockerfile` e `infra/caddy.Dockerfile`. Según ADR-019, las imágenes base, los entornos de ejecución, uv, pnpm y las acciones de GitHub deben tener más de 14 días de publicados, y las bibliotecas de Python y de JavaScript más de 7; Dependabot, uv y pnpm aplican esas esperas.

## Caddy

- Obtiene y renueva solo el certificado de Let's Encrypt para el dominio de producción y su `www`. Los certificados y la cuenta ACME viven en el volumen `caddy-data`, así que un despliegue no los vuelve a pedir.
- HTTP redirige a HTTPS con 308, y `www` al dominio principal con 301, conservando la ruta.
- Cabeceras en todas las respuestas, también en los errores: CSP solo con `'self'` y `frame-ancestors 'none'`, HSTS de un año con `includeSubDomains` y sin `preload`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP y CORP. No envía la cabecera `Server`.
- Sin API de administración y sin HTTP/3: el grupo de seguridad solo abre el 443 por TCP.
- `/api/*` va a la API; `/assets/*` se guarda un año en el navegador; lo demás es la aplicación de una sola página, que se revalida en cada visita.

## Despliegue

Al integrar la rama `release/X.Y.Z` en `develop`, se crea y se sube una etiqueta firmada sobre el commit integrado. La publicación sigue estos pasos en `.github/workflows/publicar.yml`.

1. Comprueba que la etiqueta tenga la forma `vX.Y.Z`, que su commit pertenezca al historial de `develop` y que coincida con la versión de `backend/pyproject.toml` y `frontend/package.json`.
2. Comprueba que GitHub haya verificado la firma de la etiqueta anotada. Construye las dos imágenes para linux/amd64, las publica en GHCR y obtiene sus digests de los metadatos de cada compilación.
3. Espera la aprobación del administrador en el entorno `production`, que solo admite etiquetas `v*`.
4. Envía el documento `aletheia-desplegar` con `infra/prod/ssm/enviar.sh` y muestra la salida del servidor.
5. Ejecuta `infra/prod/prueba-de-humo.sh` desde internet. Si falla, envía la misma orden con la acción `revertir`.

Tras verificar la publicación, se sincroniza `main` mediante un pull request para que su contenido corresponda al código desplegado.

En el servidor, el documento trae la etiqueta, comprueba su firma y deja `/opt/aletheia` en ella antes de ejecutar `infra/prod/desplegar.sh`. El script descarga las imágenes, aplica las migraciones, actualiza los contenedores y consulta la salud por HTTPS desde la misma máquina. Si algo falla, vuelve solo a la versión anterior.

| Archivo en el servidor | Contenido |
| --- | --- |
| `/etc/aletheia/firmantes-permitidos` | La llave pública que firma las etiquetas. Sin ella, ningún despliegue pasa |
| `/etc/aletheia/entorno.env` | Configuración fija del servidor que no cambia con cada despliegue (`ALETHEIA_EVIDENCE_BUCKET`). La deja una sola vez el administrador; `desplegar.sh` no la escribe ni la toca |
| `/var/lib/aletheia/despliegue.env` | Versión y digests de lo que está corriendo |
| `/var/lib/aletheia/despliegue.anterior.env` | La versión a la que se vuelve si la nueva falla |
| `/var/lib/aletheia/despliegue.fallido.env` | La última versión que falló, para revisarla |

Sin `/etc/aletheia/entorno.env`, `desplegar.sh` se niega a desplegar con un mensaje claro en vez de levantar los contenedores con el bucket vacío.

Las migraciones nunca se revierten. Cada una debe dejar funcionando la versión anterior de la API: primero se amplía el esquema y, en una versión posterior, se retira lo que sobra.

### Documento de SSM

| Elemento | Valor |
| --- | --- |
| Nombre | `aletheia-desplegar`, tipo Command, solo para instancias EC2 |
| Fuente | `infra/prod/ssm/aletheia-desplegar.yaml` |
| Agente | 3.3.5700.0, instalado desde el paquete regional de Ohio |
| Parámetros | `Accion` (`desplegar` o `revertir`), `Version` (`^v\d+\.\d+\.\d+$`), `ApiDigest` y `WebDigest` (`^sha256:[a-f0-9]{64}$`) |

### Paquetes de GHCR

`aletheia-api` y `aletheia-web` son públicos, para que el servidor los descargue sin credenciales. GHCR crea cada paquete privado la primera vez que se publica; se cambia una sola vez en GitHub, en el perfil > Packages > el paquete > Package settings > Change visibility > Public.

### Cuenta propietaria de la plataforma

Tras desplegar la versión que incluya la migración 0016, la persona propietaria registra su
cuenta y confirma el correo. El operador verifica que la cuenta está activa y ejecuta una sola
vez, desde el servidor, el comando del contenedor de migraciones:

```bash
cd /opt/aletheia/infra
sudo docker compose --env-file /var/lib/aletheia/despliegue.env -f compose.prod.yaml \
  run --rm migrate python -m app.maintenance.platform_owner --email "correo@ejemplo.com"
```

La operación exige `aletheia_owner`, acepta solo una cuenta activa con correo verificado, deja
`platform_admin_granted` en la auditoría y es idempotente para la misma cuenta. El usuario de la
API no tiene permiso SQL para escribir `is_platform_admin`. Ese atributo no concede acceso a
datos de otros despachos. La primera sección de plataforma permite gestionar el estado de las
cuentas. La versión 0.4.1 agrega resumen comercial de solo lectura, solicitudes de soporte y
auditoría transversal sin contenido de expedientes. Los cobros y la emisión de facturas siguen
requiriendo integración propia.

## Pruebas de TT-007

Las pruebas de AWS corrieron desde la instancia, dentro de un contenedor con AWS CLI y con las credenciales del rol.

| Prueba | Resultado |
| --- | --- |
| Identidad | Las llamadas salen con el rol `aletheia-prod-instancia` |
| Envoltura con KMS | Una llave de 131 bytes se envolvió en 384 bytes y se recuperó idéntica |
| KMS con SHA-1 | Rechazado |
| Bucket de evidencias | Sube, lee y borra; listar, negado |
| Bucket de respaldos | Sube y lista; borrar, negado |
| Parameter Store | `ParameterNotFound` dentro de `/aletheia/prod/` y `AccessDenied` fuera de esa ruta |
| Primer arranque de PostgreSQL | Las cuatro claves se leyeron con el rol y se crearon `aletheia`, `aletheia_owner`, `aletheia_app` y `aletheia_support`, sin base de pruebas |
| Aislamiento | Ningún puerto publicado; nada escucha en el 5432 del servidor |
| Claves en la configuración del contenedor | Ninguna |
| Inicio de sesión de `aletheia_app` | Correcto por TCP con su clave de Parameter Store |
| Reinicio de la máquina | PostgreSQL volvió solo y sano, y los datos persistieron |
| SSH | Solo con llave; contraseña y root desactivados (`sshd -T`) |

## Pruebas de TT-008

| Prueba | Resultado |
| --- | --- |
| Agente de SSM | `Online`, versión 3.3.5700.0 |
| Parámetro inválido (`v0.1`) | SSM lo rechaza con `InvalidParameters` y no envía nada |
| `revertir` sin despliegue | Llega al servidor y el script se niega: `No hay ningún despliegue` |
| Firma | `git verify-commit` reconoce la llave del administrador con `/etc/aletheia/firmantes-permitidos` |
| Permisos del usuario de despliegue | `allowed` con `aletheia-desplegar`; `implicitDeny` con `AWS-RunShellScript` |
| Caddy en local | Cabeceras en el 200, el 404 y el 502, sin `Server`, y `www` con 301 |

## Advertencias

- En CloudShell, al pegar bloques largos hay que confirmar que se ejecutaron completos, porque la salida a veces se corta. Antes de repetir una creación, se verifica con un comando de consulta.
- En el simulador de IAM hay que pasar la región como contexto (`aws:RequestedRegion`). Sin ella, la política del plan gratuito aparece como `explicitDeny` aunque los permisos estén bien.
- En la consola de AWS, la traducción automática del navegador cambia los valores de los registros DNS: `bounce` aparece como `rebote` y `include` como `incluye`. Los registros se copian con la página en su idioma original o desde el archivo .csv que ofrece SES.
- Los comandos de Docker en el servidor necesitan `--env-file /var/lib/aletheia/despliegue.env`. Sin él, Compose usa las etiquetas `sin-desplegar`, que no existen, y no reemplaza nada.
