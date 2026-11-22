# Credenciales de AWS

Cómo se organizan las credenciales de la cuenta de AWS de ALETHEIA y cómo se rotan. Aquí no hay identificadores reales de la cuenta, de usuarios ni de llaves: esos viven en el runbook interno.

## Principios

1. Cada credencial tiene un solo dueño y un solo uso: una persona, el servidor o el despliegue.
2. Ninguna llave va al repositorio, al chat ni al correo. Las llaves nuevas se crean y se pegan directo en su destino.
3. Las credenciales de personas caducan en horas y exigen MFA. Las llaves de larga vida solo existen donde no hay alternativa.
4. Lo que solo mira no puede cambiar, y nada que mire puede leer datos de clientes ni secretos.

## Inventario

| Credencial | Quién la usa | Duración | Alcance |
| --- | --- | --- | --- |
| Cuenta raíz | Nadie en el día a día; solo emergencias | Sin llaves de acceso | MFA activo; la recuperación vive fuera de la cuenta |
| Identidad de la persona administradora | Quien opera la cuenta | Sesión de unas horas con MFA | Administración, con su propio usuario |
| Rol `aletheia-auditor` | Revisiones con `infra/prod/auditar-aws.sh` y herramientas de revisión | Una hora, con MFA reciente | Solo lectura; no lee objetos de S3, valores de Parameter Store ni descifra con KMS |
| Rol de la instancia `aletheia-prod-instancia` | La API y el trabajador, en el servidor | Credenciales temporales que entrega AWS | Lo que detalla [la sección IAM del runbook](produccion.md) |
| Usuario de despliegue | GitHub Actions | Una llave, rotada cada 90 días | Solo enviar el documento de SSM `aletheia-desplegar` a `aletheia-prod` y leer su resultado |

El despliegue usa una llave de larga vida porque la política de control de servicios del plan gratuito impide crear un proveedor OIDC (ADR-018). Si algún día se puede, esa llave desaparece.

## Rol de auditoría

`infra/aws/crear-rol-auditor.sh` lo crea una sola vez, desde CloudShell y con MFA:

```bash
bash infra/aws/crear-rol-auditor.sh <usuario-de-iam>
```

Combina las políticas administradas `ReadOnlyAccess` y `SecurityAudit` con la negación `infra/aws/denegar-datos-auditor.json`, que le quita la lectura de objetos de S3, de Parameter Store y de Secrets Manager y el uso de KMS. Esa negación es la razón de que sea seguro dárselo a una herramienta de revisión: `ReadOnlyAccess` por sí sola sí podría leer las evidencias cifradas. El rol solo lo asume el usuario nombrado, con MFA de menos de una hora.

## Rotación y revisión

| Qué | Cada cuánto | Cómo |
| --- | --- | --- |
| Llave del usuario de despliegue | 90 días y ante cualquier sospecha | Procedimiento de rotación del runbook: crear la nueva, reemplazar los secretos del entorno `production` en GitHub, desactivar la vieja y borrarla tras un despliegue correcto |
| Revisión de credenciales | Antes de cada versión | `infra/prod/auditar-aws.sh` comprueba que la raíz no tenga llaves y tenga MFA, que cada persona con consola tenga MFA y que ninguna llave activa pase de 90 días |
| Claves de PostgreSQL y de firma | Ante cualquier sospecha | Se generan de nuevo en Parameter Store y se reinicia el servicio; los enlaces firmados anteriores dejan de valer |
| Actividad | Ante una alerta | El historial de CloudTrail guarda 90 días de eventos de gestión |

## Si una credencial se filtra

1. Desactivar la llave o la sesión de inmediato; borrar después.
2. Revisar en CloudTrail qué llamadas hizo en las últimas 24 horas.
3. Rotar lo que esa credencial podía leer.
4. Anotar el incidente y la corrección en el runbook interno.

## Herramientas de revisión externas

Una herramienta o conector que revise la cuenta usa el rol `aletheia-auditor`, nunca una identidad de administración, y sus credenciales se renuevan cada hora. Si la herramienta pide una llave permanente, no se le da: se cambia de herramienta.
