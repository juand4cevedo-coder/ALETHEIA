import type { ReactNode, Ref } from "react";

import { useDismissible } from "../../features/workspace/dismissedNotices.ts";
import styles from "./Notice.module.css";
import {
  AdvertenciaIcon,
  CerrarIcon,
  CirculoAlertaIcon,
  CirculoVistoIcon,
  InfoIcon,
  type IconComponent,
} from "./icons.tsx";

type Tone = "info" | "success" | "warning" | "error";

const ICONS: Record<Tone, IconComponent> = {
  info: InfoIcon,
  success: CirculoVistoIcon,
  warning: AdvertenciaIcon,
  error: CirculoAlertaIcon,
};

type NoticeProps = {
  tone: Tone;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
  /** Nombre estable del aviso. Con él, la persona puede cerrarlo y no vuelve a verlo en este
   * navegador. Solo para avisos informativos: un error o una advertencia que pide actuar no se
   * cierra. */
  dismissId?: string;
};

// Aviso en línea (CMP-UI-010). Los errores usan role alert y se anuncian de inmediato; lo demás
// usa role status, que el lector de pantalla lee sin interrumpir. El icono acompaña al texto,
// nunca lo reemplaza.
export function Notice({ tone, children, ref, dismissId }: NoticeProps) {
  const Icon = ICONS[tone];
  const { visible, dismiss } = useDismissible(dismissId);
  if (!visible) return null;
  return (
    <div
      ref={ref}
      className={styles.notice}
      data-tone={tone}
      role={tone === "error" ? "alert" : "status"}
      tabIndex={tone === "error" ? -1 : undefined}
    >
      <Icon size={16} aria-hidden="true" />
      <div className={styles.content}>{children}</div>
      {dismissId && (
        <button
          type="button"
          className={styles.dismiss}
          aria-label="Cerrar este aviso"
          title="Cerrar este aviso"
          onClick={dismiss}
        >
          <CerrarIcon size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
