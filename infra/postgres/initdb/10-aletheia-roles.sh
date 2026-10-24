#!/bin/sh
# Primer arranque del contenedor: crea los usuarios de ALETHEIA con las claves de infra/.env.
# PostgreSQL solo ejecuta esta carpeta cuando el volumen de datos está vacío. Sin "set -e":
# si el archivo no es ejecutable, la imagen lo carga dentro de su propio script de arranque.
# psql es el último comando, así que su código de salida decide si el arranque falla.
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --file /aletheia/bootstrap.sql
