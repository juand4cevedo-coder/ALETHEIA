import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import type { Me } from "../../api/generated";
import { taskInboxOptions } from "../../api/generated/@tanstack/react-query.gen.ts";
import { EmptyState } from "../../components/ui/EmptyState.tsx";
import { Panel } from "../../components/ui/Panel.tsx";
import { StatusBadge } from "../../components/ui/StatusBadge.tsx";
import { ROUTES } from "../../config/routes.ts";
import { formatColombiaTime } from "../cases/dates.ts";
import styles from "./TaskInbox.module.css";

const PRIORITY = {
  low: "Baja",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
} as const;

export function TaskInbox({ me }: { me: Me }) {
  const [now] = useState(() => Date.now());
  const role = me.organization?.role;
  const personal = role === "assistant" || role === "lawyer";
  const inbox = useQuery({
    ...taskInboxOptions({
      query: { assigned_to: personal ? me.id : undefined, limit: 8 },
    }),
    enabled: me.organization != null,
  });
  const data =
    inbox.data &&
    Array.isArray(inbox.data.items) &&
    typeof inbox.data.active === "number" &&
    typeof inbox.data.overdue === "number" &&
    typeof inbox.data.due_soon === "number"
      ? inbox.data
      : undefined;
  const title =
    role === "assistant"
      ? "Mis tareas asignadas"
      : role === "lawyer"
        ? "Mis próximos plazos"
        : "Seguimiento de tareas del equipo";

  return (
    <Panel title={title}>
      {inbox.isPending && <p role="status">Cargando tareas y plazos</p>}
      {inbox.isError && (
        <p role="status" className={styles.note}>
          No pudimos cargar la bandeja de tareas. Los casos siguen disponibles
          desde el libro.
        </p>
      )}
      {inbox.isSuccess && !data && (
        <p role="status" className={styles.note}>
          La bandeja de tareas no está disponible en este momento.
        </p>
      )}
      {data && (
        <>
          <dl className={styles.summary} aria-label="Resumen de tareas activas">
            <div>
              <dt>Activas</dt>
              <dd>{data.active}</dd>
            </div>
            <div>
              <dt>Vencidas</dt>
              <dd>{data.overdue}</dd>
            </div>
            <div>
              <dt>Próximos 7 días</dt>
              <dd>{data.due_soon}</dd>
            </div>
          </dl>
          {data.items.length === 0 ? (
            <EmptyState
              title="Sin tareas activas"
              description={
                personal
                  ? "No tiene trabajo pendiente asignado en sus casos."
                  : "No hay trabajo pendiente en los casos que supervisa."
              }
            />
          ) : (
            <ol className={styles.list} aria-label="Tareas próximas">
              {data.items.map((task) => {
                const overdue =
                  task.due_at !== null && new Date(task.due_at).getTime() < now;
                return (
                  <li key={task.id}>
                    <a
                      href={`${ROUTES.cases}/${task.case_id}#tareas`}
                      className={styles.task}
                    >
                      <span className={styles.taskMain}>
                        <strong>{task.title}</strong>
                        <span>{task.case_title}</span>
                      </span>
                      <span className={styles.meta}>
                        {!personal && <span>{task.assignee_name}</span>}
                        <StatusBadge tone={overdue ? "error" : "pending"}>
                          {overdue
                            ? "Vencida"
                            : task.due_at
                              ? formatColombiaTime(task.due_at)
                              : "Sin plazo"}
                        </StatusBadge>
                        <span>
                          Prioridad {PRIORITY[task.priority].toLowerCase()}
                        </span>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}
    </Panel>
  );
}
