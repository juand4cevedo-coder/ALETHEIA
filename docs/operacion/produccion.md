# Producción en AWS

Registro de la infraestructura de producción de ALETHEIA según ADR-017: qué existe, cómo quedó configurado y cómo se comprobó. Aquí no hay claves, contraseñas ni llaves privadas. Las claves viven en Parameter Store y la llave SSH solo en el equipo del administrador.

Última actualización: 30/10/2026, con TT-007.

## Cuenta y costos

| Elemento | Valor |
| --- | --- |
| Cuenta | 047938357957, plan gratuito, con MFA activado |
| Región | us-east-2 (Ohio) |
| Créditos | 200 USD después de completar las cinco actividades de bienvenida. El plan gratuito vence el 29/04/2027 |
| Presupuesto | `aletheia-mensual`: 30 USD al mes sin contar créditos, con alertas al 50 y al 80 % |

## Instancia

| Elemento | Valor |
| --- | --- |
| Nombre e ID | `aletheia-prod`, `i-0eb0891dbf8d8dbf9` |
| Tipo | t3.small x86 (2 vCPU y 2 GB) |
| Sistema | Debian 13 (trixie), kernel `6.12.113+deb13-cloud-amd64` |
| Disco | EBS gp3 de 30 GiB |
| IP elástica | 3.22.173.241 |
| Metadatos | IMDSv2 obligatorio, con límite de saltos 2 para que los contenedores reciban las credenciales del rol |
| Perfil de instancia | `aletheia-prod-instancia` |
| Grupo de seguridad | `aletheia-prod-sg`: solo el puerto 22, abierto a la IP pública del administrador y nunca a `0.0.0.0/0`. Los puertos 80 y 443 se abren con TT-008 |

## Acceso por SSH

- Usuario `admin`, solo con llave y frase de paso. Sin contraseña y sin acceso directo como root: lo fija `/etc/ssh/sshd_config.d/10-aletheia.conf`.
- Si la conexión da timeout, casi siempre cambió la IP pública del administrador. Se corrige en EC2 > Security Groups > `aletheia-prod-sg` > Edit inbound rules: en la regla del puerto 22, Source pasa a My IP.
- En la actualización completa del sistema se conservó el `sshd_config` local. La versión que traía el paquete quedó en `/etc/ssh/sshd_config.ucf-dist`.
- Los comandos de Linux funcionan solo dentro del servidor, después de que `ssh` conecta. En PowerShell fallan.

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
| `aletheia-prod-evidencias-047938357957` | Evidencias cifradas y paquetes exportados | `borrar-subidas-incompletas`: descarta al día las subidas que no terminaron |
| `aletheia-prod-respaldos-047938357957` | Copias diarias de PostgreSQL (TT-011) | `borrar-subidas-incompletas` y `retencion-7-dias`: borra cada copia a los 7 días |

Los dos buckets tienen el acceso público bloqueado, las ACL desactivadas y cifrado SSE-S3. No usan versionado ni Object Lock. La política `SoloHTTPS` rechaza toda petición que no llegue por TLS.

Hay dos detalles que el código debe tener en cuenta:

- Como el rol no puede listar el bucket de evidencias, S3 responde 403 y no 404 cuando un objeto no existe. El adaptador de almacenamiento lo trata como no encontrado.
- La regla de 7 días cuenta hasta la medianoche UTC siguiente y AWS borra con demora. TT-011 fija un margen para `backups_expire_at` (Arquitectura 8.11).

El objeto `prueba/tt-007.bin` quedó a propósito en el bucket de respaldos: lo borra la regla de 7 días.

## AWS KMS

| Elemento | Valor |
| --- | --- |
| Alias | `alias/aletheia-prod-maestra` |
| ARN | `arn:aws:kms:us-east-2:047938357957:key/2bf06d55-cdf0-416f-9283-be72afed8a6d` |
| Tipo | RSA_3072, uso cifrar y descifrar, una sola región |
| Política de la llave | La predeterminada: los permisos se conceden por IAM |
| Uso | Envolver con `RSAES_OAEP_SHA_256` la llave de cada caso (ADR-014) |

## IAM

El rol `aletheia-prod-instancia` tiene la política `aletheia-prod-acceso` y llega a la máquina por el perfil de instancia del mismo nombre. Nada que no esté en esta tabla está permitido.

| Servicio | Recurso | Permitido |
| --- | --- | --- |
| S3 | Bucket de evidencias | `GetObject`, `PutObject`, `DeleteObject` y `AbortMultipartUpload`. No puede listar |
| S3 | Bucket de respaldos | `GetObject`, `PutObject`, `AbortMultipartUpload` y `ListBucket`. No puede borrar |
| KMS | `alias/aletheia-prod-maestra` | `Encrypt` y `Decrypt`, solo con `RSAES_OAEP_SHA_256` |
| Parameter Store | Parámetros bajo `/aletheia/prod/` | `GetParameter`, `GetParameters` y `GetParametersByPath`. No puede escribir |

Para leer un `SecureString` cifrado con la llave `aws/ssm`, el rol no necesita permisos adicionales de KMS.

## Parameter Store

| Parámetro | Tipo | Para qué |
| --- | --- | --- |
| `/aletheia/prod/postgres/admin-password` | SecureString (`aws/ssm`) | Administrador `aletheia`: primer arranque y tareas manuales |
| `/aletheia/prod/postgres/owner-password` | SecureString (`aws/ssm`) | `aletheia_owner`: migraciones |
| `/aletheia/prod/postgres/app-password` | SecureString (`aws/ssm`) | `aletheia_app`: API y trabajador |
| `/aletheia/prod/postgres/support-password` | SecureString (`aws/ssm`) | `aletheia_support`: consultas de solo lectura |

Las claves se generaron en CloudShell con 40 letras y números. Pasaron por una tubería directo a AWS, así que nunca aparecieron en pantalla, en el historial ni como argumento de un comando:

```bash
for usuario in admin owner app support; do
  openssl rand -base64 48 | tr -d '\n/+=' | head -c 40 |
    aws ssm put-parameter --region us-east-2 \
      --name "/aletheia/prod/postgres/${usuario}-password" \
      --description "Clave de PostgreSQL de produccion (${usuario})" \
      --type SecureString --value file:///dev/stdin \
      --query Version --output text
done
```

## PostgreSQL

- `infra/compose.prod.yaml` define el proyecto `aletheia-prod` con PostgreSQL 18.6, la misma versión de desarrollo y de la CI. No publica puertos y guarda los datos en el volumen `aletheia-prod_postgres-data`, sobre el disco EBS. El healthcheck consulta por TCP y el contenedor se reinicia solo (`unless-stopped`).
- El servidor tiene una copia de solo lectura del repositorio en `/opt/aletheia`, clonada por HTTPS y sin credenciales de GitHub.
- El primer arranque se hace una sola vez, con `bash /opt/aletheia/infra/prod/iniciar-postgres.sh`. El script lee las cuatro claves con el rol, levanta PostgreSQL con `compose.prod.init.yaml` para crear los usuarios y luego recrea el contenedor sin ellas. Si el volumen ya existe, se niega a continuar.
- Si el primer arranque falla a mitad de camino, la base queda a medias y se borra con `docker compose -f compose.prod.yaml down --volumes`. Ese comando borra todos los datos, así que solo se usa antes de que exista información real.

| Imagen | Digest |
| --- | --- |
| `postgres:18.6-trixie` | `sha256:979bccfde35445db618c65107d27d08c6c21339d8dc3ad4c830c6633947be0e4` |
| `amazon/aws-cli:2.38.1` | `sha256:733d5be1015825e4038c6016f3fa9954868ddee1f611b73be795a9cc2e706bfd` |

Para revisar el estado:

```bash
cd /opt/aletheia/infra
docker compose -f compose.prod.yaml ps
docker compose -f compose.prod.yaml exec postgres psql -U aletheia -d aletheia -c '\du'
```

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

## Advertencias

- En CloudShell, al pegar bloques largos hay que confirmar que se ejecutaron completos, porque la salida a veces se corta. Antes de repetir una creación, se verifica con un comando de consulta.
