#!/usr/bin/env bash
# Cifra el disco raíz de aletheia-prod, que se creó sin cifrar. Lo ejecuta la persona
# administradora desde CloudShell (región Ohio), con MFA:
#
#   bash infra/aws/cifrar-disco-raiz.sh --revisar            # solo mira, no cambia nada
#   bash infra/aws/cifrar-disco-raiz.sh --ejecutar           # cifra (corte de 10 a 20 minutos)
#   bash infra/aws/cifrar-disco-raiz.sh --revertir <vol-...> # vuelve al disco anterior
#
# AWS no cifra un disco en uso. El procedimiento es el estándar: copia del disco, copia cifrada
# de esa copia, disco nuevo cifrado a partir de ella y cambio del disco raíz con la máquina
# apagada. La IP elástica no cambia, así que el DNS sigue valiendo.
#
# El disco anterior NO se borra: queda separado y etiquetado para volver atrás. Se borra a mano,
# cuando todo lleve unos días bien (el script imprime el comando).
set -euo pipefail

readonly REGION=us-east-2
readonly SITIO=https://aletheia.sbs
modo="${1:---revisar}"
aws_() { aws --region "$REGION" --output text "$@"; }
avisar() { printf '%s  %s\n' "$(date -u +%H:%M:%S)" "$*"; }
abortar() {
    printf 'ERROR: %s\n' "$*" >&2
    exit 1
}

instancia="$(aws_ ec2 describe-instances \
    --filters Name=tag:Name,Values=aletheia-prod Name=instance-state-name,Values=running,stopped \
    --query 'Reservations[0].Instances[0].InstanceId')"
[[ $instancia == i-* ]] || abortar "no encuentro la instancia aletheia-prod."

estado="$(aws_ ec2 describe-instances --instance-ids "$instancia" \
    --query 'Reservations[0].Instances[0].State.Name')"
dispositivo="$(aws_ ec2 describe-instances --instance-ids "$instancia" \
    --query 'Reservations[0].Instances[0].RootDeviceName')"
zona="$(aws_ ec2 describe-instances --instance-ids "$instancia" \
    --query 'Reservations[0].Instances[0].Placement.AvailabilityZone')"
volumen="$(aws_ ec2 describe-instances --instance-ids "$instancia" \
    --query "Reservations[0].Instances[0].BlockDeviceMappings[?DeviceName=='$dispositivo'].Ebs.VolumeId | [0]")"
read -r tamano tipo iops rendimiento cifrado < <(aws_ ec2 describe-volumes --volume-ids "$volumen" \
    --query 'Volumes[0].[Size,VolumeType,Iops,Throughput,Encrypted]')
ip_elastica="$(aws_ ec2 describe-addresses --filters "Name=instance-id,Values=$instancia" \
    --query 'Addresses[0].PublicIp')"
cifrado_por_omision="$(aws_ ec2 get-ebs-encryption-by-default --query EbsEncryptionByDefault)"

informe() {
    cat <<TEXTO
Instancia:            $instancia ($estado)
Disco raíz:           $volumen en $dispositivo, $tamano GiB $tipo, cifrado: $cifrado
Zona:                 $zona
IP elástica:          ${ip_elastica/None/NINGUNA}
Cifrado por omisión:  $cifrado_por_omision
TEXTO
}

salud() {
    curl -fsS -m 15 "$SITIO/api/v1/health" 2>/dev/null || echo "sin respuesta"
}

if [[ $modo == --revisar ]]; then
    informe
    problemas=0
    if [[ $cifrado == True ]]; then
        avisar "El disco raíz ya está cifrado: no hay nada que hacer."
        exit 0
    fi
    [[ $estado == running ]] || { avisar "La instancia no está en ejecución."; problemas=1; }
    [[ $ip_elastica != None ]] || { avisar "Sin IP elástica, al reiniciar cambiaría la IP y el DNS dejaría de valer."; problemas=1; }
    [[ $cifrado_por_omision == True ]] || { avisar "El cifrado por omisión está apagado: los discos nuevos nacerían sin cifrar."; problemas=1; }
    avisar "Salud del sitio ahora: $(salud)"
    if ((problemas)); then
        abortar "hay puntos por resolver antes de cifrar."
    fi
    avisar "Todo listo para cifrar. Elija una hora de poco uso y ejecute: --ejecutar"
    exit 0
fi

if [[ $modo == --revertir ]]; then
    anterior="${2:?Indique el disco anterior, por ejemplo vol-0abc...}"
    informe
    read -r -p "Se apagará la máquina y se volverá al disco $anterior. Escriba REVERTIR para seguir: " respuesta
    [[ $respuesta == REVERTIR ]] || abortar "cancelado."
    avisar "Apagando la instancia..."
    aws_ ec2 stop-instances --instance-ids "$instancia" >/dev/null
    aws_ ec2 wait instance-stopped --instance-ids "$instancia"
    aws_ ec2 detach-volume --volume-id "$volumen" >/dev/null
    aws_ ec2 wait volume-available --volume-ids "$volumen"
    aws_ ec2 attach-volume --volume-id "$anterior" --instance-id "$instancia" --device "$dispositivo" >/dev/null
    aws_ ec2 wait volume-in-use --volume-ids "$anterior"
    aws_ ec2 start-instances --instance-ids "$instancia" >/dev/null
    aws_ ec2 wait instance-running --instance-ids "$instancia"
    avisar "Instancia en ejecución con el disco anterior. Espere un par de minutos. Salud: $(salud)"
    exit 0
fi

[[ $modo == --ejecutar ]] || abortar "modo desconocido: $modo (use --revisar, --ejecutar o --revertir)."
informe
[[ $cifrado != True ]] || abortar "el disco raíz ya está cifrado."
[[ $estado == running ]] || abortar "la instancia debe estar en ejecución para empezar."
[[ $ip_elastica != None ]] || abortar "la instancia no tiene IP elástica: cámbiela antes de cifrar."
[[ $cifrado_por_omision == True ]] || abortar "active el cifrado por omisión de EBS antes de cifrar."

cat <<TEXTO

Esto apaga el sitio entre 10 y 20 minutos. Antes de apagar se hace una copia de la base de datos
y una copia del disco; el disco anterior queda guardado, sin borrar, para volver atrás.
TEXTO
read -r -p "Escriba CIFRAR para seguir: " respuesta
[[ $respuesta == CIFRAR ]] || abortar "cancelado."

avisar "1/8 Copia de la base de datos antes de empezar (puede tardar unos minutos)..."
orden="$(aws_ ssm send-command --instance-ids "$instancia" --document-name AWS-RunShellScript \
    --parameters 'commands=["systemctl start aletheia-respaldo.service && /bin/bash /opt/aletheia/infra/prod/respaldar.sh --revisar"]' \
    --query Command.CommandId)"
aws ssm wait command-executed --region "$REGION" --command-id "$orden" --instance-id "$instancia" \
    || abortar "el respaldo previo falló: revise el servidor antes de seguir. No se cambió nada."
avisar "   respaldo verificado."

avisar "2/8 Instantánea del disco actual..."
origen="$(aws_ ec2 create-snapshot --volume-id "$volumen" \
    --description "aletheia-prod raiz sin cifrar, antes de cifrar" \
    --tag-specifications 'ResourceType=snapshot,Tags=[{Key=Name,Value=aletheia-raiz-sin-cifrar}]' \
    --query SnapshotId)"
aws_ ec2 wait snapshot-completed --snapshot-ids "$origen"

avisar "3/8 Copia cifrada de la instantánea ($origen)..."
cifrada="$(aws_ ec2 copy-snapshot --source-region "$REGION" --source-snapshot-id "$origen" \
    --encrypted --kms-key-id alias/aws/ebs --description "aletheia-prod raiz cifrada" \
    --tag-specifications 'ResourceType=snapshot,Tags=[{Key=Name,Value=aletheia-raiz-cifrada}]' \
    --query SnapshotId)"
aws_ ec2 wait snapshot-completed --snapshot-ids "$cifrada"

avisar "4/8 Disco nuevo y cifrado a partir de la copia ($cifrada)..."
argumentos=(--snapshot-id "$cifrada" --availability-zone "$zona" --volume-type "$tipo"
    --tag-specifications 'ResourceType=volume,Tags=[{Key=Name,Value=aletheia-prod-raiz-cifrada}]')
if [[ $tipo == gp3 ]]; then
    argumentos+=(--iops "$iops" --throughput "$rendimiento")
fi
nuevo="$(aws_ ec2 create-volume "${argumentos[@]}" --query VolumeId)"
aws_ ec2 wait volume-available --volume-ids "$nuevo"
[[ "$(aws_ ec2 describe-volumes --volume-ids "$nuevo" --query 'Volumes[0].Encrypted')" == True ]] \
    || abortar "el disco nuevo $nuevo no salió cifrado. No se tocó la máquina."

avisar "5/8 Apagando la instancia (el sitio queda fuera de línea)..."
aws_ ec2 stop-instances --instance-ids "$instancia" >/dev/null
aws_ ec2 wait instance-stopped --instance-ids "$instancia"

avisar "6/8 Cambiando el disco raíz..."
aws_ ec2 detach-volume --volume-id "$volumen" >/dev/null
aws_ ec2 wait volume-available --volume-ids "$volumen"
aws_ ec2 create-tags --resources "$volumen" \
    --tags Key=Name,Value=aletheia-raiz-anterior-sin-cifrar >/dev/null
aws_ ec2 attach-volume --volume-id "$nuevo" --instance-id "$instancia" --device "$dispositivo" >/dev/null
aws_ ec2 wait volume-in-use --volume-ids "$nuevo"

avisar "7/8 Encendiendo la instancia..."
aws_ ec2 start-instances --instance-ids "$instancia" >/dev/null
aws_ ec2 wait instance-running --instance-ids "$instancia"
aws_ ec2 wait instance-status-ok --instance-ids "$instancia"

avisar "8/8 Comprobando el sitio (hasta 5 minutos)..."
for _ in $(seq 1 30); do
    respuesta="$(salud)"
    [[ $respuesta == *'"database":"ok"'* ]] && break
    sleep 10
done
avisar "Salud: $respuesta"

cat <<TEXTO

Resultado:
  Disco raíz nuevo:       $nuevo (cifrado)
  Disco anterior:         $volumen (guardado, sin cifrar, etiquetado aletheia-raiz-anterior-sin-cifrar)
  Instantánea sin cifrar: $origen
  Instantánea cifrada:    $cifrada

Si algo no funciona, vuelva al disco anterior:
  bash infra/aws/cifrar-disco-raiz.sh --revertir $volumen

Cuando lleve unos días bien (revise el panel ALETHEIA y la prueba de humo), borre lo sin cifrar:
  aws --region $REGION ec2 delete-volume --volume-id $volumen
  aws --region $REGION ec2 delete-snapshot --snapshot-id $origen
TEXTO
[[ $respuesta == *'"database":"ok"'* ]] || abortar "el sitio no respondió bien: revise y, si hace falta, revierta."
