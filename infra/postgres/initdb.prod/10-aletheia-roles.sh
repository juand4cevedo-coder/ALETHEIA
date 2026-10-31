#!/bin/sh
# Primer arranque en producción: crea los usuarios de ALETHEIA con las claves que trae
# infra/prod/iniciar-postgres.sh desde Parameter Store. A diferencia de desarrollo, no crea
# la base de pruebas.
# Sin "set -e" por la misma razón que en infra/postgres/initdb: si el archivo no es
# ejecutable, la imagen lo carga dentro de su propio script de arranque. Si falta una clave,
# el arranque se detiene antes de crear cualquier usuario.
: "${ALETHEIA_OWNER_PASSWORD:?Falta ALETHEIA_OWNER_PASSWORD}" &&
    : "${ALETHEIA_APP_PASSWORD:?Falta ALETHEIA_APP_PASSWORD}" &&
    : "${ALETHEIA_SUPPORT_PASSWORD:?Falta ALETHEIA_SUPPORT_PASSWORD}" &&
    psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --file /aletheia/bootstrap.sql
