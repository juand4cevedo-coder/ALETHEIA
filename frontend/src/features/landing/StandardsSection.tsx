import { ChainDemo } from "./ChainDemo.tsx";
import { HashDemo } from "./HashDemo.tsx";
import demo from "./IntegrityDemo.module.css";
import section from "./Section.module.css";
import { SectionHeading } from "./SectionHeading.tsx";
import { StampCard } from "./StampCard.tsx";
import styles from "./StandardsSection.module.css";
import {
  ArchivoEquisIcon,
  CadenaIcon,
  HuellaIcon,
  LlaveIcon,
  SelloIcon,
  type IconComponent,
} from "../../components/ui/icons.tsx";

type Guarantee = { icon: IconComponent; title: string; text: string };

// Lo que protege el archivo mientras está guardado. No se puede manipular en pantalla, así que
// va como lista, debajo de las comprobaciones.
const GUARANTEES: Guarantee[] = [
  {
    icon: LlaveIcon,
    title: "Cifrado por caso",
    text: "Cada caso tiene su propia llave AES‑256‑GCM. La protege una llave maestra en AWS KMS, fuera de la base de datos.",
  },
  {
    icon: ArchivoEquisIcon,
    title: "Eliminación con constancia",
    text: "Al eliminar un caso se destruye su llave de cifrado. Usted recibe por correo una constancia de la eliminación.",
  },
];

// Lo que se puede comprobar: cómo sabe el abogado que nadie alteró el archivo. Las garantías se
// demuestran en vez de enumerarse; cada demostración solo cambia cuando la persona actúa. En
// los textos, nombres como AES‑256‑GCM llevan guiones que no parten la línea (U+2011).
export function StandardsSection() {
  return (
    <section
      id="seguridad"
      className={section.section}
      aria-labelledby="titulo-estandares"
    >
      <div className={section.inner}>
        <SectionHeading
          id="titulo-estandares"
          kicker="Lo que se puede comprobar"
          title="Cómo se sabe que nadie alteró el archivo"
          lead="Un perito puede repetir cada cálculo con herramientas independientes."
        />

        <div className={demo.demos}>
          <div className={`${demo.panel} ${demo.hashPanel}`}>
            <div className={demo.panelHead}>
              <h3 className={demo.panelTitle}>
                <HuellaIcon size={20} aria-hidden="true" />
                La huella SHA-256
              </h3>
              <p className={demo.panelText}>
                El mismo archivo produce siempre la misma huella. Si cambia un
                solo carácter, la huella es otra por completo.
              </p>
            </div>
            <HashDemo />
          </div>

          <div className={demo.panel}>
            <div className={demo.panelHead}>
              <h3 className={demo.panelTitle}>
                <CadenaIcon size={20} aria-hidden="true" />
                La cadena de custodia
              </h3>
              <p className={demo.panelText}>
                Cada evento guarda la huella del anterior. Si alguien cambia un
                registro, las huellas dejan de coincidir desde ese punto.
              </p>
            </div>
            <ChainDemo />
          </div>

          <div className={demo.panel}>
            <div className={demo.panelHead}>
              <h3 className={demo.panelTitle}>
                <SelloIcon size={20} aria-hidden="true" />
                El sello de tiempo
              </h3>
              <p className={demo.panelText}>
                Una autoridad externa firma la huella con la fecha y la hora,
                según la norma RFC 3161. El sello se comprueba con OpenSSL, sin
                depender de ALETHEIA.
              </p>
            </div>
            <StampCard />
          </div>
        </div>

        <ul className={styles.guarantees}>
          {GUARANTEES.map((item) => (
            <li key={item.title} className={styles.guarantee}>
              <span className={styles.icon} aria-hidden="true">
                <item.icon size={20} aria-hidden="true" />
              </span>
              <div className={styles.copy}>
                <h3 className={section.cardTitle}>{item.title}</h3>
                <p className={section.cardText}>{item.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
