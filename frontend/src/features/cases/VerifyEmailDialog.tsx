import { Button } from "../../components/ui/Button.tsx";
import { Dialog } from "../../components/ui/Dialog.tsx";
import { ResendVerification } from "../auth/ResendVerification.tsx";
import { CASE_MESSAGES } from "./messages.ts";
import { CorreoIcon } from "../../components/ui/icons.tsx";

type VerifyEmailDialogProps = {
  open: boolean;
  onClose: () => void;
};

// Con el correo sin verificar, «Abrir caso» no se oculta: abre este aviso, que explica por qué
// todavía no puede abrir casos y ofrece reenviar el enlace (especificación, 5.2).
export function VerifyEmailDialog({ open, onClose }: VerifyEmailDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Verifique su correo"
      icon={<CorreoIcon size={22} />}
      actions={
        <Button
          surface="dark"
          variant="secondary"
          size="sm"
          shape="pill"
          onClick={onClose}
        >
          Cerrar
        </Button>
      }
    >
      <p>{`${CASE_MESSAGES.emailNotVerified}.`}</p>
      <ResendVerification />
    </Dialog>
  );
}
