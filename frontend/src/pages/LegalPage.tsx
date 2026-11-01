import { List, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { NavLink, useParams } from "react-router";

import { buttonClassName } from "../components/ui/buttonStyles.ts";
import {
  DATA_CONTROLLER,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_VERSION,
} from "../config/legal.ts";
import { LEGAL_PAGES, legalRoute } from "../config/routes.ts";
import { CONTACT_EMAIL, SITE_NAME, SITE_URL } from "../config/site.ts";
import { findLegalDocument } from "../features/legal/documents.ts";
import { formatEffectiveDate } from "../features/legal/format.ts";
import type { LegalDocument } from "../features/legal/types.ts";
import { useActiveSection } from "../features/legal/useActiveSection.ts";
import { NotFoundPage } from "./NotFoundPage.tsx";
import styles from "./LegalPage.module.css";

// Destino del índice para el bloque de contacto que cierra cada política.
const CONTACT_ID = "contacto";

// Páginas legales (UI-003, HU-003): una sola plantilla de lectura para las cuatro políticas.
// La dirección /legal/:pagina elige el texto; un nombre que no existe muestra la página 404.
export function LegalPage() {
  const { pagina } = useParams();
  const legalDocument = findLegalDocument(pagina);
  if (!legalDocument) return <NotFoundPage />;
  // La clave reinicia el índice y su resaltado al pasar de una política a otra.
  return <LegalDocumentView key={legalDocument.slug} doc={legalDocument} />;
}

function LegalDocumentView({ doc }: { doc: LegalDocument }) {
  const [indexOpen, setIndexOpen] = useState(false);
  const sectionIds = useMemo(
    () => [...doc.sections.map((section) => section.id), CONTACT_ID],
    [doc],
  );
  const active = useActiveSection(sectionIds);

  return (
    <>
      <title>{`${doc.title} · ${SITE_NAME}`}</title>
      <meta name="description" content={doc.description} />
      <link rel="canonical" href={`${SITE_URL}${legalRoute(doc.slug)}`} />

      <div className={styles.head}>
        <div className={styles.inner}>
          <nav aria-label="Políticas" className={styles.switcher}>
            <ul className={styles.switcherList}>
              {LEGAL_PAGES.map((page) => (
                <li key={page.slug}>
                  <NavLink
                    to={legalRoute(page.slug)}
                    className={styles.switcherLink}
                  >
                    {page.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <h1 className={styles.title}>{doc.title}</h1>
          <p className={styles.meta}>
            <span className={styles.version}>Versión {LEGAL_VERSION}</span>
            <span>
              Vigente desde el{" "}
              <time dateTime={LEGAL_EFFECTIVE_DATE}>
                {formatEffectiveDate()}
              </time>
            </span>
          </p>

          <div className={styles.summary}>
            <p className={styles.summaryLabel}>En pocas palabras</p>
            <p>{doc.summary}</p>
          </div>
        </div>
      </div>

      <div className={styles.body}>
        <aside className={styles.aside}>
          <nav
            aria-labelledby="indice-titulo"
            className={styles.index}
            data-open={indexOpen ? "true" : "false"}
          >
            <p id="indice-titulo" className={styles.indexTitle}>
              En esta página
            </p>
            {/* En pantallas angostas el índice se pliega para no empujar el texto hacia abajo. */}
            <button
              type="button"
              className={styles.indexToggle}
              aria-expanded={indexOpen}
              aria-controls="indice-lista"
              onClick={() => setIndexOpen((open) => !open)}
            >
              <List size={16} />
              {indexOpen ? "Ocultar el índice" : "Ver el índice"}
            </button>
            <ol id="indice-lista" className={styles.indexList}>
              {doc.sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className={styles.indexLink}
                    aria-current={
                      active === section.id ? "location" : undefined
                    }
                    onClick={() => setIndexOpen(false)}
                  >
                    {section.title}
                  </a>
                </li>
              ))}
              <li className={styles.indexContact}>
                <a
                  href={`#${CONTACT_ID}`}
                  className={styles.indexLink}
                  aria-current={active === CONTACT_ID ? "location" : undefined}
                  onClick={() => setIndexOpen(false)}
                >
                  Responsable y contacto
                </a>
              </li>
            </ol>
          </nav>
          <button
            type="button"
            className={`${buttonClassName({ variant: "secondary", surface: "dark", size: "sm" })} ${styles.print}`}
            onClick={() => window.print()}
          >
            <Printer size={16} />
            Imprimir
          </button>
        </aside>

        <article className={styles.article} aria-label={doc.title}>
          {doc.sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className={styles.section}
              aria-labelledby={`${section.id}-titulo`}
            >
              <h2 id={`${section.id}-titulo`} className={styles.sectionTitle}>
                {section.title}
              </h2>
              <div className={styles.prose}>{section.body}</div>
            </section>
          ))}

          <section
            id={CONTACT_ID}
            className={styles.contact}
            aria-labelledby="contacto-titulo"
          >
            <h2 id="contacto-titulo" className={styles.contactTitle}>
              Responsable y contacto
            </h2>
            <dl className={styles.contactList}>
              <div>
                <dt>Responsable</dt>
                <dd>{DATA_CONTROLLER.name}</dd>
              </div>
              <div>
                <dt>Domicilio</dt>
                <dd>{DATA_CONTROLLER.city}</dd>
              </div>
              <div>
                <dt>Dirección</dt>
                <dd>{DATA_CONTROLLER.address}</dd>
              </div>
              <div>
                <dt>Correo</dt>
                <dd>
                  <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
                </dd>
              </div>
              <div>
                <dt>Teléfono</dt>
                <dd>
                  <a href={DATA_CONTROLLER.phoneHref}>
                    {DATA_CONTROLLER.phone}
                  </a>
                </dd>
              </div>
            </dl>
          </section>
        </article>
      </div>
    </>
  );
}
