import { useRef } from "react";

import { Reveal } from "../../components/ui/Reveal.tsx";
import { ChainDemo } from "./ChainDemo.tsx";
import { HashDemo } from "./HashDemo.tsx";
import demo from "./IntegrityDemo.module.css";
import section from "./Section.module.css";
import { SectionHeading } from "./SectionHeading.tsx";
import { StampCard } from "./StampCard.tsx";
import styles from "./StandardsSection.module.css";
import {
  ArchivoEquisIcon,
  LlaveIcon,
  type IconComponent,
} from "../../components/ui/icons.tsx";

type Guarantee = { icon: IconComponent; title: string; text: string };

// Las dos garantías que no se pueden manipular en pantalla van como lista, debajo de las
// demostraciones.
const GUARANTEES: Guarantee[] = [
  {
    icon: LlaveIcon,
    title: "Cifrado por caso",
    text: "Cada caso tiene su propia llave AES‑256‑GCM, protegida por una llave maestra que vive en AWS KMS, fuera de la base de datos.",
  },
  {
    icon: ArchivoEquisIcon,
    title: "Eliminación con constancia",
    text: "Al cerrar un caso destruimos su llave y el contenido queda ilegible. Usted recibe una constancia con la fecha y el alcance de la eliminación.",
  },
];

// Pieza central de la landing: las garantías técnicas se demuestran en vez de enumerarse. Cada
// demostración envuelve su superficie en un contenedor con data-spotlight del mismo tamaño,
// para que la luz del puntero caiga donde está el puntero. En los textos, los nombres como
// AES‑256‑GCM llevan guiones que no parten la línea (U+2011).
export function StandardsSection() {
  const demosRef = useRef<HTMLDivElement>(null);

  return (
    <section
      id="seguridad"
      className={section.section}
      aria-labelledby="titulo-estandares"
    >
      <div className={section.inner}>
        <SectionHeading
          id="titulo-estandares"
          kicker="Seguridad y estándares"
          title="Garantías que cualquier perito puede comprobar"
          lead="No usamos criptografía propia ni cadenas de bloques. Cada garantía descansa en estándares abiertos, documentados y verificables con herramientas independientes."
        />

        <div ref={demosRef} className={demo.demos}>
          <Reveal className={`${demo.panel} ${demo.hashPanel}`}>
            <div className={demo.panelHead}>
              <p className={demo.exhibit}>Demostración A</p>
              <h3 className={demo.panelTitle}>Huella SHA-256</h3>
              <p className={demo.panelText}>
                El mismo archivo produce siempre la misma huella; si cambia un
                solo carácter, la huella es otra por completo.
              </p>
            </div>
            <div data-spotlight className={demo.surface}>
              <HashDemo />
            </div>
          </Reveal>

          <Reveal className={demo.panel}>
            <div className={demo.panelHead}>
              <p className={demo.exhibit}>Demostración B</p>
              <h3 className={demo.panelTitle}>Cadena de custodia encadenada</h3>
              <p className={demo.panelText}>
                Cada evento guarda la huella del anterior: si alguien altera un
                registro, la cadena se rompe y la verificación lo detecta.
              </p>
            </div>
            <div data-spotlight className={demo.surface}>
              <ChainDemo />
            </div>
          </Reveal>

          <Reveal className={demo.panel}>
            <div className={demo.panelHead}>
              <p className={demo.exhibit}>Demostración C</p>
              <h3 className={demo.panelTitle}>Sello de tiempo RFC 3161</h3>
              <p className={demo.panelText}>
                Una autoridad externa firma la huella con fecha y hora, y el
                sello se comprueba con herramientas de uso común, como OpenSSL,
                sin depender de nosotros.
              </p>
            </div>
            <div data-spotlight className={demo.surface}>
              <StampCard />
            </div>
          </Reveal>
        </div>

        <ul className={styles.guarantees}>
          {GUARANTEES.map((item) => (
            <Reveal as="li" key={item.title} className={styles.guarantee}>
              <span className={styles.icon} aria-hidden="true">
                <item.icon size={20} aria-hidden="true" />
              </span>
              <div className={styles.copy}>
                <h3 className={section.cardTitle}>{item.title}</h3>
                <p className={section.cardText}>{item.text}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
