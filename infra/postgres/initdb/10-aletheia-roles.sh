#!/bin/sh
# Primer arranque del contenedor: crea los usuarios de ALETHEIA con las claves de infra/.env
# y una segunda base, con el sufijo _test, para las pruebas del backend.
# PostgreSQL solo ejecuta esta carpeta cuando el volumen de datos está vacío. Sin "set -e":
# si el archivo no es ejecutable, la imagen lo carga dentro de su propio script de arranque.
# Los comandos van unidos con &&, así que el código de salida del último decide si falla.
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --file /aletheia/bootstrap.sql &&
    psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
        --command "CREATE DATABASE \"${POSTGRES_DB}_test\"" &&
    psql --username "$POSTGRES_USER" --dbname "${POSTGRES_DB}_test" \
        --file /aletheia/bootstrap.sql
