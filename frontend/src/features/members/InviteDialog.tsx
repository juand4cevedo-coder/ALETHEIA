import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useId, useRef, useState } from "react";

import type { InvitationOut } from "../../api/generated";
import { createInvitationMutation } from "../../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../../components/ui/Button.tsx";
import { Dialog } from "../../components/ui/Dialog.tsx";
import { Field } from "../../components/ui/Field.tsx";
import { Notice } from "../../components/ui/Notice.tsx";
import { Select } from "../../components/ui/Select.tsx";
import { SystemError } from "../../components/ui/SystemError.tsx";
import { MESSAGES } from "../../content/messages.ts";
import { apiProblem } from "../auth/apiProblem.ts";
import {
  EMAIL_MAX_LENGTH,
  EMAIL_PATTERN,
  SIGN_UP_MESSAGES,
} from "../auth/signUp.ts";
import { INVITABLE_ROLES, type InvitableRole } from "../workspace/roles.ts";
import styles from "./InviteDialog.module.css";
import { isEmailConflict } from "./messages.ts";
import { CorreoIcon } from "../../components/ui/icons.tsx";

type Props = {
  open: boolean;
  onClose: () => void;
  onInvited: (invitation: InvitationOut) => void;
};

type Failure =
  { kind: "message"; text: string } | { kind: "system"; requestId?: string };

const DEFAULT_ROLE: InvitableRole = "lawyer";

// Invitar a una persona (UI-021, HU-011): el correo y el rol con lo que ese rol permite, para
// que quien invita elija con conocimiento. Los errores del correo van junto al campo; el cupo
// lleno y las fallas del sistema, en un aviso.
export function InviteDialog({ open, onClose, onInvited }: Props) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitableRole>(DEFAULT_ROLE);
  const [emailError, setEmailError] = useState<string | undefined>();
  const [failure, setFailure] = useState<Failure | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const formId = useId();
  const roleHintId = useId();

  const invite = useMutation({
    ...createInvitationMutation(),
    onSuccess: (invitation) => {
      reset();
      onInvited(invitation);
    },
    onError: (error) => {
      const { status, detail, requestId } = apiProblem(error);
      if (status === 409 && isEmailConflict(detail)) {
        setEmailError(detail);
        emailRef.current?.focus();
        return;
      }
      if (status === 422) {
        setEmailError(SIGN_UP_MESSAGES.email);
        emailRef.current?.focus();
        return;
      }
      if (status === 429) {
        setFailure({ kind: "message", text: MESSAGES.tooManyAttempts });
        return;
      }
      if ((status === 409 || status === 403) && detail) {
        setFailure({ kind: "message", text: detail });
        return;
      }
      setFailure({ kind: "system", requestId });
    },
  });

  function reset() {
    setEmail("");
    setRole(DEFAULT_ROLE);
    setEmailError(undefined);
    setFailure(null);
  }

  function close() {
    if (invite.isPending) return;
    reset();
    onClose();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (invite.isPending) return;
    setFailure(null);
    const value = email.trim();
    if (value.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(value)) {
      setEmailError(SIGN_UP_MESSAGES.email);
      emailRef.current?.focus();
      return;
    }
    setEmailError(undefined);
    invite.mutate({ body: { email: value, role } });
  }

  const selected = INVITABLE_ROLES.find((option) => option.value === role);

  return (
    <Dialog
      open={open}
      onClose={close}
      busy={invite.isPending}
      title="Invitar a una persona"
      icon={<CorreoIcon size={22} />}
      actions={
        <>
          <Button
            surface="dark"
            variant="secondary"
            size="sm"
            shape="pill"
            onClick={close}
            disabled={invite.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="bright"
            size="sm"
            shape="pill"
            busy={invite.isPending}
          >
            {invite.isPending ? "Enviando…" : "Enviar invitación"}
          </Button>
        </>
      }
    >
      <p>
        Le enviaremos un correo con un enlace para unirse a su organización. La
        invitación vence en 72 horas y sirve una sola vez.
      </p>
      <form id={formId} noValidate onSubmit={handleSubmit}>
        <fieldset className={styles.fields}>
          <legend className="visually-hidden">Datos de la invitación</legend>
          <Field
            ref={emailRef}
            label="Correo electrónico"
            name="correo"
            type="email"
            autoComplete="off"
            inputMode="email"
            spellCheck={false}
            required
            maxLength={EMAIL_MAX_LENGTH}
            value={email}
            error={emailError}
            data-autofocus
            onChange={(event) => {
              setEmail(event.target.value);
              if (emailError) setEmailError(undefined);
            }}
          />
          <Select
            label="Rol"
            name="rol"
            value={role}
            options={INVITABLE_ROLES}
            describedBy={roleHintId}
            onChange={(event) => setRole(event.target.value as InvitableRole)}
          >
            <p id={roleHintId} className={styles.hint}>
              {selected?.description}
            </p>
          </Select>
        </fieldset>
      </form>
      {failure && (
        <Notice tone="error">
          {failure.kind === "message" ? (
            <p>{failure.text}</p>
          ) : (
            <SystemError requestId={failure.requestId} />
          )}
        </Notice>
      )}
    </Dialog>
  );
}
