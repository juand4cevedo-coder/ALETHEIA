import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Mail } from "lucide-react";

import { listPlansOptions } from "../../api/generated/@tanstack/react-query.gen.ts";
import { ButtonLink } from "../../components/ui/ButtonLink.tsx";
import { buttonClassName } from "../../components/ui/buttonStyles.ts";
import { Reveal } from "../../components/ui/Reveal.tsx";
import { ROUTES } from "../../config/routes.ts";
import { CONTACT_EMAIL } from "../../config/site.ts";
import { trialDays } from "../billing/plans.ts";
import styles from "./ClosingSection.module.css";
import section from "./Section.module.css";

// Cierre del inicio: una sola invitación clara a empezar.
export function ClosingSection() {
  const { data: plans } = useQuery(listPlansOptions());
  const days = plans ? trialDays(plans) : null;

  return (
    <section className={section.section} aria-labelledby="titulo-cierre">
      <div className={section.inner}>
        <Reveal className={styles.panel}>
          <h2 id="titulo-cierre" className={styles.title}>
            Empiece a preservar su evidencia hoy
          </h2>
          <p className={styles.text}>
            Cree su cuenta, abra un caso y recorra el ciclo completo con sus
            propios archivos.{" "}
            {days === null
              ? "La prueba es gratuita y no pide tarjeta de crédito."
              : `Tiene ${days} días de prueba gratuita, sin tarjeta de crédito.`}
          </p>
          <div className={styles.actions}>
            <ButtonLink to={ROUTES.signUp} surface="dark">
              Crear cuenta gratis
              <ArrowRight size={18} />
            </ButtonLink>
            <a
              className={buttonClassName({
                surface: "dark",
                variant: "secondary",
              })}
              href={`mailto:${CONTACT_EMAIL}`}
            >
              <Mail size={18} />
              Escribirnos
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
