#!/usr/bin/env bash
# Cifra el disco raíz de aletheia-prod, que se creó sin cifrar. Lo ejecuta la persona
# administradora desde CloudShell (región Ohio), con MFA:
#
#   bash infra/aws/cifrar-disco-raiz.sh --revisar            # solo mira, no cambia nada
#   bash infra/aws/cifrar-disco-raiz.sh --preparar           # ensayo sin apagar nada: adelanta lo lento
#   bash infra/aws/cifrar-disco-raiz.sh --cambiar            # el corte: apaga, cifra lo definitivo y cambia
#   bash infra/aws/cifrar-disco-raiz.sh --ejecutar           # las dos cosas seguidas
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

case $modo in
    --preparar | --cambiar | --ejecutar) ;;
    *) abortar "modo desconocido: $modo (use --revisar, --preparar, --cambiar, --ejecutar o --revertir)." ;;
esac
informe
[[ $cifrado != True ]] || abortar "el disco raíz ya está cifrado."
[[ $estado == running ]] || abortar "la instancia debe estar en ejecución para empezar."
[[ $ip_elastica != None ]] || abortar "la instancia no tiene IP elástica: cámbiela antes de cifrar."
[[ $cifrado_por_omision == True ]] || abortar "active el cifrado por omisión de EBS antes de cifrar."

nuevo=""
origen=""
cifrada=""

# Espera a que una instantánea termine, hasta una hora, mostrando el avance. La espera integrada
# de AWS (aws ec2 wait snapshot-completed) se rinde a los 10 minutos y una copia cifrada de 30 GiB
# puede tardar más; además, dentro de una sustitución de comandos un fallo se perdería sin avisar.
esperar_instantanea() {
    local estado avance
    for _ in $(seq 1 240); do
        read -r estado avance < <(aws_ ec2 describe-snapshots --snapshot-ids "$1" \
            --query 'Snapshots[0].[State,Progress]')
        case $estado in
            completed)
                avisar "   $1 completada."
                return 0
                ;;
            error) abortar "la instantánea $1 terminó con error." ;;
        esac
        avisar "   $1: $estado $avance"
        sleep 15
    done
    abortar "la instantánea $1 no terminó en una hora."
}

# Copia una instantánea cifrándola y espera a que termine. Deja el resultado en $copia_cifrada.
copia_cifrada=""
copiar_cifrada() {
    copia_cifrada="$(aws_ ec2 copy-snapshot --source-region "$REGION" --source-snapshot-id "$1" \
        --encrypted --kms-key-id alias/aws/ebs --description "aletheia-prod raiz cifrada" \
        --tag-specifications 'ResourceType=snapshot,Tags=[{Key=Name,Value=aletheia-raiz-cifrada}]' \
        --query SnapshotId)"
    esperar_instantanea "$copia_cifrada"
}

# Parte 1: no apaga nada. Respalda, toma una primera instantánea y su copia cifrada, que es lo más
# lento. Sirve de ensayo y adelanta el trabajo: las copias siguientes de AWS solo mueven lo que
# cambió, así que el corte de la parte 2 es corto. NO sirve para el cambio por sí sola: el sitio
# sigue escribiendo, y un disco hecho de esta instantánea perdería lo posterior.
preparar() {
    avisar "1/7 Copia de la base de datos antes de empezar (puede tardar unos minutos)..."
    local orden
    orden="$(aws_ ssm send-command --instance-ids "$instancia" --document-name AWS-RunShellScript \
        --parameters 'commands=["systemctl start aletheia-respaldo.service && /bin/bash /opt/aletheia/infra/prod/respaldar.sh --revisar"]' \
        --query Command.CommandId)"
    aws ssm wait command-executed --region "$REGION" --command-id "$orden" --instance-id "$instancia" \
        || abortar "el respaldo previo falló: revise el servidor antes de seguir. No se cambió nada."
    avisar "   respaldo verificado."

    avisar "2/7 Primera instantánea del disco actual (ensayo, con el sitio en línea)..."
    origen="$(aws_ ec2 create-snapshot --volume-id "$volumen" \
        --description "aletheia-prod raiz sin cifrar, ensayo" \
        --tag-specifications 'ResourceType=snapshot,Tags=[{Key=Name,Value=aletheia-raiz-sin-cifrar}]' \
        --query SnapshotId)"
    esperar_instantanea "$origen"

    avisar "3/7 Copia cifrada del ensayo ($origen)..."
    copiar_cifrada "$origen"
    cifrada="$copia_cifrada"
    avisar "   copia cifrada $cifrada lista. El ensayo terminó sin apagar nada."
}

# Parte 2: el corte. Con la máquina apagada ya no se escribe nada en el disco, así que la
# instantánea que se toma ahora es la definitiva.
cambiar() {
    avisar "4/7 Apagando la instancia (el sitio queda fuera de línea)..."
    aws_ ec2 stop-instances --instance-ids "$instancia" >/dev/null
    aws_ ec2 wait instance-stopped --instance-ids "$instancia"

    avisar "5/7 Instantánea definitiva, copia cifrada y disco nuevo..."
    origen="$(aws_ ec2 create-snapshot --volume-id "$volumen" \
        --description "aletheia-prod raiz sin cifrar, definitiva" \
        --tag-specifications 'ResourceType=snapshot,Tags=[{Key=Name,Value=aletheia-raiz-sin-cifrar}]' \
        --query SnapshotId)"
    esperar_instantanea "$origen"
    copiar_cifrada "$origen"
    cifrada="$copia_cifrada"
    local argumentos=(--snapshot-id "$cifrada" --availability-zone "$zona" --volume-type "$tipo"
        --tag-specifications 'ResourceType=volume,Tags=[{Key=Name,Value=aletheia-prod-raiz-cifrada}]')
    if [[ $tipo == gp3 ]]; then
        argumentos+=(--iops "$iops" --throughput "$rendimiento")
    fi
    nuevo="$(aws_ ec2 create-volume "${argumentos[@]}" --query VolumeId)"
    aws_ ec2 wait volume-available --volume-ids "$nuevo"
    if [[ "$(aws_ ec2 describe-volumes --volume-ids "$nuevo" --query 'Volumes[0].Encrypted')" != True ]]; then
        aws_ ec2 start-instances --instance-ids "$instancia" >/dev/null
        abortar "el disco nuevo $nuevo no salió cifrado. Se volvió a encender la instancia con el disco anterior."
    fi

    avisar "6/7 Cambiando el disco raíz y encendiendo..."
    aws_ ec2 detach-volume --volume-id "$volumen" >/dev/null
    aws_ ec2 wait volume-available --volume-ids "$volumen"
    aws_ ec2 create-tags --resources "$volumen" \
        --tags Key=Name,Value=aletheia-raiz-anterior-sin-cifrar >/dev/null
    aws_ ec2 attach-volume --volume-id "$nuevo" --instance-id "$instancia" --device "$dispositivo" >/dev/null
    aws_ ec2 wait volume-in-use --volume-ids "$nuevo"
    aws_ ec2 start-instances --instance-ids "$instancia" >/dev/null
    aws_ ec2 wait instance-running --instance-ids "$instancia"
    aws_ ec2 wait instance-status-ok --instance-ids "$instancia"

    avisar "7/7 Comprobando el sitio (hasta 5 minutos)..."
    local respuesta=""
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
  Instantánea sin cifrar: $origen (hay otra, del ensayo, con la misma etiqueta)
  Instantánea cifrada:    $cifrada

Si algo no funciona, vuelva al disco anterior:
  bash infra/aws/cifrar-disco-raiz.sh --revertir $volumen

Cuando lleve unos días bien (revise el panel ALETHEIA y la prueba de humo), borre lo sin cifrar:
  aws --region $REGION ec2 delete-volume --volume-id $volumen
  y las instantáneas con la etiqueta aletheia-raiz-sin-cifrar (consola de EC2, Instantáneas).
TEXTO
    [[ $respuesta == *'"database":"ok"'* ]] || abortar "el sitio no respondió bien: revise y, si hace falta, revierta."
}

confirmar_corte() {
    cat <<TEXTO

El corte apaga el sitio de 8 a 15 minutos (más si no se hizo antes --preparar). El disco anterior
queda guardado, sin borrar, para volver atrás.
TEXTO
    read -r -p "Escriba CIFRAR para seguir: " respuesta
    [[ $respuesta == CIFRAR ]] || abortar "cancelado."
}

case $modo in
    --preparar)
        avisar "Esta parte NO apaga nada: el sitio sigue en línea."
        preparar
        avisar "Listo. Cuando quiera hacer el corte, ejecute: --cambiar"
        ;;
    --cambiar)
        confirmar_corte
        cambiar
        ;;
    --ejecutar)
        confirmar_corte
        preparar
        cambiar
        ;;
esac
