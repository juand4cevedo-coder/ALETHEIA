import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary";

export type ButtonStyleOptions = {
  variant?: ButtonVariant;
  /** Fondo sobre el que va el botón: la banda oscura del sitio público o una superficie clara. */
  surface?: "light" | "dark";
  size?: "md" | "sm";
};

/** Clases del botón (CMP-UI-001), para un <button> o para un enlace que se ve como botón. */
export function buttonClassName({
  variant = "primary",
  surface = "light",
  size = "md",
}: ButtonStyleOptions = {}): string {
  return [
    styles.button,
    styles[variant],
    surface === "dark" ? styles.dark : "",
    size === "sm" ? styles.sm : "",
  ]
    .filter(Boolean)
    .join(" ");
}
