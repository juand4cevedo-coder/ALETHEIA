import styles from "./FaqSection.module.css";
import section from "./Section.module.css";
import { SectionHeading } from "./SectionHeading.tsx";
import { ChevronAbajoIcon } from "../../components/ui/icons.tsx";

// Cada respuesta dice solo lo que el sistema hace hoy o lo que fijan los textos legales. Quién
// ve los archivos: solo los miembros del caso (services/cases.py) y ALETHEIA no los analiza ni
// los usa para fines propios (política de privacidad). El servidor sí los descifra para servir
// una descarga o armar un paquete; por eso no se promete que nadie más pueda abrirlos.
const QUESTIONS = [
  {
    question: "¿ALETHEIA certifica que una prueba es auténtica?",
    answer:
      "No. Preserva el archivo y documenta que no cambió. Si la prueba es auténtica, veraz o admisible lo decide la autoridad judicial.",
  },
  {
    question: "¿Qué es una huella SHA-256?",
    answer:
      "Un código de 64 caracteres que se calcula a partir del contenido del archivo. Si el archivo cambia en un solo byte, la huella es otra.",
  },
  {
    question: "¿Quién emite el sello de tiempo?",
    answer:
      "Una autoridad de sellado de tiempo externa, con la norma RFC 3161. El sello se comprueba con OpenSSL, sin depender de ALETHEIA.",
  },
  {
    question: "¿Cómo comprueba la contraparte el paquete?",
    answer:
      "Con el verificador público, que llega con la versión 1.0 y no pide una cuenta. La huella se calcula en su navegador y el archivo no se envía a ningún servidor.",
  },
  {
    question: "¿Quién puede ver mis archivos?",
    answer:
      "Solo las personas de su organización que son miembros del caso. Los archivos se guardan cifrados con la llave del caso y se descifran cuando un miembro descarga un original o pide un paquete. ALETHEIA no los analiza ni los usa para fines propios.",
  },
  {
    question: "¿Qué pasa con mi evidencia si cancelo el plan?",
    answer:
      "Al terminar el periodo pagado, la cuenta queda 30 días en solo lectura para que exporte sus casos. Después se destruyen las llaves de cifrado y le enviamos por correo una constancia de eliminación.",
  },
] as const;

// Preguntas frecuentes con <details>: se abren con teclado y lector de pantalla sin código. El
// encabezado queda fijo (sticky) mientras se leen las preguntas.
export function FaqSection() {
  return (
    <section className={section.section} aria-labelledby="titulo-preguntas">
      <div className={`${section.inner} ${styles.layout}`}>
        <SectionHeading
          id="titulo-preguntas"
          kicker="Preguntas frecuentes"
          title="Antes de empezar"
          className={`${section.headingStacked} ${styles.heading}`}
        />
        <div className={styles.list}>
          {QUESTIONS.map((item) => (
            <details key={item.question} className={styles.item}>
              <summary className={styles.summary}>
                <span>{item.question}</span>
                <ChevronAbajoIcon
                  size={16}
                  className={styles.chevron}
                  aria-hidden="true"
                />
              </summary>
              <p className={styles.answer}>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
