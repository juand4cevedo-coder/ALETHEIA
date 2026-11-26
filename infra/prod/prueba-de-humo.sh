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
# acepte otros orígenes, que una dirección inventada responda 404 y que las páginas públicas
# traigan su propio HTML (descripción única, og:url propio y datos estructurados). Muestra todas
# las fallas antes de terminar, no solo la primera. Lee JSON con Node, o con python3 si no hay
# Node, así que también corre en Git Bash de Windows.
set -euo pipefail

readonly DOMINIO="${1:-aletheia.sbs}"
# Las direcciones canónicas y og:url siempre dicen el dominio público, también en localhost.
readonly SITIO="https://aletheia.sbs"
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

# Evalúa una condición sobre el JSON que llega por la entrada estándar, guardado en d. Recibe la
# condición en JavaScript y en Python; usa Node si existe y python3 si no.
json_cumple() {
    local javascript=$1 python=$2
    if command -v node >/dev/null 2>&1; then
        node -e "let t='';process.stdin.on('data',(c)=>{t+=c}).on('end',()=>{let d;try{d=JSON.parse(t)}catch{process.exit(1)}process.exit(($javascript)?0:1)})"
    elif command -v python3 >/dev/null 2>&1; then
        python3 -c "import json,sys; d=json.load(sys.stdin); sys.exit(0 if ($python) else 1)"
    else
        echo "Se necesita node o python3 para leer JSON." >&2
        return 1
    fi
}

# Cuerpo de una página, sin seguir redirecciones.
pagina() {
    curl --silent --show-error --max-time 10 "$@"
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
    json_cumple 'd.status === "ok" && d.database === "ok"' \
        'd.get("status") == "ok" and d.get("database") == "ok"' <<<"$salud"; then
    ok "salud de la API y la base"
else
    falla "salud: la API no confirmó la disponibilidad de la base"
fi

# El catálogo público alimenta la portada y la página de precios. Comprobar la respuesta
# evita publicar una web sana en apariencia pero sin planes disponibles.
if curl --silent --show-error --fail --max-time 10 \
    "https://$DOMINIO/api/v1/plans" \
    | json_cumple '["trial", "essential", "professional", "firm"].every((c) => d.some((p) => p.code === c))' \
        '{"trial", "essential", "professional", "firm"} <= {p["code"] for p in d}'; then
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

# 8. Las imágenes llevan caché de una semana; la aplicación no se guarda sin revalidar.
medios="$(cabeceras "https://$DOMINIO/media/producto/tareas.webp")"
exigir "$medios" cache-control "max-age=604800" "captura del producto"
exigir "$portada" cache-control "no-cache" "página principal"

# 9. Un cuerpo de 2 MiB hacia una ruta de la API que no recibe archivos se corta en Caddy, sin
# llegar a la aplicación (solo la subida de evidencias admite cuerpos grandes).
read -r codigo _ <<<"$(head -c 2097152 /dev/zero | curl --silent --max-time 20 --output /dev/null     --write-out '%{http_code} %{redirect_url}' --request POST --header 'X-Aletheia-Request: 1'     --header 'Content-Type: application/json' --data-binary @- "https://$DOMINIO/api/v1/auth/login")"
if [[ $codigo == 413 ]]; then ok "cuerpo excesivo rechazado (413)"; else falla "un cuerpo de 2 MiB respondió $codigo y no 413"; fi

# 10. Cada página pública trae su propio HTML: una sola descripción, og:url con su dirección y
# datos estructurados. Se revisan precios y el último artículo del mapa del sitio.
mapa="$(pagina "https://$DOMINIO/sitemap.xml" || true)"
articulo="$(grep -o "<loc>$SITIO/blog/[^<]*" <<<"$mapa" | tail -n 1 | sed "s|<loc>$SITIO||" || true)"
if [[ -n $articulo ]]; then
    ok "el mapa del sitio lista artículos ($articulo)"
else
    falla "el mapa del sitio no lista artículos del blog"
fi
for ruta in /precios ${articulo:+"$articulo"}; do
    html="$(pagina "https://$DOMINIO$ruta" || true)"
    descripciones="$(grep -o '<meta name="description"' <<<"$html" | wc -l | tr -d ' ')"
    if [[ $descripciones == 1 ]]; then
        ok "$ruta: una sola descripción"
    else
        falla "$ruta: tiene $descripciones descripciones"
    fi
    if grep --quiet --fixed-strings "<meta property=\"og:url\" content=\"$SITIO$ruta\"" <<<"$html"; then
        ok "$ruta: og:url propio"
    else
        falla "$ruta: og:url no es $SITIO$ruta"
    fi
    estructurados="$(grep -o '<script type="application/ld+json">.*</script>' <<<"$html" \
        | sed -e 's|^<script type="application/ld+json">||' -e 's|</script>$||' | head -n 1)"
    if json_cumple 'Array.isArray(d["@graph"]) && d["@graph"].length > 0' \
        'len(d.get("@graph", [])) > 0' <<<"$estructurados"; then
        ok "$ruta: datos estructurados"
    else
        falla "$ruta: sin datos estructurados válidos"
    fi
done

# 10b. Precios trae sus tarjetas en el HTML y su imagen para compartir existe.
html="$(pagina "https://$DOMINIO/precios" || true)"
if grep --quiet --fixed-strings '29.900' <<<"$html"; then
    ok "/precios: los precios están en el HTML"
else
    falla "/precios: el HTML no trae los precios"
fi
if grep --quiet --fixed-strings "<meta property=\"og:image\" content=\"$SITIO/og/precios.png\"" <<<"$html"; then
    ok "/precios: imagen para compartir propia"
else
    falla "/precios: no declara su imagen para compartir"
fi
read -r codigo tipo <<<"$(curl --silent --show-error --max-time 10 --output /dev/null \
    --write-out '%{http_code} %{content_type}' "$SITIO/og/precios.png" || true)"
if [[ $codigo == 200 && $tipo == image/png* ]]; then
    ok "la imagen para compartir de /precios responde"
else
    falla "la imagen para compartir de /precios respondió $codigo $tipo"
fi

# 11. Una dirección inventada responde 404 con noindex; las pantallas de la aplicación, 200.
inventada="/no-existe-$RANDOM"
read -r codigo _ <<<"$(respuesta "https://$DOMINIO$inventada")"
if [[ $codigo == 404 ]]; then ok "$inventada responde 404"; else falla "$inventada respondió $codigo y no 404"; fi
# La página se guarda antes de buscar: con pipefail, grep --quiet cierra el tubo al encontrar
# la etiqueta, curl falla al escribir (código 23) y la comprobación daba falla sin haberla.
html="$(pagina "https://$DOMINIO$inventada" || true)"
if grep --quiet --fixed-strings '<meta name="robots" content="noindex"' <<<"$html"; then
    ok "la página 404 lleva noindex"
else
    falla "la página 404 no lleva noindex"
fi
for ruta in /ingresar /app; do
    read -r codigo _ <<<"$(respuesta "https://$DOMINIO$ruta")"
    if [[ $codigo == 200 ]]; then ok "$ruta responde 200"; else falla "$ruta respondió $codigo"; fi
done

# 12. El HTML sale en Brotli, desde el archivo que comprimió el build.
exigir "$(cabeceras --header 'Accept-Encoding: br' "https://$DOMINIO/")" content-encoding br "página principal"

if ((fallas > 0)); then
    echo "La prueba de humo encontró $fallas fallas."
    exit 1
fi
echo "La prueba de humo pasó."
