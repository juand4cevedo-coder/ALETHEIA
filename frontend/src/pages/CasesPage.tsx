import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import {
  Fragment,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { Link, useOutletContext, useSearchParams } from "react-router";

import type {
  CaseSummaryOut,
  CaseTotalsOut,
  ListCasesData,
  Me,
} from "../api/generated";
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
import { pageTitle } from "../config/site.ts";
import { apiProblem } from "../features/auth/apiProblem.ts";
import { custodyActionLabel } from "../features/cases/custodyActions.ts";
import { CustodyStrip } from "../features/cases/CustodyStrip.tsx";
import { formatRecentActivity } from "../features/cases/dates.ts";
import { describeEvidenceByType } from "../features/cases/evidenceTypes.ts";
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
  { value: "closed", label: "Archivo", count: (totals) => totals.closed },
  {
    value: "all",
    label: "Todos",
    count: (totals) => totals.open + totals.closed,
  },
];

/** El segmento vive en la dirección (?estado=…), para que volver de un caso lo conserve. */
const STATUS_PARAM = "estado";
const SEARCH_PARAM = "buscar";
const CLOSED_FROM_PARAM = "cierre_desde";
const CLOSED_TO_PARAM = "cierre_hasta";
const RETENTION_BASIS_PARAM = "fundamento";
const LEGAL_HOLD_PARAM = "bloqueo";
const RETENTION_REVIEW_PARAM = "revision";

type CaseListQuery = NonNullable<ListCasesData["query"]>;
type RetentionBasis = NonNullable<CaseListQuery["retention_basis"]>;
type RetentionReview = NonNullable<CaseListQuery["retention_review"]>;

const RETENTION_BASIS_LABELS: Record<RetentionBasis, string> = {
  organization_policy: "Política del despacho",
  legal_or_contractual_duty: "Deber legal o contractual",
  litigation_hold: "Bloqueo por litigio",
};

const RETENTION_BASES = Object.keys(RETENTION_BASIS_LABELS) as RetentionBasis[];
const ARCHIVE_PARAMS = [
  CLOSED_FROM_PARAM,
  CLOSED_TO_PARAM,
  RETENTION_BASIS_PARAM,
  LEGAL_HOLD_PARAM,
  RETENTION_REVIEW_PARAM,
] as const;

function retentionBasisFromUrl(value: string | null) {
  return RETENTION_BASES.find((basis) => basis === value);
}

function retentionReviewFromUrl(
  value: string | null,
): RetentionReview | undefined {
  return value === "due" || value === "upcoming" ? value : undefined;
}

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
  closed: "Archivo histórico de casos",
  all: "Todos los casos",
};

const NONE_IN_SEGMENT: Record<Status, string> = {
  open: "No tiene casos abiertos.",
  closed: "No tiene casos en el archivo histórico.",
  all: "No tiene casos.",
};

/** Texto exacto para quien no abre casos (especificación, 5.2). */
const ASSISTANT_EMPTY =
  "Los casos los abre un abogado o la persona responsable del despacho. Cuando lo asignen a uno, aparecerá aquí";

// En 1100 px o menos la tabla pasa a tarjetas apiladas: con el menú lateral de 240 px, antes de ahí
// la columna del título no llega a 240 px de texto (especificación, 5.2).
const CARDS_QUERY = "(max-width: 1100px)";

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
  const filter = searchParams.get(SEARCH_PARAM) ?? "";
  const normalizedFilter = filter.trim();
  const closedFrom = searchParams.get(CLOSED_FROM_PARAM) ?? "";
  const closedTo = searchParams.get(CLOSED_TO_PARAM) ?? "";
  const retentionBasis = retentionBasisFromUrl(
    searchParams.get(RETENTION_BASIS_PARAM),
  );
  const legalHoldValue = searchParams.get(LEGAL_HOLD_PARAM);
  const legalHold =
    legalHoldValue === "si"
      ? true
      : legalHoldValue === "no"
        ? false
        : undefined;
  const retentionReview = retentionReviewFromUrl(
    searchParams.get(RETENTION_REVIEW_PARAM),
  );
  const [serverSearch, setServerSearch] = useState(normalizedFilter);
  const [loadedNote, setLoadedNote] = useState("");
  const [verifying, setVerifying] = useState(false);
  const cards = useMediaQuery(CARDS_QUERY);
  const bookRef = useRef<HTMLDivElement>(null);
  // Casos recién cargados que deben recibir el foco cuando el botón desaparece.
  const pendingFocus = useRef<string[] | null>(null);
  const filterId = useId();
  const archiveQuery: CaseListQuery =
    status === "closed"
      ? {
          closed_from: closedFrom || undefined,
          closed_to: closedTo || undefined,
          retention_basis: retentionBasis,
          legal_hold: legalHold,
          retention_review: retentionReview,
        }
      : {};
  const listQuery: CaseListQuery = {
    status,
    search: serverSearch || undefined,
    ...archiveQuery,
  };

  // La dirección cambia de inmediato, pero la consulta espera una pausa breve: escribir una
  // palabra no debe disparar una solicitud por cada tecla.
  useEffect(() => {
    const timer = window.setTimeout(
      () => setServerSearch(normalizedFilter),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [normalizedFilter]);

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
      {
        ...listCasesQueryKey({
          query: listQuery,
        })[0],
        _infinite: true,
      },
    ],
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await listCases({
        query: pageParam ? { ...listQuery, cursor: pageParam } : listQuery,
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

  const mayOpen = canOpenCases(me.organization);
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
      <title>{pageTitle("Casos")}</title>
      <meta name="robots" content="noindex" />
    </>
  );
  const header = (actions?: ReactNode) => (
    <PageHeader
      title="Casos"
      description="Los casos en los que usted es miembro."
      actions={actions}
    />
  );
  const dialog = (
    <VerifyEmailDialog
      email={me.email}
      open={verifying}
      onClose={() => setVerifying(false)}
    />
  );

  if (book.isPending) {
    return (
      <div className={styles.screen}>
        {head}
        {header()}
        <p className={styles.loading} role="status">
          <CargandoIcon
            className={styles.spinner}
            size={16}
            aria-hidden="true"
          />
          Cargando sus casos
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
              ? "Todavía no tiene casos"
              : "Todavía no tiene casos asignados"
          }
          description={
            mayOpen
              ? "Al abrir un caso empieza su cadena de custodia. Desde ahí, cada acción de su equipo sobre él queda registrada."
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
  const loadingSegment =
    book.isPlaceholderData || normalizedFilter !== serverSearch;
  const visible = loaded;
  const archiveFiltering =
    status === "closed" &&
    Boolean(
      closedFrom ||
      closedTo ||
      retentionBasis ||
      legalHold !== undefined ||
      retentionReview,
    );
  const filtering = normalizedFilter.length > 0 || archiveFiltering;
  const caption = CAPTIONS[status];

  function setArchiveFilter(name: string, value: string) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(name, value);
        else next.delete(name);
        return next;
      },
      { replace: true },
    );
    setLoadedNote("");
  }

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
      {header(mayOpen ? openCase("Abrir un caso") : undefined)}

      <CustodyStrip totals={totals} />

      {status === "closed" && (
        <p className={styles.archiveNote}>
          Los casos cerrados permanecen cifrados y consultables con su cadena de
          custodia. Cerrarlos no elimina archivos ni eventos.
        </p>
      )}

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
                      if (segment.value !== "closed") {
                        ARCHIVE_PARAMS.forEach((parameter) =>
                          next.delete(parameter),
                        );
                      }
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
            size={16}
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
              const value = event.target.value;
              setSearchParams(
                (current) => {
                  const next = new URLSearchParams(current);
                  if (value) next.set(SEARCH_PARAM, value);
                  else next.delete(SEARCH_PARAM);
                  return next;
                },
                { replace: true },
              );
              // Al escribir solo cambia el número de coincidencias: la carga ya se anunció.
              setLoadedNote("");
            }}
          />
        </div>

        <p className={styles.order}>
          Ordenados por <b>última actividad</b>
        </p>
      </div>

      {status === "closed" && (
        <fieldset className={styles.archiveFilters}>
          <legend>Filtrar archivo histórico</legend>
          <label>
            <span>Cierre desde</span>
            <input
              type="date"
              value={closedFrom}
              max={closedTo || undefined}
              onChange={(event) =>
                setArchiveFilter(CLOSED_FROM_PARAM, event.target.value)
              }
            />
          </label>
          <label>
            <span>Cierre hasta</span>
            <input
              type="date"
              value={closedTo}
              min={closedFrom || undefined}
              onChange={(event) =>
                setArchiveFilter(CLOSED_TO_PARAM, event.target.value)
              }
            />
          </label>
          <label>
            <span>Fundamento</span>
            <select
              value={retentionBasis ?? ""}
              onChange={(event) =>
                setArchiveFilter(RETENTION_BASIS_PARAM, event.target.value)
              }
            >
              <option value="">Todos</option>
              {RETENTION_BASES.map((basis) => (
                <option key={basis} value={basis}>
                  {RETENTION_BASIS_LABELS[basis]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Bloqueo jurídico</span>
            <select
              value={legalHoldValue ?? ""}
              onChange={(event) =>
                setArchiveFilter(LEGAL_HOLD_PARAM, event.target.value)
              }
            >
              <option value="">Todos</option>
              <option value="si">Con bloqueo</option>
              <option value="no">Sin bloqueo</option>
            </select>
          </label>
          <label>
            <span>Revisión de conservación</span>
            <select
              value={retentionReview ?? ""}
              onChange={(event) =>
                setArchiveFilter(RETENTION_REVIEW_PARAM, event.target.value)
              }
            >
              <option value="">Todas</option>
              <option value="upcoming">Conservación vigente</option>
              <option value="due">Requiere revisión</option>
            </select>
          </label>
          <Button
            variant="secondary"
            size="sm"
            disabled={!archiveFiltering}
            onClick={() => {
              setSearchParams(
                (current) => {
                  const next = new URLSearchParams(current);
                  ARCHIVE_PARAMS.forEach((parameter) => next.delete(parameter));
                  return next;
                },
                { replace: true },
              );
              setLoadedNote("");
            }}
          >
            Limpiar filtros
          </Button>
        </fieldset>
      )}

      <div
        ref={bookRef}
        className={styles.book}
        aria-busy={loadingSegment || undefined}
      >
        {loadingSegment ? (
          <p className={styles.loading} role="status">
            <CargandoIcon
              className={styles.spinner}
              size={16}
              aria-hidden="true"
            />
            Cargando sus casos
          </p>
        ) : filtering && loaded.length === 0 ? (
          <p className={styles.none} tabIndex={-1} data-book-focus="">
            {normalizedFilter
              ? `Ningún caso coincide con «${normalizedFilter}».`
              : "Ningún caso del archivo coincide con estos filtros."}
          </p>
        ) : loaded.length === 0 ? (
          <p className={styles.none}>{NONE_IN_SEGMENT[status]}</p>
        ) : cards ? (
          <CaseCards
            items={visible}
            caption={caption}
            showRetention={status === "closed"}
          />
        ) : (
          <CaseTable
            items={visible}
            caption={caption}
            showRetention={status === "closed"}
          />
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
        </div>
      )}

      {dialog}
    </div>
  );
}

/** Lo que hace un caso desde que se abre y lo que hará con la evidencia (maqueta 04). Solo se
 * dice en presente lo que ya ocurre: la evidencia todavía no se puede subir. La lista numerada
 * ya dice el orden; no hacen falta cifras dibujadas. */
function Principles() {
  return (
    <ol className={styles.principles}>
      <li>
        <p className={styles.principleTitle}>Una llave por caso</p>
        <p className={styles.principleText}>
          Cada caso recibe su propia llave de cifrado al abrirse.
        </p>
      </li>
      <li>
        <p className={styles.principleTitle}>El original, intacto</p>
        <p className={styles.principleText}>
          La evidencia que suba se guardará tal como llegó, cifrada con la llave
          del caso. No se convertirá ni se comprimirá.
        </p>
      </li>
      <li>
        <p className={styles.principleTitle}>Un historial que no se edita</p>
        <p className={styles.principleText}>
          Cada acción sobre el caso queda en su cadena de custodia. Cada evento
          lleva la huella del anterior. Si alguien alterara uno, la cadena
          dejaría de cuadrar.
        </p>
      </li>
    </ol>
  );
}

type ListProps = {
  items: CaseSummaryOut[];
  caption: string;
  showRetention: boolean;
};

// Escritorio: una tabla real. Toda la fila lleva al caso, pero el único enlace es el título.
function CaseTable({ items, caption, showRetention }: ListProps) {
  return (
    <table
      className={`${styles.table} ${showRetention ? styles.retentionTable : ""}`}
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
          <th scope="col">{showRetention ? "Conservación" : "Integridad"}</th>
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
              <span
                className={
                  showRetention ? styles.retentionCell : styles.integrity
                }
              >
                {showRetention ? (
                  <RetentionCell item={item} />
                ) : (
                  <StatusBadge tone="muted">Sin verificar</StatusBadge>
                )}
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

// 1100 px o menos: tarjetas apiladas con los mismos datos, cada una con su título como encabezado
// y los demás datos como una lista de definiciones.
function CaseCards({ items, caption, showRetention }: ListProps) {
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
          <CaseCard item={item} showRetention={showRetention} />
        </li>
      ))}
    </ul>
  );
}

function CaseCard({
  item,
  showRetention,
}: {
  item: CaseSummaryOut;
  showRetention: boolean;
}) {
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
          <dt>{showRetention ? "Conservación" : "Integridad"}</dt>
          <dd>
            {showRetention ? (
              <RetentionCell item={item} />
            ) : (
              <StatusBadge tone="muted">Sin verificar</StatusBadge>
            )}
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
                {", referencia interna "}
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
  const parts = describeEvidenceByType(item.evidence_by_type).split(", ");
  return (
    <span className={styles.evidence}>
      <span className={styles.evidenceCount}>{item.evidence_count}</span>
      <span className={styles.evidenceTypes}>
        {item.evidence_count === 0
          ? "Sin evidencias"
          : // La coma y el espacio quedan fuera del tramo que no se parte: ahí puede
            // saltar la línea, y «9 chats» sigue entero.
            parts.map((part, index) => (
              <Fragment key={part}>
                {index > 0 && ", "}
                <span>{part}</span>
              </Fragment>
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
            {/* Qué pasó en un renglón; quién y cuándo, en el siguiente. */}
            <span className={styles.whenAction}>
              {custodyActionLabel(event.action)}
            </span>
            {`${event.actor_name ?? "Sistema"}, `}
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

const ARCHIVE_DATE = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeZone: "America/Bogota",
});

function archiveDate(value: string | null | undefined): string {
  return value ? ARCHIVE_DATE.format(new Date(value)) : "Sin fecha registrada";
}

function RetentionCell({ item }: { item: CaseSummaryOut }) {
  const [reviewAt] = useState(() => Date.now());
  const reviewDue =
    Boolean(item.retention_until) &&
    new Date(item.retention_until!).getTime() <= reviewAt;
  return (
    <span className={styles.retention}>
      <StatusBadge
        tone={item.legal_hold ? "closed" : reviewDue ? "pending" : "muted"}
      >
        {item.legal_hold
          ? "Bloqueo jurídico"
          : reviewDue
            ? "Requiere revisión"
            : "Conservación vigente"}
      </StatusBadge>
      <span>
        Cerrado el{" "}
        <time dateTime={item.closed_at ?? undefined}>
          {archiveDate(item.closed_at)}
        </time>
      </span>
      <span>
        Revisar desde{" "}
        <time dateTime={item.retention_until ?? undefined}>
          {archiveDate(item.retention_until)}
        </time>
      </span>
      <span>
        {item.retention_basis
          ? RETENTION_BASIS_LABELS[item.retention_basis]
          : "Fundamento no registrado"}
      </span>
    </span>
  );
}
