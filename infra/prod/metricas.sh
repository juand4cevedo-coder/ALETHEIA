#!/usr/bin/env bash
# Publica en CloudWatch las métricas de salud de la plataforma: peticiones, errores 5xx, latencia,
# errores registrados, memoria, disco y tiempo de respuesta de la API. Corre cada minuto desde
# aletheia-metricas.timer, en el servidor, con el rol de la instancia (solo puede publicar métricas
# en el espacio ALETHEIA/Produccion).
set -euo pipefail

readonly REGION="${AWS_REGION:-us-east-2}"
readonly ESPACIO="ALETHEIA/Produccion"
readonly VENTANA=60

api="$(docker ps --filter label=com.docker.compose.service=api -q | head -n1)"
worker="$(docker ps --filter label=com.docker.compose.service=worker -q | head -n1)"
metricas=()

agregar() { # nombre valor unidad
    metricas+=("MetricName=$1,Value=$2,Unit=$3")
}

if [[ -n "$api" ]]; then
    registros="$(docker logs --since "${VENTANA}s" "$api" 2>&1 || true)"
    atendidas="$(grep -c '"message": "Petición atendida"' <<<"$registros" || true)"
    errores_5xx="$(grep '"message": "Petición atendida"' <<<"$registros" | grep -c '"status": 5[0-9][0-9]' || true)"
    p95="$({ grep '"message": "Petición atendida"' <<<"$registros" || true; } \
        | sed -n 's/.*"duration_ms": \([0-9.]*\).*/\1/p' | sort -n \
        | awk '{ v[NR] = $1 } END { if (NR) { i = int(NR * 0.95); if (i < 1) i = 1; print v[i] } else print 0 }')"
    registros_error="$(grep -c '"level": "ERROR"' <<<"$registros" || true)"
    agregar Peticiones "$atendidas" Count
    agregar Errores5xx "$errores_5xx" Count
    agregar LatenciaP95 "${p95:-0}" Milliseconds
    agregar ErroresRegistrados "$registros_error" Count
fi

if [[ -n "$worker" ]]; then
    fallos="$(docker logs --since "${VENTANA}s" "$worker" 2>&1 | grep -c '"level": "ERROR"' || true)"
    agregar ErroresDelTrabajador "$fallos" Count
fi

# Una caída de la API o del trabajador se ve en las alarmas por esta métrica.
agregar ContenedoresActivos "$(docker ps -q | wc -l | tr -d ' ')" Count

disco="$(df --output=pcent / | tail -n1 | tr -dc '0-9')"
memoria="$(free | awk '/^Mem:/ { printf "%.1f", ($2 - $7) / $2 * 100 }')"
agregar DiscoUsado "$disco" Percent
agregar MemoriaUsada "$memoria" Percent

# Tiempo de respuesta de la API vista desde el propio servidor, con la base incluida.
respuesta="$(curl -s -o /dev/null -w '%{http_code} %{time_total}' --max-time 10 --resolve aletheia.sbs:443:127.0.0.1 https://aletheia.sbs/api/v1/health || echo '000 10')"
codigo="${respuesta%% *}"
segundos="${respuesta##* }"
agregar SaludDeLaApi "$([[ "$codigo" == 200 ]] && echo 1 || echo 0)" Count
agregar TiempoDeSalud "$(awk -v s="$segundos" 'BEGIN { printf "%.0f", s * 1000 }')" Milliseconds

args=()
for m in "${metricas[@]}"; do args+=("$m"); done
aws cloudwatch put-metric-data --region "$REGION" --namespace "$ESPACIO" --metric-data "${args[@]}"
