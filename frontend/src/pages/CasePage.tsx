import { useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";

import type { CaseDetail, CaseMemberOut } from "../api/generated";
import { readCaseOptions } from "../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../components/ui/Button.tsx";
import { ButtonLink } from "../components/ui/ButtonLink.tsx";
import { FilingNumber } from "../components/ui/FilingNumber.tsx";
import { Notice } from "../components/ui/Notice.tsx";
import { PageHeader } from "../components/ui/PageHeader.tsx";
import { StatusBadge } from "../components/ui/StatusBadge.tsx";
import { SystemError } from "../components/ui/SystemError.tsx";
import { ROUTES } from "../config/routes.ts";
import { SITE_NAME } from "../config/site.ts";
import { MESSAGES } from "../content/messages.ts";
import { apiProblem } from "../features/auth/apiProblem.ts";
import { CustodyTimeline } from "../features/cases/CustodyTimeline.tsx";
import { formatColombiaTime } from "../features/cases/dates.ts";
import { PRACTICE_AREA_LABELS } from "../features/cases/practiceAreas.ts";
import { ROLE_LABELS } from "../features/workspace/roles.ts";
import styles from "./CasePage.module.css";

type TabKey = "chain" | "team";
const TAB_ORDER: readonly TabKey[] = ["chain", "team"];

/** El caso no existe, es de otra organización o su id no es válido: MSG-011 en los tres casos. */
function isMissing(error: unknown): boolean {
  const { status } = apiProblem(error);
  return status === 404 || status === 422;
}

// El caso (HU-015, maqueta 03): su identidad procesal, la cadena de custodia desde el evento 1 y
// el equipo. Solo muestra lo que ya existe: sin «Editar datos», sin zona de carga, sin
// «Verificar ahora» y sin pestañas de evidencias o paquetes hasta sus historias.
export function CasePage() {
  const { caseId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  // El aviso se guarda al llegar y el estado se borra del historial: se ve en esta visita, pero
  // no otra vez al recargar ni al volver atrás.
  const [justOpened] = useState(
    () =>
      (location.state as { justOpened?: boolean } | null)?.justOpened === true,
  );
  useEffect(() => {
    if (justOpened) {
      void navigate(location.pathname, { replace: true, state: null });
    }
  }, [justOpened, location.pathname, navigate]);
  const detail = useQuery({
    ...readCaseOptions({ path: { case_id: caseId } }),
    // Un caso inexistente, ajeno o con un id mal formado (422 de la ruta) no cambia con otro
    // intento: MSG-011 se muestra de inmediato. Las fallas de red o del servidor sí se reintentan.
    retry: (failureCount, error) => !isMissing(error) && failureCount < 2,
  });

  if (detail.isPending) {
    return (
      <div className={styles.screen}>
        <title>{`Caso · ${SITE_NAME}`}</title>
        <meta name="robots" content="noindex" />
        <p className={styles.loading} role="status">
          <LoaderCircle
            className={styles.spinner}
            size={20}
            aria-hidden="true"
          />
          Abriendo el caso…
        </p>
      </div>
    );
  }

  if (detail.isError) {
    const missing = isMissing(detail.error);
    const { requestId } = apiProblem(detail.error);
    return (
      <div className={styles.screen}>
        <title>{`Caso no disponible · ${SITE_NAME}`}</title>
        <meta name="robots" content="noindex" />
        <div className={styles.unavailable}>
          <PageHeader eyebrow="Caso" title="Caso no disponible" />
          <Notice tone={missing ? "info" : "error"}>
            {missing ? (
              <p>{MESSAGES.notFound}</p>
            ) : (
              <SystemError requestId={requestId} />
            )}
          </Notice>
          <div className={styles.unavailableActions}>
            {!missing && (
              <Button
                surface="dark"
                variant="secondary"
                size="sm"
                shape="pill"
                onClick={() => void detail.refetch()}
              >
                Intentar de nuevo
              </Button>
            )}
            <ButtonLink
              to={ROUTES.app}
              variant="secondary"
              surface="dark"
              size="sm"
              shape="pill"
            >
              Volver al inicio
            </ButtonLink>
          </div>
        </div>
      </div>
    );
  }

  return <CaseView detail={detail.data} justOpened={justOpened} />;
}

function referenceLine(detail: CaseDetail) {
  if (detail.filing_number) {
    return <FilingNumber digits={detail.filing_number} />;
  }
  if (!detail.internal_reference) return "Sin radicado";
  return (
    <>
      {"Sin radicado · ref. interna "}
      <code translate="no">{detail.internal_reference}</code>
    </>
  );
}

function CaseView({
  detail,
  justOpened,
}: {
  detail: CaseDetail;
  justOpened: boolean;
}) {
  const [tab, setTab] = useState<TabKey>("chain");
  const tabRefs = useRef<Record<TabKey, HTMLButtonElement | null>>({
    chain: null,
    team: null,
  });
  const ids = { chain: useId(), team: useId() };
  // La API entrega los últimos eventos; el número del más reciente es el total de la cadena.
  const eventCount = detail.recent_events.reduce(
    (max, event) => Math.max(max, event.seq),
    0,
  );

  // Pestañas según el patrón WAI-ARIA: las flechas, Inicio y Fin mueven el foco y la selección.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = TAB_ORDER.indexOf(tab);
    const moves: Record<string, number> = {
      ArrowRight: (index + 1) % TAB_ORDER.length,
      ArrowLeft: (index - 1 + TAB_ORDER.length) % TAB_ORDER.length,
      Home: 0,
      End: TAB_ORDER.length - 1,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const key = TAB_ORDER[next]!;
    setTab(key);
    tabRefs.current[key]?.focus();
  }

  const tabs: { key: TabKey; label: string; count: number; unit: string }[] = [
    {
      key: "chain",
      label: "Cadena de custodia",
      count: eventCount,
      unit: eventCount === 1 ? "evento" : "eventos",
    },
    {
      key: "team",
      label: "Equipo",
      count: detail.member_count,
      unit: detail.member_count === 1 ? "persona" : "personas",
    },
  ];

  const opened = `Abierto el ${formatColombiaTime(detail.created_at)} por ${detail.created_by_name}`;

  return (
    <div className={styles.screen}>
      <title>{`${detail.title} · ${SITE_NAME}`}</title>
      <meta name="robots" content="noindex" />

      {justOpened && (
        <Notice tone="success">
          <p>Caso abierto. Su cadena de custodia comenzó.</p>
        </Notice>
      )}

      <div className={styles.case}>
        <header className={styles.hero}>
          <p className={styles.reference}>{referenceLine(detail)}</p>
          <h1 className={styles.title}>{detail.title}</h1>
          <ul className={styles.chips} aria-label="Datos del caso">
            {detail.practice_area && (
              <li className={styles.chip}>
                <i className={styles.areaDot} aria-hidden="true" />
                {PRACTICE_AREA_LABELS[detail.practice_area]}
              </li>
            )}
            {detail.court && <li className={styles.chip}>{detail.court}</li>}
            <li className={styles.chip}>{opened}</li>
          </ul>

          <div
            className={styles.tabs}
            role="tablist"
            aria-label="Secciones del caso"
            onKeyDown={handleKeyDown}
          >
            {tabs.map(({ key, label, count, unit }) => (
              <button
                key={key}
                ref={(node) => {
                  tabRefs.current[key] = node;
                }}
                type="button"
                role="tab"
                id={`${ids[key]}-tab`}
                className={styles.tab}
                aria-selected={tab === key}
                aria-controls={`${ids[key]}-panel`}
                tabIndex={tab === key ? 0 : -1}
                onClick={() => setTab(key)}
              >
                <span>{label}</span>
                <span className={styles.count} aria-hidden="true">
                  {count}
                </span>
                <span className="visually-hidden">{`, ${count} ${unit}`}</span>
              </button>
            ))}
          </div>
        </header>

        <div
          role="tabpanel"
          id={`${ids.chain}-panel`}
          aria-labelledby={`${ids.chain}-tab`}
          className={styles.panel}
          tabIndex={0}
          hidden={tab !== "chain"}
        >
          <div className={styles.chainLayout}>
            <section className={styles.card} aria-labelledby={ids.chain}>
              <h2 id={ids.chain} className={styles.cardTitle}>
                Cadena de custodia
              </h2>
              <p className={styles.caption}>
                Cada evento lleva el hash del anterior. Si alguien alterara uno,
                la cadena dejaría de cerrar.
              </p>
              <CustodyTimeline
                events={detail.recent_events}
                justOpened={justOpened}
              />
            </section>
            <CaseFacts detail={detail} />
          </div>
        </div>

        <div
          role="tabpanel"
          id={`${ids.team}-panel`}
          aria-labelledby={`${ids.team}-tab`}
          className={styles.panel}
          tabIndex={0}
          hidden={tab !== "team"}
        >
          <section className={styles.card} aria-labelledby={ids.team}>
            <h2 id={ids.team} className={styles.cardTitle}>
              Equipo del caso
            </h2>
            <p className={styles.caption}>
              Quienes trabajan en este caso y ven sus datos.
            </p>
            <TeamList detail={detail} />
          </section>
        </div>
      </div>
    </div>
  );
}

function CaseFacts({ detail }: { detail: CaseDetail }) {
  const headingId = useId();
  return (
    <section className={styles.card} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.cardTitle}>
        Datos procesales
      </h2>
      <dl className={styles.facts}>
        <div>
          <dt>Número de radicación</dt>
          <dd className={styles.filingParts}>
            {detail.filing_number ? (
              <FilingNumber digits={detail.filing_number} breakdown />
            ) : (
              "Sin radicado"
            )}
          </dd>
        </div>
        <div>
          <dt>Referencia interna</dt>
          <dd translate={detail.internal_reference ? "no" : undefined}>
            {detail.internal_reference ?? "Sin especificar"}
          </dd>
        </div>
        <div>
          <dt>Estado</dt>
          {/* Tono neutro: el verde queda para cuando el verificador independiente haya
              comprobado la cadena (HU-024), nunca por defecto. */}
          <dd>
            {detail.status === "open" ? (
              <StatusBadge tone="muted">Abierto</StatusBadge>
            ) : (
              <StatusBadge tone="closed">Cerrado</StatusBadge>
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}

/** Quien abrió el caso quedó como su primer miembro, con su nombre. */
function creatorOf(detail: CaseDetail): CaseMemberOut | undefined {
  return detail.members
    .filter((member) => member.full_name === detail.created_by_name)
    .sort((a, b) => a.added_at.localeCompare(b.added_at))[0];
}

function TeamList({ detail }: { detail: CaseDetail }) {
  const creator = creatorOf(detail);
  return (
    <ul className={styles.members}>
      {detail.members.map((member) => (
        <li key={member.user_id} className={styles.member}>
          <span className={styles.avatar} aria-hidden="true">
            {initials(member.full_name)}
          </span>
          <span className={styles.who}>
            <span className={styles.memberName}>{member.full_name}</span>
            <span className={styles.memberEmail}>{member.email}</span>
          </span>
          <span className={styles.role}>
            {member === creator
              ? `${ROLE_LABELS[member.role]} · abrió el caso`
              : ROLE_LABELS[member.role]}
          </span>
        </li>
      ))}
    </ul>
  );
}
