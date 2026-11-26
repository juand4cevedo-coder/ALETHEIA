import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { verifyCustody } from "../../api/generated/sdk.gen.ts";
import { listCustodyEventsInfiniteOptions } from "../../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../../components/ui/Button.tsx";
import { Hash } from "../../components/ui/Hash.tsx";
import { Notice } from "../../components/ui/Notice.tsx";
import { CustodyTimeline, CustodyVerification } from "./CustodyTimeline.tsx";
import { formatColombiaTime } from "./dates.ts";
import styles from "./CustodySection.module.css";

type Group =
  | "all"
  | "evidence"
  | "stamp"
  | "team"
  | "lifecycle"
  | "package"
  | "verification";

const GROUPS: { key: Group; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "evidence", label: "Evidencia" },
  { key: "stamp", label: "Sello de tiempo" },
  { key: "team", label: "Equipo" },
  { key: "lifecycle", label: "Cierre y conservación" },
  { key: "package", label: "Paquetes" },
  { key: "verification", label: "Verificación" },
];

const ACTION_GROUP: Record<string, Group> = {
  evidence_uploaded: "evidence",
  evidence_downloaded: "evidence",
  evidence_link_created: "evidence",
  evidence_link_revoked: "evidence",
  evidence_link_downloaded: "evidence",
  evidence_stamped: "stamp",
  evidence_stamp_failed: "stamp",
  case_created: "team",
  member_added: "team",
  member_removed: "team",
  case_closed: "lifecycle",
  case_reopened: "lifecycle",
  case_retention_updated: "lifecycle",
  deletion_requested: "lifecycle",
  export_requested: "package",
  export_ready: "package",
  export_downloaded: "package",
  chain_verified: "verification",
};

function groupOf(action: string): Group {
  return ACTION_GROUP[action] ?? "all";
}

export function CustodySection({
  caseId,
  justOpened,
}: {
  caseId: string;
  justOpened: boolean;
}) {
  const [group, setGroup] = useState<Group>("all");
  const listing = useInfiniteQuery({
    ...listCustodyEventsInfiniteOptions({ path: { case_id: caseId } }),
    initialPageParam: { path: { case_id: caseId }, query: { limit: 20 } },
    getNextPageParam: (lastPage) => lastPage.next_cursor,
  });
  const events = listing.data?.pages.flatMap((page) => page.items) ?? [];
  const verification = useMutation({
    mutationFn: async () => {
      const { data } = await verifyCustody({
        path: { case_id: caseId },
        throwOnError: true,
      });
      return data;
    },
  });

  const head = events[0];
  const counts = new Map<Group, number>();
  for (const event of events) {
    const key = groupOf(event.action);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const shown =
    group === "all"
      ? events
      : events.filter((event) => groupOf(event.action) === group);

  return (
    <div className={styles.stack}>
      {listing.isPending && (
        // Lugar reservado para la cadena: los datos procesales de abajo no saltan al llegar.
        <p role="status" className={styles.reserva}>
          Cargando cadena de custodia
        </p>
      )}
      {listing.isError && (
        <Notice tone="error">
          <p>No pudimos consultar la cadena de custodia.</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void listing.refetch()}
          >
            Intentar de nuevo
          </Button>
        </Notice>
      )}

      {head && (
        <section className={styles.summary} aria-label="Resumen de la cadena">
          <dl className={styles.stats}>
            <div>
              <dt>Eventos</dt>
              <dd>{head.seq}</dd>
            </div>
            <div>
              <dt>Último evento</dt>
              <dd>
                <time dateTime={head.occurred_at}>
                  {formatColombiaTime(head.occurred_at, { seconds: true })}
                </time>
              </dd>
            </div>
            <div className={styles.headHash}>
              <dt>Huella de la cabeza de la cadena</dt>
              <dd translate="no">
                <Hash value={head.event_hash} variant="full" />
              </dd>
            </div>
          </dl>
          <div className={styles.verify}>
            <CustodyVerification verification={verification.data ?? null} />
            <Button
              disabled={verification.isPending}
              onClick={() => verification.mutate()}
            >
              {verification.isPending
                ? "Verificando cadena"
                : "Verificar cadena"}
            </Button>
          </div>
          {verification.isError && (
            <Notice tone="error">
              <p>No pudimos verificar la cadena. Inténtelo de nuevo.</p>
            </Notice>
          )}
        </section>
      )}

      {events.length > 0 && (
        <div
          className={styles.filters}
          role="group"
          aria-label="Mostrar eventos de"
        >
          {GROUPS.filter(
            ({ key }) => key === "all" || (counts.get(key) ?? 0) > 0,
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={styles.chip}
              aria-pressed={group === key}
              onClick={() => setGroup(key)}
            >
              {label}
              <span className={styles.count}>
                {key === "all" ? events.length : counts.get(key)}
              </span>
            </button>
          ))}
        </div>
      )}

      {events.length > 0 && (
        <CustodyTimeline
          events={shown}
          justOpened={justOpened}
          caseId={caseId}
          showNext={group === "all"}
        />
      )}
      {events.length > 0 && shown.length === 0 && (
        <p className={styles.empty}>
          No hay eventos de este tipo entre los cargados. Si hay más anteriores,
          cárguelos para buscar ahí.
        </p>
      )}
      {listing.hasNextPage && (
        <div>
          <Button
            variant="secondary"
            size="sm"
            disabled={listing.isFetchingNextPage}
            onClick={() => void listing.fetchNextPage()}
          >
            {listing.isFetchingNextPage
              ? "Cargando más"
              : "Ver eventos anteriores"}
          </Button>
        </div>
      )}
    </div>
  );
}
