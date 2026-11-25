import type { ReactNode } from "react";

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
      "No. Una coincidencia de huellas indica que dos contenidos coinciden; no determina si son verdaderos o si constituyen una prueba admisible. La valoración corresponde a la autoridad judicial.",
  },
  {
    question: "¿Qué es una huella SHA-256?",
    answer:
      "Un código de 64 caracteres calculado a partir de un contenido. El mismo contenido produce la misma huella. Es una herramienta para detectar cambios, no para determinar la autoría.",
  },
  {
    question: "¿El comprobador envía mis archivos?",
    answer:
      "No. La huella se calcula en su navegador, por partes, así que el archivo puede ser de cualquier tamaño. Para compararla con una huella de referencia no necesita crear una cuenta.",
  },
  {
    question: "¿Quién puede ver mis casos?",
    answer:
      "Las personas de su organización que son miembros del caso. Ser administrador de la organización no otorga por sí solo acceso a todos los casos.",
  },
  {
    question: "¿Puedo trabajar con mi equipo?",
    answer:
      "Sí. El propietario y los administradores pueden invitar integrantes y gestionar sus roles. Cada invitación llega al correo de la persona invitada.",
  },
  {
    question: "¿Dónde encuentro las condiciones del servicio?",
    answer:
      "En el pie de cada página están los términos, la política de tratamiento de datos, las cookies y los reembolsos. Cada documento incluye su fecha de vigencia y una copia que puede descargar.",
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
          title="Antes de empezar"
          className={`${section.headingStacked} ${styles.heading}`}
        />
        <FaqList items={QUESTIONS} />
      </div>
    </section>
  );
}

export type FaqItem = { question: string; answer: ReactNode };

/** Lista de preguntas que se abren una a una. Cada página que la usa declara sus preguntas en
 * los datos estructurados (FAQPage). */
export function FaqList({ items }: { items: readonly FaqItem[] }) {
  return (
    // data-preguntas: el prerender lee de aquí las preguntas de la página para su FAQPage.
    <div className={styles.list} data-preguntas>
      {items.map((item) => (
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
  );
}
