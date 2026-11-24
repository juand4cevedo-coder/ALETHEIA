import { LunaIcon, SolIcon } from "../../components/ui/icons.tsx";
import { originOf, setThemePreference, useTheme } from "./theme.ts";
import styles from "./ThemeToggle.module.css";

/** Botón del encabezado: alterna entre claro y oscuro con un toque. */
export function ThemeSwitch({ className }: { className?: string }) {
  const { resolved } = useTheme();
  const next = resolved === "dark" ? "light" : "dark";
  const label =
    next === "dark" ? "Cambiar a modo oscuro" : "Cambiar a modo claro";
  return (
    <button
      type="button"
      className={[styles.switch, className].filter(Boolean).join(" ")}
      aria-label={label}
      title={label}
      data-mode={resolved}
      onClick={(event) =>
        setThemePreference(next, originOf(event.currentTarget))
      }
    >
      <SolIcon size={18} aria-hidden="true" className={styles.sun} />
      <LunaIcon size={18} aria-hidden="true" className={styles.moon} />
    </button>
  );
}
