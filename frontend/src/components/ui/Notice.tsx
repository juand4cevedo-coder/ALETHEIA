import {
  CircleAlert,
  CircleCheck,
  Info,
  type LucideIcon,
  TriangleAlert,
} from "lucide-react";
import type { ReactNode, Ref } from "react";

import styles from "./Notice.module.css";

type Tone = "info" | "success" | "warning" | "error";

const ICONS: Record<Tone, LucideIcon> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleAlert,
};

type NoticeProps = {
  tone: Tone;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
};

// Aviso en línea (CMP-UI-010). Los errores usan role alert y se anuncian de inmediato; lo demás
// usa role status, que el lector de pantalla lee sin interrumpir. El icono acompaña al texto,
// nunca lo reemplaza.
export function Notice({ tone, children, ref }: NoticeProps) {
  const Icon = ICONS[tone];
  return (
    <div
      ref={ref}
      className={styles.notice}
      data-tone={tone}
      role={tone === "error" ? "alert" : "status"}
      tabIndex={tone === "error" ? -1 : undefined}
    >
      <Icon size={18} aria-hidden="true" />
      <div className={styles.content}>{children}</div>
    </div>
  );
}
