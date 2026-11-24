import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Link, Navigate, useOutletContext } from "react-router";

import type { Me, SupportTicketOut } from "../api/generated";
import {
  createSupportTicketMutation,
  ownSupportTicketsOptions,
} from "../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../components/ui/Button.tsx";
import { ChoiceCards } from "../components/ui/ChoiceCards.tsx";
import { Field } from "../components/ui/Field.tsx";
import { Notice } from "../components/ui/Notice.tsx";
import { PageHeader } from "../components/ui/PageHeader.tsx";
import { Panel } from "../components/ui/Panel.tsx";
import { StatusBadge } from "../components/ui/StatusBadge.tsx";
import { legalRoute, ROUTES } from "../config/routes.ts";
import { pageTitle } from "../config/site.ts";
import {
  formatColombiaDate,
  formatColombiaTime,
} from "../features/cases/dates.ts";
import {
  TICKET_CATEGORIES,
  TICKET_CATEGORY_LABELS,
  type TicketCategory,
} from "../features/support/categories.ts";
import { formatDay } from "./platform/labels.ts";
import { useCursorPager } from "./platform/pager.ts";
import { Pager } from "./platform/shared.tsx";
import styles from "./SupportPage.module.css";

export function SupportPage() {
  const me = useOutletContext<Me>();
  if (me.platform_admin)
    return <Navigate to={ROUTES.platformSupport} replace />;
  return <CustomerSupportPage />;
}

// Soporte y PQR: una sola puerta para pedir ayuda, consultar o reclamar sobre sus datos
// personales, presentar una queja o pedir un reembolso. Cada solicitud recibe al instante su
// radicado y la fecha límite de respuesta que fija la ley.
function CustomerSupportPage() {
  const [category, setCategory] = useState<TicketCategory>("support");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [created, setCreated] = useState<SupportTicketOut | null>(null);
  const pager = useCursorPager();
  const queryClient = useQueryClient();
  const tickets = useQuery(
    ownSupportTicketsOptions({
      query: pager.cursor ? { cursor: pager.cursor } : {},
    }),
  );
  const create = useMutation({
    ...createSupportTicketMutation(),
    onSuccess: async (ticket) => {
      setSubject("");
      setMessage("");
      setCreated(ticket);
      pager.reset();
      await queryClient.invalidateQueries();
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setCreated(null);
    create.mutate({
      body: { category, subject: subject.trim(), message: message.trim() },
    });
  };
  return (
    <div className={styles.screen}>
      <title>{pageTitle("Soporte")}</title>
      <meta name="robots" content="noindex" />
      <PageHeader
        title="Soporte"
        description="Pida ayuda, consulte sus datos personales o presente una queja. Cada solicitud recibe un radicado y una fecha límite de respuesta."
      />
      <div className={styles.layout}>
        <Panel title="Nueva solicitud">
          <form className={styles.form} onSubmit={submit}>
            <ChoiceCards
              legend="Tipo de solicitud"
              value={category}
              onChange={setCategory}
              options={TICKET_CATEGORIES}
            />
            <Field
              label="Asunto"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              minLength={5}
              maxLength={120}
              required
            />
            <Field
              label="Mensaje"
              multiline
              rows={6}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              minLength={10}
              maxLength={3000}
              required
              help="No incluya contraseñas, archivos de casos ni datos de terceros."
            />
            {created && (
              <Notice tone="success">
                Radicamos su solicitud con el número{" "}
                <strong>{created.filing_number}</strong>. Le responderemos a más
                tardar el {formatDay(created.due_on)}.
              </Notice>
            )}
            {create.isError && (
              <Notice tone="error">
                No pudimos enviar la solicitud. Revise su conexión e inténtelo
                de nuevo.
              </Notice>
            )}
            <Button type="submit" busy={create.isPending}>
              Enviar solicitud
            </Button>
            <p className={styles.legal}>
              Los plazos se cuentan en días hábiles de Colombia, como lo explica
              la{" "}
              <Link to={legalRoute("privacidad")}>
                política de tratamiento de datos
              </Link>
              .
            </p>
          </form>
        </Panel>
        <Panel title="Mis solicitudes" density="compact">
          {tickets.isPending && <p role="status">Cargando solicitudes</p>}
          {tickets.isError && (
            <Notice tone="error">No pudimos cargar las solicitudes.</Notice>
          )}
          {tickets.data?.items.length === 0 && (
            <p className={styles.empty}>Todavía no ha enviado solicitudes.</p>
          )}
          {tickets.data && tickets.data.items.length > 0 && (
            <ul className={styles.tickets}>
              {tickets.data.items.map((ticket) => (
                <li className={styles.ticket} key={ticket.id}>
                  <div className={styles.ticketHead}>
                    <span className={styles.filing}>
                      {ticket.filing_number}
                    </span>
                    <StatusBadge
                      tone={ticket.status === "open" ? "pending" : "ok"}
                    >
                      {ticket.status === "open" ? "En trámite" : "Resuelta"}
                    </StatusBadge>
                  </div>
                  <h3 className={styles.subject}>{ticket.subject}</h3>
                  <p className={styles.note}>
                    {TICKET_CATEGORY_LABELS[ticket.category]}, recibida el{" "}
                    <time dateTime={ticket.created_at}>
                      {formatColombiaTime(ticket.created_at)}
                    </time>
                  </p>
                  {ticket.status === "open" ? (
                    <p className={styles.note}>
                      Respuesta a más tardar el {formatDay(ticket.due_on)}
                    </p>
                  ) : (
                    ticket.closed_at && (
                      <p className={styles.note}>
                        Resuelta el {formatColombiaDate(ticket.closed_at)}
                      </p>
                    )
                  )}
                  <details className={styles.details}>
                    <summary>Ver el mensaje</summary>
                    <p className={styles.message}>{ticket.message}</p>
                  </details>
                </li>
              ))}
            </ul>
          )}
          <Pager pager={pager} next={tickets.data?.next_cursor} />
        </Panel>
      </div>
    </div>
  );
}
