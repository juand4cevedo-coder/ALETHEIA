import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { listPlansOptions } from "../../api/generated/@tanstack/react-query.gen.ts";
import { ButtonLink } from "../../components/ui/ButtonLink.tsx";
import { ROUTES } from "../../config/routes.ts";
import { trialDays } from "../billing/plans.ts";
import { EvidencePreview } from "./EvidencePreview.tsx";
import styles from "./Hero.module.css";

// Estándares en los que descansa cada garantía; se nombran tal cual porque un perito los
// reconoce de inmediato.
const STANDARDS = ["SHA-256", "RFC 3161", "AES-256-GCM"] as const;

// Portada del inicio (UI-001): un solo h1, la acción principal y la vista de una evidencia.
export function Hero() {
  // Misma consulta que el resumen de planes: TanStack Query la pide una sola vez.
  const { data: plans } = useQuery(listPlansOptions());
  const days = plans ? trialDays(plans) : null;

  return (
    <section className={styles.hero} aria-labelledby="titulo-inicio">
      <div className={styles.aurora} aria-hidden="true" />
      <div className={styles.grid} aria-hidden="true" />

      <div className={styles.inner}>
        <p className={`${styles.badge} ${styles.enter}`}>
          <ShieldCheck size={16} />
          Preservación de evidencia digital para abogados en Colombia
        </p>

        <h1 id="titulo-inicio" className={`${styles.title} ${styles.enter}`}>
          Preserve la evidencia digital{" "}
          <span className={styles.accent}>tal como la recibió.</span>
        </h1>

        <p className={`${styles.lead} ${styles.enter}`}>
          ALETHEIA conserva el archivo original de cada evidencia, registra su
          huella criptográfica y un sello de tiempo emitido por un tercero, y
          documenta cada acceso en una cadena de custodia que nadie puede
          editar. Cuando el caso lo requiera, usted exporta un paquete que
          cualquier persona puede verificar de forma independiente.
        </p>

        <div className={`${styles.actions} ${styles.enter}`}>
          <ButtonLink to={ROUTES.signUp} surface="dark">
            Crear cuenta gratis
            <ArrowRight size={18} />
          </ButtonLink>
          <ButtonLink to={ROUTES.howItWorks} surface="dark" variant="secondary">
            Ver cómo funciona
          </ButtonLink>
        </div>

        <p className={`${styles.trial} ${styles.enter}`}>
          {days === null
            ? "Prueba gratuita sin tarjeta de crédito"
            : `${days} días de prueba gratuita · Sin tarjeta de crédito`}
        </p>

        <ul className={`${styles.standards} ${styles.enter}`}>
          {STANDARDS.map((standard) => (
            <li key={standard}>{standard}</li>
          ))}
        </ul>
      </div>

      <div className={`${styles.preview} ${styles.enter}`}>
        <EvidencePreview />
      </div>
    </section>
  );
}
