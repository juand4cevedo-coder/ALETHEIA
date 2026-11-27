import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";

import type { NotificationOut } from "../../api/generated";
import {
  listNotificationsOptions,
  listNotificationsQueryKey,
  readAllNotificationsMutation,
  readNotificationMutation,
} from "../../api/generated/@tanstack/react-query.gen.ts";
import {
  CampanaIcon,
  CarpetaAbiertaIcon,
  CorreoIcon,
  TareasIcon,
  UsuarioAgregarIcon,
  type IconComponent,
} from "../../components/ui/icons.tsx";
import styles from "./NotificationBell.module.css";
import { timeAgo } from "./timeAgo.ts";

// Avisos dentro de la aplicación (ADR-063): una campana en el encabezado con el número de avisos
// sin leer y un panel con los más recientes. Como el menú de la cuenta, es un botón que despliega
// un panel: se recorre con Tab y se cierra con Escape o con un clic fuera. Se consulta al abrir
// la página, cada minuto mientras la pestaña está a la vista y al volver a ella.

const POLL_MS = 60_000;

const KIND_ICONS: Record<NotificationOut["kind"], IconComponent> = {
  task_assigned: TareasIcon,
  case_member_added: CarpetaAbiertaIcon,
  client_message: CorreoIcon,
  member_joined: UsuarioAgregarIcon,
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();

  const inbox = useQuery({
    ...listNotificationsOptions(),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: listNotificationsQueryKey() });
  const readOne = useMutation({
    ...readNotificationMutation(),
    onSettled: refresh,
  });
  const readAll = useMutation({
    ...readAllNotificationsMutation(),
    onSettled: refresh,
  });

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const items = inbox.data?.items ?? [];
  const unread = inbox.data?.unread ?? 0;
  const badge = unread > 9 ? "9+" : String(unread);
  const label =
    unread === 0
      ? "Avisos, no tiene avisos sin leer"
      : `Avisos, ${unread} sin leer`;

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={label}
        title="Avisos"
        onClick={() => setOpen((current) => !current)}
      >
        <CampanaIcon size={20} aria-hidden="true" />
        {unread > 0 && (
          <span className={styles.badge} aria-hidden="true">
            {badge}
          </span>
        )}
      </button>

      <section
        id={panelId}
        className={styles.panel}
        hidden={!open}
        aria-labelledby={titleId}
      >
        <header className={styles.head}>
          <h2 id={titleId} className={styles.title}>
            Avisos
          </h2>
          {unread > 0 && (
            <button
              type="button"
              className={styles.readAll}
              onClick={() => readAll.mutate({})}
              disabled={readAll.isPending}
            >
              Marcar todo como leído
            </button>
          )}
        </header>

        {inbox.isPending ? (
          <p className={styles.empty}>Cargando sus avisos</p>
        ) : inbox.isError ? (
          <p className={styles.empty}>
            No pudimos traer sus avisos. Vuelva a abrir este panel en un
            momento.
          </p>
        ) : items.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyMark} aria-hidden="true">
              <CampanaIcon size={22} />
            </span>
            <p className={styles.emptyTitle}>Está al día</p>
            <p className={styles.empty}>
              Aquí verá las tareas que le asignen, los casos a los que lo
              agreguen y los mensajes de sus clientes.
            </p>
          </div>
        ) : (
          <ul className={styles.list}>
            {items.map((item) => {
              const Icon = KIND_ICONS[item.kind];
              return (
                <li key={item.id}>
                  <Link
                    to={item.link}
                    className={styles.item}
                    data-unread={item.read ? undefined : ""}
                    onClick={() => {
                      if (!item.read)
                        readOne.mutate({ path: { notification_id: item.id } });
                      setOpen(false);
                    }}
                  >
                    <span className={styles.kind} aria-hidden="true">
                      <Icon size={16} />
                    </span>
                    <span className={styles.text}>
                      <span className={styles.itemTitle}>{item.title}</span>
                      {item.body && (
                        <span className={styles.itemBody}>{item.body}</span>
                      )}
                      <span className={styles.when}>
                        <time dateTime={item.created_at}>
                          {timeAgo(item.created_at)}
                        </time>
                        {!item.read && (
                          <span className="visually-hidden">, sin leer</span>
                        )}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
