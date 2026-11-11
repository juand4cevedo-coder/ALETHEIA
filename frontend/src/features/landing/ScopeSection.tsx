import styles from "./ScopeSection.module.css";
import section from "./Section.module.css";
import { SectionHeading } from "./SectionHeading.tsx";
import {
  BalanzaIcon,
  CerrarIcon,
  VistoIcon,
  type IconComponent,
} from "../../components/ui/icons.tsx";

// Lo que la cadena de custodia anota sale de su lista cerrada de acciones (custodyActions.ts):
// cargas, descargas y paquetes. No hay un evento de apertura ni de consulta.
const DOES = [
  "Conserva el archivo original, cifrado y sin modificarlo.",
  "Registra su huella SHA-256 y obtiene un sello de tiempo de un tercero.",
  "Anota en la cadena de custodia quién sube, descarga o exporta cada evidencia, y a qué hora.",
  "Le entrega un paquete con los originales, sus huellas, los sellos y el informe de custodia.",
] as const;

const DOES_NOT = [
  "No certifica pruebas ni decide sobre su validez.",
  "No califica un archivo como auténtico, veraz o admisible.",
  "No extrae información de celulares ni entra a cuentas de terceros. Solo recibe lo que usted sube.",
] as const;

type Column = {
  title: string;
  items: readonly string[];
  icon: IconComponent;
};

const COLUMNS: readonly Column[] = [
  { title: "Lo que hace", items: DOES, icon: VistoIcon },
  { title: "Lo que no hace", items: DOES_NOT, icon: CerrarIcon },
];

// Alcance (RN-001): qué hace ALETHEIA y qué no, sin ambigüedad. Dos paneles iguales; ninguno se
// destaca con otro color, porque ninguno es un estado de una evidencia.
export function ScopeSection() {
  return (
    <section className={section.section} aria-labelledby="titulo-alcance">
      <div className={section.inner}>
        <SectionHeading
          id="titulo-alcance"
          kicker="Alcance"
          title="Preservamos y documentamos. La valoración es del juez."
          lead="ALETHEIA es una herramienta técnica de preservación. Le da elementos para sustentar que su evidencia no cambió."
        />

        <div className={styles.columns}>
          {COLUMNS.map((column) => (
            <div key={column.title} className={styles.panel}>
              <h3 className={styles.panelTitle}>{column.title}</h3>
              <ul className={styles.list}>
                {column.items.map((item) => (
                  <li key={item}>
                    <column.icon
                      size={16}
                      className={styles.mark}
                      aria-hidden="true"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className={styles.note}>
          <BalanzaIcon size={16} aria-hidden="true" />
          Si una prueba es auténtica, veraz o admisible, y qué valor tiene, lo
          decide siempre la autoridad judicial.
        </p>
      </div>
    </section>
  );
}
