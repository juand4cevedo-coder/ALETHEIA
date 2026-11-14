import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { type ReactNode, useId, useState } from "react";
import { Link, useOutletContext } from "react-router";

import type { InvitationOut, Me, MemberOut, SeatsOut } from "../api/generated";
import {
  listInvitationsInfiniteOptions,
  listInvitationsInfiniteQueryKey,
  listMembersInfiniteOptions,
  listMembersInfiniteQueryKey,
  removeMemberMutation,
  revokeInvitationMutation,
} from "../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../components/ui/Button.tsx";
import { Notice } from "../components/ui/Notice.tsx";
import { PageHeader } from "../components/ui/PageHeader.tsx";
import { SystemError } from "../components/ui/SystemError.tsx";
import { ROUTES } from "../config/routes.ts";
import { pageTitle } from "../config/site.ts";
import { apiProblem } from "../features/auth/apiProblem.ts";
import { dateTime, shortDate } from "../features/members/format.ts";
import { ChangeRoleDialog } from "../features/members/ChangeRoleDialog.tsx";
import { InviteDialog } from "../features/members/InviteDialog.tsx";
import { RemoveMemberDialog } from "../features/members/RemoveMemberDialog.tsx";
import { RevokeInvitationDialog } from "../features/members/RevokeInvitationDialog.tsx";
import { managesTeam, ROLE_LABELS } from "../features/workspace/roles.ts";
import styles from "./MembersPage.module.css";
import { CorreoIcon } from "../components/ui/icons.tsx";

// MSG-010 del catálogo de mensajes.
const NOT_ALLOWED =
  "No tiene permiso para esta acción. Si lo necesita, pídalo al propietario o al administrador de su organización.";

// La primera página va sin cursor. El cliente generado trata null como un objeto de
// parámetros, así que la página inicial se declara como parámetros vacíos.
const FIRST_PAGE = { query: {} };
const nextCursor = (page: { next_cursor: string | null }) =>
  page.next_cursor ?? undefined;

// Miembros e invitaciones (UI-021, HU-011): quién está en la organización, quién tiene una
// invitación pendiente y cuántos cupos quedan en el plan. Solo el propietario y el
// administrador llegan aquí; la API también lo exige (RN-008).
export function MembersPage() {
  const me = useOutletContext<Me>();

  return (
    <div className={styles.screen}>
      <title>{pageTitle("Miembros")}</title>
      <meta name="robots" content="noindex" />

      {managesTeam(me.organization?.role) ? (
        <Team currentUserId={me.id} />
      ) : (
        <>
          <Header />
          <Notice tone="error">
            <p>{NOT_ALLOWED}</p>
          </Notice>
        </>
      )}
    </div>
  );
}

function Header({ action }: { action?: ReactNode }) {
  return (
    <PageHeader
      title="Miembros"
      description="Cada persona entra con su propio acceso. Lo que ve depende de su rol."
      actions={action}
    />
  );
}

function Team({ currentUserId }: { currentUserId: string }) {
  const queryClient = useQueryClient();
  const [inviting, setInviting] = useState(false);
  const [sent, setSent] = useState<InvitationOut | null>(null);
  const [revoking, setRevoking] = useState<InvitationOut | null>(null);
  const [changing, setChanging] = useState<MemberOut | null>(null);
  const [removing, setRemoving] = useState<MemberOut | null>(null);
  const [removed, setRemoved] = useState<string | null>(null);

  const members = useInfiniteQuery({
    ...listMembersInfiniteOptions(),
    initialPageParam: FIRST_PAGE,
    getNextPageParam: nextCursor,
  });
  const invitations = useInfiniteQuery({
    ...listInvitationsInfiniteOptions(),
    initialPageParam: FIRST_PAGE,
    getNextPageParam: nextCursor,
  });

  // Invitar o revocar cambia el cupo y las dos listas: se vuelven a pedir juntas.
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: listMembersInfiniteQueryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: listInvitationsInfiniteQueryKey(),
      }),
    ]);

  const revoke = useMutation({
    ...revokeInvitationMutation(),
    onSuccess: async () => {
      setRevoking(null);
      setSent(null);
      await refresh();
    },
    onError: async (error) => {
      // Si ya no estaba pendiente (la aceptaron o la revocó otra persona), la lista lo dirá.
      if (apiProblem(error).status === 404) {
        setRevoking(null);
        await refresh();
      }
    },
  });

  const remove = useMutation({
    ...removeMemberMutation(),
    onSuccess: async () => {
      setRemoved(removing?.full_name ?? null);
      setRemoving(null);
      await refresh();
    },
    onError: async (error) => {
      // Si ya no era miembro (otra persona la retiró), la lista lo dirá.
      if (apiProblem(error).status === 404) {
        setRemoving(null);
        await refresh();
      }
    },
  });

  const seats = members.data?.pages[0]?.seats;
  const memberRows = members.data?.pages.flatMap((page) => page.items) ?? [];
  const invitationRows =
    invitations.data?.pages.flatMap((page) => page.items) ?? [];

  // Invitar es la acción que se espera aquí: va arriba, como «Abrir un caso» en Casos. Mientras
  // carga el cupo o con el plan lleno no se ofrece; el aviso del cupo dice cómo seguir.
  const invite =
    seats && !seats.full ? (
      <Button
        size="sm"
        onClick={() => {
          setSent(null);
          setRemoved(null);
          setInviting(true);
        }}
      >
        <CorreoIcon size={16} aria-hidden="true" />
        Invitar a una persona
      </Button>
    ) : undefined;

  return (
    <>
      <Header action={invite} />

      {sent && (
        <Notice tone="success">
          Enviamos la invitación a <strong translate="no">{sent.email}</strong>.
          Vence el {dateTime(sent.expires_at)}
        </Notice>
      )}

      {removed && (
        <Notice tone="success">
          <strong translate="no">{removed}</strong> ya no pertenece a la
          organización y sus sesiones quedaron cerradas.
        </Notice>
      )}

      <SeatsBar seats={seats} loading={members.isPending} />

      <Card title="Personas">
        {members.isError ? (
          <LoadError
            error={members.error}
            onRetry={() => void members.refetch()}
          />
        ) : members.isPending ? (
          <p className={styles.loading}>Cargando las personas</p>
        ) : (
          <ul className={styles.rows}>
            {memberRows.map((member) => (
              <li
                key={member.user_id}
                className={styles.row}
                data-actions={isManageable(member, currentUserId) || undefined}
              >
                <span className={styles.who}>
                  <span className={styles.name}>{member.full_name}</span>
                  <span className={styles.email} translate="no">
                    {member.email}
                  </span>
                </span>
                <span className={styles.role} data-role={member.role}>
                  {ROLE_LABELS[member.role]}
                </span>
                <span className={styles.meta}>
                  Desde el{" "}
                  <time dateTime={member.joined_at}>
                    {shortDate(member.joined_at)}
                  </time>
                </span>
                {isManageable(member, currentUserId) && (
                  <span className={styles.rowActions}>
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={`Cambiar el rol de ${member.full_name}`}
                      onClick={() => {
                        setRemoved(null);
                        setChanging(member);
                      }}
                    >
                      Cambiar el rol
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={`Retirar a ${member.full_name}`}
                      onClick={() => {
                        remove.reset();
                        setRemoved(null);
                        setRemoving(member);
                      }}
                    >
                      Retirar
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {members.hasNextPage && (
          <MoreButton
            label="Cargar más personas"
            busy={members.isFetchingNextPage}
            onClick={() => void members.fetchNextPage()}
          />
        )}
      </Card>

      <Card title="Invitaciones pendientes">
        {invitations.isError ? (
          <LoadError
            error={invitations.error}
            onRetry={() => void invitations.refetch()}
          />
        ) : invitations.isPending ? (
          <p className={styles.loading}>Cargando las invitaciones</p>
        ) : invitationRows.length === 0 ? (
          <p className={styles.empty}>
            No hay invitaciones pendientes. Cuando invite a alguien, aparecerá
            aquí hasta que acepte.
          </p>
        ) : (
          <ul className={styles.rows} data-kind="invitations">
            {invitationRows.map((invitation) => (
              <li key={invitation.id} className={styles.row}>
                <span className={styles.who}>
                  <span className={styles.name} translate="no">
                    {invitation.email}
                  </span>
                  <span className={styles.detail}>
                    {invitation.expired ? (
                      <span className={styles.expired}>
                        Venció el {dateTime(invitation.expires_at)}
                      </span>
                    ) : (
                      <>Vence el {dateTime(invitation.expires_at)}</>
                    )}
                  </span>
                </span>
                <span className={styles.role} data-role={invitation.role}>
                  {ROLE_LABELS[invitation.role]}
                </span>
                <span className={styles.rowAction}>
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={`Revocar la invitación de ${invitation.email}`}
                    onClick={() => {
                      revoke.reset();
                      setRevoking(invitation);
                    }}
                  >
                    Revocar
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {invitations.hasNextPage && (
          <MoreButton
            label="Cargar más invitaciones"
            busy={invitations.isFetchingNextPage}
            onClick={() => void invitations.fetchNextPage()}
          />
        )}
      </Card>

      <InviteDialog
        open={inviting}
        onClose={() => setInviting(false)}
        onInvited={(invitation) => {
          setInviting(false);
          setSent(invitation);
          void refresh();
        }}
      />
      <ChangeRoleDialog
        key={changing?.user_id ?? "ninguno"}
        member={changing}
        onClose={() => setChanging(null)}
        onChanged={() => {
          setChanging(null);
          void refresh();
        }}
      />
      <RemoveMemberDialog
        member={removing}
        onClose={() => setRemoving(null)}
        onConfirm={(member) =>
          remove.mutate({ path: { user_id: member.user_id } })
        }
        busy={remove.isPending}
        failure={
          remove.isError &&
          apiProblem(remove.error).status !== 404 &&
          (apiProblem(remove.error).status === 403
            ? (apiProblem(remove.error).detail ?? true)
            : true)
        }
      />
      <RevokeInvitationDialog
        invitation={revoking}
        onClose={() => setRevoking(null)}
        onConfirm={(invitation) =>
          revoke.mutate({ path: { invitation_id: invitation.id } })
        }
        busy={revoke.isPending}
        failed={revoke.isError && apiProblem(revoke.error).status !== 404}
      />
    </>
  );
}

// El propietario no se cambia ni se retira (RN-010), y nadie se gestiona a sí mismo desde aquí:
// la API también lo rechaza (HU-013), así que el botón ni se ofrece.
function isManageable(member: MemberOut, currentUserId: string): boolean {
  return member.role !== "owner" && member.user_id !== currentUserId;
}

// Cupo del plan (RN-012): cuántas personas e invitaciones caben. Con el plan lleno, el botón de
// invitar no se muestra y el aviso, debajo del cupo, dice cómo seguir (FLU-003, E1).
function SeatsBar({
  seats,
  loading,
}: {
  seats: SeatsOut | undefined;
  loading: boolean;
}) {
  const meterId = useId();
  if (loading || !seats) {
    // Reserva el alto del cupo para que la página no salte cuando llega.
    return <div className={styles.seats} aria-hidden="true" />;
  }
  const unlimited = seats.extra_user_price_cop !== null;
  if (seats.owner_exempt) {
    return (
      <div className={styles.seats}>
        <div className={styles.seatsText}>
          <p className={styles.seatsCount}>Equipo de la plataforma</p>
          <p className={styles.seatsHint}>
            Su cuenta de propietario puede invitar personas sin límite de cupo
            del plan. Hay {seats.used} miembros e invitaciones abiertas.
          </p>
        </div>
      </div>
    );
  }
  const ratio = Math.min(seats.used / seats.included, 1);
  const users = seats.included === 1 ? "usuario" : "usuarios";

  return (
    <>
      <div className={styles.seats}>
        <div className={styles.seatsText}>
          <p id={meterId} className={styles.seatsCount}>
            <strong>{seats.used}</strong> de {seats.included} {users} en uso
          </p>
          {/* En los dos tipos de plan una invitación pendiente ocupa un cupo; con usuarios
              adicionales, ese cupo puede cobrarse. */}
          <p className={styles.seatsHint}>
            Cuentan los miembros y las invitaciones que siguen abiertas.
            {unlimited &&
              " Por encima del cupo, cada usuario adicional tiene cobro mensual."}
          </p>
        </div>
        <span
          className={styles.meter}
          role="meter"
          aria-labelledby={meterId}
          aria-valuemin={0}
          aria-valuemax={seats.included}
          aria-valuenow={Math.min(seats.used, seats.included)}
          data-full={seats.full || undefined}
        >
          <span style={{ inlineSize: `${ratio * 100}%` }} />
        </span>
      </div>
      {seats.full && (
        <Notice tone="warning">
          <p>
            Su plan ya no tiene cupo. Para invitar a alguien más,{" "}
            <Link to={ROUTES.pricing}>cambie de plan</Link> o revoque una
            invitación pendiente.
          </p>
        </Notice>
      )}
    </>
  );
}

// Un panel por lista: el título arriba y las filas de borde a borde, como el libro de casos.
function Card({ title, children }: { title: string; children: ReactNode }) {
  const titleId = useId();
  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.cardTitle}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function LoadError({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <div className={styles.loadError}>
      <Notice tone="error">
        <SystemError requestId={apiProblem(error).requestId} />
      </Notice>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Intentar de nuevo
      </Button>
    </div>
  );
}

function MoreButton({
  label,
  busy,
  onClick,
}: {
  label: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <div className={styles.more}>
      <Button variant="secondary" size="sm" busy={busy} onClick={onClick}>
        {busy ? "Cargando" : label}
      </Button>
    </div>
  );
}
