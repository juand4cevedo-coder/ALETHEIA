import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import { Link, useSearchParams } from "react-router";

import type { ArchiveSummaryData, ListCasesData } from "../api/generated";
import {
  archiveSummaryOptions,
  listCasesQueryKey,
} from "../api/generated/@tanstack/react-query.gen.ts";
import { listCases } from "../api/generated/sdk.gen.ts";
import { Button } from "../components/ui/Button.tsx";
import { EmptyState } from "../components/ui/EmptyState.tsx";
import { FilingNumber } from "../components/ui/FilingNumber.tsx";
import { Notice } from "../components/ui/Notice.tsx";
import { PageHeader } from "../components/ui/PageHeader.tsx";
import { StatusBadge } from "../components/ui/StatusBadge.tsx";
import { SystemError } from "../components/ui/SystemError.tsx";
import { BuscarIcon } from "../components/ui/icons.tsx";
import { ROUTES } from "../config/routes.ts";
import { pageTitle } from "../config/site.ts";
import { apiProblem } from "../features/auth/apiProblem.ts";
import { formatBytes } from "../features/billing/format.ts";
import { formatColombiaDate } from "../features/cases/dates.ts";
import {
  PRACTICE_AREA_LABELS,
  type PracticeArea,
} from "../features/cases/practiceAreas.ts";
import styles from "./ArchivePage.module.css";

type Basis =
  "organization_policy" | "legal_or_contractual_duty" | "litigation_hold";
type Review = "due" | "upcoming";
type Query = NonNullable<ArchiveSummaryData["query"]>;

const BASIS_LABELS: Record<Basis, string> = {
  organization_policy: "Política del despacho",
  legal_or_contractual_duty: "Deber legal o contractual",
  litigation_hold: "Bloqueo por litigio",
};
const REVIEW_LABELS: Record<Review, string> = {
  due: "Plazo vencido, para revisión",
  upcoming: "Plazo vigente",
};
const AREAS = Object.keys(PRACTICE_AREA_LABELS) as PracticeArea[];
const BASES = Object.keys(BASIS_LABELS) as Basis[];

function pick<T extends string>(
  value: string | null,
  allowed: readonly T[],
): T | undefined {
  return allowed.find((option) => option === value);
}

// Banco de datos: el archivo de casos cerrados donde la persona es miembro. Es una vista de
// lectura: encontrar un caso, ver cuánto se conserva y hasta cuándo, y llevarse el índice. El
// contenido de cada caso se abre desde el caso, con su cadena de custodia.
export function ArchivePage() {
  const [params, setParams] = useSearchParams();
  const searchId = useId();
  const [now] = useState(() => Date.now());
  const typed = params.get("q") ?? "";
  const [search, setSearch] = useState(typed.trim());
  const year = /^\d{4}$/.test(params.get("anio") ?? "")
    ? (params.get("anio") as string)
    : undefined;
  const area = pick(params.get("area"), AREAS);
  const basis = pick(params.get("base"), BASES);
  const review = pick<Review>(params.get("plazo"), ["due", "upcoming"]);
  const hold = params.get("bloqueo") === "si" ? true : undefined;

  // La consulta espera una pausa breve: escribir una palabra no dispara una solicitud por tecla.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(typed.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [typed]);

  const filters: Query = {
    search: search || undefined,
    closed_from: year ? `${year}-01-01` : undefined,
    closed_to: year ? `${year}-12-31` : undefined,
    practice_area: area,
    retention_basis: basis,
    retention_review: review,
    legal_hold: hold,
  };
  const filtering = Object.values(filters).some((value) => value !== undefined);

  const summary = useQuery({
    ...archiveSummaryOptions({ query: filters }),
    placeholderData: keepPreviousData,
  });
  // Los años del selector salen del archivo completo, no del filtro puesto.
  const everything = useQuery({ ...archiveSummaryOptions({ query: {} }) });

  const listQuery: NonNullable<ListCasesData["query"]> = {
    status: "closed",
    ...filters,
  };
  const results = useInfiniteQuery({
    queryKey: [
      { ...listCasesQueryKey({ query: listQuery })[0], _archive: true },
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
    placeholderData: keepPreviousData,
  });
  const items = results.data?.pages.flatMap((page) => page.items) ?? [];

  function setParam(name: string, value: string | undefined) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(name, value);
        else next.delete(name);
        return next;
      },
      { replace: true },
    );
  }

  const exportQuery = new URLSearchParams(
    Object.entries(filters)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  ).toString();
  const total = summary.data?.cases;

  return (
    <div className={styles.screen}>
      <title>{pageTitle("Banco de datos")}</title>
      <PageHeader
        title="Banco de datos"
        description="El archivo de sus casos cerrados: busque por título, radicado, nombre de un archivo o huella SHA-256, vea cuánto se conserva y hasta cuándo, y descargue el índice."
        actions={
          <a
            className={styles.export}
            href={`/api/v1/archive/export${exportQuery ? `?${exportQuery}` : ""}`}
            download
          >
            Descargar el índice (CSV)
          </a>
        }
      />

      {summary.isError ? (
        <Notice tone="error">
          {summary.error && apiProblem(summary.error).status === 403 ? (
            <p>Su cuenta no consulta casos.</p>
          ) : (
            <SystemError requestId={apiProblem(summary.error).requestId} />
          )}
        </Notice>
      ) : (
        <section aria-label="Cifras del archivo" className={styles.figures}>
          <Figure label="Casos archivados" value={summary.data?.cases} />
          <Figure
            label="Evidencias conservadas"
            value={summary.data?.evidences}
          />
          <Figure
            label="Tamaño conservado"
            text={
              summary.data ? formatBytes(summary.data.stored_bytes) : undefined
            }
          />
          <Figure
            label="Plazo vencido"
            value={summary.data?.review_due}
            hint="Casos listos para revisar su conservación"
            onSelect={() =>
              setParam("plazo", review === "due" ? undefined : "due")
            }
            active={review === "due"}
          />
          <Figure
            label="Con bloqueo por litigio"
            value={summary.data?.legal_hold}
            onSelect={() => setParam("bloqueo", hold ? undefined : "si")}
            active={hold === true}
          />
        </section>
      )}

      <form
        className={styles.tools}
        role="search"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className={styles.search}>
          <label htmlFor={searchId} className="visually-hidden">
            Buscar en el archivo
          </label>
          <BuscarIcon
            size={16}
            aria-hidden="true"
            className={styles.searchIcon}
          />
          <input
            id={searchId}
            type="search"
            value={typed}
            placeholder="Título, radicado, archivo o huella SHA-256"
            onChange={(event) => setParam("q", event.target.value || undefined)}
          />
        </div>
        <label className={styles.select}>
          <span>Año de cierre</span>
          <select
            value={year ?? ""}
            onChange={(event) => setParam("anio", event.target.value)}
          >
            <option value="">Todos</option>
            {(everything.data?.by_year ?? []).map((entry) => (
              <option key={entry.year} value={String(entry.year)}>
                {entry.year} ({entry.cases})
              </option>
            ))}
          </select>
        </label>
        <label className={styles.select}>
          <span>Especialidad</span>
          <select
            value={area ?? ""}
            onChange={(event) => setParam("area", event.target.value)}
          >
            <option value="">Todas</option>
            {AREAS.map((option) => (
              <option key={option} value={option}>
                {PRACTICE_AREA_LABELS[option]}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.select}>
          <span>Base de conservación</span>
          <select
            value={basis ?? ""}
            onChange={(event) => setParam("base", event.target.value)}
          >
            <option value="">Todas</option>
            {BASES.map((option) => (
              <option key={option} value={option}>
                {BASIS_LABELS[option]}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.select}>
          <span>Plazo de conservación</span>
          <select
            value={review ?? ""}
            onChange={(event) => setParam("plazo", event.target.value)}
          >
            <option value="">Todos</option>
            {(Object.keys(REVIEW_LABELS) as Review[]).map((option) => (
              <option key={option} value={option}>
                {REVIEW_LABELS[option]}
              </option>
            ))}
          </select>
        </label>
        {filtering && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setParams({}, { replace: true });
              setSearch("");
            }}
          >
            Quitar los filtros
          </Button>
        )}
      </form>

      <p className={styles.count} role="status">
        {results.isPending
          ? "Buscando en el archivo"
          : total === undefined
            ? ""
            : total === 1
              ? "1 caso archivado coincide"
              : `${total} casos archivados coinciden`}
      </p>

      {results.isError ? (
        <Notice tone="error">
          <SystemError requestId={apiProblem(results.error).requestId} />
        </Notice>
      ) : results.isSuccess && items.length === 0 ? (
        <EmptyState
          title={
            filtering
              ? "Ningún caso del archivo coincide"
              : "Todavía no tiene casos archivados"
          }
          description={
            filtering
              ? "Pruebe con otras palabras o quite algún filtro."
              : "Cuando cierre un caso, aparece aquí con su cadena de custodia y su plazo de conservación."
          }
        />
      ) : (
        <ul className={styles.list} aria-label="Casos archivados">
          {items.map((item) => (
            <li key={item.id} className={styles.row}>
              <div className={styles.main}>
                <Link
                  className={styles.title}
                  to={ROUTES.caseDetail(item.id)}
                  translate="no"
                >
                  {item.title}
                </Link>
                <p className={styles.meta}>
                  {item.filing_number && (
                    <FilingNumber digits={item.filing_number} />
                  )}
                  {item.court && <span>{item.court}</span>}
                  {item.practice_area && (
                    <span>{PRACTICE_AREA_LABELS[item.practice_area]}</span>
                  )}
                  <span>
                    {Object.values(item.evidence_by_type).reduce(
                      (sum, count) => sum + count,
                      0,
                    )}{" "}
                    evidencias
                  </span>
                </p>
              </div>
              <div className={styles.keep}>
                {item.closed_at && (
                  <span>
                    Cerrado el{" "}
                    <time dateTime={item.closed_at}>
                      {formatColombiaDate(item.closed_at)}
                    </time>
                  </span>
                )}
                {item.legal_hold ? (
                  <StatusBadge tone="error">Bloqueo por litigio</StatusBadge>
                ) : item.retention_until ? (
                  <StatusBadge
                    tone={
                      new Date(item.retention_until).getTime() <= now
                        ? "pending"
                        : "ok"
                    }
                  >
                    {new Date(item.retention_until).getTime() <= now
                      ? "Plazo vencido, para revisión"
                      : `Se conserva hasta ${new Intl.DateTimeFormat("es-CO", {
                          timeZone: "America/Bogota",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }).format(new Date(item.retention_until))}`}
                  </StatusBadge>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {results.hasNextPage && (
        <div>
          <Button
            variant="secondary"
            busy={results.isFetchingNextPage}
            onClick={() => void results.fetchNextPage()}
          >
            Cargar más casos
          </Button>
        </div>
      )}
    </div>
  );
}

function Figure({
  label,
  value,
  text,
  hint,
  onSelect,
  active,
}: {
  label: string;
  value?: number;
  text?: string;
  hint?: string;
  onSelect?: () => void;
  active?: boolean;
}) {
  const shown = text ?? (value === undefined ? " " : String(value));
  const body = (
    <>
      <span className={styles.figureValue}>{shown}</span>
      <span className={styles.figureLabel}>{label}</span>
      {hint && <span className={styles.figureHint}>{hint}</span>}
    </>
  );
  return onSelect ? (
    <button
      type="button"
      className={styles.figure}
      data-active={active || undefined}
      aria-pressed={active}
      onClick={onSelect}
    >
      {body}
    </button>
  ) : (
    <div className={styles.figure}>{body}</div>
  );
}
