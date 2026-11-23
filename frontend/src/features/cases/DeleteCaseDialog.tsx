import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";

import type { CaseDetail } from "../../api/generated";
import {
  listCasesQueryKey,
  requestCaseDeletionMutation,
} from "../../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../../components/ui/Button.tsx";
import { Dialog } from "../../components/ui/Dialog.tsx";
import { Field } from "../../components/ui/Field.tsx";
import { Notice } from "../../components/ui/Notice.tsx";
import { BalanzaIcon } from "../../components/ui/icons.tsx";
import { ROUTES } from "../../config/routes.ts";
import { apiProblem } from "../auth/apiProblem.ts";
import { formatColombiaTime } from "./dates.ts";

// Eliminar de forma definitiva un caso cerrado (SEQ-004). Solo dueños y administradores. No se
// puede deshacer: la llave del caso se destruye al confirmar, así que el diálogo exige escribir
// el título exacto y explica qué se pierde y qué se conserva.
export function DeleteCaseDialog({ detail }: { detail: CaseDetail }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [now] = useState(() => Date.now());
  const retentionPending =
    detail.retention_until !== null &&
    new Date(detail.retention_until).getTime() > now;
  const blocked = detail.legal_hold
    ? "Tiene un bloqueo jurídico vigente. Levántelo en «Gestionar conservación» para poder eliminarlo."
    : retentionPending
      ? `Podrá eliminarse desde el ${formatColombiaTime(detail.retention_until!)}, cuando termine su plazo de conservación.`
      : null;

  const request = useMutation({
    ...requestCaseDeletionMutation(),
    onSuccess: async () => {
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: listCasesQueryKey() });
      void navigate(ROUTES.cases, { replace: true });
    },
  });
  const matches = confirmation.trim() === detail.title;

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        disabled={blocked !== null}
        aria-describedby={blocked ? "delete-case-blocked" : undefined}
        onClick={() => {
          setConfirmation("");
          request.reset();
          setOpen(true);
        }}
      >
        Eliminar definitivamente
      </Button>
      {blocked && (
        <span id="delete-case-blocked" role="note">
          {blocked}
        </span>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Eliminar el caso de forma definitiva"
        icon={<BalanzaIcon size={24} />}
        busy={request.isPending}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              data-autofocus
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              busy={request.isPending}
              disabled={!matches}
              onClick={() =>
                request.mutate({
                  path: { case_id: detail.id },
                  body: { confirmation: confirmation.trim() },
                })
              }
            >
              Eliminar para siempre
            </Button>
          </>
        }
      >
        <p>
          Esto no se puede deshacer. Al confirmar, la llave de cifrado del caso
          se destruye en el acto: su contenido deja de poder recuperarse, aunque
          algo falle después.
        </p>
        <p>
          Se eliminan las evidencias, la cadena de custodia, las notas, las
          tareas y todo lo compartido con el cliente. Quedan una constancia
          permanente, con las huellas SHA-256 y sin nombres de archivo ni
          contenido, y las copias de respaldo, cifradas y sin llave, que se
          descartan a los 7 días. Le enviaremos la constancia por correo.
        </p>
        <Field
          label={`Para confirmar, escriba el título del caso: ${detail.title}`}
          autoComplete="off"
          spellCheck={false}
          value={confirmation}
          disabled={request.isPending}
          onChange={(event) => setConfirmation(event.target.value)}
        />
        {request.error && (
          <Notice tone="error">
            <p role="alert">
              {apiProblem(request.error).detail ??
                "No pudimos pedir la eliminación. Inténtelo de nuevo."}
            </p>
          </Notice>
        )}
      </Dialog>
    </>
  );
}
