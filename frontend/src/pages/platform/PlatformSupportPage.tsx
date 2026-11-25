import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useOutletContext } from "react-router";

import type { Me, SupportTicketOut } from "../../api/generated";
import {
  changeSupportTicketStatusMutation,
  deleteSupportTicketMutation,
  platformSupportTicketsOptions,
} from "../../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../../components/ui/Button.tsx";
import { Notice } from "../../components/ui/Notice.tsx";
import { PageHeader } from "../../components/ui/PageHeader.tsx";
import { SegmentedControl } from "../../components/ui/SegmentedControl.tsx";
import { StatusBadge } from "../../components/ui/StatusBadge.tsx";
import { pageTitle } from "../../config/site.ts";
import {
  dueState,
  TICKET_CATEGORY_LABELS,
} from "../../features/support/categories.ts";
import styles from "./Platform.module.css";
import { formatDay } from "./labels.ts";
import { useCursorPager } from "./pager.ts";
import { DateText, Pager, Restricted } from "./shared.tsx";

type View = "open" | "closed";

// Bandeja de solicitudes: soporte, consultas y reclamos sobre datos personales, quejas de
// consumidor y reembolsos. Cada una con su radicado y la fecha límite que fija la ley; las
// abiertas se ordenan por la fecha que vence primero.
export function PlatformSupportPage() {
  const me = useOutletContext<Me>();
  const [view, setView] = useState<View>("open");
  const pager = useCursorPager();
  const [error, setError] = useState(false);
  const queryClient = useQueryClient();
  const tickets = useQuery({
    ...platformSupportTicketsOptions({
      query: {
        status: view,
        ...(pager.cursor ? { cursor: pager.cursor } : {}),
      },
    }),
    enabled: me.platform_admin,
  });
  const change = useMutation({
    ...changeSupportTicketStatusMutation(),
    onSuccess: async () => {
      setError(false);
      await queryClient.invalidateQueries();
    },
    onError: () => setError(true),
  });
  const remove = useMutation({
    ...deleteSupportTicketMutation(),
    onSuccess: async () => {
      setError(false);
      await queryClient.invalidateQueries();
    },
    onError: () => setError(true),
  });
  const [today] = useState(() =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(
      new Date(),
    ),
  );
  function erase(ticket: SupportTicketOut) {
    if (
      window.confirm(
        `¿Eliminar la solicitud ${ticket.filing_number}? No se puede recuperar; la auditoría conserva solo su radicado.`,
      )
    )
      remove.mutate({ path: { ticket_id: ticket.id } });
  }
  const update = (ticket: SupportTicketOut) =>
    change.mutate({
      path: { ticket_id: ticket.id },
      body: { status: ticket.status === "open" ? "closed" : "open" },
    });
  const items = [...(tickets.data?.items ?? [])].sort((a, b) =>
    view === "open" ? a.due_on.localeCompare(b.due_on) : 0,
  );
  return (
    <div className={styles.screen}>
      <title>{pageTitle("Solicitudes y PQR")}</title>
      <meta name="robots" content="noindex" />
      <PageHeader
        title="Solicitudes y PQR"
        description="Lo que piden las cuentas de ALETHEIA, con su radicado y la fecha límite para responder. Los plazos se cuentan en días hábiles de Colombia."
      />
      {!me.platform_admin ? (
        <Restricted />
      ) : (
        <>
          <SegmentedControl
            label="Mostrar solicitudes"
            value={view}
            onChange={(next) => {
              pager.reset();
              setView(next);
            }}
            options={[
              { value: "open", label: "Abiertas" },
              { value: "closed", label: "Resueltas" },
            ]}
          />
          {tickets.isPending && <p role="status">Cargando las solicitudes</p>}
          {tickets.isError && (
            <Notice tone="error">No pudimos cargar las solicitudes.</Notice>
          )}
          {error && (
            <Notice tone="error">
              No pudimos actualizar la solicitud. Inténtelo de nuevo.
            </Notice>
          )}
          {tickets.data && items.length === 0 && (
            <p className={styles.empty}>
              {view === "open"
                ? "No hay solicitudes abiertas. Todo está al día."
                : "Todavía no hay solicitudes resueltas."}
            </p>
          )}
          <ul className={styles.tickets}>
            {items.map((ticket) => {
              const due = dueState(ticket.due_on);
              return (
                <li key={ticket.id}>
                  <article className={styles.ticket}>
                    <div className={styles.ticketHead}>
                      <div>
                        <p className={styles.filing}>{ticket.filing_number}</p>
                        <h2>{ticket.subject}</h2>
                      </div>
                      <div className={styles.ticketBadges}>
                        <StatusBadge tone="muted">
                          {TICKET_CATEGORY_LABELS[ticket.category]}
                        </StatusBadge>
                        {ticket.status === "open" ? (
                          <StatusBadge
                            tone={
                              due === "overdue"
                                ? "error"
                                : due === "soon"
                                  ? "pending"
                                  : "muted"
                            }
                          >
                            {due === "overdue"
                              ? `Venció el ${formatDay(ticket.due_on)}`
                              : `Responder antes del ${formatDay(ticket.due_on)}`}
                          </StatusBadge>
                        ) : (
                          <StatusBadge tone="ok">Resuelta</StatusBadge>
                        )}
                      </div>
                    </div>
                    <p className={styles.note}>
                      {ticket.user_email}, recibida el{" "}
                      <DateText value={ticket.created_at} />
                    </p>
                    <p className={styles.message}>{ticket.message}</p>
                    <div className={styles.ticketActions}>
                      {ticket.user_email && (
                        <a
                          className={styles.replyLink}
                          href={`mailto:${ticket.user_email}?subject=${encodeURIComponent(`${ticket.filing_number}: ${ticket.subject}`)}`}
                        >
                          Responder por correo
                        </a>
                      )}
                      {ticket.status === "closed" &&
                        ticket.deletable_on &&
                        (ticket.deletable_on <= today ? (
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={remove.isPending}
                            onClick={() => erase(ticket)}
                          >
                            Eliminar
                          </Button>
                        ) : (
                          <span className={styles.note}>
                            Se conserva hasta el{" "}
                            {formatDay(ticket.deletable_on)}
                          </span>
                        ))}
                      <Button
                        size="sm"
                        variant={
                          ticket.status === "open" ? "primary" : "secondary"
                        }
                        disabled={change.isPending}
                        onClick={() => update(ticket)}
                      >
                        {ticket.status === "open"
                          ? "Marcar como resuelta"
                          : "Reabrir"}
                      </Button>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
          <Pager pager={pager} next={tickets.data?.next_cursor} />
        </>
      )}
    </div>
  );
}
