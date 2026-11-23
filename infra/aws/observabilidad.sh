#!/usr/bin/env bash
# Crea la vigilancia de ALETHEIA en AWS: tema de avisos por correo, alarmas y
# panel. Lo ejecuta una vez la persona administradora, desde CloudShell (región Ohio):
#
#   bash infra/aws/observabilidad.sh <correo-que-recibe-los-avisos>
#
# Es repetible: lo que ya existe se actualiza, no se duplica. Las alarmas avisan antes de que
# algo falle (disco, memoria, créditos de CPU, latencia) y cuando ya falló (salud, errores 5xx).
set -euo pipefail

readonly REGION=us-east-2
readonly ESPACIO="ALETHEIA/Produccion"
readonly ROL=aletheia-prod-instancia
readonly DOMINIO=aletheia.sbs
correo="${1:?Indique el correo que recibirá los avisos.}"
carpeta="$(cd "$(dirname "$0")" && pwd)"
cuenta="$(aws sts get-caller-identity --query Account --output text)"
aws_() { aws --region "$REGION" "$@"; }

instancia="$(aws_ ec2 describe-instances \
    --filters Name=tag:Name,Values=aletheia-prod Name=instance-state-name,Values=running \
    --query 'Reservations[0].Instances[0].InstanceId' --output text)"
[[ "$instancia" == i-* ]] || { echo "No encuentro la instancia aletheia-prod." >&2; exit 1; }

echo "1/4 Tema de avisos y suscripción de correo"
tema="$(aws_ sns create-topic --name aletheia-alertas --query TopicArn --output text)"
aws_ sns subscribe --topic-arn "$tema" --protocol email --notification-endpoint "$correo" >/dev/null

echo "2/4 Permiso del servidor para publicar métricas, y nada más"
aws iam put-role-policy --role-name "$ROL" --policy-name PublicarMetricas --policy-document "$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "cloudwatch:PutMetricData",
    "Resource": "*",
    "Condition": {"StringEquals": {"cloudwatch:namespace": "$ESPACIO"}}
  }]
}
JSON
)"

alarma() { # nombre descripcion espacio metrica estadistica operador umbral periodo evaluaciones faltantes [dimensiones...]
    local nombre="$1" descripcion="$2" espacio="$3" metrica="$4" estadistica="$5" operador="$6"
    local umbral="$7" periodo="$8" evaluaciones="$9" faltantes="${10}"
    shift 10
    aws_ cloudwatch put-metric-alarm --alarm-name "aletheia-$nombre" --alarm-description "$descripcion" \
        --namespace "$espacio" --metric-name "$metrica" --statistic "$estadistica" \
        --comparison-operator "$operador" --threshold "$umbral" --period "$periodo" \
        --evaluation-periods "$evaluaciones" --datapoints-to-alarm "$evaluaciones" \
        --treat-missing-data "$faltantes" --alarm-actions "$tema" --ok-actions "$tema" "$@"
}

echo "3/4 Alarmas"
instancia_dim=(--dimensions "Name=InstanceId,Value=$instancia")
# Fallan: la plataforma ya tiene un problema.
alarma salud-api "La API o la base no responden desde el propio servidor" "$ESPACIO" SaludDeLaApi Minimum \
    LessThanThreshold 1 60 3 breaching
alarma sin-metricas "El servidor dejó de publicar métricas: puede estar caído" "$ESPACIO" SaludDeLaApi SampleCount \
    LessThanThreshold 1 300 2 breaching
alarma errores-5xx "Errores 5xx sostenidos en la API" "$ESPACIO" Errores5xx Sum \
    GreaterThanOrEqualToThreshold 5 300 2 notBreaching
alarma errores-trabajador "El trabajador de segundo plano registra errores" "$ESPACIO" ErroresDelTrabajador Sum \
    GreaterThanOrEqualToThreshold 3 300 2 notBreaching
alarma contenedores "Hay menos contenedores activos de los esperados" "$ESPACIO" ContenedoresActivos Minimum \
    LessThanThreshold 4 60 3 breaching
alarma estado-instancia "La instancia falló una comprobación de estado de AWS" AWS/EC2 StatusCheckFailed Maximum \
    GreaterThanThreshold 0 60 3 notBreaching "${instancia_dim[@]}"
# Avisan antes: la plataforma se está acercando a un límite.
alarma latencia "Latencia p95 de la API por encima de 1,5 s" "$ESPACIO" LatenciaP95 Maximum \
    GreaterThanThreshold 1500 300 3 notBreaching
alarma respaldo "El último respaldo de la base tiene más de 26 horas" "$ESPACIO" RespaldoEdadHoras Maximum \
    GreaterThanThreshold 26 300 2 breaching
alarma disco "Disco por encima del 75 %" "$ESPACIO" DiscoUsado Maximum \
    GreaterThanThreshold 75 300 2 notBreaching
alarma memoria "Memoria por encima del 88 %" "$ESPACIO" MemoriaUsada Maximum \
    GreaterThanThreshold 88 300 3 notBreaching
alarma cpu "CPU por encima del 80 % durante 15 minutos" AWS/EC2 CPUUtilization Average \
    GreaterThanThreshold 80 300 3 notBreaching "${instancia_dim[@]}"
alarma creditos-cpu "Quedan pocos créditos de CPU: la instancia se frenará" AWS/EC2 CPUCreditBalance Minimum \
    LessThanThreshold 40 300 2 notBreaching "${instancia_dim[@]}"
alarma correos-rebotados "Tasa de rebote de correos por encima del 4 %" AWS/SES Reputation.BounceRate Maximum \
    GreaterThanThreshold 0.04 3600 1 notBreaching
alarma correos-quejas "Tasa de quejas de correos por encima de 0,05 %" AWS/SES Reputation.ComplaintRate Maximum \
    GreaterThanThreshold 0.0005 3600 1 notBreaching

echo "4/4 Panel"
panel="$(sed -e "s/INSTANCIA/$instancia/g" -e "s/REGION/$REGION/g" "$carpeta/panel.json")"
aws_ cloudwatch put-dashboard --dashboard-name ALETHEIA --dashboard-body "$panel" >/dev/null

cat <<TEXTO

Listo. Falta un paso suyo: abra el correo $correo y confirme la suscripción de AWS
Sin esa confirmación no llegará ningún aviso.

Panel: https://$REGION.console.aws.amazon.com/cloudwatch/home?region=$REGION#dashboards/dashboard/ALETHEIA
TEXTO
