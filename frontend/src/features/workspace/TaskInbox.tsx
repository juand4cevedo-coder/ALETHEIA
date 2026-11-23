import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import type { Me } from "../../api/generated";
import { taskInboxOptions } from "../../api/generated/@tanstack/react-query.gen.ts";
import { EmptyState } from "../../components/ui/EmptyState.tsx";
import { Panel } from "../../components/ui/Panel.tsx";
import { StatusBadge } from "../../components/ui/StatusBadge.tsx";
import { ROUTES } from "../../config/routes.ts";
import { dayKey } from "../calendar/calendar.ts";
import { formatColombiaTime } from "../cases/dates.ts";
import styles from "./TaskInbox.module.css";

const PRIORITY = {
  low: "Baja",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
} as const;

const GROUPS = [
  { key: "overdue", label: "Vencidas" },
  { key: "today", label: "Para hoy" },
  { key: "week", label: "Esta semana" },
  { key: "later", label: "Más adelante" },
  { key: "none", label: "Sin plazo" },
] as const;
type GroupKey = (typeof GROUPS)[number]["key"];

// Agrupa por el día de Colombia, no por el del navegador: un plazo «para hoy» es el de hoy allá.
function groupOf(dueAt: string | null, now: number): GroupKey {
  if (dueAt === null) return "none";
  const due = new Date(dueAt).getTime();
  if (due < now) return "overdue";
  const today = dayKey(new Date(now).toISOString());
  if (dayKey(dueAt) === today) return "today";
  return due - now < 7 * 24 * 60 * 60 * 1000 ? "week" : "later";
}

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
            <div className={styles.groups}>
              {GROUPS.map(({ key, label }) => {
                const tasks = data.items.filter(
                  (task) => groupOf(task.due_at, now) === key,
                );
                if (tasks.length === 0) return null;
                return (
                  <section key={key} aria-label={label} data-group={key}>
                    <h3 className={styles.groupTitle}>
                      {label} <span>{tasks.length}</span>
                    </h3>
                    <ol className={styles.list}>
                      {tasks.map((task) => {
                        const overdue = key === "overdue";
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
                                <StatusBadge
                                  tone={overdue ? "error" : "pending"}
                                >
                                  {overdue
                                    ? "Vencida"
                                    : task.due_at
                                      ? formatColombiaTime(task.due_at)
                                      : "Sin plazo"}
                                </StatusBadge>
                                <span>
                                  Prioridad{" "}
                                  {PRIORITY[task.priority].toLowerCase()}
                                </span>
                              </span>
                            </a>
                          </li>
                        );
                      })}
                    </ol>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
