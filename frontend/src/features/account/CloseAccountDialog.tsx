import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { closeAccountMutation } from "../../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../../components/ui/Button.tsx";
import { Dialog } from "../../components/ui/Dialog.tsx";
import { Field } from "../../components/ui/Field.tsx";
import { Notice } from "../../components/ui/Notice.tsx";
import { SystemError } from "../../components/ui/SystemError.tsx";
import { ROUTES } from "../../config/routes.ts";
import { MESSAGES } from "../../content/messages.ts";
import { apiProblem } from "../auth/apiProblem.ts";
import { forgetSession } from "../session/sessionHint.ts";
import styles from "./CloseAccountDialog.module.css";

const CONFIRMATION = "CERRAR MI CUENTA";

type Props = {
  open: boolean;
  onClose: () => void;
  closesOrganization: boolean;
};

type Failure =
  | { kind: "conflict"; detail: string }
  | { kind: "tooManyAttempts" }
  | { kind: "system"; requestId?: string };

export function CloseAccountDialog({
  open,
  onClose,
  closesOrganization,
}: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmationRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [passwordError, setPasswordError] = useState<string>();
  const [confirmationError, setConfirmationError] = useState<string>();
  const [failure, setFailure] = useState<Failure | null>(null);

  const closure = useMutation({
    ...closeAccountMutation(),
    onSuccess: () => {
      setPassword("");
      setConfirmation("");
      forgetSession();
      queryClient.clear();
      void navigate(`${ROUTES.signIn}?cuenta=cerrada`, { replace: true });
    },
    onError: (error) => {
      const { status, detail, requestId } = apiProblem(error);
      setPassword("");
      if (status === 400) {
        setPasswordError(
          detail ?? "La contraseña no coincide. Revísela e inténtelo de nuevo.",
        );
        passwordRef.current?.focus();
        return;
      }
      setFailure(
        status === 409
          ? {
              kind: "conflict",
              detail:
                detail ??
                "Antes de cerrar la cuenta debe transferir sus responsabilidades.",
            }
          : status === 429
            ? { kind: "tooManyAttempts" }
            : { kind: "system", requestId },
      );
    },
  });

  function close() {
    if (closure.isPending) return;
    setPassword("");
    setConfirmation("");
    setPasswordError(undefined);
    setConfirmationError(undefined);
    setFailure(null);
    closure.reset();
    onClose();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (closure.isPending) return;
    setFailure(null);
    const missingPassword = password
      ? undefined
      : "Escriba su contraseña actual.";
    const invalidConfirmation =
      confirmation === CONFIRMATION
        ? undefined
        : `Escriba exactamente ${CONFIRMATION}.`;
    setPasswordError(missingPassword);
    setConfirmationError(invalidConfirmation);
    if (missingPassword) return passwordRef.current?.focus();
    if (invalidConfirmation) return confirmationRef.current?.focus();
    closure.mutate({ body: { password, confirmation: CONFIRMATION } });
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      busy={closure.isPending}
      title="¿Cerrar definitivamente su cuenta?"
      actions={
        <>
          <Button
            variant="secondary"
            size="sm"
            data-autofocus
            onClick={close}
            disabled={closure.isPending}
          >
            Conservar mi cuenta
          </Button>
          <Button
            size="sm"
            type="submit"
            form="cerrar-cuenta"
            busy={closure.isPending}
          >
            {closure.isPending ? "Cerrando la cuenta" : "Cerrar mi cuenta"}
          </Button>
        </>
      }
    >
      <div className={styles.explanation}>
        <p>
          Se cerrarán todas sus sesiones, se desvinculará Google y sus datos de
          identificación directa se reemplazarán por un seudónimo.
        </p>
        {closesOrganization && (
          <p>
            Como única persona propietaria, también cerrará el despacho y su
            suscripción. Si todavía hay integrantes, primero deberá transferir
            la responsabilidad o retirarlos.
          </p>
        )}
        <p>
          Los casos, evidencias, aceptaciones y registros de auditoría que deban
          conservarse no se borran: permanecen protegidos durante el plazo legal
          o contractual aplicable.
        </p>
      </div>

      {failure && (
        <Notice tone="error">
          {failure.kind === "conflict" ? (
            failure.detail
          ) : failure.kind === "tooManyAttempts" ? (
            MESSAGES.tooManyAttempts
          ) : (
            <SystemError requestId={failure.requestId} />
          )}
        </Notice>
      )}

      <form
        id="cerrar-cuenta"
        className={styles.form}
        noValidate
        onSubmit={submit}
      >
        <Field
          ref={passwordRef}
          label="Confirme su contraseña actual"
          name="contrasena-cierre"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          error={passwordError}
          onChange={(event) => {
            setPassword(event.target.value);
            setPasswordError(undefined);
          }}
        />
        <Field
          ref={confirmationRef}
          label={`Para confirmar, escriba ${CONFIRMATION}`}
          name="confirmacion-cierre"
          type="text"
          autoComplete="off"
          required
          value={confirmation}
          error={confirmationError}
          onChange={(event) => {
            setConfirmation(event.target.value);
            setConfirmationError(undefined);
          }}
        />
      </form>
    </Dialog>
  );
}
