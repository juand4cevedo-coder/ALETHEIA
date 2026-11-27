import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";

import {
  createCaseNoteMutation,
  listCaseNotesInfiniteOptions,
  listCaseNotesQueryKey,
} from "../../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../../components/ui/Button.tsx";
import { Field } from "../../components/ui/Field.tsx";
import { IconTile } from "../../components/ui/IconTile.tsx";
import { LibroIcon } from "../../components/ui/icons.tsx";
import { Notice } from "../../components/ui/Notice.tsx";
import { apiProblem } from "../auth/apiProblem.ts";
import { formatColombiaTime } from "./dates.ts";
import styles from "./NotesSection.module.css";

const MAX_LENGTH = 4000;

// Notas internas del caso: texto de trabajo de quien lo lleva, fuera de la cadena de custodia.
// Solo se agregan: no se editan ni se borran, así que una corrección es una nota nueva y la
// historia queda completa.
export function NotesSection({
  caseId,
  caseOpen,
}: {
  caseId: string;
  caseOpen: boolean;
}) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const countId = useId();
  const query = { limit: 20 };
  const listing = useInfiniteQuery({
    ...listCaseNotesInfiniteOptions({ path: { case_id: caseId }, query }),
    initialPageParam: { path: { case_id: caseId }, query },
    getNextPageParam: (lastPage) => lastPage.next_cursor,
  });
  const notes = listing.data?.pages.flatMap((page) => page.items) ?? [];

  const create = useMutation({
    ...createCaseNoteMutation(),
    onSuccess: async () => {
      setBody("");
      setError("");
      await queryClient.invalidateQueries({
        queryKey: listCaseNotesQueryKey({ path: { case_id: caseId } }),
      });
    },
    onError: (failure) => {
      const problem = apiProblem(failure);
      setError(
        problem.status === 409
          ? "Un caso archivado conserva sus notas, pero no admite nuevas."
          : "No pudimos guardar la nota. Inténtelo de nuevo.",
      );
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = body.trim();
    if (!text || create.isPending) return;
    create.mutate({ path: { case_id: caseId }, body: { body: text } });
  }

  return (
    <section aria-labelledby="case-notes-title" className={styles.section}>
      <div className={styles.heading}>
        <h2 id="case-notes-title">Notas del caso</h2>
        <p>
          Apuntes internos del equipo. No forman parte de la cadena de custodia,
          no se editan ni se borran: si algo cambia, agregue una nota nueva.
        </p>
      </div>

      {caseOpen ? (
        <form className={styles.form} onSubmit={submit}>
          <Field
            label="Nueva nota"
            multiline
            rows={4}
            value={body}
            maxLength={MAX_LENGTH}
            describedBy={countId}
            disabled={create.isPending}
            onChange={(event) => setBody(event.target.value)}
          >
            <span id={countId} className={styles.count}>
              {body.length} de {MAX_LENGTH}
            </span>
          </Field>
          <Button
            type="submit"
            busy={create.isPending}
            disabled={body.trim() === ""}
          >
            Agregar nota
          </Button>
        </form>
      ) : (
        <Notice tone="info" dismissId="caso-archivado-notas">
          <p>El caso está archivado: sus notas se conservan en consulta.</p>
        </Notice>
      )}
      {error && (
        <Notice tone="error">
          <p role="alert">{error}</p>
        </Notice>
      )}

      {listing.isPending && <p role="status">Cargando notas</p>}
      {listing.isError && (
        <Notice tone="error">
          <p>No pudimos consultar las notas de este caso.</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void listing.refetch()}
          >
            Intentar de nuevo
          </Button>
        </Notice>
      )}
      {listing.isSuccess && notes.length === 0 && (
        <div className={styles.empty}>
          <IconTile icon={LibroIcon} size="lg" />
          <p>
            <strong>Todavía no hay notas.</strong>
            <span>
              Use este espacio para dejar contexto que no cabe en una tarea:
              acuerdos con el cliente, pendientes, dudas para la audiencia.
            </span>
          </p>
        </div>
      )}
      {notes.length > 0 && (
        <ol className={styles.list} aria-label="Notas del caso">
          {notes.map((note) => (
            <li key={note.id} className={styles.note}>
              <header>
                <strong>{note.author_name}</strong>
                <time dateTime={note.created_at}>
                  {formatColombiaTime(note.created_at)}
                </time>
              </header>
              <p>{note.body}</p>
            </li>
          ))}
        </ol>
      )}
      {listing.hasNextPage && (
        <Button
          variant="secondary"
          busy={listing.isFetchingNextPage}
          onClick={() => void listing.fetchNextPage()}
        >
          Cargar más notas
        </Button>
      )}
    </section>
  );
}
