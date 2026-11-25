import type { BillingQuoteOption } from "../../api/generated";
import { formatCop } from "./format.ts";
import styles from "./QuoteBreakdown.module.css";

function people(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Lo que se va a cobrar, separado en el plan y los usuarios adicionales, antes de pagar.
 * El valor sale de la API (GET /billing/quote), que usa la misma cuenta que el cobro. */
export function QuoteBreakdown({
  option,
  users,
}: {
  option: BillingQuoteOption;
  users: number;
}) {
  const period = option.billing_cycle === "annual" ? "al año" : "al mes";
  const cycle = option.billing_cycle === "annual" ? "anual" : "mensual";
  const team = people(users, "persona", "personas");
  const included = people(option.included_users, "usuario", "usuarios");

  if (!option.fits) {
    return (
      <p className={styles.misfit} role="status">
        Su equipo tiene {team}, contando las invitaciones abiertas, y el plan{" "}
        {option.plan_name} incluye {included} sin adicionales. Elija un plan más
        amplio o retire personas en Equipo.
      </p>
    );
  }

  return (
    <div className={styles.breakdown}>
      <dl className={styles.rows} aria-label="Valor a pagar">
        <div className={styles.row}>
          <dt>
            Plan {option.plan_name}, {cycle}
            <span className={styles.detail}>Incluye {included}</span>
          </dt>
          <dd>{formatCop(option.plan_cop)}</dd>
        </div>
        {option.extra_users > 0 && option.extra_user_unit_cop != null && (
          <div className={styles.row}>
            <dt>
              {people(
                option.extra_users,
                "usuario adicional",
                "usuarios adicionales",
              )}
              <span className={styles.detail}>
                {formatCop(option.extra_user_unit_cop)} {period} cada uno
              </span>
            </dt>
            <dd>{formatCop(option.extra_users_cop)}</dd>
          </div>
        )}
        <div className={styles.total}>
          <dt>Total {period}</dt>
          <dd>{formatCop(option.total_cop)}</dd>
        </div>
      </dl>
      <p className={styles.note}>
        Cuentan las {team} de su equipo, con las invitaciones abiertas. Si
        agrega personas durante el periodo, se cobran desde la renovación
        siguiente.
      </p>
    </div>
  );
}
