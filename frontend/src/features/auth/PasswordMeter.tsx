import { PASSWORD_MIN_LENGTH } from "./signUp.ts";
import styles from "./PasswordMeter.module.css";

type PasswordMeterProps = { id: string; password: string };

// Pocos caracteres distintos delatan una clave fácil de adivinar, como "aaaaaaaaaaaa".
const MIN_DISTINCT = 5;

function assess(password: string): { level: 0 | 1 | 2 | 3 | 4; text: string } {
  const normalized = password.normalize("NFKC");
  const length = normalized.length;
  if (length === 0) {
    return {
      level: 0,
      text: `Al menos ${PASSWORD_MIN_LENGTH} caracteres. Una frase funciona bien.`,
    };
  }
  if (length < PASSWORD_MIN_LENGTH) {
    return {
      level: 1,
      text: `Al menos ${PASSWORD_MIN_LENGTH} caracteres. Una frase funciona bien.`,
    };
  }
  if (new Set(normalized).size < MIN_DISTINCT) {
    return { level: 1, text: "Use caracteres más variados." };
  }
  if (length < 16)
    return { level: 2, text: "Cumple el mínimo. Más larga es más segura." };
  if (length < 20) return { level: 3, text: "Buena contraseña." };
  return { level: 4, text: "Muy buena contraseña." };
}

// Medidor de la contraseña (RN-025): mide sobre todo la longitud, como recomienda NIST, sin
// exigir mayúsculas ni símbolos. El texto solo cambia al pasar de un nivel a otro, así que un
// lector de pantalla no lo repite con cada tecla.
export function PasswordMeter({ id, password }: PasswordMeterProps) {
  const { level, text } = assess(password);

  return (
    <div className={styles.meter} data-level={level}>
      <span className={styles.bars} aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </span>
      <p id={id} className={styles.text} aria-live="polite">
        {text}
      </p>
    </div>
  );
}
