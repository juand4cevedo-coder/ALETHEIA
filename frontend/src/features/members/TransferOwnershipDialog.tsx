import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useId, useRef, useState } from "react";

import type { MemberOut } from "../../api/generated";
import { transferOwnershipMutation } from "../../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../../components/ui/Button.tsx";
import { Dialog } from "../../components/ui/Dialog.tsx";
import { Field } from "../../components/ui/Field.tsx";
import { Notice } from "../../components/ui/Notice.tsx";
import { Select } from "../../components/ui/Select.tsx";
import { SystemError } from "../../components/ui/SystemError.tsx";
import { UsuarioAjustesIcon } from "../../components/ui/icons.tsx";
import { apiProblem } from "../auth/apiProblem.ts";
import styles from "./InviteDialog.module.css";

type Props = {
  member: MemberOut | null;
  onClose: () => void;
  /** El despacho quedó a cargo de la otra persona. */
  onTransferred: () => void;
};

type PreviousRole = "admin" | "lawyer";

const PREVIOUS_ROLES: readonly { value: PreviousRole; label: string }[] = [
  { value: "lawyer", label: "Abogado: sigue abriendo y llevando casos" },
  { value: "admin", label: "Administrador: sigue gestionando al equipo" },
];

type Failure =
  { kind: "message"; text: string } | { kind: "system"; requestId?: string };

// Dejar el despacho a cargo de otro miembro. Es la acción más delicada del despacho: pide la
// contraseña de quien entrega y avisa lo que cambia. Siempre queda exactamente un responsable.
export function TransferOwnershipDialog({
  member,
  onClose,
  onTransferred,
}: Props) {
  const formId = useId();
  const passwordRef = useRef<HTMLInputElement>(null);
  const [previous, setPrevious] = useState<PreviousRole>("lawyer");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string>();
  const [failure, setFailure] = useState<Failure | null>(null);

  const transfer = useMutation({
    ...transferOwnershipMutation(),
    onSuccess: () => {
      setPassword("");
      onTransferred();
    },
    onError: (error) => {
      const { status, detail, requestId } = apiProblem(error);
      if (status === 400) {
        setPasswordError("La contraseña no coincide.");
        passwordRef.current?.focus();
      } else if (status === 403 && detail) {
        setFailure({ kind: "message", text: detail });
      } else if (status === 404) {
        onTransferred();
      } else {
        setFailure({ kind: "system", requestId });
      }
    },
  });

  function close() {
    if (transfer.isPending) return;
    setPassword("");
    setPasswordError(undefined);
    setFailure(null);
    onClose();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!member || transfer.isPending) return;
    setFailure(null);
    if (!password) {
      setPasswordError("Escriba su contraseña para confirmar.");
      passwordRef.current?.focus();
      return;
    }
    transfer.mutate({
      body: {
        user_id: member.user_id,
        previous_owner_role: previous,
        password,
      },
    });
  }

  return (
    <Dialog
      open={member !== null}
      onClose={close}
      busy={transfer.isPending}
      title="Dejar el despacho a cargo de otra persona"
      icon={<UsuarioAjustesIcon size={20} />}
      actions={
        <>
          <Button
            variant="secondary"
            size="sm"
            onClick={close}
            disabled={transfer.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form={formId}
            size="sm"
            busy={transfer.isPending}
          >
            {transfer.isPending
              ? "Entregando el despacho"
              : "Entregar el despacho"}
          </Button>
        </>
      }
    >
      <p>
        <strong translate="no">{member?.full_name}</strong> pasará a ser la
        persona responsable del despacho: administra los datos del despacho, la
        facturación y el equipo. Usted deja de serlo y no podrá deshacerlo por
        su cuenta.
      </p>
      <form id={formId} noValidate onSubmit={submit}>
        <fieldset className={styles.fields}>
          <legend className="visually-hidden">
            Su rol después de entregar
          </legend>
          <Select
            label="Su rol después de entregar"
            name="rol-anterior"
            value={previous}
            options={PREVIOUS_ROLES}
            data-autofocus
            onChange={(event) =>
              setPrevious(event.target.value as PreviousRole)
            }
          />
          <Field
            ref={passwordRef}
            label="Confirme su contraseña actual"
            name="contrasena-traspaso"
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
