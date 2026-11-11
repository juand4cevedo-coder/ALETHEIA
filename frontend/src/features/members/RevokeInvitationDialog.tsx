import type { InvitationOut } from "../../api/generated";
import { Button } from "../../components/ui/Button.tsx";
import { Dialog } from "../../components/ui/Dialog.tsx";
import { Notice } from "../../components/ui/Notice.tsx";
import { CorreoIcon } from "../../components/ui/icons.tsx";

type Props = {
  invitation: InvitationOut | null;
  onClose: () => void;
  onConfirm: (invitation: InvitationOut) => void;
  busy: boolean;
  failed: boolean;
};

// Confirmación antes de revocar una invitación (UI-021, FLU-003 A2): dice a quién y qué pasa
// con su enlace. El foco empieza en Cancelar, que es lo seguro.
export function RevokeInvitationDialog({
  invitation,
  onClose,
  onConfirm,
  busy,
  failed,
}: Props) {
  return (
    <Dialog
      open={invitation !== null}
      onClose={onClose}
      busy={busy}
      title="¿Revocar la invitación?"
      icon={<CorreoIcon size={22} />}
      actions={
        <>
          <Button
            surface="dark"
            variant="secondary"
            size="sm"
            shape="pill"
            data-autofocus
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button
            variant="bright"
            size="sm"
            shape="pill"
            busy={busy}
            onClick={() => invitation && onConfirm(invitation)}
          >
            {busy ? "Revocando…" : "Revocar"}
          </Button>
        </>
      }
    >
      <p>
        El enlace que enviamos a{" "}
        <strong translate="no">{invitation?.email}</strong> dejará de servir y
        el cupo quedará libre. Si cambia de opinión, puede enviar una invitación
        nueva.
      </p>
      {failed && (
        <Notice tone="error">
          No pudimos revocar la invitación. Revise su conexión e inténtelo de
          nuevo.
        </Notice>
      )}
    </Dialog>
  );
}
