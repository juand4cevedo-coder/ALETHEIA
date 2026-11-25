import { Link } from "react-router";

import section from "./Section.module.css";
import { SectionHeading } from "./SectionHeading.tsx";
import styles from "./ProblemSection.module.css";

// Las preguntas que la otra parte o el juez le harán a una prueba digital. Salen de los factores
// que el artículo 11 de la Ley 527 de 1999 manda tener en cuenta al valorar un mensaje de datos.
const QUESTIONS = [
  "¿De dónde salió el archivo y quién se lo entregó?",
  "¿Es el original o una copia que alguien rehízo?",
  "¿Quién lo ha tenido desde que llegó al despacho?",
  "¿Cambió en algo desde ese día?",
] as const;

// El problema antes de la solución: quien llega a la portada sin saber que lo tiene, lo
// reconoce aquí con una escena de su propio despacho.
export function ProblemSection() {
  return (
    <section className={section.section} aria-labelledby="titulo-problema">
      <div className={section.inner}>
        <SectionHeading
          id="titulo-problema"
          title="La prueba llega por WhatsApp y nadie anota qué pasa con ella"
          lead="Trae un chat de WhatsApp, un audio o un correo. El archivo pasa del celular al correo, del correo a una memoria USB y de ahí a una carpeta compartida. En ese camino nadie anota quién lo tuvo ni si cambió."
        />
        <div className={styles.layout}>
          <div className={styles.copy} data-reveal>
            <p>
              Meses después, en la audiencia, alguien tiene que responder por
              esa prueba. Si la historia del archivo no quedó escrita el día en
              que llegó, hay que reconstruirla de memoria, revisando chats y
              correos viejos.
            </p>
            <p>
              El artículo 11 de la Ley 527 de 1999 dice que un mensaje de datos
              se valora, entre otras cosas, por la forma en que se conservó la
              integridad de la información. Lea{" "}
              <Link to="/blog/conservar-chat-correo-video-como-evidencia">
                cómo conservar un chat, un correo o un video como evidencia
              </Link>
              .
            </p>
          </div>
          <figure className={styles.questions} data-reveal>
            <figcaption>Lo que le van a preguntar sobre esa prueba</figcaption>
            <ol>
              {QUESTIONS.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ol>
            <p className={styles.answer}>
              ALETHEIA deja esas respuestas anotadas desde el día en que el
              archivo llega al caso.
            </p>
          </figure>
        </div>
      </div>
    </section>
  );
}
