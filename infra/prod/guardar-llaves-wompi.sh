#!/usr/bin/env bash
# Guarda las tres llaves secretas de Wompi en Parameter Store, sin que aparezcan en pantalla, en el
# historial ni como argumento de un comando. Se ejecuta en CloudShell (o donde haya sesión de AWS
# con permiso de escritura en /aletheia/prod/*), una sola vez por llave nueva.
#
#   bash guardar-llaves-wompi.sh
#
# Pide, en este orden y sin mostrarlas: llave privada, secreto de integridad y secreto de eventos.
# Al terminar imprime las cuatro líneas que van en /etc/aletheia/entorno.env del servidor (ver
# docs/operacion/produccion.md, sección «Wompi»).
set -euo pipefail

REGION="${AWS_REGION:-us-east-2}"
RAIZ="/aletheia/prod/wompi"

leer() {
    local etiqueta="$1" prefijo="$2" valor
    read -r -s -p "$etiqueta: " valor
    echo >&2
    [[ $valor == "$prefijo"* ]] || {
        echo "El valor no empieza con $prefijo; revise que sea la llave de producción." >&2
        exit 1
    }
    printf '%s' "$valor"
}

guardar() {
    local nombre="$1" valor="$2"
    printf '%s' "$valor" | aws ssm put-parameter \
        --region "$REGION" --name "$RAIZ/$nombre" --type SecureString \
        --overwrite --value file:///dev/stdin > /dev/null
    echo "Guardado $RAIZ/$nombre"
}

privada="$(leer 'Llave privada (prv_prod_...)' 'prv_prod_')"
guardar private-key "$privada"
integridad="$(leer 'Secreto de integridad (prod_integrity_...)' 'prod_integrity_')"
guardar integrity-secret "$integridad"
eventos="$(leer 'Secreto de eventos (prod_events_...)' 'prod_events_')"
guardar events-secret "$eventos"

cat <<TEXTO

Agregue estas líneas a /etc/aletheia/entorno.env del servidor (la llave pública pub_prod_... no es
secreta; cámbiela por la suya):

ALETHEIA_WOMPI_PUBLIC_KEY=pub_prod_REEMPLACE
ALETHEIA_WOMPI_PRIVATE_KEY_PARAMETER=$RAIZ/private-key
ALETHEIA_WOMPI_INTEGRITY_SECRET_PARAMETER=$RAIZ/integrity-secret
ALETHEIA_WOMPI_EVENTS_SECRET_PARAMETER=$RAIZ/events-secret
TEXTO
