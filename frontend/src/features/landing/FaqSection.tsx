import { Reveal } from "../../components/ui/Reveal.tsx";
import styles from "./FaqSection.module.css";
import section from "./Section.module.css";
import { SectionHeading } from "./SectionHeading.tsx";
import { ChevronAbajoIcon } from "../../components/ui/icons.tsx";

const QUESTIONS = [
  {
    question: "¿Ustedes certifican que una prueba es auténtica o válida?",
    answer:
      "No. Preservamos el archivo y documentamos su integridad y su trazabilidad con criptografía estándar. Determinar si una prueba es auténtica, veraz o admisible, y qué valor tiene, corresponde a la autoridad judicial.",
  },
  {
    question: "¿Qué es una huella SHA-256?",
    answer:
      "Es un código de 64 caracteres que se obtiene a partir del contenido del archivo. El mismo archivo produce siempre la misma huella, y cualquier cambio, por mínimo que sea, produce una huella completamente distinta. Por eso sirve para comprobar que un archivo no cambió.",
  },
  {
    question: "¿Quién emite el sello de tiempo?",
    answer:
      "Una autoridad de sellado de tiempo externa, con el estándar RFC 3161. El sello demuestra que la huella del archivo existía en una fecha y hora determinadas, y se puede verificar con herramientas de uso común, como OpenSSL, sin depender de nosotros.",
  },
  {
    question: "¿Cómo comprueba un tercero el paquete que le entrego?",
    answer:
      "Con el verificador público, sin crear una cuenta. La comprobación se hace en su propio navegador, así que el archivo no se envía a nuestros servidores. El resultado indica si cada archivo coincide o no con el manifiesto del paquete.",
  },
  {
    question: "¿Quién puede ver mis archivos?",
    answer:
      "Solo las personas de su organización con acceso al caso, según su rol: propietario, administrador, abogado o asistente. Cada caso se cifra con su propia llave, y ni siquiera nuestro equipo puede abrir el contenido de sus evidencias.",
  },
  {
    question: "¿Qué pasa con mi evidencia si cancelo el plan?",
    answer:
      "Nunca retenemos su evidencia por falta de pago. Al cancelar, su cuenta queda 30 días en modo de solo lectura para que descargue y exporte lo que necesite. Después destruimos las llaves de cifrado y le enviamos por correo una constancia de eliminación.",
  },
] as const;

// Preguntas frecuentes con <details>: se abren con teclado y lector de pantalla sin código. El
// encabezado es el elemento fijo (sticky) y ninguno de sus ancestros lleva Reveal: una
// transformación en un ancestro cambiaría la referencia del sticky.
export function FaqSection() {
  return (
    <section className={section.section} aria-labelledby="titulo-preguntas">
      <div className={`${section.inner} ${styles.layout}`}>
        <SectionHeading
          id="titulo-preguntas"
          index={7}
          kicker="Preguntas frecuentes"
          title="Lo que más nos preguntan"
          className={`${section.headingStacked} ${styles.heading}`}
        />
        <Reveal className={styles.list}>
          {QUESTIONS.map((item) => (
            <details key={item.question} className={styles.item}>
              <summary className={styles.summary}>
                <span>{item.question}</span>
                <ChevronAbajoIcon size={20} className={styles.chevron} />
              </summary>
              <p className={styles.answer}>{item.answer}</p>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
