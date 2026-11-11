import { useQuery } from "@tanstack/react-query";

import { listPlansOptions } from "../../api/generated/@tanstack/react-query.gen.ts";
import { ButtonLink } from "../../components/ui/ButtonLink.tsx";
import { ROUTES } from "../../config/routes.ts";
import { trialDays } from "../billing/plans.ts";
import styles from "./Hero.module.css";
import { WorkspacePreview } from "./WorkspacePreview.tsx";
import { HuellaIcon } from "../../components/ui/icons.tsx";

// Inicio (UI-001): qué es y por qué le sirve al abogado. Un solo h1, una frase de apoyo, dos
// acciones y el espacio de trabajo como imagen.
export function Hero() {
  // Misma consulta que el resumen de planes: TanStack Query la pide una sola vez.
  const { data: plans } = useQuery(listPlansOptions());
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
          Demuestre que el archivo que aporta es el mismo que recibió.
        </h1>

        <p className={styles.lead}>
          Conservamos el original con su huella y un sello de tiempo de un
          tercero, y registramos quién lo abre y cuándo.
        </p>

        <div className={styles.actions}>
          <ButtonLink to={ROUTES.signUp}>Crear una cuenta</ButtonLink>
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
