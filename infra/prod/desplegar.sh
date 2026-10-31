#!/usr/bin/env bash
# Despliegue de ALETHEIA en aletheia-prod. Lo ejecuta el documento de SSM aletheia-desplegar
# como root, nunca una persona por SSH:
#
#   desplegar.sh desplegar vX.Y.Z sha256:<api> sha256:<web>
#   desplegar.sh revertir  vX.Y.Z sha256:<api> sha256:<web>
#
# desplegar: el documento ya dejó /opt/aletheia en la etiqueta vX.Y.Z. El script descarga las
# dos imágenes por digest, guarda el despliegue actual como anterior, aplica las migraciones,
# actualiza los contenedores y consulta la salud por HTTPS desde la misma máquina. Si algo
# falla después de cambiar la configuración, vuelve solo a la versión anterior.
#
# revertir: lo pide la CI cuando la prueba de humo externa falla. Solo actúa si lo que está
# desplegado es exactamente esa versión con esos digests, y entonces vuelve a la anterior.
#
# Las migraciones nunca se revierten: cada una debe dejar funcionando también la versión
# anterior de la API (ADR-018). Por eso volver atrás solo cambia imágenes y código.
set -euo pipefail

readonly REPO=/opt/aletheia
readonly COMPOSE="$REPO/infra/compose.prod.yaml"
readonly ESTADO=/var/lib/aletheia
readonly ACTUAL="$ESTADO/despliegue.env"
readonly ANTERIOR="$ESTADO/despliegue.anterior.env"
readonly FALLIDO="$ESTADO/despliegue.fallido.env"
readonly REGISTRO=ghcr.io/juand4cevedo-coder
readonly DOMINIO=aletheia.sbs
readonly PATRON_VERSION='^v[0-9]+\.[0-9]+\.[0-9]+$'
readonly PATRON_DIGEST='^sha256:[a-f0-9]{64}$'

registrar() {
    printf '%s  %s\n' "$(date -u +%H:%M:%S)" "$*"
}

compose() {
    docker compose --env-file "$ACTUAL" -f "$COMPOSE" "$@"
}

repo() {
    git -C "$REPO" -c safe.directory="$REPO" "$@"
}

# Contenido del archivo de variables. Se genera siempre igual para poder compararlo con cmp.
variables() {
    printf '# Lo escribe infra/prod/desplegar.sh en cada despliegue. No se edita a mano.\n'
    printf 'ALETHEIA_VERSION=%s\n' "$1"
    printf 'ALETHEIA_API_IMAGEN=%s/aletheia-api@%s\n' "$REGISTRO" "$2"
    printf 'ALETHEIA_WEB_IMAGEN=%s/aletheia-web@%s\n' "$REGISTRO" "$3"
}

version_de() {
    sed -n 's/^ALETHEIA_VERSION=//p' "$1"
}

# Deja el código en la versión que está corriendo, para que compose.prod.yaml coincida con
# las imágenes. Sin despliegue previo no hay a dónde volver y el código se queda como está.
codigo_de_la_version_actual() {
    [[ -f $ACTUAL ]] || return 0
    local version
    version="$(version_de "$ACTUAL")"
    [[ $version =~ $PATRON_VERSION ]] || { registrar "La versión de $ACTUAL no es válida."; return 1; }
    repo checkout --quiet --detach "$version"
}

levantar_y_comprobar() {
    registrar "Actualizando los contenedores..."
    compose up --detach --wait --wait-timeout 180 || return 1
    # Por HTTPS y con el nombre del dominio, como llegaría un usuario, pero sin salir de la
    # máquina: así se comprueban a la vez Caddy, su certificado, la API y la base de datos.
    # Los reintentos cubren los segundos que tarda Caddy en pedir el primer certificado.
    registrar "Consultando la salud en https://$DOMINIO/api/v1/health..."
    curl --silent --show-error --fail --output /dev/null \
        --max-time 10 --retry 10 --retry-delay 3 --retry-all-errors \
        --resolve "$DOMINIO:443:127.0.0.1" "https://$DOMINIO/api/v1/health"
}

# Vuelve a la versión guardada en $ANTERIOR. La que falló queda en $FALLIDO para revisarla.
volver_a_la_anterior() {
    if [[ ! -f $ANTERIOR ]]; then
        registrar "No hay una versión anterior a la cual volver. Dejo todo como está para revisarlo."
        return 1
    fi
    cp "$ACTUAL" "$FALLIDO"
    mv -f "$ANTERIOR" "$ACTUAL"
    registrar "Volviendo a $(version_de "$ACTUAL")..."
    if ! codigo_de_la_version_actual || ! levantar_y_comprobar; then
        registrar "La versión anterior tampoco quedó sana. Hay que revisarlo a mano."
        return 1
    fi
    registrar "Quedó otra vez $(version_de "$ACTUAL"). La versión fallida está en $FALLIDO."
}

desplegar() {
    local version=$1 api=$2 web=$3 nuevo
    registrar "Desplegando $version."

    registrar "Descargando las imágenes..."
    if ! docker pull --quiet "$REGISTRO/aletheia-api@$api" \
        || ! docker pull --quiet "$REGISTRO/aletheia-web@$web"; then
        registrar "No pude descargar las imágenes. No cambié nada."
        codigo_de_la_version_actual
        return 1
    fi

    # El archivo nuevo se escribe aparte y se mueve de una vez: nunca queda a medias.
    nuevo="$(mktemp "$ESTADO/nuevo.XXXXXX")"
    variables "$version" "$api" "$web" >"$nuevo"
    local hay_respaldo=false
    if [[ -f $ACTUAL ]] && ! cmp --silent "$ACTUAL" "$nuevo"; then
        cp "$ACTUAL" "$ANTERIOR"
        hay_respaldo=true
    fi
    mv -f "$nuevo" "$ACTUAL"

    registrar "Aplicando las migraciones..."
    if ! compose run --rm migrate; then
        registrar "Las migraciones fallaron. La API que está corriendo no cambió."
        if [[ $hay_respaldo == true ]]; then
            volver_a_la_anterior || true
        else
            registrar "No hay una versión anterior a la cual volver. Dejo todo como está para revisarlo."
        fi
        return 1
    fi

    if ! levantar_y_comprobar; then
        registrar "La versión $version no quedó sana."
        if [[ $hay_respaldo == true ]]; then
            volver_a_la_anterior || true
        else
            registrar "No hay una versión anterior a la cual volver. Dejo todo como está para revisarlo."
        fi
        return 1
    fi
    registrar "Listo: $version está en producción."
}

revertir() {
    [[ -f $ACTUAL ]] || { registrar "No hay ningún despliegue. No hay nada que revertir."; return 1; }
    # Solo se revierte lo que la CI acaba de desplegar. Si entretanto llegó otra versión, o
    # ya se revirtió, no se toca nada.
    if ! cmp --silent "$ACTUAL" <(variables "$1" "$2" "$3"); then
        registrar "Lo desplegado no es $1 con esos digests. No revierto nada."
        return 1
    fi
    registrar "Revirtiendo $1."
    volver_a_la_anterior
}

main() {
    if [[ $# -ne 4 ]] || [[ $1 != desplegar && $1 != revertir ]] \
        || ! [[ $2 =~ $PATRON_VERSION && $3 =~ $PATRON_DIGEST && $4 =~ $PATRON_DIGEST ]]; then
        echo "Uso: $0 desplegar|revertir vX.Y.Z sha256:<api> sha256:<web>" >&2
        return 2
    fi
    # SSM no siempre define HOME, y Git y Docker lo necesitan para su configuración.
    export HOME="${HOME:-/root}"
    umask 027
    mkdir -p "$ESTADO"

    # Un solo despliegue a la vez.
    exec 9>"$ESTADO/despliegue.lock"
    flock --nonblock 9 || { registrar "Ya hay un despliegue en curso."; return 1; }

    case $1 in
        desplegar) desplegar "$2" "$3" "$4" ;;
        revertir) revertir "$2" "$3" "$4" ;;
    esac
}

# Todo va dentro de main y en una sola línea: Bash lee esta línea completa antes de ejecutarla.
# Así, si al volver atrás Git reemplaza este archivo, el script en curso no lee el nuevo.
main "$@"; exit
