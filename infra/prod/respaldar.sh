#!/usr/bin/env bash
# Copia diaria de PostgreSQL de aletheia-prod hacia el bucket de respaldos (TT-011). La ejecuta
# el temporizador aletheia-respaldo.timer como root; también se puede lanzar a mano:
#
#   respaldar.sh            # genera, verifica y sube una copia
#   respaldar.sh --revisar  # sale con error si la última copia tiene más de 26 horas
#
# 1. pg_dump en formato personalizado (comprimido) desde el contenedor de PostgreSQL, por el
#    socket local del propio contenedor: no maneja ninguna clave.
# 2. Comprueba que la copia se pueda leer con pg_restore --list. Una copia que no se lee no se
#    sube: es mejor fallar hoy que descubrirlo el día que haga falta.
# 3. La sube con el rol de la máquina (cifrado SSE-S3) junto con su SHA-256. El rol puede
#    escribir pero no borrar: el bucket descarta cada copia a los 7 días con su regla de ciclo
#    de vida.
#
# El nombre del bucket vive en /etc/aletheia/entorno.env como ALETHEIA_BACKUP_BUCKET.
# Restaurar una copia está explicado en docs/operacion/produccion.md.
set -euo pipefail

readonly REGION=us-east-2
readonly COMPOSE=/opt/aletheia/infra/compose.prod.yaml
readonly ESTADO=/var/lib/aletheia
readonly ACTUAL="$ESTADO/despliegue.env"
readonly ENTORNO=/etc/aletheia/entorno.env
readonly MARCA="$ESTADO/ultimo-respaldo"
readonly AWS_CLI=amazon/aws-cli:2.38.1@sha256:733d5be1015825e4038c6016f3fa9954868ddee1f611b73be795a9cc2e706bfd
readonly VIGENCIA_HORAS=26

registrar() {
    printf '%s  %s\n' "$(date -u +%H:%M:%S)" "$*"
}

if [[ ${1:-} == --revisar ]]; then
    [[ -f $MARCA ]] || {
        registrar "No hay registro de ningún respaldo."
        exit 1
    }
    edad=$((($(date +%s) - $(stat -c %Y "$MARCA")) / 3600))
    if ((edad > VIGENCIA_HORAS)); then
        registrar "El último respaldo tiene $edad horas: supera las $VIGENCIA_HORAS."
        exit 1
    fi
    registrar "Último respaldo hace $edad horas."
    exit 0
fi

bucket="$(sed -n 's/^ALETHEIA_BACKUP_BUCKET=//p' "$ENTORNO" 2>/dev/null || true)"
[[ -n $bucket ]] || {
    registrar "Falta ALETHEIA_BACKUP_BUCKET en $ENTORNO."
    exit 1
}

temporal="$(mktemp -d /var/tmp/aletheia-respaldo.XXXXXX)"
trap 'rm -rf "$temporal"' EXIT
chmod 700 "$temporal"

sello="$(date -u +%Y%m%dT%H%M%SZ)"
archivo="aletheia-$sello.dump"
compose() {
    docker compose --env-file "$ACTUAL" -f "$COMPOSE" "$@"
}

registrar "Generando $archivo..."
compose exec -T postgres pg_dump --username aletheia --dbname aletheia --format custom \
    >"$temporal/$archivo"

registrar "Comprobando que la copia se pueda leer..."
compose exec -T postgres pg_restore --list <"$temporal/$archivo" >/dev/null
[[ -s $temporal/$archivo ]] || {
    registrar "La copia quedó vacía."
    exit 1
}

(cd "$temporal" && sha256sum "$archivo" >"$archivo.sha256")
tamano="$(stat -c %s "$temporal/$archivo")"

registrar "Subiendo ${tamano} bytes a s3://$bucket/postgres/..."
docker run --rm --log-driver none --volume "$temporal:/datos:ro" "$AWS_CLI" s3 cp \
    "/datos/$archivo" "s3://$bucket/postgres/$archivo" \
    --region "$REGION" --sse AES256 --only-show-errors
docker run --rm --log-driver none --volume "$temporal:/datos:ro" "$AWS_CLI" s3 cp \
    "/datos/$archivo.sha256" "s3://$bucket/postgres/$archivo.sha256" \
    --region "$REGION" --sse AES256 --only-show-errors

touch "$MARCA"
registrar "Respaldo $archivo completo."
