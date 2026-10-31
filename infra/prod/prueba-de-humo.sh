#!/usr/bin/env bash
# Prueba de humo externa de ALETHEIA: consulta el sitio desde fuera, como un visitante. La
# ejecuta .github/workflows/publicar.yml después de cada despliegue y, si falla, el workflow
# vuelve a la versión anterior. También sirve desde el equipo del administrador (en WSL):
#
#   bash infra/prod/prueba-de-humo.sh            # aletheia.sbs
#   bash infra/prod/prueba-de-humo.sh localhost  # la imagen de Caddy probada en local
#
# Revisa la salud de la API y la base, las cabeceras de seguridad (también en un error), las
# redirecciones de HTTP y de www, que la documentación interactiva no exista y que la API no
# acepte otros orígenes. Muestra todas las fallas antes de terminar, no solo la primera.
set -euo pipefail

readonly DOMINIO="${1:-aletheia.sbs}"
fallas=0

ok() { printf 'ok     %s\n' "$1"; }
falla() {
    printf 'FALLA  %s\n' "$1"
    fallas=$((fallas + 1))
}

# Cabeceras de una respuesta, sin retornos de carro y en minúsculas para compararlas sin
# depender de mayúsculas. No sigue redirecciones.
cabeceras() {
    curl --silent --show-error --max-time 10 --output /dev/null --dump-header - "$@" \
        | tr -d '\r' | tr '[:upper:]' '[:lower:]'
}

# Código HTTP y destino de la redirección, si la hay.
respuesta() {
    curl --silent --show-error --max-time 10 --output /dev/null \
        --write-out '%{http_code} %{redirect_url}' "$@"
}

# Comprueba que una cabecera exista con un valor que contiene el texto esperado.
exigir() {
    local bloque=$1 nombre=$2 valor=$3 donde=$4
    # Sin --quiet en el segundo grep: así lee todo y el primero nunca recibe SIGPIPE.
    if grep "^$nombre: " <<<"$bloque" | grep --fixed-strings -- "$valor" >/dev/null; then
        ok "$donde: $nombre ($valor)"
    else
        falla "$donde: falta $nombre con $valor"
    fi
}

revisar_cabeceras() {
    local bloque=$1 donde=$2
    exigir "$bloque" strict-transport-security "max-age=31536000; includesubdomains" "$donde"
    exigir "$bloque" content-security-policy "default-src 'self'" "$donde"
    exigir "$bloque" content-security-policy "frame-ancestors 'none'" "$donde"
    exigir "$bloque" x-content-type-options nosniff "$donde"
    exigir "$bloque" referrer-policy strict-origin-when-cross-origin "$donde"
    exigir "$bloque" permissions-policy "camera=()" "$donde"
    exigir "$bloque" cross-origin-opener-policy same-origin "$donde"
    if grep --quiet '^server:' <<<"$bloque"; then
        falla "$donde: anuncia la cabecera server"
    else
        ok "$donde: sin cabecera server"
    fi
}

echo "Prueba de humo en https://$DOMINIO"

# 1. Salud. Los reintentos cubren los segundos que tardan el DNS o el primer certificado.
if curl --silent --show-error --fail --max-time 10 --retry 10 --retry-delay 3 \
    --retry-all-errors --output /dev/null "https://$DOMINIO/api/v1/health"; then
    ok "salud de la API y la base"
else
    falla "salud: /api/v1/health no respondió 200"
fi

# 2. Cabeceras en la página principal y en un error.
revisar_cabeceras "$(cabeceras "https://$DOMINIO/")" "página principal"
revisar_cabeceras "$(cabeceras "https://$DOMINIO/assets/no-existe.js")" "error 404"

# 3. HTTP pasa a HTTPS, y www al dominio principal conservando la ruta.
read -r codigo destino <<<"$(respuesta "http://$DOMINIO/prueba?x=1")"
if [[ $codigo =~ ^30[18]$ && $destino == "https://$DOMINIO/prueba?x=1" ]]; then
    ok "HTTP redirige a HTTPS ($codigo)"
else
    falla "HTTP: se esperaba 301 o 308 hacia HTTPS y llegó $codigo $destino"
fi
read -r codigo destino <<<"$(respuesta "https://www.$DOMINIO/prueba?x=1")"
if [[ $codigo == 301 && $destino == "https://$DOMINIO/prueba?x=1" ]]; then
    ok "www redirige al dominio principal (301)"
else
    falla "www: se esperaba 301 hacia https://$DOMINIO y llegó $codigo $destino"
fi

# 4. En producción no existe la documentación interactiva.
for ruta in /api/v1/docs /api/v1/openapi.json; do
    read -r codigo _ <<<"$(respuesta "https://$DOMINIO$ruta")"
    if [[ $codigo == 404 ]]; then ok "$ruta no existe"; else falla "$ruta respondió $codigo"; fi
done

# 5. La API solo se usa desde su propio origen: a otro sitio no le da permiso de leerla.
if grep --quiet '^access-control-allow-origin:' \
    <<<"$(cabeceras --header 'Origin: https://otro-sitio.example' "https://$DOMINIO/api/v1/health")"; then
    falla "la API acepta peticiones de otro origen"
else
    ok "la API rechaza otros orígenes"
fi

if ((fallas > 0)); then
    echo "La prueba de humo encontró $fallas fallas."
    exit 1
fi
echo "La prueba de humo pasó."
