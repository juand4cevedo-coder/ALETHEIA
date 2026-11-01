import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";

import { listPlansOptions } from "../api/generated/@tanstack/react-query.gen.ts";
import { ButtonLink } from "../components/ui/ButtonLink.tsx";
import { ROUTES } from "../config/routes.ts";
import { SITE_NAME, SITE_URL } from "../config/site.ts";
import { PlanSummary } from "../features/billing/PlanSummary.tsx";
import { trialDays } from "../features/billing/plans.ts";
import { PreservationDemo } from "../features/landing/PreservationDemo.tsx";
import styles from "./HomePage.module.css";

const STEPS = [
  {
    title: "Suba el original",
    text: "Cargue dentro de un caso el chat exportado, el correo, el audio, la foto o el PDF tal como lo recibió. El archivo se guarda cifrado y sin cambios.",
  },
  {
    title: "Huella y sello de tiempo",
    text: "ALETHEIA calcula su huella SHA-256, un código que cambia por completo si se modifica cualquier parte del archivo, y pide a una autoridad externa un sello que fija la fecha y la hora.",
  },
  {
    title: "Cadena de custodia",
    text: "Cada vez que alguien de su oficina sube, consulta, descarga o exporta la evidencia, queda registrado quién lo hizo y cuándo. Ese historial está encadenado y nadie lo puede editar.",
  },
  {
    title: "Paquete verificable",
    text: "Exporte los originales con sus huellas, los sellos de tiempo y un informe de custodia en PDF. Cualquiera puede comprobarlos en el verificador público sin enviar el archivo a nuestros servidores.",
  },
] as const;

const DOES = [
  "Conserva el archivo original, cifrado y sin modificaciones.",
  "Registra su huella y un sello de tiempo emitido por un tercero.",
  "Documenta quién lo subió, lo consultó, lo descargó o lo exportó.",
  "Entrega un paquete que cualquier persona puede verificar.",
] as const;

const DOES_NOT = [
  "No certifica pruebas ni determina su validez.",
  "No dice si un archivo es auténtico, veraz o admisible: esa valoración le corresponde al juez.",
  "No extrae información de celulares ni entra a cuentas de terceros. Solo recibe lo que usted sube.",
] as const;

// Página de inicio (UI-001, HU-001).
export function HomePage() {
  // La misma consulta que el resumen de planes: TanStack Query la pide una sola vez.
  const { data: plans } = useQuery(listPlansOptions());
  const days = plans ? trialDays(plans) : null;
  const trialNote =
    days === null
      ? "Prueba gratuita, sin tarjeta."
      : `Prueba gratuita de ${days} días, sin tarjeta.`;

  return (
    <>
      <title>{`${SITE_NAME} · Preservación de evidencia digital para abogados`}</title>
      <meta
        name="description"
        content="Conserve el archivo original con su huella SHA-256, un sello de tiempo de un tercero y la cadena de custodia de cada evidencia digital. Para abogados en Colombia."
      />
      <link rel="canonical" href={`${SITE_URL}/`} />

      <section className={styles.hero} aria-labelledby="titulo-inicio">
        <div className={`${styles.inner} ${styles.heroGrid}`}>
          <div className={styles.heroText}>
            <p className={styles.eyebrow}>
              Preservación de evidencia digital para abogados en Colombia
            </p>
            <h1 id="titulo-inicio" className={styles.title}>
              Conserve el original.{" "}
              <span className={styles.titleAccent}>
                Demuestre que no cambió.
              </span>
            </h1>
            <p className={styles.lead}>
              ALETHEIA guarda el archivo tal como usted lo recibió, registra su
              huella y la hora exacta con el sello de tiempo de un tercero, y
              deja constancia de cada persona que lo consulta. Cuando lo
              necesite, exporta un paquete que el juez, el perito o la
              contraparte pueden verificar sin crear una cuenta.
            </p>
            <div className={styles.actions}>
              <ButtonLink to={ROUTES.signUp} surface="dark">
                Crear cuenta gratis
              </ButtonLink>
              <ButtonLink
                to={ROUTES.verifier}
                surface="dark"
                variant="secondary"
              >
                Verificar un archivo
              </ButtonLink>
            </div>
            <p className={styles.trial}>{trialNote}</p>
          </div>
          <PreservationDemo />
        </div>
      </section>

      <section
        id="como-funciona"
        className={styles.section}
        aria-labelledby="titulo-como-funciona"
      >
        <div className={styles.inner}>
          <h2 id="titulo-como-funciona" className={styles.sectionTitle}>
            Cómo funciona
          </h2>
          <p className={styles.sectionLead}>
            Cuatro pasos, sin instalar nada y sin cambiar la forma en que su
            oficina recibe los archivos.
          </p>
          <ol className={styles.steps}>
            {STEPS.map((step, index) => (
              <li key={step.title} className={styles.step}>
                <span className={styles.stepNumber} aria-hidden="true">
                  {index + 1}
                </span>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepText}>{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        className={`${styles.section} ${styles.scope}`}
        aria-labelledby="titulo-alcance"
      >
        <div className={styles.inner}>
          <h2 id="titulo-alcance" className={styles.sectionTitle}>
            Preservamos y documentamos. La valoración de la prueba es del juez.
          </h2>
          <p className={styles.sectionLead}>
            ALETHEIA es una herramienta técnica para conservar evidencia
            digital. No reemplaza el criterio del abogado ni el del despacho.
          </p>
          <div className={styles.scopeGrid}>
            <div className={styles.scopeCard}>
              <h3 className={styles.scopeTitle}>Lo que hace</h3>
              <ul className={`${styles.scopeList} ${styles.does}`}>
                {DOES.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className={styles.scopeCard}>
              <h3 className={styles.scopeTitle}>Lo que no hace</h3>
              <ul className={`${styles.scopeList} ${styles.doesNot}`}>
                {DOES_NOT.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="titulo-planes">
        <div className={styles.inner}>
          <div className={styles.plansHead}>
            <div>
              <h2 id="titulo-planes" className={styles.sectionTitle}>
                Planes para cada etapa de su oficina
              </h2>
              <p className={styles.sectionLead}>
                Todos preservan igual. Cambian la capacidad y el número de
                usuarios.
              </p>
            </div>
            <Link to={ROUTES.pricing} className={styles.plansLink}>
              Ver planes y precios
            </Link>
          </div>
          <PlanSummary />
        </div>
      </section>

      <section className={styles.closing} aria-labelledby="titulo-cierre">
        <div className={`${styles.inner} ${styles.closingInner}`}>
          <div>
            <h2 id="titulo-cierre" className={styles.closingTitle}>
              Empiece con un caso real
            </h2>
            <p className={styles.closingText}>
              Cree su cuenta, abra un caso y preserve sus primeros archivos.{" "}
              {trialNote}
            </p>
          </div>
          <ButtonLink to={ROUTES.signUp} surface="dark">
            Crear cuenta gratis
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
