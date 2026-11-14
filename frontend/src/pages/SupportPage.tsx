import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";

import {
  createSupportTicketMutation,
  ownSupportTicketsOptions,
} from "../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../components/ui/Button.tsx";
import { Field } from "../components/ui/Field.tsx";
import { Notice } from "../components/ui/Notice.tsx";
import { PageHeader } from "../components/ui/PageHeader.tsx";
import { pageTitle } from "../config/site.ts";
import styles from "./PlatformPage.module.css";

export function SupportPage() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();
  const [previous, setPrevious] = useState<(string | undefined)[]>([]);
  const [sent, setSent] = useState(false);
  const queryClient = useQueryClient();
  const tickets = useQuery(
    ownSupportTicketsOptions({ query: cursor ? { cursor } : {} }),
  );
  const create = useMutation({
    ...createSupportTicketMutation(),
    onSuccess: async () => {
      setSubject("");
      setMessage("");
      setSent(true);
      setCursor(undefined);
      setPrevious([]);
      await queryClient.invalidateQueries();
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSent(false);
    create.mutate({
      body: { subject: subject.trim(), message: message.trim() },
    });
  };
  return (
    <div className={styles.screen}>
      <title>{pageTitle("Soporte")}</title>
      <meta name="robots" content="noindex" />
      <PageHeader
        title="Soporte"
        description="Cuéntenos qué necesita y siga el estado de su solicitud."
      />
      <section className={styles.section} aria-label="Nueva solicitud">
        <div className={styles.sectionHeading}>
          <h2>Nueva solicitud</h2>
          <p>
            No incluya contraseñas, archivos de casos ni datos confidenciales.
          </p>
        </div>
        <form className={styles.form} onSubmit={submit}>
          <Field
            label="Asunto"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            minLength={5}
            maxLength={120}
            required
          />
          <div className={styles.textareaField}>
            <label htmlFor="support-message">Mensaje</label>
            <textarea
              id="support-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              minLength={10}
              maxLength={3000}
              rows={6}
              required
            />
          </div>
          {sent && <Notice tone="success">Solicitud enviada.</Notice>}
          {create.isError && (
            <Notice tone="error">No pudimos enviar la solicitud.</Notice>
          )}
          <Button
            type="submit"
            busy={create.isPending}
            disabled={create.isPending}
          >
            Enviar solicitud
          </Button>
        </form>
      </section>
      <section className={styles.section} aria-label="Mis solicitudes">
        <div className={styles.sectionHeading}>
          <h2>Mis solicitudes</h2>
        </div>
        {tickets.isPending && <p role="status">Cargando solicitudes</p>}
        {tickets.isError && (
          <Notice tone="error">No pudimos cargar las solicitudes.</Notice>
        )}
        {tickets.data?.items.length === 0 && (
          <p>Todavía no ha enviado solicitudes.</p>
        )}
        {tickets.data?.items.map((ticket) => (
          <article className={styles.ticket} key={ticket.id}>
            <div className={styles.ticketHead}>
              <h3>{ticket.subject}</h3>
              <span>{ticket.status === "open" ? "Abierta" : "Resuelta"}</span>
            </div>
            <p className={styles.note}>
              <time dateTime={ticket.created_at}>
                {new Date(ticket.created_at).toLocaleString("es-CO")}
              </time>
            </p>
            <p className={styles.message}>{ticket.message}</p>
          </article>
        ))}
        <div className={styles.pager}>
          {previous.length > 0 && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setCursor(previous.at(-1));
                setPrevious((items) => items.slice(0, -1));
              }}
            >
              Anterior
            </Button>
          )}
          {tickets.data?.next_cursor && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setPrevious((items) => [...items, cursor]);
                setCursor(tickets.data.next_cursor ?? undefined);
              }}
            >
              Ver más
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
