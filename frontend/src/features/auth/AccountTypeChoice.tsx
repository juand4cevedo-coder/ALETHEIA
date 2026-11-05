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
  { value: "individual", title: "Independiente", Icon: UserRound },
  { value: "firm", title: "Oficina o firma", Icon: Building2 },
] as const satisfies ReadonlyArray<{
  value: AccountType;
  title: string;
  Icon: LucideIcon;
}>;

// Para quién es la cuenta, como un selector segmentado. Son botones de opción nativos con otro
// aspecto: se recorren con las flechas y el lector de pantalla los anuncia como un grupo.
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
        {OPTIONS.map(({ value: option, title, Icon }) => (
          <label key={option} className={styles.option}>
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
            />
            <Icon className={styles.icon} size={18} aria-hidden="true" />
            {title}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
