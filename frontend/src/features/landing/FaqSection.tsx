import { ChevronDown } from "lucide-react";

import { Reveal } from "../../components/ui/Reveal.tsx";
import styles from "./FaqSection.module.css";
import section from "./Section.module.css";
import { SectionHeading } from "./SectionHeading.tsx";

const QUESTIONS = [
  {
    question: "¿ALETHEIA certifica que una prueba es auténtica o válida?",
    answer:
      "No. ALETHEIA preserva el archivo y documenta su integridad y su trazabilidad con criptografía estándar. Determinar si una prueba es auténtica, veraz o admisible, y qué valor tiene, corresponde a la autoridad judicial.",
  },
  {
    question: "¿Qué es una huella SHA-256?",
    answer:
      "Es un código de 64 caracteres que se obtiene a partir del contenido del archivo. El mismo archivo produce siempre la misma huella, y cualquier cambio, por mínimo que sea, produce una huella completamente distinta. Por eso sirve para comprobar que un archivo no cambió.",
  },
  {
    question: "¿Quién emite el sello de tiempo?",
    answer:
      "Una autoridad de sellado de tiempo externa, con el estándar RFC 3161. El sello demuestra que la huella del archivo existía en una fecha y hora determinadas, y se puede verificar con herramientas de uso común, como OpenSSL, sin depender de ALETHEIA.",
  },
  {
    question: "¿Cómo comprueba un tercero el paquete que le entrego?",
    answer:
      "Con el verificador público, sin crear una cuenta. La comprobación se hace en su propio navegador, así que el archivo no se envía a nuestros servidores. El resultado indica si cada archivo coincide o no con el manifiesto del paquete.",
  },
  {
    question: "¿Quién puede ver mis archivos?",
    answer:
      "Solo las personas de su organización con acceso al caso, según su rol: propietario, administrador, abogado o asistente. Cada caso se cifra con su propia llave, y ni siquiera el administrador de la plataforma puede abrir el contenido de las evidencias.",
  },
  {
    question: "¿Qué pasa con mi evidencia si cancelo el plan?",
    answer:
      "Nunca se retiene evidencia por falta de pago. Al cancelar, la cuenta queda 30 días en modo de solo lectura para que descargue y exporte lo que necesite. Después se destruyen las llaves de cifrado y usted recibe por correo una constancia de eliminación.",
  },
] as const;

// Preguntas frecuentes con <details>: se abren con teclado y lector de pantalla sin código.
export function FaqSection() {
  return (
    <section className={section.section} aria-labelledby="titulo-preguntas">
      <div className={`${section.inner} ${styles.inner}`}>
        <SectionHeading
          id="titulo-preguntas"
          kicker="Preguntas frecuentes"
          title="Lo que suelen preguntar los abogados"
        />
        <Reveal className={styles.list}>
          {QUESTIONS.map((item) => (
            <details key={item.question} className={styles.item}>
              <summary className={styles.summary}>
                <span>{item.question}</span>
                <ChevronDown size={20} className={styles.chevron} />
              </summary>
              <p className={styles.answer}>{item.answer}</p>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
