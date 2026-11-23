#!/usr/bin/env bash
# Revisión de solo lectura de la cuenta de AWS de ALETHEIA. Se ejecuta desde CloudShell o desde
# un equipo con credenciales de lectura; no crea, cambia ni borra nada:
#
#   bash infra/prod/auditar-aws.sh
#
# Comprueba lo que docs/operacion/produccion.md dice que existe: acceso por SSH restringido,
# IMDSv2, discos cifrados, buckets privados y cifrados con su regla de ciclo de vida, una copia
# de PostgreSQL de menos de 26 horas, los parámetros de Parameter Store, las alarmas y el
# presupuesto, y las credenciales de IAM (raíz, MFA y rotación de llaves). Muestra todas las fallas antes de terminar, no solo la primera.
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
    # La política de copias diarias (DLM) solo copia los discos con la etiqueta respaldo=diario.
    # Si el disco de producción no la lleva, deja de tener copias sin que nada avise (como pasó
    # al cambiar el disco raíz por uno cifrado, el 23/11/2026).
    sin_etiqueta="$(aws_ ec2 describe-volumes --filters Name=attachment.instance-id,Values="$instancia" \
        --query 'Volumes[?!(Tags[?Key==`respaldo` && Value==`diario`])].VolumeId')"
    [[ -z $sin_etiqueta ]] && ok "los discos de la instancia llevan la etiqueta respaldo=diario" \
        || falla "sin etiqueta respaldo=diario, la política de copias no los respalda: $sin_etiqueta"
    sueltos="$(aws_ ec2 describe-volumes --filters Name=status,Values=available Name=tag:respaldo,Values=diario \
        --query 'Volumes[].VolumeId')"
    [[ -z $sueltos ]] || aviso "discos sin conectar que siguen respaldándose cada noche: $sueltos"
    for volumen in $(aws_ ec2 describe-volumes --filters Name=attachment.instance-id,Values="$instancia" \
        --query 'Volumes[].VolumeId'); do
        ultima_copia="$(aws_ ec2 describe-snapshots --owner-ids self \
            --filters Name=volume-id,Values="$volumen" Name=tag:dlm:managed,Values=true \
            --query 'max_by(Snapshots, &StartTime).StartTime')"
        if [[ -z $ultima_copia || $ultima_copia == None ]]; then
            aviso "el disco $volumen todavía no tiene ninguna copia diaria"
        else
            ok "última copia diaria de $volumen: $ultima_copia"
        fi
    done
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


# 6. Credenciales de IAM: la raíz sin llaves y con MFA, cada persona con MFA y ninguna llave
# activa con más de 90 días sin rotar. Los datos salen del informe de credenciales de IAM.
resumen="$(aws_ iam get-account-summary --query 'SummaryMap.[AccountAccessKeysPresent,AccountMFAEnabled]')"
read -r llaves_raiz mfa_raiz <<<"$resumen"
[[ ${llaves_raiz:-1} == 0 ]] && ok "la cuenta raíz no tiene llaves de acceso" || falla "la cuenta raíz tiene llaves de acceso"
# En las cuentas de tipo proyecto, con un dueño que entra por su propio inicio de sesión, la raíz
# puede no tener credenciales y su MFA no se puede activar. Por eso es un aviso y no una falla:
# lo que hay que confirmar es el MFA del inicio de sesión del dueño (menú de la cuenta, Profile).
[[ ${mfa_raiz:-0} == 1 ]] && ok "la cuenta raíz tiene MFA" \
    || aviso "la raíz no tiene MFA: si la cuenta es de tipo proyecto, confirme el MFA del dueño en Profile"

aws iam generate-credential-report >/dev/null 2>&1
sleep 3
informe="$(aws --output text iam get-credential-report --query Content 2>/dev/null | base64 -d 2>/dev/null)"
if [[ -z $informe ]]; then
    aviso "no se pudo leer el informe de credenciales de IAM"
else
    hoy="$(date +%s)"
    while IFS=, read -r usuario _ _ clave _ _ _ mfa llave1 rotada1 llave2 rotada2 _; do
        [[ $usuario == user || $usuario == '<root_account>' ]] && continue
        [[ $clave == true && $mfa == false ]] && falla "el usuario $usuario entra a la consola sin MFA"
        for par in "$llave1:$rotada1" "$llave2:$rotada2"; do
            activa="${par%%:*}"
            rotada="${par#*:}"
            [[ $activa == true && $rotada != N/A ]] || continue
            dias=$(((hoy - $(date -d "$rotada" +%s)) / 86400))
            ((dias > 90)) && falla "el usuario $usuario tiene una llave de acceso de $dias días sin rotar"
        done
    done <<<"$informe"
    ok "informe de credenciales revisado"
fi
echo
echo "$fallas fallas y $avisos avisos."
((fallas == 0))
