import { Link } from "react-router";

import { FlechaDerechaIcon, PaqueteIcon } from "../../components/ui/icons.tsx";
import { ROUTES } from "../../config/routes.ts";
import section from "./Section.module.css";
import { SectionHeading } from "./SectionHeading.tsx";
import styles from "./PreservationSection.module.css";

// Contenido real del ZIP que arma export_package.py: originales en files/, un .tsr por archivo
// sellado en timestamps/, la cadena en custody/events.json (con custody/head.tsr si la cabeza
// quedó anclada), report.pdf y manifest.json. Si el armado cambia, este listado cambia con él.
const CONTENTS = [
  {
    path: "files/",
    text: "Los originales, byte por byte como se subieron.",
  },
  {
    path: "manifest.json",
    text: "La huella SHA-256 y el tamaño de cada archivo, y la huella del último evento de custodia.",
  },
  {
    path: "custody/events.json",
    text: "Los eventos de custodia en orden. Cada uno lleva la huella del anterior.",
  },
  {
    path: "timestamps/",
    text: "El sello de tiempo RFC 3161 de cada archivo que ya lo tiene.",
  },
  {
    path: "report.pdf",
    text: "Un informe legible con la declaración de alcance: qué se comprobó y qué no.",
  },
] as const;

const STEPS = [
  "En el verificador público carga manifest.json y el archivo que quiere revisar. Su navegador recalcula la huella y le dice si coincide con la del manifiesto.",
  "Los sellos son respuestas RFC 3161 estándar, así que se pueden revisar con herramientas comunes como OpenSSL, sin pasar por ALETHEIA.",
  "Si alguien cambia un evento de custodia, la huella que lo sigue deja de coincidir y la cadena se rompe en ese punto.",
] as const;

// Paquete de preservación (antes una diapositiva del carrusel): sección fija y visible sin
// interacción, porque es lo que un tercero recibe del abogado.
export function PreservationSection() {
  return (
    <section
      id="paquete"
      className={section.section}
      aria-labelledby="titulo-paquete"
    >
      <div className={section.inner}>
        <SectionHeading
          id="titulo-paquete"
          title="El caso completo cabe en un paquete que otra persona puede revisar sin su ayuda"
          lead="Lo pide desde la pestaña Paquete del caso. Se arma en segundo plano y queda disponible en un enlace que vence a las 24 horas."
        />
        <div className={styles.layout}>
          <figure className={styles.package}>
            <figcaption className={styles.packageHead}>
              <PaqueteIcon size={20} aria-hidden="true" />
              Qué trae el archivo ZIP
            </figcaption>
            <dl className={styles.contents}>
              {CONTENTS.map((item) => (
                <div key={item.path} className={styles.row}>
                  <dt translate="no">{item.path}</dt>
                  <dd>{item.text}</dd>
                </div>
              ))}
            </dl>
          </figure>
          <div className={styles.verify}>
            <h3 className={styles.verifyTitle}>Cómo lo comprueba un tercero</h3>
            <ol className={styles.steps}>
              {STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p className={styles.scope}>
              El paquete muestra que los archivos no cambiaron desde que
              llegaron a ALETHEIA. Si una prueba es admisible lo decide la
              autoridad judicial.
            </p>
            <Link to={ROUTES.verifier} className={styles.link}>
              Abrir el verificador público
              <FlechaDerechaIcon size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
