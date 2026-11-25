import { CirculoVistoIcon, CargandoIcon } from "../../components/ui/icons.tsx";
import type { CaptchaStatus } from "./useCaptcha.ts";
import styles from "./CaptchaNotice.module.css";

// Estado de la verificación de persona bajo el botón del formulario. No pide nada a la persona:
// solo cuenta que el navegador está comprobando, en una línea discreta que se anuncia una vez.
export function CaptchaNotice({
  status,
  onRetry,
}: {
  status: CaptchaStatus;
  onRetry: () => void;
}) {
  return (
    <p className={styles.notice} data-status={status} role="status">
      {status === "solving" && (
        <>
          <CargandoIcon size={14} aria-hidden="true" className={styles.spin} />
          Comprobando en su navegador que es una persona
        </>
      )}
      {status === "ready" && (
        <>
          <CirculoVistoIcon size={14} aria-hidden="true" />
          Verificación lista. Sin cookies ni servicios externos.
        </>
      )}
      {status === "failed" && (
        <>
          No pudimos hacer la verificación.{" "}
          <button type="button" className={styles.retry} onClick={onRetry}>
            Intentar de nuevo
          </button>
        </>
      )}
    </p>
  );
}
