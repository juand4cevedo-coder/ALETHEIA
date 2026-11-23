#!/usr/bin/env bash
# Ensayo de restauración: genera una copia de la base de producción, la restaura en una base
# temporal dentro del mismo PostgreSQL y compara el esquema y el número de filas de las tablas
# principales. No toca la base de producción (solo la lee) y borra la temporal al terminar.
#
#   ensayar-restauracion.sh
#
# Un respaldo que nunca se restauró no es una garantía: se ensaya al menos una vez por trimestre.
set -euo pipefail

readonly COMPOSE=/opt/aletheia/infra/compose.prod.yaml
readonly ACTUAL=/var/lib/aletheia/despliegue.env
readonly TEMPORAL=aletheia_ensayo
readonly TABLAS=(organizations users cases evidences custody_events case_tasks case_notes audit_log)

compose() { docker compose --env-file "$ACTUAL" -f "$COMPOSE" "$@"; }
sql() { compose exec -T postgres psql --username aletheia --no-psqlrc --tuples-only --no-align "$@"; }
registrar() { printf '%s  %s\n' "$(date -u +%H:%M:%S)" "$*"; }

carpeta="$(mktemp -d)"
limpiar() {
    sql --dbname aletheia --command "DROP DATABASE IF EXISTS $TEMPORAL" >/dev/null 2>&1 || true
    rm -rf "$carpeta"
}
trap limpiar EXIT

declare -A antes
for tabla in "${TABLAS[@]}"; do
    antes[$tabla]="$(sql --dbname aletheia --command "SELECT count(*) FROM $tabla")"
done

registrar "Generando la copia..."
compose exec -T postgres pg_dump --username aletheia --dbname aletheia --format custom >"$carpeta/copia.dump"
[[ -s $carpeta/copia.dump ]] || { registrar "La copia quedó vacía."; exit 1; }

registrar "Creando la base temporal $TEMPORAL..."
sql --dbname aletheia --command "DROP DATABASE IF EXISTS $TEMPORAL" >/dev/null
sql --dbname aletheia --command "CREATE DATABASE $TEMPORAL" >/dev/null

registrar "Restaurando..."
compose exec -T postgres pg_restore --username aletheia --dbname "$TEMPORAL" --no-owner \
    --exit-on-error <"$carpeta/copia.dump"

fallos=0
registrar "Comparando filas (producción antes y después de la copia / restaurada):"
for tabla in "${TABLAS[@]}"; do
    original="$(sql --dbname aletheia --command "SELECT count(*) FROM $tabla")"
    restaurada="$(sql --dbname "$TEMPORAL" --command "SELECT count(*) FROM $tabla")"
    # Producción sigue recibiendo escrituras mientras se ensaya: la copia debe quedar entre el
    # conteo previo y el posterior.
    if ((restaurada >= antes[$tabla] && restaurada <= original)); then
        printf '  %-16s %s / %s  igual\n' "$tabla" "$original" "$restaurada"
    else
        printf '  %-16s %s / %s  DIFERENTE\n' "$tabla" "$original" "$restaurada"
        fallos=1
    fi
done

version_original="$(sql --dbname aletheia --command "SELECT version_num FROM alembic_version")"
version_restaurada="$(sql --dbname "$TEMPORAL" --command "SELECT version_num FROM alembic_version")"
registrar "Versión del esquema: producción $version_original, restaurada $version_restaurada"
[[ "$version_original" == "$version_restaurada" ]] || fallos=1

if ((fallos)); then
    registrar "ENSAYO FALLIDO: la copia no reproduce la base."
    exit 1
fi
registrar "ENSAYO CORRECTO: la copia restaura igual que producción."
