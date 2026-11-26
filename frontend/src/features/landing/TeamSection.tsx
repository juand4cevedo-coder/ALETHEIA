import {
  CalendarioIcon,
  CandadoIcon,
  UsuariosIcon,
  type IconComponent,
} from "../../components/ui/icons.tsx";
import { fotoProps } from "../../config/fotos.ts";
import section from "./Section.module.css";
import styles from "./TeamSection.module.css";

const PUNTOS: readonly {
  Icono: IconComponent;
  titulo: string;
  texto: string;
}[] = [
  {
    Icono: UsuariosIcon,
    titulo: "Permisos por caso",
    texto:
      "Socios, asociados, practicantes y clientes, cada uno con el acceso que le corresponde.",
  },
  {
    Icono: CalendarioIcon,
    titulo: "Plazos que no se escapan",
    texto:
      "Tareas con fecha límite y avisos antes de cada vencimiento, en su correo y en su calendario.",
  },
  {
    Icono: CandadoIcon,
    titulo: "Portal para su cliente",
    texto:
      "Su cliente sube las pruebas directamente, sin enviarlas por WhatsApp.",
  },
];

// Para despachos: la foto de un equipo reunido y lo que ALETHEIA ordena dentro de un despacho.
export function TeamSection() {
  return (
    <section
      id="para-despachos"
      className={section.section}
      aria-labelledby="titulo-despachos"
    >
      <div className={`${section.inner} ${styles.layout}`}>
        <figure className={styles.photo}>
          <img
            {...fotoProps(
              "despacho",
              "(max-width: 960px) calc(100vw - 32px), 560px",
            )}
            alt="Abogados de un despacho reunidos en una sala"
            width={1280}
            height={720}
            loading="lazy"
            decoding="async"
          />
          <figcaption className={styles.caption}>
            <img
              {...fotoProps("abogado-llamada", "56px")}
              alt=""
              width={56}
              height={56}
              loading="lazy"
            />
            <span>
              <strong>Cada abogado ve sus casos</strong>
              <small>Y usted sabe quién hizo qué</small>
            </span>
          </figcaption>
        </figure>
        <div>
          <p className={styles.kicker}>Para despachos</p>
          <h2 id="titulo-despachos" className={section.title}>
            Su equipo, sus reglas.
          </h2>
          <p className={styles.lead}>
            Desde el abogado independiente hasta la firma con varias sedes: cada
            persona ve los casos que le corresponden y usted sabe en todo
            momento quién hizo qué.
          </p>
          <ul className={styles.list}>
            {PUNTOS.map(({ Icono, titulo, texto }) => (
              <li key={titulo}>
                <span className={styles.icon}>
                  <Icono size={22} aria-hidden="true" />
                </span>
                <span>
                  <strong>{titulo}</strong>
                  <span className={styles.text}>{texto}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
