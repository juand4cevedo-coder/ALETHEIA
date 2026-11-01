import { Check, CircleSlash, Scale, ShieldCheck, X } from "lucide-react";

import { Reveal } from "../../components/ui/Reveal.tsx";
import styles from "./ScopeSection.module.css";
import section from "./Section.module.css";
import { SectionHeading } from "./SectionHeading.tsx";

const DOES = [
  "Conserva el archivo original, cifrado y sin modificaciones.",
  "Registra su huella y un sello de tiempo emitido por un tercero.",
  "Documenta quién subió, consultó, descargó o exportó cada evidencia.",
  "Entrega un paquete que cualquier persona puede verificar.",
] as const;

const DOES_NOT = [
  "No certifica pruebas ni determina su validez.",
  "No califica un archivo como auténtico, veraz o admisible.",
  "No extrae información de celulares ni accede a cuentas de terceros: solo recibe lo que usted sube.",
] as const;

// Regla de oro (RN-001): qué hace ALETHEIA y qué no hace, dicho sin ambigüedad.
export function ScopeSection() {
  return (
    <section className={section.section} aria-labelledby="titulo-alcance">
      <div className={section.inner}>
        <SectionHeading
          id="titulo-alcance"
          kicker="Alcance del servicio"
          title="Preservamos y documentamos. La valoración es del juez."
          lead="ALETHEIA es una herramienta técnica de preservación. Le da al abogado elementos sólidos para sustentar la integridad de su evidencia, sin reemplazar el criterio de nadie."
        />

        <Reveal className={styles.panel}>
          <div className={styles.column}>
            <h3 className={styles.columnTitle}>
              <ShieldCheck size={20} />
              Lo que ALETHEIA hace
            </h3>
            <ul className={styles.list}>
              {DOES.map((item) => (
                <li key={item}>
                  <span className={`${styles.mark} ${styles.yes}`}>
                    <Check size={14} strokeWidth={3} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.column}>
            <h3 className={styles.columnTitle}>
              <CircleSlash size={20} />
              Lo que no hace
            </h3>
            <ul className={styles.list}>
              {DOES_NOT.map((item) => (
                <li key={item}>
                  <span className={`${styles.mark} ${styles.no}`}>
                    <X size={14} strokeWidth={3} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <p className={styles.note}>
            <Scale size={18} />
            Determinar si una prueba es auténtica, veraz o admisible, y qué
            valor tiene, corresponde siempre a la autoridad judicial.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
