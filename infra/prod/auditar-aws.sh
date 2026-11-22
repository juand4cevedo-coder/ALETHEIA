#!/usr/bin/env bash
# Revisión de solo lectura de la cuenta de AWS de ALETHEIA. Se ejecuta desde CloudShell o desde
# un equipo con credenciales de lectura; no crea, cambia ni borra nada:
#
#   bash infra/prod/auditar-aws.sh
#
# Comprueba lo que docs/operacion/produccion.md dice que existe: acceso por SSH restringido,
# IMDSv2, discos cifrados, buckets privados y cifrados con su regla de ciclo de vida, una copia
# de PostgreSQL de menos de 26 horas, los parámetros de Parameter Store, las alarmas y el
# presupuesto. Muestra todas las fallas antes de terminar, no solo la primera.
set -uo pipefail

readonly REGION=us-east-2
fallas=0
avisos=0

ok() { printf 'ok     %s\n' "$1"; }
falla() {
    printf 'FALLA  %s\n' "$1"
    fallas=$((fallas + 1))
}
aviso() {
    printf 'aviso  %s\n' "$1"
    avisos=$((avisos + 1))
}

aws_() { aws --region "$REGION" --output text "$@" 2>/dev/null; }

cuenta="$(aws_ sts get-caller-identity --query Account)" || {
    echo "No hay credenciales de AWS válidas."
    exit 2
}
echo "Cuenta $cuenta, región $REGION"

# 1. La instancia.
instancia="$(aws_ ec2 describe-instances --filters Name=tag:Name,Values=aletheia-prod Name=instance-state-name,Values=running \
    --query 'Reservations[0].Instances[0].InstanceId')"
if [[ -z $instancia || $instancia == None ]]; then
    falla "no hay una instancia aletheia-prod en ejecución"
else
    ok "instancia $instancia en ejecución"
    tokens="$(aws_ ec2 describe-instances --instance-ids "$instancia" --query 'Reservations[0].Instances[0].MetadataOptions.HttpTokens')"
    [[ $tokens == required ]] && ok "IMDSv2 obligatorio" || falla "IMDSv2 no es obligatorio ($tokens)"
    cifrados="$(aws_ ec2 describe-volumes --filters Name=attachment.instance-id,Values="$instancia" --query 'Volumes[].Encrypted')"
    [[ $cifrados != *False* && -n $cifrados ]] && ok "discos cifrados" || falla "hay discos sin cifrar"
    grupo="$(aws_ ec2 describe-instances --instance-ids "$instancia" --query 'Reservations[0].Instances[0].SecurityGroups[0].GroupId')"
    abiertos="$(aws_ ec2 describe-security-groups --group-ids "$grupo" \
        --query 'SecurityGroups[0].IpPermissions[?contains(IpRanges[].CidrIp, `0.0.0.0/0`)].FromPort')"
    for puerto in $abiertos; do
        case $puerto in
            80 | 443) ;;
            *) falla "el puerto $puerto está abierto a todo internet" ;;
        esac
    done
    [[ -z $abiertos ]] || ok "solo 80 y 443 abiertos a internet (revise que el 22 no figure arriba)"
fi

# 2. Buckets: privados, cifrados y con regla de ciclo de vida.
for bucket in "aletheia-prod-evidencias-$cuenta" "aletheia-prod-respaldos-$cuenta"; do
    if ! aws_ s3api head-bucket --bucket "$bucket" >/dev/null; then
        falla "$bucket: no existe o no hay acceso"
        continue
    fi
    bloqueo="$(aws_ s3api get-public-access-block --bucket "$bucket" \
        --query 'PublicAccessBlockConfiguration.[BlockPublicAcls,IgnorePublicAcls,BlockPublicPolicy,RestrictPublicBuckets]')"
    [[ $bloqueo != *False* && -n $bloqueo ]] && ok "$bucket: acceso público bloqueado" || falla "$bucket: acceso público sin bloquear"
    cifrado="$(aws_ s3api get-bucket-encryption --bucket "$bucket" \
        --query 'ServerSideEncryptionConfiguration.Rules[0].ApplyServerSideEncryptionByDefault.SSEAlgorithm')"
    [[ -n $cifrado ]] && ok "$bucket: cifrado $cifrado" || falla "$bucket: sin cifrado por defecto"
    reglas="$(aws_ s3api get-bucket-lifecycle-configuration --bucket "$bucket" --query 'Rules[].ID')"
    [[ -n $reglas ]] && ok "$bucket: reglas de ciclo de vida ($reglas)" || falla "$bucket: sin reglas de ciclo de vida"
done

# 3. La copia de PostgreSQL más reciente.
ultima="$(aws_ s3api list-objects-v2 --bucket "aletheia-prod-respaldos-$cuenta" --prefix postgres/ \
    --query 'sort_by(Contents[?ends_with(Key, `.dump`)], &LastModified)[-1].[Key,LastModified]')"
if [[ -z $ultima || $ultima == None* ]]; then
    falla "no hay ninguna copia de PostgreSQL en el bucket de respaldos"
else
    fecha="$(awk '{print $2}' <<<"$ultima")"
    edad=$((($(date +%s) - $(date -d "$fecha" +%s)) / 3600))
    ((edad <= 26)) && ok "última copia hace $edad horas" || falla "la última copia tiene $edad horas"
fi

# 4. Parameter Store: solo los nombres, nunca los valores.
parametros="$(aws_ ssm get-parameters-by-path --path /aletheia/prod --recursive --query 'Parameters[].Name')"
for esperado in postgres/admin-password postgres/owner-password postgres/app-password \
    postgres/support-password app/token-signing-key; do
    grep -q "/aletheia/prod/$esperado" <<<"$parametros" && ok "parámetro $esperado" || falla "falta el parámetro $esperado"
done
grep -q google/client-secret <<<"$parametros" && ok "parámetro google/client-secret" \
    || aviso "falta google/client-secret: el acceso con Google no puede activarse"

# 5. Alarmas y presupuesto.
alarmas="$(aws_ cloudwatch describe-alarms --query 'MetricAlarms[].AlarmName')"
[[ -n $alarmas ]] && ok "alarmas de CloudWatch: $alarmas" \
    || aviso "no hay alarmas de CloudWatch: nadie se entera si el servidor cae o el disco se llena"
presupuesto="$(aws --output text budgets describe-budgets --account-id "$cuenta" --query 'Budgets[].BudgetName' 2>/dev/null)"
[[ -n $presupuesto ]] && ok "presupuesto: $presupuesto" || aviso "no hay un presupuesto con alertas"

echo
echo "$fallas fallas y $avisos avisos."
((fallas == 0))
