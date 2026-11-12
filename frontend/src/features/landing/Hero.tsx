import { ButtonLink } from "../../components/ui/ButtonLink.tsx";
import { ROUTES } from "../../config/routes.ts";
import { SIGN_UP_LABEL } from "../../config/site.ts";
import { usePlanCatalog } from "../billing/catalog.tsx";
import { trialDays } from "../billing/plans.ts";
import styles from "./Hero.module.css";
import { WorkspacePreview } from "./WorkspacePreview.tsx";
import { HuellaIcon } from "../../components/ui/icons.tsx";

// Inicio (UI-001): qué es y por qué le sirve al abogado. Un solo h1, una frase de apoyo, dos
// acciones y el espacio de trabajo como imagen.
export function Hero() {
  // Misma consulta que el resumen de planes: TanStack Query la pide una sola vez.
  const { plans } = usePlanCatalog();
  const days = plans ? trialDays(plans) : null;

  return (
    <section className={styles.hero} aria-labelledby="titulo-inicio">
      <div className={styles.inner}>
        {/* Hechos que un perito puede comprobar, no un eslogan. */}
        <p className={styles.facts}>
          <HuellaIcon size={16} aria-hidden="true" />
          Huella SHA-256 y sello de tiempo RFC 3161 emitido por un tercero
        </p>

        <h1 id="titulo-inicio" className={styles.title}>
          Demuestre que el archivo que aporta no cambió desde que lo preservó.
        </h1>

        <p className={styles.lead}>
          Conservamos el original con su huella y un sello de tiempo de un
          tercero, y cada descarga queda registrada con nombre y hora.
        </p>

        <div className={styles.actions}>
          <ButtonLink to={ROUTES.signUp}>{SIGN_UP_LABEL}</ButtonLink>
          <ButtonLink to={ROUTES.howItWorks} variant="secondary">
            Ver cómo funciona
          </ButtonLink>
        </div>

        <p className={styles.trial}>
          {days === null
            ? "Prueba gratuita, sin tarjeta de crédito."
            : `${days} días de prueba gratuita, sin tarjeta de crédito.`}
        </p>
      </div>

      <div className={styles.shot}>
        <WorkspacePreview />
      </div>
    </section>
  );
}
