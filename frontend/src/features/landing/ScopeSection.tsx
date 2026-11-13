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
  "Organiza casos con su radicado, especialidad y despacho.",
  "Relaciona cada caso con los integrantes responsables de su organización.",
  "Registra la apertura del caso con su fecha y responsable.",
  "Permite calcular y comparar huellas SHA-256 en el navegador.",
] as const;

const DOES_NOT = [
  "No certifica pruebas ni decide sobre su validez.",
  "No califica un archivo como auténtico, veraz o admisible.",
  "No extrae información de celulares ni entra a cuentas de terceros.",
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
    <section
      data-reveal
      className={section.section}
      aria-labelledby="titulo-alcance"
    >
      <div className={section.inner}>
        <SectionHeading
          id="titulo-alcance"
          kicker="Alcance"
          title="Una herramienta precisa. Un alcance claro."
          lead="Aletheia acompaña la organización de su trabajo y la comprensión técnica de la evidencia. La valoración de la prueba corresponde a la autoridad judicial."
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
