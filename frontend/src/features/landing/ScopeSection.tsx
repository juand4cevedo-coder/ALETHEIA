import { Link } from "react-router";

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
  "Registra cada archivo con su huella SHA-256, su sello de tiempo y la persona que lo subió.",
  "Exporta un paquete de preservación con los originales, sus huellas y la cadena de custodia.",
  "Organiza casos con su radicado, especialidad y despacho.",
  "Relaciona cada caso con los integrantes responsables de su organización.",
  "Permite calcular y comparar huellas SHA-256 en el navegador.",
] as const;

const DOES_NOT = [
  "No certifica pruebas ni decide sobre su validez.",
  "No califica un archivo como auténtico, veraz o admisible.",
  "No extrae información de celulares ni entra a cuentas de terceros.",
  "No consulta la Rama Judicial ni avisa de estados electrónicos: se usa junto a su herramienta de vigilancia de procesos.",
] as const;

// Comparaciones honestas con lo que el abogado ya usa o ya conoce.
const COMPARISONS = [
  {
    to: "/blog/vigilancia-de-procesos-y-evidencia-digital",
    label: "Frente a un software de vigilancia de procesos",
  },
  {
    to: "/blog/aletheia-y-el-estampado-cronologico",
    label: "Frente al estampado de una entidad acreditada",
  },
  {
    to: "/blog/carpeta-compartida-frente-a-un-caso-con-custodia",
    label: "Frente a una carpeta compartida y WhatsApp",
  },
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
          title="Qué hace ALETHEIA con su evidencia y qué deja en manos del juez"
          lead="ALETHEIA anota lo que pasa con cada archivo desde el momento en que lo recibe. Lo ocurrido antes de esa fecha no lo puede demostrar."
        />

        <div className={styles.columns}>
          {COLUMNS.map((column) => (
            <div key={column.title} className={styles.panel} data-reveal>
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

        <nav className={styles.compare} aria-label="Comparaciones">
          <p>Cómo se compara ALETHEIA</p>
          <ul>
            {COMPARISONS.map((item) => (
              <li key={item.to}>
                <Link to={item.to}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </section>
  );
}
