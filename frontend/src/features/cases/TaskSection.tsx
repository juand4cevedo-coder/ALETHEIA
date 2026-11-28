import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";

import type { CaseMemberOut, CaseTaskOut } from "../../api/generated";
import {
  applyTaskTemplateMutation,
  createCaseTaskMutation,
  listTaskTemplatesOptions,
  listCaseTasksInfiniteOptions,
  listCaseTasksQueryKey,
  updateCaseTaskStatusMutation,
} from "../../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../../components/ui/Button.tsx";
import { Dialog } from "../../components/ui/Dialog.tsx";
import { Field } from "../../components/ui/Field.tsx";
import { Notice } from "../../components/ui/Notice.tsx";
import { Select } from "../../components/ui/Select.tsx";
import { StatusBadge } from "../../components/ui/StatusBadge.tsx";
import { apiProblem } from "../auth/apiProblem.ts";
import { formatColombiaTime } from "./dates.ts";
import styles from "./TaskSection.module.css";

type TaskStatus = CaseTaskOut["status"];
type TaskPriority = CaseTaskOut["priority"];

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  completed: "Completada",
  canceled: "Cancelada",
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Baja",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

const PRIORITY_OPTIONS = Object.entries(PRIORITY_LABELS).map(
  ([value, label]) => ({ value, label }),
);

export function TaskSection({
  caseId,
  members,
  role,
  currentUserId,
  caseOpen,
}: {
  caseId: string;
  members: CaseMemberOut[];
  role: string | undefined;
  currentUserId: string;
  caseOpen: boolean;
}) {
  const canManage = role === "owner" || role === "admin" || role === "lawyer";
  const [search, setSearch] = useState("");
  const [serverSearch, setServerSearch] = useState("");
  const [status, setStatus] = useState<TaskStatus | "">("");
  const [assignee, setAssignee] = useState("");
  const searchId = useId();
  const query = {
    status: status || undefined,
    assigned_to: assignee || undefined,
    search: serverSearch || undefined,
    limit: 25,
  };
  const listing = useInfiniteQuery({
    ...listCaseTasksInfiniteOptions({
      path: { case_id: caseId },
      query,
    }),
    initialPageParam: { path: { case_id: caseId }, query },
    getNextPageParam: (lastPage) => lastPage.next_cursor,
  });
  const tasks = listing.data?.pages.flatMap((page) => page.items) ?? [];

  useEffect(() => {
    const timer = window.setTimeout(() => setServerSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  return (
    <section aria-labelledby="case-tasks-title" className={styles.section}>
      <div className={styles.heading}>
        <div>
          <h2 id="case-tasks-title">Tareas y plazos</h2>
          <p>
            Trabajo asignado al equipo. Los casos archivados conservan esta
            información en modo de consulta.
          </p>
        </div>
        {canManage && caseOpen && (
          <div className={styles.headingActions}>
            <ApplyTemplate caseId={caseId} members={members} />
            <CreateTask caseId={caseId} members={members} />
          </div>
        )}
      </div>

      <div className={styles.filters} aria-label="Filtros de tareas">
        <div className={styles.search}>
          <label htmlFor={searchId}>Buscar tarea</label>
          <input
            id={searchId}
            type="search"
            value={search}
            placeholder="Título de la tarea"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select
          label="Estado"
          value={status}
          options={STATUS_OPTIONS}
          onChange={(event) => setStatus(event.target.value as TaskStatus | "")}
        />
        <Select
          label="Persona asignada"
          value={assignee}
          options={[
            { value: "", label: "Todo el equipo" },
            ...members.map((member) => ({
              value: member.user_id,
              label:
                member.user_id === currentUserId
                  ? `${member.full_name} (usted)`
                  : member.full_name,
            })),
          ]}
          onChange={(event) => setAssignee(event.target.value)}
        />
      </div>

      {listing.isPending && <p role="status">Cargando tareas</p>}
      {listing.isError && (
        <Notice tone="error">
          <p>No pudimos consultar las tareas de este caso.</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void listing.refetch()}
          >
            Intentar de nuevo
          </Button>
        </Notice>
      )}
      {listing.isSuccess && tasks.length === 0 && (
        <p className={styles.empty}>
          {search || status || assignee
            ? "Ninguna tarea coincide con estos filtros."
            : "Este caso todavía no tiene tareas asignadas."}
        </p>
      )}
      {tasks.length > 0 && (
        <ol className={styles.list} aria-label="Tareas del caso">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              caseId={caseId}
              currentUserId={currentUserId}
              canManage={canManage}
              caseOpen={caseOpen}
            />
          ))}
        </ol>
      )}
      {listing.hasNextPage && (
        <Button
          variant="secondary"
          size="sm"
          busy={listing.isFetchingNextPage}
          onClick={() => void listing.fetchNextPage()}
        >
          Cargar más tareas
        </Button>
      )}
    </section>
  );
}

// Crea de una vez las tareas de una plantilla del despacho, todas con la misma persona
// responsable. Si el despacho no tiene plantillas, la opción no aparece.
function ApplyTemplate({
  caseId,
  members,
}: {
  caseId: string;
  members: CaseMemberOut[];
}) {
  const queryClient = useQueryClient();
  const templates = useQuery(listTaskTemplatesOptions());
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [assignedTo, setAssignedTo] = useState(members[0]?.user_id ?? "");
  const items = Array.isArray(templates.data?.items)
    ? templates.data.items
    : [];
  const selected = templateId || items[0]?.id || "";
  const mutation = useMutation({
    ...applyTaskTemplateMutation(),
    onSuccess: async () => {
      setOpen(false);
      await queryClient.invalidateQueries({
        queryKey: listCaseTasksQueryKey({ path: { case_id: caseId } }),
      });
    },
  });
  if (items.length === 0) return null;
  const template = items.find((item) => item.id === selected);

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Usar una plantilla
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Crear tareas desde una plantilla"
        busy={mutation.isPending}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              busy={mutation.isPending}
              disabled={!selected || !assignedTo}
              onClick={() =>
                mutation.mutate({
                  path: { case_id: caseId },
                  body: { template_id: selected, assigned_to: assignedTo },
                })
              }
            >
              Crear las tareas
            </Button>
          </>
        }
      >
        <div className={styles.form}>
          <Select
            label="Plantilla"
            value={selected}
            options={items.map((item) => ({
              value: item.id,
              label: item.name,
            }))}
            onChange={(event) => setTemplateId(event.target.value)}
          />
          <Select
            label="Responsable de todas"
            value={assignedTo}
            options={members.map((member) => ({
              value: member.user_id,
              label: member.full_name,
            }))}
            onChange={(event) => setAssignedTo(event.target.value)}
          />
          {template && (
            <p>
              Se crearán {template.items.length}{" "}
              {template.items.length === 1 ? "tarea" : "tareas"}. Después puede
              cambiar el estado de cada una.
            </p>
          )}
          {mutation.error && (
            <Notice tone="error">
              {apiProblem(mutation.error).detail ??
                "No pudimos crear las tareas."}
            </Notice>
          )}
        </div>
      </Dialog>
    </>
  );
}

function CreateTask({
  caseId,
  members,
}: {
  caseId: string;
  members: CaseMemberOut[];
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [assignedTo, setAssignedTo] = useState(members[0]?.user_id ?? "");
  const [dueAt, setDueAt] = useState("");
  const mutation = useMutation({
    ...createCaseTaskMutation(),
    onSuccess: async () => {
      setOpen(false);
      setTitle("");
      setDescription("");
      setDueAt("");
      await queryClient.invalidateQueries({
        queryKey: listCaseTasksQueryKey({ path: { case_id: caseId } }),
      });
    },
  });
  const titleError =
    title.length > 160 ? "Use máximo 160 caracteres." : undefined;

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Nueva tarea
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Nueva tarea del caso"
        busy={mutation.isPending}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              busy={mutation.isPending}
              disabled={!title.trim() || !assignedTo || Boolean(titleError)}
              onClick={() =>
                mutation.mutate({
                  path: { case_id: caseId },
                  body: {
                    title: title.trim(),
                    description: description.trim() || null,
                    priority,
                    assigned_to: assignedTo,
                    due_at: dueAt ? new Date(dueAt).toISOString() : null,
                  },
                })
              }
            >
              Crear y asignar
            </Button>
          </>
        }
      >
        <div className={styles.form}>
          <Field
            label="Tarea"
            value={title}
            maxLength={161}
            error={titleError}
            onChange={(event) => setTitle(event.target.value)}
          />
          <Field
            label="Instrucciones"
            value={description}
            maxLength={1000}
            multiline
            rows={3}
            help="No incluya datos sensibles que no sean necesarios para ejecutar la tarea."
            onChange={(event) => setDescription(event.target.value)}
          />
          <div className={styles.formGrid}>
            <Select
              label="Prioridad"
              value={priority}
              options={PRIORITY_OPTIONS}
              onChange={(event) =>
                setPriority(event.target.value as TaskPriority)
              }
            />
            <Select
              label="Asignar a"
              value={assignedTo}
              options={members.map((member) => ({
                value: member.user_id,
                label: member.full_name,
              }))}
              onChange={(event) => setAssignedTo(event.target.value)}
            />
          </div>
          <Field
            label="Fecha límite"
            type="datetime-local"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
            help="Opcional. Se guarda en hora de Colombia."
          />
          {mutation.error && (
            <Notice tone="error">
              {apiProblem(mutation.error).detail ??
                "No pudimos crear la tarea."}
            </Notice>
          )}
        </div>
      </Dialog>
    </>
  );
}

function TaskCard({
  task,
  caseId,
  currentUserId,
  canManage,
  caseOpen,
}: {
  task: CaseTaskOut;
  caseId: string;
  currentUserId: string;
  canManage: boolean;
  caseOpen: boolean;
}) {
  const queryClient = useQueryClient();
  const [now] = useState(() => Date.now());
  const mutation = useMutation({
    ...updateCaseTaskStatusMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: listCaseTasksQueryKey({ path: { case_id: caseId } }),
      });
    },
  });
  const mayUpdate = canManage || task.assigned_to === currentUserId;
  const overdue =
    task.due_at !== null &&
    new Date(task.due_at).getTime() < now &&
    task.status !== "completed" &&
    task.status !== "canceled";
  const setStatus = (status: TaskStatus) =>
    mutation.mutate({
      path: { case_id: caseId, task_id: task.id },
      body: { status },
    });

  return (
    <li className={styles.task}>
      <div className={styles.taskHead}>
        <div>
          <h3>{task.title}</h3>
          <p>{task.assignee_name}</p>
        </div>
        <div className={styles.badges}>
          <StatusBadge
            tone={
              task.status === "completed"
                ? "ok"
                : overdue
                  ? "error"
                  : task.status === "in_progress"
                    ? "pending"
                    : "muted"
            }
          >
            {overdue ? "Vencida" : STATUS_LABELS[task.status]}
          </StatusBadge>
          <span data-priority={task.priority}>
            Prioridad {PRIORITY_LABELS[task.priority].toLowerCase()}
          </span>
        </div>
      </div>
      {task.description && (
        <p className={styles.description}>{task.description}</p>
      )}
      <dl className={styles.meta}>
        <div>
          <dt>Fecha límite</dt>
          <dd>
            {task.due_at ? (
              <time dateTime={task.due_at}>
                {formatColombiaTime(task.due_at)}
              </time>
            ) : (
              "Sin fecha límite"
            )}
          </dd>
        </div>
        <div>
          <dt>Último cambio</dt>
          <dd>
            <time dateTime={task.updated_at}>
              {formatColombiaTime(task.updated_at)}
            </time>
          </dd>
        </div>
      </dl>
      {caseOpen && mayUpdate && (
        <div className={styles.actions}>
          {task.status !== "in_progress" && task.status !== "completed" && (
            <Button
              variant="secondary"
              size="sm"
              busy={mutation.isPending}
              onClick={() => setStatus("in_progress")}
            >
              Iniciar
            </Button>
          )}
          {task.status !== "completed" && task.status !== "canceled" && (
            <Button
              size="sm"
              busy={mutation.isPending}
              onClick={() => setStatus("completed")}
            >
              Completar
            </Button>
          )}
          {task.status === "completed" && (
            <Button
              variant="secondary"
              size="sm"
              busy={mutation.isPending}
              onClick={() => setStatus("pending")}
            >
              Reabrir tarea
            </Button>
          )}
          {canManage && task.status !== "canceled" && (
            <Button
              variant="secondary"
              size="sm"
              busy={mutation.isPending}
              onClick={() => setStatus("canceled")}
            >
              Cancelar tarea
            </Button>
          )}
        </div>
      )}
      {mutation.error && (
        <Notice tone="error">
          {apiProblem(mutation.error).detail ??
            "No pudimos actualizar la tarea."}
        </Notice>
      )}
    </li>
  );
}
