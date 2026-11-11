import styles from "./Button.module.css";

/** primary: la acción que se espera, una por vista. secondary: las demás. text: terciarias. */
export type ButtonVariant = "primary" | "secondary" | "text";

export type ButtonStyleOptions = {
  variant?: ButtonVariant;
  size?: "md" | "sm";
};

/** Clases del botón (CMP-UI-001), para un <button> o para un enlace que se ve como botón. */
export function buttonClassName({
  variant = "primary",
  size = "md",
}: ButtonStyleOptions = {}): string {
  return [styles.button, styles[variant], size === "sm" ? styles.sm : ""]
    .filter(Boolean)
    .join(" ");
}
