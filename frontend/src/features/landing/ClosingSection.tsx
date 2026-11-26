import { ButtonLink } from "../../components/ui/ButtonLink.tsx";
import { FlechaDerechaIcon } from "../../components/ui/icons.tsx";
import { fotoProps } from "../../config/fotos.ts";
import { ROUTES } from "../../config/routes.ts";
import { SIGN_UP_LABEL, SIGN_UP_NOTE } from "../../config/site.ts";
import { usePlanCatalog } from "../billing/catalog.tsx";
import { trialDays } from "../billing/plans.ts";
import styles from "./ClosingSection.module.css";

// Cierre del inicio: abogados firmando un acuerdo bajo una capa de tinta y una sola acción. Los días de
// prueba salen del catálogo; sin él, la frase no da una cifra.
export function ClosingSection() {
  const { plans } = usePlanCatalog();
  const days = plans ? trialDays(plans) : null;

  return (
    <section
      className={`${styles.section} on-ink`}
      aria-labelledby="titulo-cierre"
    >
      <img
        className={styles.photo}
        {...fotoProps("firma", "100vw")}
        alt=""
        width={1280}
        height={720}
        loading="lazy"
        decoding="async"
      />
      <div className={styles.inner}>
        <p className={styles.kicker}>Empiece hoy</p>
        <h2 id="titulo-cierre" className={styles.title}>
          La próxima prueba que reciba, guárdela bien desde el principio.
        </h2>
        <p className={styles.text}>
          Cree su cuenta y suba los archivos de un caso real.{" "}
          {days === null
            ? "La prueba es gratuita y no pide tarjeta de crédito."
            : `La prueba dura ${days} días y no pide tarjeta de crédito.`}
        </p>
        <div className={styles.action}>
          <ButtonLink to={ROUTES.signUp}>
            {SIGN_UP_LABEL}
            <FlechaDerechaIcon size={18} aria-hidden="true" />
          </ButtonLink>
          <p className={styles.note}>{SIGN_UP_NOTE}</p>
        </div>
      </div>
    </section>
  );
}
