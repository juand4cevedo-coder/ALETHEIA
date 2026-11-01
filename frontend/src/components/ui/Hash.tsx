import { useEffect, useState } from "react";

import styles from "./Hash.module.css";

type HashProps = {
  /** Huella SHA-256 en hexadecimal: 64 caracteres. */
  value: string;
  /** Completa en el detalle y el verificador; abreviada en tablas. */
  variant?: "full" | "short";
  /** Muestra el botón para copiar la huella. */
  copyable?: boolean;
};

type CopyState = "idle" | "copied" | "failed";

// Cuánto tiempo se muestra la confirmación de copiado.
const FEEDBACK_MS = 2000;

/** Parte la huella en bloques de 8 caracteres para leerla y compararla con facilidad. */
function hashBlocks(value: string): string[] {
  return value.toLowerCase().match(/.{1,8}/g) ?? [];
}

// Huella SHA-256 (CMP-UI-007): monoespaciada, en minúsculas y en bloques de 8.
export function Hash({ value, variant = "full", copyable = true }: HashProps) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const normalized = value.toLowerCase();
  const blocks = hashBlocks(normalized);

  useEffect(() => {
    if (copyState === "idle") return;
    const timer = window.setTimeout(() => setCopyState("idle"), FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  async function copy() {
    try {
      // Se copian los 64 caracteres seguidos, sin los espacios de los bloques.
      await navigator.clipboard.writeText(normalized);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <span className={styles.hash}>
      {variant === "full" ? (
        <code className={styles.value}>{blocks.join(" ")}</code>
      ) : (
        <code className={styles.value}>
          <span aria-hidden="true">{`${blocks.slice(0, 2).join(" ")} …`}</span>
          <span className="visually-hidden">{normalized}</span>
        </code>
      )}
      {copyable && (
        <>
          <button
            type="button"
            className={styles.copy}
            onClick={() => void copy()}
          >
            {copyState === "copied" ? "Copiada" : "Copiar huella"}
          </button>
          <span role="status" className="visually-hidden">
            {copyState === "copied" && "Huella copiada."}
            {copyState === "failed" &&
              "No se pudo copiar. Seleccione la huella y cópiela."}
          </span>
        </>
      )}
    </span>
  );
}
