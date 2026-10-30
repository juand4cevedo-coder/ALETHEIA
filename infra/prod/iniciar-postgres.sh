#!/usr/bin/env bash
# Primer arranque de PostgreSQL en producción (aletheia-prod). Se ejecuta una sola vez, en el
# servidor, con: bash /opt/aletheia/infra/prod/iniciar-postgres.sh
#
# 1. Comprueba que la base no exista; si ya existe, se detiene sin tocar nada.
# 2. Lee las cuatro claves de Parameter Store con el rol de la máquina.
# 3. Levanta PostgreSQL con ellas para que cree su administrador y los usuarios de ALETHEIA.
# 4. Recrea el contenedor sin las claves. Desde ahí solo existen en Parameter Store y, como
#    huella SCRAM, dentro de PostgreSQL.
#
# Las claves nunca se imprimen, no se escriben en archivos ni pasan como argumento de un comando.
set -euo pipefail

readonly REGION=us-east-2
readonly RUTA=/aletheia/prod/postgres
readonly AWS_CLI=amazon/aws-cli:2.38.1
readonly VOLUMEN=aletheia-prod_postgres-data

cd "$(dirname "$(readlink -f "$0")")/.."

if docker volume inspect "$VOLUMEN" >/dev/null 2>&1; then
    echo "El volumen $VOLUMEN ya existe: PostgreSQL ya se inicializó. No cambio nada." >&2
    exit 1
fi

# Lee una clave de Parameter Store. Con --log-driver none Docker no la guarda en sus registros.
leer_clave() {
    docker run --rm --log-driver none "$AWS_CLI" ssm get-parameter \
        --region "$REGION" --name "$RUTA/$1-password" --with-decryption \
        --query Parameter.Value --output text
}

echo "Leyendo las claves de Parameter Store..."
POSTGRES_PASSWORD="$(leer_clave admin)"
ALETHEIA_OWNER_PASSWORD="$(leer_clave owner)"
ALETHEIA_APP_PASSWORD="$(leer_clave app)"
ALETHEIA_SUPPORT_PASSWORD="$(leer_clave support)"
export POSTGRES_PASSWORD ALETHEIA_OWNER_PASSWORD ALETHEIA_APP_PASSWORD ALETHEIA_SUPPORT_PASSWORD

echo "Primer arranque: creando la base y sus usuarios..."
docker compose -f compose.prod.yaml -f compose.prod.init.yaml up --detach --wait postgres

unset POSTGRES_PASSWORD ALETHEIA_OWNER_PASSWORD ALETHEIA_APP_PASSWORD ALETHEIA_SUPPORT_PASSWORD

echo "Recreando el contenedor sin las claves..."
docker compose -f compose.prod.yaml up --detach --wait --force-recreate postgres

echo "Listo: PostgreSQL quedó en marcha y sin claves en su configuración."
