import { useQuery } from "@tanstack/react-query";

import { listPlansOptions } from "../../api/generated/@tanstack/react-query.gen.ts";
import { ButtonLink } from "../../components/ui/ButtonLink.tsx";
import { ROUTES } from "../../config/routes.ts";
import { SIGN_UP_LABEL } from "../../config/site.ts";
import { trialDays } from "../billing/plans.ts";
import styles from "./ClosingSection.module.css";
import section from "./Section.module.css";

// Cierre del inicio: una sola acción. Los días de prueba salen del catálogo; sin él, la frase no
// da una cifra.
export function ClosingSection() {
  const { data: plans } = useQuery(listPlansOptions());
  const days = plans ? trialDays(plans) : null;

  return (
    <section className={section.section} aria-labelledby="titulo-cierre">
      <div className={`${section.inner} ${styles.layout}`}>
        <div className={styles.copy}>
          <h2 id="titulo-cierre" className={section.title}>
            Pruebe ALETHEIA con uno de sus casos
          </h2>
          <p className={styles.text}>
            Cree su cuenta y suba un archivo real para ver su huella y su sello
            de tiempo.{" "}
            {days === null
              ? "La prueba es gratuita y no pide tarjeta de crédito."
              : `La prueba gratuita dura ${days} días y no pide tarjeta de crédito.`}
          </p>
        </div>
        <ButtonLink to={ROUTES.signUp}>{SIGN_UP_LABEL}</ButtonLink>
      </div>
    </section>
  );
}
