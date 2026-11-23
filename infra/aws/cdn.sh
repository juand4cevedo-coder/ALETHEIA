#!/usr/bin/env bash
# Red de distribución (CloudFront) para los archivos estáticos de ALETHEIA, en cdn.aletheia.sbs.
# La ejecuta la persona administradora desde CloudShell, con MFA:
#
#   bash infra/aws/cdn.sh --revisar       # solo mira lo que ya existe
#   bash infra/aws/cdn.sh --certificado   # pide el certificado y muestra el registro DNS a crear
#   bash infra/aws/cdn.sh --crear         # con el certificado emitido, crea la distribución
#   bash infra/aws/cdn.sh --estado        # comprueba que cdn.aletheia.sbs ya sirve archivos
#
# Solo se sirven por aquí las rutas /assets/, /media/ y /brand/ (archivos públicos y con huella o
# de caché larga). El HTML, la API, las sesiones y toda la evidencia siguen saliendo del servidor
# de siempre: nada sensible pasa por la red de distribución. Una función de CloudFront responde 404
# a cualquier otra ruta, así que cdn.aletheia.sbs/api/... no existe.
#
# El certificado de CloudFront debe vivir en Norte de Virginia (us-east-1), la única región donde
# CloudFront lo acepta; la cuenta permite certificados allí.
set -euo pipefail

readonly DOMINIO=cdn.aletheia.sbs
readonly ORIGEN=aletheia.sbs
readonly SITIO=https://aletheia.sbs
readonly REGION_CERTIFICADO=us-east-1
modo="${1:---revisar}"
aws_() { aws --output text "$@"; }
avisar() { printf '%s  %s\n' "$(date -u +%H:%M:%S)" "$*"; }
abortar() {
    printf 'ERROR: %s\n' "$*" >&2
    exit 1
}

certificado="$(aws_ acm list-certificates --region "$REGION_CERTIFICADO" \
    --query "CertificateSummaryList[?DomainName=='$DOMINIO'].CertificateArn | [0]")"
[[ $certificado != None ]] || certificado=""
distribucion="$(aws_ cloudfront list-distributions \
    --query "DistributionList.Items[?contains(Aliases.Items, '$DOMINIO')].Id | [0]")"
[[ $distribucion != None && -n $distribucion ]] || distribucion=""

estado_certificado() {
    aws_ acm describe-certificate --region "$REGION_CERTIFICADO" --certificate-arn "$certificado" \
        --query Certificate.Status
}

registro_validacion() {
    aws_ acm describe-certificate --region "$REGION_CERTIFICADO" --certificate-arn "$certificado" \
        --query 'Certificate.DomainValidationOptions[0].ResourceRecord.[Name,Type,Value]'
}

if [[ $modo == --revisar ]]; then
    avisar "Certificado: ${certificado:-ninguno} ($( [[ -n $certificado ]] && estado_certificado || echo '-' ))"
    avisar "Distribución: ${distribucion:-ninguna}"
    if [[ -n $distribucion ]]; then
        aws_ cloudfront get-distribution --id "$distribucion" \
            --query 'Distribution.[DomainName,Status,DistributionConfig.Enabled]'
    fi
    exit 0
fi

if [[ $modo == --certificado ]]; then
    if [[ -z $certificado ]]; then
        avisar "Pidiendo el certificado de $DOMINIO en $REGION_CERTIFICADO..."
        certificado="$(aws_ acm request-certificate --region "$REGION_CERTIFICADO" \
            --domain-name "$DOMINIO" --validation-method DNS --idempotency-token cdnaletheia \
            --tags Key=Name,Value=aletheia-cdn --query CertificateArn)"
    else
        avisar "Ya existe el certificado $certificado."
    fi
    for _ in $(seq 1 20); do
        read -r nombre tipo valor < <(registro_validacion 2>/dev/null || true)
        [[ -n ${nombre:-} && ${nombre:-} != None ]] && break
        sleep 3
    done
    [[ -n ${nombre:-} && ${nombre:-} != None ]] || abortar "AWS aún no entrega el registro: repita en un minuto."
    cat <<TEXTO

Estado del certificado: $(estado_certificado)

Cree este registro en el DNS de Hostinger (Dominios > aletheia.sbs > DNS / Servidores de nombres >
Registros DNS), tal como se lo muestro. Sirve para que AWS compruebe que el dominio es suyo:

  Tipo:    $tipo
  Nombre:  $nombre
  Valor:   $valor

Ojo con el nombre: Hostinger suele agregar solo ".aletheia.sbs" al final. Si el nombre de arriba
ya termina en ".aletheia.sbs.", escriba solo la parte de la izquierda y sin el punto final.
TTL: 300. Cuando lo haya creado, espere unos minutos y ejecute: --crear
TEXTO
    exit 0
fi

if [[ $modo == --estado ]]; then
    [[ -n $distribucion ]] || abortar "no hay distribución."
    estado="$(aws_ cloudfront get-distribution --id "$distribucion" --query Distribution.Status)"
    avisar "Estado de la distribución: $estado"
    archivo="$(curl -fsS -m 20 "$SITIO/" | grep -o '/assets/index-[A-Za-z0-9_-]*\.js' | head -1)"
    for cabecera in "https://$DOMINIO$archivo" "https://$DOMINIO/api/v1/health" "https://$DOMINIO/"; do
        codigo="$(curl -s -o /dev/null -D - -m 20 "$cabecera" -H "Origin: $SITIO" | tr -d '\r' \
            | awk 'NR==1{c=$2} tolower($1)=="x-cache:"{x=$2" "$3} tolower($1)=="access-control-allow-origin:"{o=$2} tolower($1)=="cross-origin-resource-policy:"{p=$2} END{print c" cache="x" cors="o" corp="p}')"
        printf '  %-70s %s\n' "$cabecera" "$codigo"
    done
    avisar "Esperado: el archivo con 200 (cors=$SITIO, corp=cross-origin) y las otras dos rutas con 404."
    exit 0
fi

[[ $modo == --crear ]] || abortar "modo desconocido: $modo (use --revisar, --certificado, --crear o --estado)."
[[ -z $distribucion ]] || abortar "ya existe la distribución $distribucion."
[[ -n $certificado ]] || abortar "primero ejecute --certificado."
avisar "Esperando a que el certificado quede emitido (hasta 30 minutos)..."
for _ in $(seq 1 180); do
    [[ "$(estado_certificado)" == ISSUED ]] && break
    sleep 10
done
[[ "$(estado_certificado)" == ISSUED ]] \
    || abortar "el certificado no está emitido. Revise que creó el registro DNS y repita."

trabajo="$(mktemp -d)"
trap 'rm -rf "$trabajo"' EXIT

avisar "1/4 Función que solo deja pasar /assets/, /media/ y /brand/..."
cat >"$trabajo/funcion.js" <<'JS'
function handler(event) {
  var uri = event.request.uri;
  if (uri.indexOf('/assets/') === 0 || uri.indexOf('/media/') === 0 || uri.indexOf('/brand/') === 0) {
    return event.request;
  }
  return { statusCode: 404, statusDescription: 'Not Found' };
}
JS
funcion="aletheia-solo-estaticos"
if ! aws_ cloudfront describe-function --name "$funcion" >/dev/null 2>&1; then
    etag="$(aws_ cloudfront create-function --name "$funcion" \
        --function-config Comment="Solo rutas estaticas",Runtime=cloudfront-js-2.0 \
        --function-code "fileb://$trabajo/funcion.js" --query ETag)"
    aws_ cloudfront publish-function --name "$funcion" --if-match "$etag" >/dev/null
fi
arn_funcion="$(aws_ cloudfront describe-function --name "$funcion" --stage LIVE \
    --query FunctionSummary.FunctionMetadata.FunctionARN)"

avisar "2/4 Política de cabeceras (CORS solo para $SITIO)..."
politica="aletheia-estaticos"
id_politica="$(aws_ cloudfront list-response-headers-policies --type custom \
    --query "ResponseHeadersPolicyList.Items[?ResponseHeadersPolicy.ResponseHeadersPolicyConfig.Name=='$politica'].ResponseHeadersPolicy.Id | [0]")"
if [[ $id_politica == None || -z $id_politica ]]; then
    cat >"$trabajo/politica.json" <<JSON
{
  "Name": "$politica",
  "Comment": "CORS solo para el sitio y recursos cruzados permitidos para los estaticos",
  "CorsConfig": {
    "AccessControlAllowOrigins": {"Quantity": 1, "Items": ["$SITIO"]},
    "AccessControlAllowHeaders": {"Quantity": 1, "Items": ["*"]},
    "AccessControlAllowMethods": {"Quantity": 2, "Items": ["GET", "HEAD"]},
    "AccessControlAllowCredentials": false,
    "AccessControlMaxAge": 86400,
    "OriginOverride": true
  },
  "SecurityHeadersConfig": {
    "StrictTransportSecurity": {
      "Override": true, "IncludeSubdomains": true, "Preload": false, "AccessControlMaxAgeSec": 31536000
    },
    "ContentTypeOptions": {"Override": true}
  },
  "CustomHeadersConfig": {
    "Quantity": 1,
    "Items": [{"Header": "Cross-Origin-Resource-Policy", "Value": "cross-origin", "Override": true}]
  }
}
JSON
    id_politica="$(aws_ cloudfront create-response-headers-policy \
        --response-headers-policy-config "file://$trabajo/politica.json" \
        --query ResponseHeadersPolicy.Id)"
fi

avisar "3/4 Distribución (puede tardar de 5 a 15 minutos en quedar desplegada)..."
cat >"$trabajo/distribucion.json" <<JSON
{
  "CallerReference": "aletheia-cdn-$(date +%s)",
  "Comment": "Archivos estaticos de ALETHEIA",
  "Aliases": {"Quantity": 1, "Items": ["$DOMINIO"]},
  "Origins": {
    "Quantity": 1,
    "Items": [{
      "Id": "servidor",
      "DomainName": "$ORIGEN",
      "CustomOriginConfig": {
        "HTTPPort": 80, "HTTPSPort": 443, "OriginProtocolPolicy": "https-only",
        "OriginSslProtocols": {"Quantity": 1, "Items": ["TLSv1.2"]},
        "OriginReadTimeout": 30, "OriginKeepaliveTimeout": 5
      }
    }]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "servidor",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"], "CachedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"]}},
    "Compress": true,
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
    "ResponseHeadersPolicyId": "$id_politica",
    "FunctionAssociations": {
      "Quantity": 1,
      "Items": [{"EventType": "viewer-request", "FunctionARN": "$arn_funcion"}]
    }
  },
  "ViewerCertificate": {
    "ACMCertificateArn": "$certificado",
    "SSLSupportMethod": "sni-only",
    "MinimumProtocolVersion": "TLSv1.2_2021"
  },
  "PriceClass": "PriceClass_All",
  "HttpVersion": "http2and3",
  "IsIPV6Enabled": true,
  "Enabled": true
}
JSON
distribucion="$(aws_ cloudfront create-distribution --distribution-config "file://$trabajo/distribucion.json" \
    --query Distribution.Id)"
direccion="$(aws_ cloudfront get-distribution --id "$distribucion" --query Distribution.DomainName)"

avisar "4/4 Esperando a que quede desplegada..."
aws_ cloudfront wait distribution-deployed --id "$distribucion"

cat <<TEXTO

Distribución $distribucion desplegada.

Falta el último registro DNS, en Hostinger (el mismo lugar de antes):

  Tipo:    CNAME
  Nombre:  cdn
  Valor:   $direccion
  TTL:     300

Cuando lo cree, ejecute: bash infra/aws/cdn.sh --estado
TEXTO
