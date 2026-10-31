#!/usr/bin/env bash
# Envía el documento de SSM aletheia-desplegar a aletheia-prod y espera su resultado. Lo usa
# .github/workflows/publicar.yml con la llave del usuario aletheia-github-deploy, que solo puede
# usar ese documento y solo sobre esa máquina.
#
#   enviar.sh desplegar|revertir
#
# Toma de variables de entorno la máquina (INSTANCIA), la versión (VERSION) y los digests
# (API_DIGEST y WEB_DIGEST). La región y las credenciales las lee AWS CLI de su entorno.
set -euo pipefail

readonly ACCION=${1:?Uso: enviar.sh desplegar\|revertir}
: "${INSTANCIA:?Falta INSTANCIA}" "${VERSION:?Falta VERSION}"
: "${API_DIGEST:?Falta API_DIGEST}" "${WEB_DIGEST:?Falta WEB_DIGEST}"

# Los parámetros van como JSON armado por jq: ningún valor se pega a mano en el comando.
parametros="$(jq --compact-output --null-input \
    --arg accion "$ACCION" --arg version "$VERSION" --arg api "$API_DIGEST" --arg web "$WEB_DIGEST" \
    '{Accion: [$accion], Version: [$version], ApiDigest: [$api], WebDigest: [$web]}')"

id="$(aws ssm send-command \
    --document-name aletheia-desplegar \
    --instance-ids "$INSTANCIA" \
    --parameters "$parametros" \
    --comment "ALETHEIA $ACCION $VERSION" \
    --timeout-seconds 60 \
    --query Command.CommandId --output text)"
echo "Orden $id enviada: $ACCION $VERSION."

# El documento tiene 15 minutos como máximo; aquí se espera un poco más que eso.
estado=Pending
for _ in $(seq 100); do
    sleep 10
    # Justo después de enviarla, la orden puede no existir todavía para la máquina.
    estado="$(aws ssm get-command-invocation --command-id "$id" --instance-id "$INSTANCIA" \
        --query Status --output text 2>/dev/null || echo Pending)"
    case $estado in
        Pending | InProgress | Delayed) ;;
        *) break ;;
    esac
done

echo "--- Salida en aletheia-prod ---"
aws ssm get-command-invocation --command-id "$id" --instance-id "$INSTANCIA" \
    --query '[StandardOutputContent, StandardErrorContent]' --output text || true
echo "-------------------------------"

if [[ $estado != Success ]]; then
    echo "::error::La orden $ACCION $VERSION terminó en estado $estado."
    exit 1
fi
