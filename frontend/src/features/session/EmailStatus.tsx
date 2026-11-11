import styles from "./EmailStatus.module.css";
import { CirculoVistoIcon, RelojIcon } from "../../components/ui/icons.tsx";

// Estado del correo de la cuenta, en el inicio y en Mi cuenta. Va en grafito en los dos casos:
// el verde, el ámbar y el rojo dicen solo el estado de una evidencia, y un correo no lo es. Por
// la misma razón no dice «Sin verificar», que es el estado de integridad de una cadena.
export function EmailStatus({ verified }: { verified: boolean }) {
  return verified ? (
    <span className={styles.badge}>
      <CirculoVistoIcon size={16} aria-hidden="true" />
      Verificado
    </span>
  ) : (
    <span className={styles.badge}>
      <RelojIcon size={16} aria-hidden="true" />
      Pendiente de verificar
    </span>
  );
}
