import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";

import type { MemberOut } from "../../api/generated";
import { changeMemberRoleMutation } from "../../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../../components/ui/Button.tsx";
import { Dialog } from "../../components/ui/Dialog.tsx";
import { Notice } from "../../components/ui/Notice.tsx";
import { Select } from "../../components/ui/Select.tsx";
import { SystemError } from "../../components/ui/SystemError.tsx";
import { apiProblem } from "../auth/apiProblem.ts";
import { INVITABLE_ROLES, type InvitableRole } from "../workspace/roles.ts";
import styles from "./InviteDialog.module.css";
import { UsuarioAjustesIcon } from "../../components/ui/icons.tsx";

type Props = {
  member: MemberOut | null;
  onClose: () => void;
  /** La persona ya tiene el rol nuevo, o ya no estaba en la organización. */
  onChanged: () => void;
};

type Failure =
  { kind: "message"; text: string } | { kind: "system"; requestId?: string };

// Cambiar el rol de un miembro (UI-021, HU-013): los roles con lo que permite cada uno, como al
// invitar. El cambio vale desde la siguiente petición de esa persona. La página monta este
// diálogo con key por miembro, así que cada vez empieza con el rol que la persona tiene hoy.
export function ChangeRoleDialog({ member, onClose, onChanged }: Props) {
  const [role, setRole] = useState<InvitableRole | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const formId = useId();
  const hintId = useId();

  const change = useMutation({
    ...changeMemberRoleMutation(),
    onSuccess: () => onChanged(),
    onError: (error) => {
      const { status, detail, requestId } = apiProblem(error);
      if (status === 404) {
        // Ya no es miembro: la lista lo dirá.
        onChanged();
        return;
      }
      if (status === 403 && detail) {
        setFailure({ kind: "message", text: detail });
        return;
      }
      setFailure({ kind: "system", requestId });
    },
  });

  const current: InvitableRole | null =
    member && member.role !== "owner" ? member.role : null;
  const chosen = role ?? current ?? "lawyer";
  const selected = INVITABLE_ROLES.find((option) => option.value === chosen);

  function close() {
    if (change.isPending) return;
    onClose();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!member || change.isPending) return;
    setFailure(null);
    if (chosen === current) {
      onClose();
      return;
    }
    change.mutate({
      path: { user_id: member.user_id },
      body: { role: chosen },
    });
  }

  return (
    <Dialog
      open={member !== null}
      onClose={close}
      busy={change.isPending}
      title="Cambiar el rol"
      icon={<UsuarioAjustesIcon size={22} />}
      actions={
        <>
          <Button
            variant="secondary"
            size="sm"
            onClick={close}
            disabled={change.isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" form={formId} size="sm" busy={change.isPending}>
            {change.isPending ? "Guardando…" : "Guardar el rol"}
          </Button>
        </>
      }
    >
      <p>
        El nuevo rol de <strong translate="no">{member?.full_name}</strong> rige
        desde su próxima petición, sin que tenga que volver a ingresar.
      </p>
      <form id={formId} noValidate onSubmit={handleSubmit}>
        <fieldset className={styles.fields}>
          <legend className="visually-hidden">Rol de la persona</legend>
          <Select
            label="Rol"
            name="rol"
            value={chosen}
            options={INVITABLE_ROLES}
            describedBy={hintId}
            data-autofocus
            onChange={(event) => setRole(event.target.value as InvitableRole)}
          >
            <p id={hintId} className={styles.hint}>
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
