import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router";

import type { CaseSummaryOut, CaseTotalsOut, Me } from "../api/generated";
import { listCasesQueryKey } from "../api/generated/@tanstack/react-query.gen.ts";
import { listCases } from "../api/generated/sdk.gen.ts";
import { Button } from "../components/ui/Button.tsx";
import { ButtonLink } from "../components/ui/ButtonLink.tsx";
import { ChainStrip } from "../components/ui/ChainStrip.tsx";
import { EmptyState } from "../components/ui/EmptyState.tsx";
import { FilingNumber } from "../components/ui/FilingNumber.tsx";
import { Notice } from "../components/ui/Notice.tsx";
import { PageHeader } from "../components/ui/PageHeader.tsx";
import { StatusBadge } from "../components/ui/StatusBadge.tsx";
import { SystemError } from "../components/ui/SystemError.tsx";
import { useMediaQuery } from "../components/ui/useMediaQuery.ts";
import { ROUTES } from "../config/routes.ts";
import { SITE_NAME } from "../config/site.ts";
import { apiProblem } from "../features/auth/apiProblem.ts";
import { custodyActionLabel } from "../features/cases/custodyActions.ts";
import { CustodyStrip } from "../features/cases/CustodyStrip.tsx";
import { formatRecentActivity } from "../features/cases/dates.ts";
import { describeEvidenceByType } from "../features/cases/evidenceTypes.ts";
import { normalizeFilingNumber } from "../features/cases/filingNumber.ts";
import { PRACTICE_AREA_LABELS } from "../features/cases/practiceAreas.ts";
import { canOpenCases } from "../features/cases/roles.ts";
import { VerifyEmailDialog } from "../features/cases/VerifyEmailDialog.tsx";
import styles from "./CasesPage.module.css";
import {
  BuscarIcon,
  CargandoIcon,
  ChevronDerechaIcon,
  MasIcon,
} from "../components/ui/icons.tsx";

type Status = "open" | "closed" | "all";

const SEGMENTS: readonly {
  value: Status;
  label: string;
  count: (totals: CaseTotalsOut) => number;
}[] = [
  { value: "open", label: "Abiertos", count: (totals) => totals.open },
  { value: "closed", label: "Cerrados", count: (totals) => totals.closed },
  {
    value: "all",
    label: "Todos",
    count: (totals) => totals.open + totals.closed,
  },
];

/** El segmento vive en la dirección (?estado=…), para que volver de un caso lo conserve. */
const STATUS_PARAM = "estado";

const STATUS_IN_URL: Record<Status, string> = {
  open: "abiertos",
  closed: "cerrados",
  all: "todos",
};

/** Sin el parámetro, o con un valor que no es un segmento, el libro muestra los abiertos. */
function statusFromUrl(value: string | null): Status {
  const found = (Object.keys(STATUS_IN_URL) as Status[]).find(
    (status) => STATUS_IN_URL[status] === value,
  );
  return found ?? "open";
}

function casesCount(count: number): string {
  return count === 1 ? "1 caso" : `${count} casos`;
}

const CAPTIONS: Record<Status, string> = {
  open: "Casos abiertos",
  closed: "Casos cerrados",
  all: "Todos los casos",
};

const NONE_IN_SEGMENT: Record<Status, string> = {
  open: "No tiene casos abiertos.",
  closed: "No tiene casos cerrados.",
  all: "No tiene casos.",
};

/** Texto exacto para quien no abre casos (especificación, 5.2). */
const ASSISTANT_EMPTY =
  "Los casos los abre un abogado, el administrador o el propietario. Cuando lo asignen a uno, aparecerá aquí";

// En 900 px o menos la tabla pasa a tarjetas apiladas (especificación, 5.2).
const CARDS_QUERY = "(max-width: 900px)";

/** Sin tildes ni mayúsculas: «sucesion» encuentra «Sucesión». */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** El filtro local busca en el título, en el radicado (solo sus dígitos, sin importar cómo se
 * escriban los espacios) y en el despacho de los casos ya cargados; no consulta la API. */
function matchesFilter(item: CaseSummaryOut, query: string): boolean {
  const text = fold(query.trim());
  if (!text) return true;
  if (fold(item.title).includes(text)) return true;
  if (item.court && fold(item.court).includes(text)) return true;
  const digits = normalizeFilingNumber(query);
  return (
    /^[0-9]+$/.test(digits) && (item.filing_number?.includes(digits) ?? false)
  );
}

/** Cada carga dice también el total, para que el texto cambie siempre: dos páginas completas
 * seguidas darían el mismo «Se cargaron 25 casos más.» y el lector de pantalla no anunciaría
 * la segunda. */
function loadedMessage(count: number, total: number): string {
  return count === 1
    ? `Se cargó 1 caso más; ${total} en total.`
    : `Se cargaron ${count} casos más; ${total} en total.`;
}

function matchMessage(count: number, loaded: number): string {
  return count === 1
    ? `1 de ${loaded} casos cargados coincide.`
    : `${count} de ${loaded} casos cargados coinciden.`;
}

// Libro de casos (HU-017, maquetas 01 y 04): la franja de la custodia, los segmentos por estado
// con su conteo, un filtro local y la lista de los casos en los que la persona es miembro,
// ordenados por su última actividad. Sin casos, la pantalla «Antes del primer caso».
export function CasesPage() {
  const me = useOutletContext<Me>();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = statusFromUrl(searchParams.get(STATUS_PARAM));
  const [filter, setFilter] = useState("");
  const [loadedNote, setLoadedNote] = useState("");
  const [verifying, setVerifying] = useState(false);
  const cards = useMediaQuery(CARDS_QUERY);
  const bookRef = useRef<HTMLDivElement>(null);
  // Casos recién cargados que deben recibir el foco cuando el botón desaparece.
  const pendingFocus = useRef<string[] | null>(null);
  const filterId = useId();

  // Tras pintar la última página, el foco pasa al primer caso nuevo que se vea. Si el filtro los
  // oculta todos, va a la tabla o a la lista, para no perderse con el botón que ya no está.
  useEffect(() => {
    const ids = pendingFocus.current;
    const root = bookRef.current;
    if (!ids || !root) return;
    pendingFocus.current = null;
    const target =
      ids
        .map((id) =>
          root.querySelector<HTMLElement>(`[data-case-link="${id}"]`),
        )
        .find((link) => link !== null) ??
      root.querySelector<HTMLElement>("[data-book-focus]");
    target?.focus();
  });

  const book = useInfiniteQuery({
    queryKey: [
      { ...listCasesQueryKey({ query: { status } })[0], _infinite: true },
    ],
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await listCases({
        query: pageParam ? { status, cursor: pageParam } : { status },
        signal,
        throwOnError: true,
      });
      return data;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.next_cursor,
    // Al cambiar de segmento, la franja y los conteos siguen a la vista mientras llega la lista:
    // los totales no dependen del filtro por estado.
    placeholderData: keepPreviousData,
  });

  const mayOpen = canOpenCases(me.organization?.role);
  const openCase = (label: string) =>
    me.email_verified ? (
      <ButtonLink to={ROUTES.newCase} size="sm">
        <MasIcon size={16} aria-hidden="true" />
        {label}
      </ButtonLink>
    ) : (
      // Con el correo sin verificar el botón no se oculta: abre el aviso que explica por qué.
      <Button size="sm" onClick={() => setVerifying(true)}>
        <MasIcon size={16} aria-hidden="true" />
        {label}
      </Button>
    );

  const head = (
    <>
      <title>{`Casos · ${SITE_NAME}`}</title>
      <meta name="robots" content="noindex" />
    </>
  );
  const header = (actions?: ReactNode) => (
    <PageHeader
      eyebrow="Expedientes"
      title="Casos"
      description="Los casos en los que usted es miembro. Cada acción sobre ellos queda en su cadena de custodia."
      actions={actions}
    />
  );
  const dialog = (
    <VerifyEmailDialog open={verifying} onClose={() => setVerifying(false)} />
  );

  if (book.isPending) {
    return (
      <div className={styles.screen}>
        {head}
        {header()}
        <p className={styles.loading} role="status">
          <CargandoIcon
            className={styles.spinner}
            size={20}
            aria-hidden="true"
          />
          Cargando sus casos…
        </p>
      </div>
    );
  }

  if (book.isError && !book.data) {
    const { requestId } = apiProblem(book.error);
    return (
      <div className={styles.screen}>
        {head}
        {header()}
        <div className={styles.failure}>
          <Notice tone="error">
            <SystemError requestId={requestId} />
          </Notice>
          <div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void book.refetch()}
            >
              Intentar de nuevo
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const pages = book.data.pages;
  const totals = pages.at(-1)!.totals;

  // Antes del primer caso (maqueta 04).
  if (totals.open + totals.closed === 0) {
    return (
      <div className={styles.screen}>
        {head}
        {header()}
        <EmptyState
          title={
            mayOpen
              ? "Abra un caso y su cadena de custodia empieza a contar."
              : "Todavía no tiene casos asignados."
          }
          description={
            mayOpen
              ? "Desde ese momento, cada acción de su equipo sobre el caso queda registrada, y la evidencia que suba se guardará tal como llegó."
              : `${ASSISTANT_EMPTY}.`
          }
          actions={mayOpen ? openCase("Abrir mi primer caso") : undefined}
          aside={<Principles />}
        />
        {dialog}
      </div>
    );
  }

  const loaded = pages.flatMap((page) => page.items);
  const loadingSegment = book.isPlaceholderData;
  const visible = loaded.filter((item) => matchesFilter(item, filter));
  const filtering = filter.trim().length > 0;
  const caption = CAPTIONS[status];

  async function loadMore() {
    const result = await book.fetchNextPage();
    const pages = result.data?.pages;
    const page = pages?.at(-1);
    if (result.isError || !pages || !page) return;
    const total = pages.reduce((sum, current) => sum + current.items.length, 0);
    if (!result.hasNextPage) {
      pendingFocus.current = page.items.map((item) => item.id);
    }
    setLoadedNote(loadedMessage(page.items.length, total));
  }

  return (
    <div className={styles.screen}>
      {head}
      {header(mayOpen ? openCase("Abrir caso") : undefined)}

      <CustodyStrip totals={totals} />

      <div className={styles.tools}>
        <div
          className={styles.segments}
          role="radiogroup"
          aria-label="Estado de los casos"
        >
          {SEGMENTS.map((segment) => (
            <label key={segment.value} className={styles.segment}>
              <input
                type="radio"
                name="estado-de-los-casos"
                value={segment.value}
                checked={status === segment.value}
                onChange={() => {
                  // Reemplaza la entrada del historial: cambiar de segmento no es navegar.
                  setSearchParams(
                    (current) => {
                      const next = new URLSearchParams(current);
                      next.set(STATUS_PARAM, STATUS_IN_URL[segment.value]);
                      return next;
                    },
                    { replace: true },
                  );
                  setLoadedNote("");
                }}
                className={styles.segmentInput}
              />
              <span>{segment.label}</span>
              {/* El número se ve; el lector de pantalla oye «Abiertos, 3 casos». */}
              <span className={styles.segmentCount} aria-hidden="true">
                {segment.count(totals)}
              </span>
              <span className="visually-hidden">
                {`, ${casesCount(segment.count(totals))}`}
              </span>
            </label>
          ))}
        </div>

        <div className={styles.filter}>
          <label htmlFor={filterId} className="visually-hidden">
            Filtrar los casos cargados por título, radicado o despacho
          </label>
          <BuscarIcon
            className={styles.filterIcon}
            size={15}
            aria-hidden="true"
          />
          <input
            id={filterId}
            type="search"
            className={styles.filterInput}
            placeholder="Título, radicado o despacho"
            autoComplete="off"
            spellCheck={false}
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
              // Al escribir solo cambia el número de coincidencias: la carga ya se anunció.
              setLoadedNote("");
            }}
          />
        </div>

        <p className={styles.order}>
          Ordenados por <b>última actividad</b>
        </p>
      </div>

      <div
        ref={bookRef}
        className={styles.book}
        aria-busy={loadingSegment || undefined}
      >
        {loadingSegment ? (
          <p className={styles.loading} role="status">
            <CargandoIcon
              className={styles.spinner}
              size={20}
              aria-hidden="true"
            />
            Cargando sus casos…
          </p>
        ) : loaded.length === 0 ? (
          <p className={styles.none}>{NONE_IN_SEGMENT[status]}</p>
        ) : visible.length === 0 ? (
          <p className={styles.none} tabIndex={-1} data-book-focus="">
            {`Ningún caso cargado coincide con «${filter.trim()}».`}
          </p>
        ) : cards ? (
          <CaseCards items={visible} caption={caption} />
        ) : (
          <CaseTable items={visible} caption={caption} />
        )}
      </div>

      <p className="visually-hidden" role="status">
        {filtering && !loadingSegment
          ? [loadedNote, matchMessage(visible.length, loaded.length)]
              .filter(Boolean)
              .join(" ")
          : loadedNote}
      </p>

      {book.isFetchNextPageError && (
        <Notice tone="error">
          <SystemError requestId={apiProblem(book.error).requestId} />
        </Notice>
      )}

      {book.hasNextPage && !loadingSegment && (
        <div className={styles.more}>
          <Button
            variant="secondary"
            size="sm"
            busy={book.isFetchingNextPage}
            onClick={() => void loadMore()}
          >
            Cargar más casos
          </Button>
          {filtering && (
            <p className={styles.moreNote}>
              El filtro busca solo en los casos cargados.
            </p>
          )}
        </div>
      )}

      {dialog}
    </div>
  );
}

/** Lo que hace un caso desde que se abre y lo que hará con la evidencia (maqueta 04). Solo se
 * dice en presente lo que ya ocurre: la evidencia todavía no se puede subir. */
function Principles() {
  return (
    <ol className={styles.principles}>
      <li>
        <span className={styles.principleNumber} aria-hidden="true">
          01
        </span>
        <div>
          <p className={styles.principleTitle}>Una llave por caso</p>
          <p className={styles.principleText}>
            Cada caso recibe su propia llave de cifrado en el momento en que se
            abre.
          </p>
        </div>
      </li>
      <li>
        <span className={styles.principleNumber} aria-hidden="true">
          02
        </span>
        <div>
          <p className={styles.principleTitle}>El original, intacto</p>
          <p className={styles.principleText}>
            La evidencia que suba se guardará tal como llegó, cifrada con la
            llave del caso. No se convertirá ni se comprimirá.
          </p>
        </div>
      </li>
      <li>
        <span className={styles.principleNumber} aria-hidden="true">
          03
        </span>
        <div>
          <p className={styles.principleTitle}>Un historial que no se edita</p>
          <p className={styles.principleText}>
            Cada acción sobre el caso queda en su cadena de custodia, y cada
            evento lleva el hash del anterior: si alguien alterara uno, la
            cadena dejaría de cuadrar.
          </p>
        </div>
      </li>
    </ol>
  );
}

type ListProps = { items: CaseSummaryOut[]; caption: string };

// Escritorio: una tabla real. Toda la fila lleva al caso, pero el único enlace es el título.
function CaseTable({ items, caption }: ListProps) {
  return (
    <table
      className={styles.table}
      data-layout="table"
      tabIndex={-1}
      data-book-focus=""
    >
      <caption className="visually-hidden">
        {`${caption}, del de actividad más reciente al más antiguo`}
      </caption>
      <thead>
        <tr>
          <th scope="col">Caso y radicado</th>
          <th scope="col">Despacho</th>
          <th scope="col">Evidencias</th>
          <th scope="col">Cadena de custodia</th>
          <th scope="col">Integridad</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id} className={styles.row}>
            <th scope="row" className={styles.caseCell}>
              <CaseIdentity item={item} />
            </th>
            <td>
              <CourtCell item={item} />
            </td>
            <td>
              <EvidenceCell item={item} />
            </td>
            <td>
              <ChainCell item={item} />
            </td>
            <td className={styles.integrityCell}>
              <span className={styles.integrity}>
                <StatusBadge tone="muted">Sin verificar</StatusBadge>
                <ChevronDerechaIcon
                  className={styles.chevron}
                  size={16}
                  aria-hidden="true"
                />
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// 900 px o menos: tarjetas apiladas con los mismos datos, cada una con su título como encabezado
// y los demás datos como una lista de definiciones.
function CaseCards({ items, caption }: ListProps) {
  return (
    <ul
      className={styles.cards}
      aria-label={caption}
      data-layout="cards"
      tabIndex={-1}
      data-book-focus=""
    >
      {items.map((item) => (
        <li key={item.id}>
          <CaseCard item={item} />
        </li>
      ))}
    </ul>
  );
}

function CaseCard({ item }: { item: CaseSummaryOut }) {
  const titleId = useId();
  return (
    <article className={styles.card} aria-labelledby={titleId}>
      <CaseIdentity item={item} titleId={titleId} />
      <dl className={styles.cardFacts}>
        <div>
          <dt>Despacho</dt>
          <dd>
            <CourtCell item={item} />
          </dd>
        </div>
        <div>
          <dt>Evidencias</dt>
          <dd>
            <EvidenceCell item={item} />
          </dd>
        </div>
        <div className={styles.cardWide}>
          <dt>Cadena de custodia</dt>
          <dd>
            <ChainCell item={item} />
          </dd>
        </div>
        <div className={styles.cardWide}>
          <dt>Integridad</dt>
          <dd>
            <StatusBadge tone="muted">Sin verificar</StatusBadge>
          </dd>
        </div>
      </dl>
    </article>
  );
}

/** Título (el enlace al caso) y radicado. En una tarjeta el título es su encabezado y le da
 * nombre; en la tabla, la celda de encabezado de la fila cumple ese papel. */
function CaseIdentity({
  item,
  titleId,
}: {
  item: CaseSummaryOut;
  titleId?: string;
}) {
  const link = (
    <Link
      to={ROUTES.caseDetail(item.id)}
      className={styles.title}
      data-case-link={item.id}
    >
      {item.title}
    </Link>
  );
  return (
    <>
      <div className={styles.titleLine}>
        {titleId ? (
          <h2 id={titleId} className={styles.cardTitle}>
            {link}
          </h2>
        ) : (
          link
        )}
        {item.status === "closed" && (
          <StatusBadge tone="closed">Cerrado</StatusBadge>
        )}
      </div>
      <div className={styles.identity}>
        {item.filing_number ? (
          <FilingNumber digits={item.filing_number} />
        ) : (
          <span className={styles.noFiling}>
            Sin radicado
            {item.internal_reference && (
              <>
                {" · ref. interna "}
                <b translate="no">{item.internal_reference}</b>
              </>
            )}
          </span>
        )}
      </div>
    </>
  );
}

function CourtCell({ item }: { item: CaseSummaryOut }) {
  return (
    <>
      {item.practice_area && (
        <span className={styles.area}>
          {PRACTICE_AREA_LABELS[item.practice_area]}
        </span>
      )}
      <span className={item.court ? styles.court : styles.noCourt}>
        {item.court ?? "Aún sin despacho"}
      </span>
    </>
  );
}

function EvidenceCell({ item }: { item: CaseSummaryOut }) {
  const parts = describeEvidenceByType(item.evidence_by_type).split(" · ");
  return (
    <span className={styles.evidence}>
      <span className={styles.evidenceCount}>{item.evidence_count}</span>
      <span className={styles.evidenceTypes}>
        {item.evidence_count === 0
          ? "Sin evidencias aún"
          : parts.map((part, index) => (
              <span key={part}>
                {index > 0 && " · "}
                {part}
              </span>
            ))}
      </span>
    </span>
  );
}

function ChainCell({ item }: { item: CaseSummaryOut }) {
  const event = item.last_event;
  return (
    <span className={styles.chain}>
      <ChainStrip actions={item.recent_actions} />
      <span className={styles.when}>
        {event ? (
          <>
            {custodyActionLabel(event.action)}
            {` · ${event.actor_name ?? "Sistema"} · `}
            <time dateTime={event.occurred_at}>
              {formatRecentActivity(event.occurred_at)}
            </time>
          </>
        ) : (
          "Sin actividad registrada"
        )}
      </span>
    </span>
  );
}
