import styles from "./Button.module.css";

// bright es la acción principal sobre la escena de acceso: una cápsula clara que resalta sobre
// el cielo oscuro sin competir con el azul del emblema.
export type ButtonVariant = "primary" | "secondary" | "bright";

export type ButtonStyleOptions = {
  variant?: ButtonVariant;
  /** Fondo sobre el que va el botón: la banda oscura del sitio público o una superficie clara. */
  surface?: "light" | "dark";
  size?: "md" | "sm";
  /** pill: bordes del todo redondeados, como los campos de las pantallas de acceso. */
  shape?: "rounded" | "pill";
};

/** Clases del botón (CMP-UI-001), para un <button> o para un enlace que se ve como botón. */
export function buttonClassName({
  variant = "primary",
  surface = "light",
  size = "md",
  shape = "rounded",
}: ButtonStyleOptions = {}): string {
  return [
    styles.button,
    styles[variant],
    surface === "dark" ? styles.dark : "",
    size === "sm" ? styles.sm : "",
    shape === "pill" ? styles.pill : "",
  ]
    .filter(Boolean)
    .join(" ");
}
