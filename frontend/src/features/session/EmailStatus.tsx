import styles from "./EmailStatus.module.css";
import {
  CirculoAlertaIcon,
  CirculoVistoIcon,
} from "../../components/ui/icons.tsx";

// Estado del correo de la cuenta, en el inicio y en Mi cuenta. Va en grafito: el verde queda
// solo para la evidencia que el sistema comprobó, y un correo confirmado no es eso. Sin
// verificar, el ícono va en ámbar porque hasta entonces no se pueden abrir casos.
export function EmailStatus({ verified }: { verified: boolean }) {
  return verified ? (
    <span className={styles.badge}>
      <CirculoVistoIcon size={16} aria-hidden="true" />
      Verificado
    </span>
  ) : (
    <span className={styles.badge} data-pending="">
      <CirculoAlertaIcon size={16} aria-hidden="true" />
      Sin verificar
    </span>
  );
}
