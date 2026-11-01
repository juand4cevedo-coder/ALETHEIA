import {
  Clock3,
  FileX2,
  Fingerprint,
  KeyRound,
  Link2,
  type LucideIcon,
} from "lucide-react";
import { useRef } from "react";

import { Reveal } from "../../components/ui/Reveal.tsx";
import { useSpotlight } from "../../components/ui/useSpotlight.ts";
import section from "./Section.module.css";
import { SectionHeading } from "./SectionHeading.tsx";
import styles from "./StandardsSection.module.css";

// Dos huellas reales: la del texto de ejemplo y la del mismo texto con una sola letra
// distinta. Muestran que un cambio mínimo produce una huella completamente diferente.
const ORIGINAL_HASH = "52a910d44b570bc5cd4d35e1";
const ALTERED_HASH = "b8d74f10b6bf8fc8e36028d5";

type Feature = { icon: LucideIcon; title: string; text: string };

const FEATURES: Feature[] = [
  {
    icon: Clock3,
    title: "Sello de tiempo RFC 3161",
    text: "Una autoridad externa firma la huella con fecha y hora. El sello se comprueba con herramientas de uso común, como OpenSSL, sin depender de ALETHEIA.",
  },
  {
    icon: Link2,
    title: "Cadena de custodia encadenada",
    text: "Cada evento guarda la huella del anterior. Si alguien altera un registro, la cadena se rompe y la verificación lo detecta.",
  },
  {
    icon: KeyRound,
    title: "Cifrado por caso",
    text: "Cada caso tiene su propia llave AES‑256‑GCM, protegida por una llave maestra que vive en AWS KMS, fuera de la base de datos.",
  },
  {
    icon: FileX2,
    title: "Eliminación con constancia",
    text: "Al cerrar un caso se destruye su llave y el contenido queda ilegible. Usted recibe una constancia con la fecha y el alcance de la eliminación.",
  },
];

// Las garantías técnicas, cada una apoyada en un estándar abierto. En los textos, los nombres
// como AES‑256‑GCM llevan guiones que no parten la línea (U+2011).
export function StandardsSection() {
  const gridRef = useRef<HTMLDivElement>(null);
  useSpotlight(gridRef);

  return (
    <section className={section.section} aria-labelledby="titulo-estandares">
      <div className={section.inner}>
        <SectionHeading
          id="titulo-estandares"
          kicker="Seguridad y estándares"
          title="Garantías que cualquier perito puede comprobar"
          lead="ALETHEIA no usa criptografía propia ni cadenas de bloques. Cada garantía descansa en estándares abiertos, documentados y verificables con herramientas independientes."
        />

        <div ref={gridRef} className={styles.bento}>
          <Reveal className={styles.featured}>
            <div data-spotlight className={`${section.card} ${styles.card}`}>
              <div className={styles.copy}>
                <span className={section.iconTile}>
                  <Fingerprint size={22} />
                </span>
                <h3 className={section.cardTitle}>Huella SHA-256</h3>
                <p className={section.cardText}>
                  Se calcula en el momento en que el archivo llega. El mismo
                  archivo produce siempre la misma huella; si cambia un solo
                  carácter, la huella es otra por completo.
                </p>
              </div>

              <div className={styles.compare} aria-hidden="true">
                <div className={styles.compareRow}>
                  <span className={styles.compareLabel}>Archivo original</span>
                  <code className={styles.compareHash}>{ORIGINAL_HASH}…</code>
                  <span className={`${styles.chip} ${styles.match}`}>
                    Coincide
                  </span>
                </div>
                <div className={styles.compareRow}>
                  <span className={styles.compareLabel}>
                    Una letra modificada
                  </span>
                  <code className={styles.compareHash}>{ALTERED_HASH}…</code>
                  <span className={`${styles.chip} ${styles.mismatch}`}>
                    No coincide
                  </span>
                </div>
              </div>
              <p className="visually-hidden">
                Ejemplo: el archivo original coincide con su huella; el mismo
                archivo con una letra modificada no coincide.
              </p>
            </div>
          </Reveal>

          {FEATURES.map((feature, index) => (
            <Reveal key={feature.title} delay={(index + 1) as 1 | 2 | 3 | 4}>
              <div data-spotlight className={`${section.card} ${styles.card}`}>
                <span className={section.iconTile}>
                  <feature.icon size={22} />
                </span>
                <h3 className={section.cardTitle}>{feature.title}</h3>
                <p className={section.cardText}>{feature.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
