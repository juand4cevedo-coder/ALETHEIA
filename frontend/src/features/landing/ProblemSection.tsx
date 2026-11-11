import styles from "./ProblemSection.module.css";
import section from "./Section.module.css";
import { SectionHeading } from "./SectionHeading.tsx";
import {
  CadenaIcon,
  HuellaIcon,
  type IconComponent,
} from "../../components/ui/icons.tsx";

type Point = {
  label: string;
  capture: string;
  original: string;
  icon?: IconComponent;
};

// Lo mismo, visto desde la captura y desde el original. Cuatro puntos que un abogado reconoce
// cuando la contraparte tacha una prueba.
const POINTS: readonly Point[] = [
  {
    label: "Metadatos",
    capture: "Se pierden. Queda solo la fecha de la captura.",
    original: "Intactos, dentro del archivo que llegó.",
  },
  {
    label: "Contenido",
    capture: "Lo que cabía en la pantalla.",
    original: "El archivo completo, sin convertir.",
  },
  {
    label: "Prueba de que no cambió",
    capture: "Ninguna.",
    original: "Su huella SHA-256, sellada por un tercero con fecha y hora.",
    icon: HuellaIcon,
  },
  {
    label: "Quién lo manejó",
    capture: "No queda registro.",
    original:
      "Cada carga, sello y descarga, con nombre y hora, en la cadena de custodia.",
    icon: CadenaIcon,
  },
];

// El problema: por qué no basta con una captura de pantalla. La respuesta es una comparación
// punto por punto, en dos paneles del mismo estilo; en escritorio sus filas se alinean.
export function ProblemSection() {
  return (
    <section className={section.section} aria-labelledby="titulo-problema">
      <div className={section.inner}>
        <SectionHeading
          id="titulo-problema"
          kicker="El problema"
          title="Una captura de pantalla no es el archivo original"
          lead="El Código General del Proceso valora como mensaje de datos el archivo en el formato en que se generó o se recibió. Su impresión se valora como un documento común."
        />

        <div className={styles.compare}>
          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>Una captura de pantalla</h3>
            <dl className={styles.points}>
              {POINTS.map((point) => (
                <div key={point.label} className={styles.point}>
                  <dt>{point.label}</dt>
                  <dd className={styles.muted}>{point.capture}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>El original en ALETHEIA</h3>
            <dl className={styles.points}>
              {POINTS.map((point) => (
                <div key={point.label} className={styles.point}>
                  <dt>{point.label}</dt>
                  <dd>
                    {point.icon && (
                      <point.icon
                        className={styles.icon}
                        size={16}
                        aria-hidden="true"
                      />
                    )}
                    {point.original}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <p className={styles.source}>
          Código General del Proceso, artículo 247, y sentencia C‑604 de 2016 de
          la Corte Constitucional.
        </p>
      </div>
    </section>
  );
}
