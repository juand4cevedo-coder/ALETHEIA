#!/usr/bin/env bash
# Crea el rol de auditoría de solo lectura de ALETHEIA. Lo ejecuta una vez la persona
# administradora, desde CloudShell y con MFA:
#
#   bash infra/aws/crear-rol-auditor.sh <usuario-de-iam-que-lo-asumirá>
#
# El rol se puede asumir solo con MFA reciente (una hora), dura una hora y combina ReadOnlyAccess
# y SecurityAudit con una negación explícita: no puede leer objetos de S3 (las evidencias y los
# respaldos), valores de Parameter Store ni descifrar con KMS. Sirve para revisar la cuenta con
# infra/prod/auditar-aws.sh y para conectar herramientas de revisión sin darles acceso a datos.
set -euo pipefail

readonly ROL=aletheia-auditor
usuario="${1:?Indique el usuario de IAM que asumirá el rol.}"
carpeta="$(cd "$(dirname "$0")" && pwd)"
cuenta="$(aws sts get-caller-identity --query Account --output text)"

if aws iam get-role --role-name "$ROL" >/dev/null 2>&1; then
    echo "El rol $ROL ya existe: no cambio nada." >&2
    exit 1
fi

confianza="$(sed -e "s/CUENTA/$cuenta/" -e "s/USUARIO/$usuario/" "$carpeta/confianza-auditor.json")"

aws iam create-role --role-name "$ROL" --max-session-duration 3600 \
    --description "Revisión de solo lectura de la cuenta de ALETHEIA, sin acceso a datos" \
    --assume-role-policy-document "$confianza" --query Role.Arn --output text
aws iam attach-role-policy --role-name "$ROL" --policy-arn arn:aws:iam::aws:policy/ReadOnlyAccess
aws iam attach-role-policy --role-name "$ROL" --policy-arn arn:aws:iam::aws:policy/SecurityAudit
aws iam put-role-policy --role-name "$ROL" --policy-name SinLecturaDeDatos \
    --policy-document "file://$carpeta/denegar-datos-auditor.json"

cat <<TEXTO

Rol creado. Para usarlo, con MFA:
  aws sts assume-role --role-arn arn:aws:iam::$cuenta:role/$ROL \
    --role-session-name revision --serial-number <ARN de su dispositivo MFA> --token-code <código>
TEXTO
