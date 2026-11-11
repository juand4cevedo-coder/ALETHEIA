import { Reveal } from "../../components/ui/Reveal.tsx";
import styles from "./ScopeSection.module.css";
import section from "./Section.module.css";
import { SectionHeading } from "./SectionHeading.tsx";
import {
  BalanzaIcon,
  CerrarIcon,
  CirculoProhibidoIcon,
  EscudoVistoIcon,
  VistoIcon,
} from "../../components/ui/icons.tsx";

const DOES = [
  "Conservamos el archivo original, cifrado y sin modificaciones.",
  "Registramos su huella y un sello de tiempo emitido por un tercero.",
  "Documentamos quién subió, consultó, descargó o exportó cada evidencia.",
  "Le entregamos un paquete que cualquier persona puede verificar.",
] as const;

const DOES_NOT = [
  "No certificamos pruebas ni determinamos su validez.",
  "No calificamos un archivo como auténtico, veraz o admisible.",
  "No extraemos información de celulares ni entramos a cuentas de terceros: solo recibimos lo que usted sube.",
] as const;

// Regla de oro (RN-001): qué hace ALETHEIA y qué no hace, dicho sin ambigüedad. Va en una hoja
// de expediente, la única superficie clara de la página, con la nota judicial al pie. El folio
// es decorativo (aria-hidden).
export function ScopeSection() {
  return (
    <section className={section.section} aria-labelledby="titulo-alcance">
      <div className={section.inner}>
        <SectionHeading
          id="titulo-alcance"
          kicker="Alcance del servicio"
          title="Preservamos y documentamos. La valoración es del juez."
          lead="Somos una herramienta técnica de preservación. Le damos elementos sólidos para sustentar la integridad de su evidencia, sin reemplazar el criterio de nadie."
        />

        <Reveal className={styles.sheet}>
          <p className={styles.folio} aria-hidden="true">
            Fol. 04
          </p>

          <div className={styles.columns}>
            <div className={styles.column}>
              <h3 className={styles.columnTitle}>
                <EscudoVistoIcon size={20} className={styles.yesIcon} />
                Lo que hacemos
              </h3>
              <ul className={styles.list}>
                {DOES.map((item) => (
                  <li key={item}>
                    <span className={`${styles.mark} ${styles.yes}`}>
                      <VistoIcon size={14} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className={styles.column}>
              <h3 className={styles.columnTitle}>
                <CirculoProhibidoIcon size={20} className={styles.noIcon} />
                Lo que no hacemos
              </h3>
              <ul className={styles.list}>
                {DOES_NOT.map((item) => (
                  <li key={item}>
                    <span className={`${styles.mark} ${styles.no}`}>
                      <CerrarIcon size={14} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className={styles.note}>
            <BalanzaIcon size={18} />
            Determinar si una prueba es auténtica, veraz o admisible, y qué
            valor tiene, corresponde siempre a la autoridad judicial.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
