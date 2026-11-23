import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Navigate, useOutletContext } from "react-router";

import type { Me, TaskTemplateItemIn, TaskTemplateOut } from "../api/generated";
import {
  createTaskTemplateMutation,
  deleteTaskTemplateMutation,
  listTaskTemplatesOptions,
  listTaskTemplatesQueryKey,
} from "../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../components/ui/Button.tsx";
import { EmptyState } from "../components/ui/EmptyState.tsx";
import { Field } from "../components/ui/Field.tsx";
import { MasIcon } from "../components/ui/icons.tsx";
import { Notice } from "../components/ui/Notice.tsx";
import { PageHeader } from "../components/ui/PageHeader.tsx";
import { Panel } from "../components/ui/Panel.tsx";
import { Select } from "../components/ui/Select.tsx";
import { ROUTES } from "../config/routes.ts";
import { pageTitle } from "../config/site.ts";
import { apiProblem } from "../features/auth/apiProblem.ts";
import { managesTasks } from "../features/workspace/roles.ts";
import styles from "./TaskTemplatesPage.module.css";

const PRIORITY_LABELS: Record<TaskTemplateItemIn["priority"] & string, string> =
  {
    low: "Baja",
    normal: "Normal",
    high: "Alta",
    urgent: "Urgente",
  };

const PRIORITY_OPTIONS = Object.entries(PRIORITY_LABELS).map(
  ([value, label]) => ({ value, label }),
);

const DUE_OPTIONS = [
  { value: "", label: "Sin plazo" },
  { value: "0", label: "El mismo día" },
  ...[1, 2, 3, 5, 7, 10, 15, 20, 30, 45, 60, 90].map((days) => ({
    value: String(days),
    label: days === 1 ? "1 día después" : `${days} días después`,
  })),
];

type Draft = { title: string; priority: string; dueDays: string };

const emptyDraft = (): Draft => ({
  title: "",
  priority: "normal",
  dueDays: "",
});

function dueLabel(days: number | null | undefined): string {
  if (days == null) return "Sin plazo";
  if (days === 0) return "El mismo día";
  return days === 1 ? "1 día después" : `${days} días después`;
}

// Plantillas de tareas: listas que el despacho repite en sus casos. Se crean y se borran aquí;
// se aplican desde un caso, donde cada tarea queda con su responsable y su plazo.
export function TaskTemplatesPage() {
  const me = useOutletContext<Me>();
  const templates = useQuery({
    ...listTaskTemplatesOptions(),
    enabled: managesTasks(me.organization?.role),
  });

  if (!managesTasks(me.organization?.role)) {
    return <Navigate to={ROUTES.app} replace />;
  }

  const items = templates.data?.items;

  return (
    <div className={styles.page}>
      <title>{pageTitle("Plantillas de tareas")}</title>
      <meta name="robots" content="noindex" />
      <PageHeader
        title="Plantillas de tareas"
        description="Listas de tareas que su despacho repite en sus casos. Aplíquelas desde un caso para abrirlo con su trabajo inicial."
      />
      <NewTemplate />
      <Panel title="Sus plantillas">
        {templates.isPending && <p role="status">Cargando las plantillas</p>}
        {templates.isError && (
          <Notice tone="error">
            <p>No pudimos consultar las plantillas.</p>
          </Notice>
        )}
        {Array.isArray(items) && items.length === 0 && (
          <EmptyState
            title="Todavía no hay plantillas"
            description="Cree la primera con las tareas que repite en un tipo de proceso."
          />
        )}
        {Array.isArray(items) && items.length > 0 && (
          <ul className={styles.list}>
            {items.map((template) => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function TemplateCard({ template }: { template: TaskTemplateOut }) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    ...deleteTaskTemplateMutation(),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: listTaskTemplatesQueryKey() }),
  });
  return (
    <li className={styles.card}>
      <header>
        <h3>{template.name}</h3>
        <Button
          variant="secondary"
          size="sm"
          busy={remove.isPending}
          onClick={() => {
            if (
              window.confirm(
                `¿Borrar la plantilla «${template.name}»? Las tareas ya creadas con ella no se tocan.`,
              )
            ) {
              remove.mutate({ path: { template_id: template.id } });
            }
          }}
        >
          Borrar
        </Button>
      </header>
      <ol>
        {template.items.map((item, position) => (
          <li key={position}>
            <strong>{item.title}</strong>
            <span>
              {PRIORITY_LABELS[item.priority]}, {dueLabel(item.due_days)}
            </span>
          </li>
        ))}
      </ol>
    </li>
  );
}

function NewTemplate() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([emptyDraft()]);
  const [error, setError] = useState<string>();

  const create = useMutation({
    ...createTaskTemplateMutation(),
    onSuccess: async () => {
      setName("");
      setDrafts([emptyDraft()]);
      setError(undefined);
      await queryClient.invalidateQueries({
        queryKey: listTaskTemplatesQueryKey(),
      });
    },
    onError: (failure) => {
      const problem = apiProblem(failure);
      setError(
        problem.status === 409
          ? "Ya tiene una plantilla con ese nombre."
          : "No pudimos guardar la plantilla. Revise los datos.",
      );
    },
  });

  function update(position: number, change: Partial<Draft>) {
    setDrafts((current) =>
      current.map((draft, index) =>
        index === position ? { ...draft, ...change } : draft,
      ),
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const filled = drafts.filter((draft) => draft.title.trim() !== "");
    if (!name.trim() || filled.length === 0) {
      setError("Escriba el nombre y al menos una tarea.");
      return;
    }
    create.mutate({
      body: {
        name: name.trim(),
        items: filled.map((draft) => ({
          title: draft.title.trim(),
          priority: draft.priority as TaskTemplateItemIn["priority"],
          due_days: draft.dueDays === "" ? null : Number(draft.dueDays),
        })),
      },
    });
  }

  return (
    <Panel title="Nueva plantilla">
      <form className={styles.form} onSubmit={submit}>
        <Field
          label="Nombre de la plantilla"
          value={name}
          maxLength={120}
          onChange={(event) => setName(event.target.value)}
          help="Por ejemplo, el tipo de proceso: «Proceso laboral»."
        />
        <ol className={styles.drafts} aria-label="Tareas de la plantilla">
          {drafts.map((draft, position) => (
            <li key={position} className={styles.draft}>
              <Field
                label={`Tarea ${position + 1}`}
                value={draft.title}
                maxLength={160}
                onChange={(event) =>
                  update(position, { title: event.target.value })
                }
              />
              <Select
                label="Prioridad"
                value={draft.priority}
                options={PRIORITY_OPTIONS}
                onChange={(event) =>
                  update(position, { priority: event.target.value })
                }
              />
              <Select
                label="Plazo"
                value={draft.dueDays}
                options={DUE_OPTIONS}
                onChange={(event) =>
                  update(position, { dueDays: event.target.value })
                }
              />
              {drafts.length > 1 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setDrafts((current) =>
                      current.filter((_, index) => index !== position),
                    )
                  }
                >
                  Quitar
                </Button>
              )}
            </li>
          ))}
        </ol>
        <div className={styles.actions}>
          <Button
            variant="secondary"
            size="sm"
            disabled={drafts.length >= 30}
            onClick={() => setDrafts((current) => [...current, emptyDraft()])}
          >
            <MasIcon size={16} aria-hidden="true" /> Agregar tarea
          </Button>
          <Button type="submit" busy={create.isPending}>
            Guardar plantilla
          </Button>
        </div>
        {error && (
          <Notice tone="error">
            <p role="alert">{error}</p>
          </Notice>
        )}
      </form>
    </Panel>
  );
}
