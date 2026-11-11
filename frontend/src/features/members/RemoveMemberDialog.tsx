import type { MemberOut } from "../../api/generated";
import { Button } from "../../components/ui/Button.tsx";
import { Dialog } from "../../components/ui/Dialog.tsx";
import { Notice } from "../../components/ui/Notice.tsx";
import { UsuarioQuitarIcon } from "../../components/ui/icons.tsx";

type Props = {
  member: MemberOut | null;
  onClose: () => void;
  onConfirm: (member: MemberOut) => void;
  busy: boolean;
  /** Texto de la API si no se pudo retirar, o true si fue una falla del sistema. */
  failure: string | boolean;
};

// Confirmación antes de retirar a un miembro (UI-021, FLU-004): dice a quién y qué pierde.
// El foco empieza en Cancelar, que es lo seguro.
export function RemoveMemberDialog({
  member,
  onClose,
  onConfirm,
  busy,
  failure,
}: Props) {
  return (
    <Dialog
      open={member !== null}
      onClose={onClose}
      busy={busy}
      title="¿Retirar a esta persona?"
      icon={<UsuarioQuitarIcon size={22} />}
      actions={
        <>
          <Button
            variant="secondary"
            size="sm"
            data-autofocus
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            busy={busy}
            onClick={() => member && onConfirm(member)}
          >
            {busy ? "Retirando a la persona" : "Retirar de la organización"}
          </Button>
        </>
      }
    >
      <p>
        <strong translate="no">{member?.full_name}</strong> perderá el acceso a
        la organización y a sus casos. Sus sesiones se cierran en este momento.
      </p>
      <p>
        Su cuenta sigue existiendo y lo que hizo queda en la cadena de custodia.
        El cupo queda libre, y puede invitarla de nuevo si cambia de opinión.
      </p>
      {failure && (
        <Notice tone="error">
          {typeof failure === "string"
            ? failure
            : "No pudimos retirar a la persona. Revise su conexión e inténtelo de nuevo."}
        </Notice>
      )}
    </Dialog>
  );
}
