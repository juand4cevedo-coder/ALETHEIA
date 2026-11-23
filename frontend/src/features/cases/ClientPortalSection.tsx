import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useId, useState } from "react";

import {
  inviteClientMutation,
  listPortalAccessesOptions,
  listPortalAccessesQueryKey,
  listPortalMessagesOptions,
  listPortalMessagesQueryKey,
  markPortalMessagesReadMutation,
  listPortalUpdatesOptions,
  listPortalUpdatesQueryKey,
  publishPortalUpdateMutation,
  revokeClientAccessMutation,
} from "../../api/generated/@tanstack/react-query.gen.ts";
import type { PortalAccessOut } from "../../api/generated/index.ts";
import { Button } from "../../components/ui/Button.tsx";
import { Field } from "../../components/ui/Field.tsx";
import { Notice } from "../../components/ui/Notice.tsx";
import { apiProblem } from "../auth/apiProblem.ts";
import { EMAIL_MAX_LENGTH, EMAIL_PATTERN } from "../auth/signUp.ts";
import { formatColombiaTime } from "./dates.ts";
import styles from "./ClientPortalSection.module.css";

const MAX_UPDATE = 2000;

const STATUS_LABEL: Record<PortalAccessOut["status"], string> = {
  active: "Con acceso",
  expired: "Enlace vencido",
  revoked: "Sin acceso",
};

// Portal del cliente (ADR-054): el cliente entra con un enlace a su correo y solo ve el título y
// el estado del caso y los avisos que se publican aquí. Notas, tareas y evidencias no se
// comparten por esta vía.
export function ClientPortalSection({
  caseId,
  caseOpen,
}: {
  caseId: string;
  caseOpen: boolean;
}) {
  const queryClient = useQueryClient();
  const path = { case_id: caseId };
  const accesses = useQuery(listPortalAccessesOptions({ path }));
  const updates = useQuery(listPortalUpdatesOptions({ path }));
  const messages = useQuery(listPortalMessagesOptions({ path }));
  const markRead = useMutation({
    ...markPortalMessagesReadMutation(),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: listPortalMessagesQueryKey({ path }),
      }),
  });
  const unread = messages.data?.unread_count ?? 0;
  const {
    mutate: markAsRead,
    isPending: marking,
    isError: markFailed,
  } = markRead;
  // Abrir la pestaña es leer: lo nuevo se marca una vez que la lista llegó.
  useEffect(() => {
    if (unread > 0 && !marking && !markFailed)
      markAsRead({ path: { case_id: caseId } });
  }, [unread, marking, markFailed, markAsRead, caseId]);
  const countId = useId();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteFailure, setInviteFailure] = useState("");
  const [body, setBody] = useState("");
  const [publishFailure, setPublishFailure] = useState("");

  async function refreshAccesses() {
    await queryClient.invalidateQueries({
      queryKey: listPortalAccessesQueryKey({ path }),
    });
  }

  const invite = useMutation({
    ...inviteClientMutation(),
    onSuccess: async (_, variables) => {
      setInviteMessage(
        `Le enviamos el enlace a ${variables.body?.client_email}. Si ya tenía acceso, el enlace anterior dejó de servir.`,
      );
      setInviteFailure("");
      setName("");
      setEmail("");
      await refreshAccesses();
    },
    onError: (failure) => {
      setInviteMessage("");
      const { status } = apiProblem(failure);
      setInviteFailure(
        status === 409
          ? "Un caso archivado conserva lo compartido, pero no admite invitaciones nuevas."
          : status === 429
            ? "Envió muchas invitaciones seguidas. Espere unos minutos."
            : "No pudimos enviar la invitación. Inténtelo de nuevo.",
      );
    },
  });

  const revoke = useMutation({
    ...revokeClientAccessMutation(),
    onSuccess: refreshAccesses,
  });

  const publish = useMutation({
    ...publishPortalUpdateMutation(),
    onSuccess: async () => {
      setBody("");
      setPublishFailure("");
      await queryClient.invalidateQueries({
        queryKey: listPortalUpdatesQueryKey({ path }),
      });
    },
    onError: (failure) => {
      setPublishFailure(
        apiProblem(failure).status === 409
          ? "Un caso archivado conserva lo compartido, pero no admite avisos nuevos."
          : "No pudimos publicar el aviso. Inténtelo de nuevo.",
      );
    },
  });

  function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (invite.isPending) return;
    const address = email.trim();
    if (!EMAIL_PATTERN.test(address) || address.length > EMAIL_MAX_LENGTH) {
      setEmailError(
        "Escriba un correo válido, por ejemplo nombre@dominio.com.",
      );
      return;
    }
    setEmailError("");
    invite.mutate({
      path,
      body: { client_name: name.trim(), client_email: address },
    });
  }

  function submitUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = body.trim();
    if (!text || publish.isPending) return;
    publish.mutate({ path, body: { body: text } });
  }

  const list = accesses.data?.items ?? [];

  return (
    <section aria-labelledby="client-portal-title" className={styles.section}>
      <div className={styles.heading}>
        <h2 id="client-portal-title">Portal del cliente</h2>
        <p>
          Su cliente entra con un enlace que le llega al correo, sin crear
          cuenta. Allí ve el título y el estado del caso y los avisos que
          publique aquí; nada más. Antes de ver el caso, acepta un aviso sobre
          el tratamiento de sus datos.
        </p>
      </div>

      {caseOpen ? (
        <form className={styles.form} onSubmit={submitInvite} noValidate>
          <h3>Invitar a un cliente</h3>
          <Field
            label="Nombre del cliente"
            autoComplete="off"
            maxLength={120}
            value={name}
            disabled={invite.isPending}
            onChange={(event) => setName(event.target.value)}
          />
          <Field
            label="Correo del cliente"
            type="email"
            autoComplete="off"
            maxLength={EMAIL_MAX_LENGTH}
            value={email}
            error={emailError}
            help="Si ya tiene acceso, invitarlo otra vez le reenvía el enlace y el anterior deja de servir."
            disabled={invite.isPending}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Button
            type="submit"
            busy={invite.isPending}
            disabled={name.trim() === "" || email.trim() === ""}
          >
            Enviar invitación
          </Button>
          {inviteMessage && (
            <Notice tone="success">
              <p role="status">{inviteMessage}</p>
            </Notice>
          )}
          {inviteFailure && (
            <Notice tone="error">
              <p role="alert">{inviteFailure}</p>
            </Notice>
          )}
        </form>
      ) : (
        <Notice tone="info">
          <p>
            El caso está archivado: lo ya compartido se conserva, pero no admite
            invitaciones ni avisos nuevos.
          </p>
        </Notice>
      )}

      <div className={styles.block}>
        <h3>Clientes con acceso</h3>
        {accesses.isPending && <p role="status">Cargando accesos</p>}
        {accesses.isError && (
          <Notice tone="error">
            <p>No pudimos consultar los accesos de este caso.</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void accesses.refetch()}
            >
              Intentar de nuevo
            </Button>
          </Notice>
        )}
        {accesses.isSuccess && list.length === 0 && (
          <p className={styles.muted}>Todavía no invitó a ningún cliente.</p>
        )}
        {list.length > 0 && (
          <ul className={styles.list} aria-label="Clientes con acceso">
            {list.map((access) => (
              <li key={access.id} className={styles.row}>
                <div>
                  <strong>{access.client_name}</strong>
                  <span>{access.client_email}</span>
                  <span className={styles.muted}>
                    {STATUS_LABEL[access.status]}
                  </span>
                  {access.notice_accepted_at ? (
                    <span className={styles.muted}>
                      Aceptó el aviso de datos el{" "}
                      {formatColombiaTime(access.notice_accepted_at)}
                    </span>
                  ) : (
                    access.status === "active" && (
                      <span className={styles.muted}>
                        Aún no acepta el aviso de datos
                      </span>
                    )
                  )}
                  {access.last_visit_at && (
                    <span className={styles.muted}>
                      Última visita {formatColombiaTime(access.last_visit_at)}
                    </span>
                  )}
                </div>
                {access.status !== "revoked" && (
                  <Button
                    variant="secondary"
                    size="sm"
                    busy={
                      revoke.isPending &&
                      revoke.variables?.path.access_id === access.id
                    }
                    onClick={() =>
                      revoke.mutate({
                        path: { case_id: caseId, access_id: access.id },
                      })
                    }
                  >
                    Quitar acceso
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {revoke.isError && (
          <Notice tone="error">
            <p role="alert">No pudimos quitar el acceso. Inténtelo de nuevo.</p>
          </Notice>
        )}
      </div>

      <div className={styles.block}>
        <h3>Mensajes de clientes</h3>
        {messages.isPending && <p role="status">Cargando mensajes</p>}
        {messages.isSuccess && messages.data.items.length === 0 && (
          <p className={styles.muted}>
            Todavía no le escribió ningún cliente. Para responderle, publique un
            aviso o use sus canales de siempre.
          </p>
        )}
        {messages.isSuccess && messages.data.items.length > 0 && (
          <ol className={styles.updates} aria-label="Mensajes de clientes">
            {messages.data.items.map((item) => (
              <li key={item.id} className={styles.update}>
                <header>
                  <strong>
                    {item.client_name}
                    {item.read_at === null && " (nuevo)"}
                  </strong>
                  <time dateTime={item.created_at}>
                    {formatColombiaTime(item.created_at)}
                  </time>
                </header>
                <p>{item.body}</p>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className={styles.block}>
        <h3>Avisos para el cliente</h3>
        {caseOpen && (
          <form className={styles.form} onSubmit={submitUpdate}>
            <Field
              label="Nuevo aviso"
              multiline
              rows={4}
              value={body}
              maxLength={MAX_UPDATE}
              describedBy={countId}
              help="Lo leerá el cliente tal como lo escriba. No copie notas internas ni estrategia."
              disabled={publish.isPending}
              onChange={(event) => setBody(event.target.value)}
            >
              <span id={countId} className={styles.count}>
                {body.length} de {MAX_UPDATE}
              </span>
            </Field>
            <Button
              type="submit"
              busy={publish.isPending}
              disabled={body.trim() === ""}
            >
              Publicar aviso
            </Button>
            {publishFailure && (
              <Notice tone="error">
                <p role="alert">{publishFailure}</p>
              </Notice>
            )}
          </form>
        )}
        {updates.isPending && <p role="status">Cargando avisos</p>}
        {updates.isSuccess && updates.data.items.length === 0 && (
          <p className={styles.muted}>Todavía no publicó ningún aviso.</p>
        )}
        {updates.isSuccess && updates.data.items.length > 0 && (
          <ol className={styles.updates} aria-label="Avisos publicados">
            {updates.data.items.map((item) => (
              <li key={item.id} className={styles.update}>
                <header>
                  <strong>{item.author_name}</strong>
                  <time dateTime={item.created_at}>
                    {formatColombiaTime(item.created_at)}
                  </time>
                </header>
                <p>{item.body}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
