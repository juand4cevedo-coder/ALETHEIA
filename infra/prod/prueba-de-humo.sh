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
    curl --silent --show-error --suppress-connect-headers --max-time 10 --output /dev/null --dump-header - "$@" \
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
    exigir "$bloque" cross-origin-resource-policy same-origin "$donde"
    if grep --quiet '^server:' <<<"$bloque"; then
        falla "$donde: anuncia la cabecera server"
    else
        ok "$donde: sin cabecera server"
    fi
}

echo "Prueba de humo en https://$DOMINIO"

# 1. Salud. Los reintentos cubren los segundos que tardan el DNS o el primer certificado.
if salud="$(curl --silent --show-error --fail --max-time 10 --retry 10 --retry-delay 3 \
    --retry-all-errors "https://$DOMINIO/api/v1/health")" && \
    python3 -c 'import json,sys; data=json.load(sys.stdin); sys.exit(data.get("status") != "ok" or data.get("database") != "ok")' <<<"$salud"; then
    ok "salud de la API y la base"
else
    falla "salud: la API no confirmó la disponibilidad de la base"
fi

# El catálogo público alimenta la portada y la página de precios. Comprobar la respuesta
# evita publicar una web sana en apariencia pero sin planes disponibles.
if curl --silent --show-error --fail --max-time 10 \
    "https://$DOMINIO/api/v1/plans" \
    | python3 -c 'import json,sys; plans=json.load(sys.stdin); codes={p["code"] for p in plans}; sys.exit(0 if {"trial","essential","professional","firm"} <= codes else 1)'; then
    ok "catálogo público de planes"
else
    falla "planes: faltan los planes públicos esperados"
fi

# 2. Cabeceras en la página principal y en un error.
portada="$(cabeceras "https://$DOMINIO/")"
if grep -Eq '^http/[^ ]+ 200( |$)' <<<"$portada"; then ok "portada disponible"; else falla "la portada no respondió 200"; fi
exigir "$portada" content-type "text/html" "página principal"
revisar_cabeceras "$portada" "página principal"
ausente="$(cabeceras "https://$DOMINIO/assets/no-existe.js")"
if grep -Eq '^http/[^ ]+ 404( |$)' <<<"$ausente"; then ok "recurso ausente"; else falla "el recurso ausente no respondió 404"; fi
revisar_cabeceras "$ausente" "error 404"

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

# 6. Una petición que cambia algo sin el encabezado propio de la interfaz no pasa (CSRF).
read -r codigo _ <<<"$(respuesta --request POST --header 'Content-Type: application/json' \
    --data '{}' "https://$DOMINIO/api/v1/auth/login")"
if [[ $codigo == 403 ]]; then
    ok "la API rechaza peticiones sin el encabezado propio"
else
    falla "un POST sin el encabezado propio respondió $codigo"
fi

# 7. Contacto de seguridad publicado (RFC 9116).
read -r codigo _ <<<"$(respuesta "https://$DOMINIO/.well-known/security.txt")"
if [[ $codigo == 200 ]]; then ok "security.txt publicado"; else falla "security.txt respondió $codigo"; fi

# 8. Las fotografías llevan caché de una semana; la aplicación no se guarda sin revalidar.
medios="$(cabeceras "https://$DOMINIO/media/campaign/hero-real-1280.webp")"
exigir "$medios" cache-control "max-age=604800" "fotografía"
exigir "$portada" cache-control "no-cache" "página principal"

# 9. Un cuerpo de 2 MiB hacia una ruta de la API que no recibe archivos se corta en Caddy, sin
# llegar a la aplicación (solo la subida de evidencias admite cuerpos grandes).
read -r codigo _ <<<"$(head -c 2097152 /dev/zero | curl --silent --max-time 20 --output /dev/null     --write-out '%{http_code} %{redirect_url}' --request POST --header 'X-Aletheia-Request: 1'     --header 'Content-Type: application/json' --data-binary @- "https://$DOMINIO/api/v1/auth/login")"
if [[ $codigo == 413 ]]; then ok "cuerpo excesivo rechazado (413)"; else falla "un cuerpo de 2 MiB respondió $codigo y no 413"; fi

if ((fallas > 0)); then
    echo "La prueba de humo encontró $fallas fallas."
    exit 1
fi
echo "La prueba de humo pasó."
