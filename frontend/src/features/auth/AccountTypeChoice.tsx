import { Building2, type LucideIcon, UserRound } from "lucide-react";
import { useId } from "react";

import type { AccountType } from "./signUp.ts";
import styles from "./AccountTypeChoice.module.css";

type AccountTypeChoiceProps = {
  value: AccountType;
  disabled?: boolean;
  onChange: (value: AccountType) => void;
};

const OPTIONS = [
  {
    value: "individual",
    title: "Por mi cuenta",
    detail: "Ejerzo de forma independiente.",
    Icon: UserRound,
  },
  {
    value: "firm",
    title: "Para una oficina o firma",
    detail: "Abro la cuenta del equipo.",
    Icon: Building2,
  },
] as const satisfies ReadonlyArray<{
  value: AccountType;
  title: string;
  detail: string;
  Icon: LucideIcon;
}>;

// Para quién es la cuenta. Son botones de opción nativos con otro aspecto: se recorren con
// las flechas y el lector de pantalla los anuncia como un grupo de dos opciones.
export function AccountTypeChoice({
  value,
  disabled = false,
  onChange,
}: AccountTypeChoiceProps) {
  const name = useId();

  return (
    <fieldset className={styles.choice} disabled={disabled}>
      <legend className={styles.legend}>¿Para quién es la cuenta?</legend>
      <div className={styles.options}>
        {OPTIONS.map(({ value: option, title, detail, Icon }) => (
          <label key={option} className={styles.option}>
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
            />
            <Icon className={styles.icon} size={20} aria-hidden="true" />
            <span className={styles.text}>
              <span className={styles.title}>{title}</span>
              <span className={styles.detail}>{detail}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
