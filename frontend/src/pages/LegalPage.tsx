import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useParams } from "react-router";

import { buttonClassName } from "../components/ui/buttonStyles.ts";
import {
  CONSUMER_AUTHORITY,
  DATA_CONTROLLER,
  LEGAL_EFFECTIVE_DATE,
} from "../config/legal.ts";
import { LEGAL_PAGES, legalRoute, type LegalSlug } from "../config/routes.ts";
import {
  CONTACT_EMAIL,
  SITE_NAME,
  SITE_URL,
  pageTitle,
} from "../config/site.ts";
import { findLegalDocument } from "../features/legal/documents.ts";
import { formatEffectiveDate } from "../features/legal/format.ts";
import { extractPlainText, sha256Hex } from "../features/legal/plainText.ts";
import type { LegalDocument } from "../features/legal/types.ts";
import { useActiveSection } from "../features/legal/useActiveSection.ts";
import { NotFoundPage } from "./NotFoundPage.tsx";
import styles from "./LegalPage.module.css";
import {
  BalanzaIcon,
  CopiarIcon,
  DescargarIcon,
  EscudoVistoIcon,
  GalletaIcon,
  HuellaIcon,
  ImprimirIcon,
  InstitucionIcon,
  MenuIcon,
  ReciboIcon,
  VistoIcon,
  type IconComponent,
} from "../components/ui/icons.tsx";

// Destino del índice para el bloque de contacto que cierra cada política.
const CONTACT_ID = "contacto";

// Palabras por minuto de una lectura atenta, para estimar el tiempo de lectura.
const WORDS_PER_MINUTE = 200;

// Cuánto se muestra el aviso de huella copiada.
const COPIED_FOR_MS = 2000;

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
  // La clave reinicia el índice, su resaltado y la huella al pasar de una política a otra.
  return <LegalDocumentView key={legalDocument.slug} doc={legalDocument} />;
}

type Fingerprint = { text: string; hash: string | null; minutes: number };

/**
 * Texto plano de la política tal como se lee en pantalla y su huella SHA-256. Se calcula en el
 * navegador después de pintar el texto, así que la huella corresponde exactamente a lo que la
 * persona tiene delante y al archivo que descarga.
 */
function useFingerprint(
  doc: LegalDocument,
  article: RefObject<HTMLElement | null>,
): Fingerprint | null {
  const [fingerprint, setFingerprint] = useState<Fingerprint | null>(null);

  useEffect(() => {
    if (!article.current) return;
    const text = [
      doc.title.toUpperCase(),
      `${SITE_NAME} (${SITE_URL.replace(/^https?:\/\//, "")})`,
      `Vigente desde el ${formatEffectiveDate()}`,
      "",
      extractPlainText(article.current),
    ].join("\n");
    const minutes = Math.max(
      1,
      Math.round(text.split(/\s+/).length / WORDS_PER_MINUTE),
    );
    let cancelled = false;
    void sha256Hex(text).then((hash) => {
      if (!cancelled) setFingerprint({ text, hash, minutes });
    });
    return () => {
      cancelled = true;
    };
  }, [doc, article]);

  return fingerprint;
}

function LegalDocumentView({ doc }: { doc: LegalDocument }) {
  const [indexOpen, setIndexOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const articleRef = useRef<HTMLElement>(null);
  const fingerprint = useFingerprint(doc, articleRef);
  const sectionIds = useMemo(
    () => [...doc.sections.map((section) => section.id), CONTACT_ID],
    [doc],
  );
  const active = useActiveSection(sectionIds);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_FOR_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copyHash() {
    if (!fingerprint?.hash) return;
    try {
      await navigator.clipboard.writeText(fingerprint.hash);
      setCopied(true);
    } catch {
      // Sin permiso para el portapapeles la huella sigue a la vista para copiarla a mano.
    }
  }

  function download() {
    if (!fingerprint) return;
    // Sin BOM ni conversión de saltos de línea: el archivo tiene los mismos bytes que se
    // usaron para calcular la huella.
    const blob = new Blob([fingerprint.text], {
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
      <title>{pageTitle(doc.title)}</title>
      <meta name="description" content={doc.description} />
      <link rel="canonical" href={`${SITE_URL}${legalRoute(doc.slug)}`} />

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
                  <dt>Lectura</dt>
                  <dd>
                    {fingerprint ? `${fingerprint.minutes} min` : "Calculando"}
                  </dd>
                </div>
                <div>
                  <dt>Responsable</dt>
                  <dd>{DATA_CONTROLLER.name}</dd>
                </div>
              </dl>
            </div>

            <section className={styles.seal} aria-labelledby="huella-titulo">
              <p id="huella-titulo" className={styles.sealLabel}>
                <HuellaIcon size={16} aria-hidden="true" />
                Huella SHA-256 de este texto
              </p>
              <p className={styles.sealHash} aria-live="polite">
                {fingerprint === null
                  ? "Calculando la huella"
                  : (fingerprint.hash ??
                    "Su navegador no permite calcular la huella.")}
              </p>
              <p className={styles.sealNote}>
                Se calcula en su navegador sobre el texto que está leyendo. Si
                descarga el texto y su huella coincide con esta, guardó
                exactamente la versión vigente.
              </p>
              <div className={styles.sealActions}>
                <button
                  type="button"
                  className={buttonClassName({
                    variant: "secondary",
                    size: "sm",
                  })}
                  onClick={download}
                  disabled={!fingerprint}
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
                  onClick={copyHash}
                  disabled={!fingerprint?.hash}
                >
                  {copied ? (
                    <VistoIcon size={16} aria-hidden="true" />
                  ) : (
                    <CopiarIcon size={16} aria-hidden="true" />
                  )}
                  {copied ? "Huella copiada" : "Copiar huella"}
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
