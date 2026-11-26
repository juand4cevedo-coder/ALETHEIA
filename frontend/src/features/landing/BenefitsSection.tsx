import { fotoProps, type Foto } from "../../config/fotos.ts";
import { SectionHeading } from "./SectionHeading.tsx";
import styles from "./BenefitsSection.module.css";
import section from "./Section.module.css";

const BENEFICIOS: readonly {
  foto: Foto;
  alt: string;
  titulo: string;
  texto: string;
}[] = [
  {
    foto: "cliente",
    alt: "Abogada reunida con un cliente en su oficina",
    titulo: "Reciba las pruebas de su cliente sin perder nada",
    texto:
      "El chat, el audio o el contrato quedan guardados tal como llegaron, con la fecha y la hora exactas en que los recibió.",
  },
  {
    foto: "equipo",
    alt: "Dos abogados revisan documentos juntos",
    titulo: "Trabaje cada caso con su equipo",
    texto:
      "Asigne tareas y plazos, comparta solo lo necesario y sepa siempre quién revisó cada documento.",
  },
  {
    foto: "acuerdo",
    alt: "Dos abogados se dan la mano al cerrar una reunión",
    titulo: "Preséntelas con tranquilidad",
    texto:
      "Descargue el expediente con un informe que el juez o la contraparte pueden comprobar por su cuenta, sin depender de usted ni de nosotros.",
  },
];

// Cómo le ayuda: tres momentos del trabajo del abogado, cada uno con su fotografía.
export function BenefitsSection() {
  return (
    <section
      id="como-le-ayuda"
      className={`${section.section} ${styles.section}`}
      aria-labelledby="titulo-ayuda"
    >
      <div className={section.inner}>
        <p className={styles.kicker}>Cómo le ayuda</p>
        <SectionHeading
          id="titulo-ayuda"
          title="Menos tiempo defendiendo la prueba. Más tiempo defendiendo a su cliente."
          lead="Las pruebas llegan por WhatsApp, por correo o en una memoria USB, y la contraparte siempre puede decir que alguien las cambió. ALETHEIA las guarda tal como llegaron y lo puede demostrar ante cualquier juez."
        />
        <ol className={styles.grid}>
          {BENEFICIOS.map((beneficio, i) => (
            <li key={beneficio.foto} className={styles.card}>
              <div className={styles.media}>
                <img
                  {...fotoProps(
                    beneficio.foto,
                    "(max-width: 760px) calc(100vw - 32px), (max-width: 1100px) 50vw, 400px",
                  )}
                  alt={beneficio.alt}
                  width={1280}
                  height={720}
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className={styles.body}>
                <span className={styles.number}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className={styles.title}>{beneficio.titulo}</h3>
                <p className={styles.text}>{beneficio.texto}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className={styles.scope}>
          ALETHEIA documenta la integridad de sus archivos. No certifica pruebas
          ni decide sobre su validez: eso le corresponde al juez.
        </p>
      </div>
    </section>
  );
}
