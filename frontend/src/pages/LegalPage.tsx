import { useMemo, useRef, useState } from "react";
import { NavLink, useParams } from "react-router";

import { buttonClassName } from "../components/ui/buttonStyles.ts";
import {
  CONSUMER_AUTHORITY,
  DATA_CONTROLLER,
  LEGAL_EFFECTIVE_DATE,
} from "../config/legal.ts";
import { LEGAL_PAGES, legalRoute, type LegalSlug } from "../config/routes.ts";
import { CONTACT_EMAIL, SITE_NAME, SITE_URL } from "../config/site.ts";
import { findLegalDocument } from "../features/legal/documents.ts";
import { formatEffectiveDate } from "../features/legal/format.ts";
import { extractPlainText } from "../features/legal/plainText.ts";
import type { LegalDocument } from "../features/legal/types.ts";
import { useActiveSection } from "../features/legal/useActiveSection.ts";
import { NotFoundPage } from "./NotFoundPage.tsx";
import { CabeceraSeo } from "../seo/CabeceraSeo.tsx";
import { metaLegal } from "../seo/contenidos.ts";
import styles from "./LegalPage.module.css";
import {
  BalanzaIcon,
  DescargarIcon,
  EscudoVistoIcon,
  GalletaIcon,
  ImprimirIcon,
  InstitucionIcon,
  MenuIcon,
  ReciboIcon,
  type IconComponent,
} from "../components/ui/icons.tsx";

// Destino del índice para el bloque de contacto que cierra cada política.
const CONTACT_ID = "contacto";

const POLICY_ICONS: Record<LegalSlug, IconComponent> = {
  privacidad: EscudoVistoIcon,
  terminos: BalanzaIcon,
  cookies: GalletaIcon,
  reembolsos: ReciboIcon,
};

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
  const articleRef = useRef<HTMLElement>(null);
  const sectionIds = useMemo(
    () => [...doc.sections.map((section) => section.id), CONTACT_ID],
    [doc],
  );
  const active = useActiveSection(sectionIds);

  function download() {
    if (!articleRef.current) return;
    const text = [
      doc.title.toUpperCase(),
      `${SITE_NAME} (${SITE_URL.replace(/^https?:\/\//, "")})`,
      `Vigente desde el ${formatEffectiveDate()}`,
      "",
      extractPlainText(articleRef.current),
    ].join("\n");
    const blob = new Blob([text], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `aletheia-${doc.slug}-${LEGAL_EFFECTIVE_DATE}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <CabeceraSeo meta={metaLegal(doc)} />

      <div className={styles.head}>
        <div className={styles.inner}>
          <nav aria-label="Políticas" className={styles.switcher}>
            <ul className={styles.switcherList}>
              {LEGAL_PAGES.map((page) => {
                const Icon = POLICY_ICONS[page.slug];
                return (
                  <li key={page.slug}>
                    <NavLink
                      to={legalRoute(page.slug)}
                      className={styles.switcherLink}
                    >
                      <Icon size={16} aria-hidden="true" />
                      {page.label}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className={styles.headGrid}>
            <div>
              <h1 className={styles.title}>{doc.title}</h1>
              <dl className={styles.facts}>
                <div>
                  <dt>Vigente desde el</dt>
                  <dd>
                    <time dateTime={LEGAL_EFFECTIVE_DATE}>
                      {formatEffectiveDate()}
                    </time>
                  </dd>
                </div>
                <div>
                  <dt>Responsable</dt>
                  <dd>{DATA_CONTROLLER.name}</dd>
                </div>
              </dl>
            </div>

            <section className={styles.tools} aria-labelledby="acciones-titulo">
              <p id="acciones-titulo" className={styles.toolsTitle}>
                Guardar una copia
              </p>
              <p className={styles.toolsNote}>
                Puede descargar o imprimir el texto vigente para conservarlo y
                consultarlo sin conexión.
              </p>
              <div className={styles.toolActions}>
                <button
                  type="button"
                  className={buttonClassName({
                    variant: "secondary",
                    size: "sm",
                  })}
                  onClick={download}
                >
                  <DescargarIcon size={16} aria-hidden="true" />
                  Descargar el texto
                </button>
                <button
                  type="button"
                  className={buttonClassName({
                    variant: "secondary",
                    size: "sm",
                  })}
                  onClick={() => window.print()}
                >
                  <ImprimirIcon size={16} aria-hidden="true" />
                  Imprimir
                </button>
              </div>
            </section>
          </div>

          <section
            className={styles.keyPoints}
            aria-labelledby="esencial-titulo"
          >
            <h2 id="esencial-titulo" className={styles.keyPointsTitle}>
              Lo esencial
            </h2>
            <ol className={styles.keyPointList}>
              {doc.keyPoints.map((point) => (
                <li key={point.title} className={styles.keyPoint}>
                  <p className={styles.keyPointTitle}>{point.title}</p>
                  <p>{point.text}</p>
                </li>
              ))}
            </ol>
            <p className={styles.keyPointsNote}>
              Este resumen ayuda a orientarse; lo que rige es el texto completo.
            </p>
          </section>
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
              <MenuIcon size={16} aria-hidden="true" />
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
        </aside>

        <article
          ref={articleRef}
          className={styles.article}
          aria-label={doc.title}
        >
          {doc.sections.map((section, index) => (
            <section
              key={section.id}
              id={section.id}
              className={styles.section}
              aria-labelledby={`${section.id}-titulo`}
            >
              <span className={styles.sectionNumber} aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h2 id={`${section.id}-titulo`} className={styles.sectionTitle}>
                {section.title}
              </h2>
              {section.basis && (
                <p className={styles.basis}>
                  <InstitucionIcon size={16} aria-hidden="true" />
                  <span>Fundamento: {section.basis.join("; ")}</span>
                </p>
              )}
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
                <dt>NIT</dt>
                <dd>{DATA_CONTROLLER.nit}</dd>
              </div>
              <div>
                <dt>Domicilio</dt>
                <dd>{DATA_CONTROLLER.city}</dd>
              </div>
              <div>
                <dt>Dirección de notificación</dt>
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
              <div>
                <dt>Régimen tributario</dt>
                <dd>{DATA_CONTROLLER.taxStatus}</dd>
              </div>
              <div>
                <dt>Autoridad de protección al consumidor</dt>
                <dd>
                  <a href={CONSUMER_AUTHORITY.url} rel="noopener noreferrer">
                    {CONSUMER_AUTHORITY.name}
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
