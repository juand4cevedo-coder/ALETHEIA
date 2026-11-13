import { ButtonLink } from "../../components/ui/ButtonLink.tsx";
import { ROUTES } from "../../config/routes.ts";
import { SIGN_UP_LABEL } from "../../config/site.ts";
import { usePlanCatalog } from "../billing/catalog.tsx";
import { trialDays } from "../billing/plans.ts";
import styles from "./ClosingSection.module.css";
import section from "./Section.module.css";

// Cierre del inicio: una sola acción. Los días de prueba salen del catálogo; sin él, la frase no
// da una cifra.
export function ClosingSection() {
  const { plans } = usePlanCatalog();
  const days = plans ? trialDays(plans) : null;

  return (
    <section
      data-reveal
      className={section.section}
      aria-labelledby="titulo-cierre"
    >
      <div className={`${section.inner} ${styles.layout}`}>
        <div className={styles.copy}>
          <h2 id="titulo-cierre" className={section.title}>
            Pruebe ALETHEIA con uno de sus casos
          </h2>
          <p className={styles.text}>
            Cree su cuenta y abra su primer caso.{" "}
            {days === null
              ? "La prueba es gratuita y no pide tarjeta de crédito."
              : `La prueba dura ${days} días y no pide tarjeta de crédito.`}
          </p>
        </div>
        <ButtonLink to={ROUTES.signUp}>{SIGN_UP_LABEL}</ButtonLink>
      </div>
    </section>
  );
}
