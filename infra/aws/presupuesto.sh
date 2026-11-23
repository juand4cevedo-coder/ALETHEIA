#!/usr/bin/env bash
# Crea el presupuesto mensual de ALETHEIA con avisos por correo. Lo ejecuta una vez la persona
# administradora, desde CloudShell:
#
#   bash infra/aws/presupuesto.sh <correo-que-recibe-los-avisos> [monto-mensual-en-USD]
#
# Avisa al llegar al 50 % y al 80 % del monto real del mes y cuando el pronóstico lo supera, antes
# de que el gasto sorprenda. Es repetible: si el presupuesto ya existe, se reemplaza.
set -euo pipefail

readonly NOMBRE=aletheia-mensual
correo="${1:?Indique el correo que recibirá los avisos.}"
monto="${2:-15}"
cuenta="$(aws sts get-caller-identity --query Account --output text)"

aws budgets delete-budget --account-id "$cuenta" --budget-name "$NOMBRE" >/dev/null 2>&1 || true

aviso() { # tipo-de-gasto porcentaje
    printf '{"Notification":{"NotificationType":"%s","ComparisonOperator":"GREATER_THAN","Threshold":%s,"ThresholdType":"PERCENTAGE"},"Subscribers":[{"SubscriptionType":"EMAIL","Address":"%s"}]}' \
        "$1" "$2" "$correo"
}

aws budgets create-budget --account-id "$cuenta" \
    --budget "{\"BudgetName\":\"$NOMBRE\",\"BudgetLimit\":{\"Amount\":\"$monto\",\"Unit\":\"USD\"},\"TimeUnit\":\"MONTHLY\",\"BudgetType\":\"COST\"}" \
    --notifications-with-subscribers "$(aviso ACTUAL 50)" "$(aviso ACTUAL 80)" "$(aviso FORECASTED 100)"

echo "Listo. Presupuesto de $monto USD al mes; los avisos llegan a $correo."
