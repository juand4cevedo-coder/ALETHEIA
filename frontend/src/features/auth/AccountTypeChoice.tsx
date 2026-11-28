import { useId } from "react";

import type { AccountType } from "./signUp.ts";
import styles from "./AccountTypeChoice.module.css";
import {
  EdificioIcon,
  UsuarioIcon,
  type IconComponent,
} from "../../components/ui/icons.tsx";

type AccountTypeChoiceProps = {
  value: AccountType;
  name?: string;
  disabled?: boolean;
  onChange: (value: AccountType) => void;
};

const OPTIONS = [
  {
    value: "individual",
    title: "Independiente",
    Icon: UsuarioIcon,
    hint: "Usted es el abogado: abre y trabaja sus casos, y puede sumar a su asistente.",
  },
  {
    value: "firm",
    title: "Oficina o firma",
    Icon: EdificioIcon,
    hint: "Usted dirige la firma: invita a sus abogados, que abren los casos. Quien dirige no ocupa cupo del plan.",
  },
] as const satisfies ReadonlyArray<{
  value: AccountType;
  title: string;
  Icon: IconComponent;
  hint: string;
}>;

// Para quién es la cuenta, como un selector segmentado. Son botones de opción nativos con otro
// aspecto: se recorren con las flechas y el lector de pantalla los anuncia como un grupo.
export function AccountTypeChoice({
  value,
  name,
  disabled = false,
  onChange,
}: AccountTypeChoiceProps) {
  const generatedName = useId();
  const hintId = useId();
  const hint = OPTIONS.find((option) => option.value === value)?.hint;

  return (
    <fieldset
      className={styles.choice}
      disabled={disabled}
      aria-describedby={hintId}
    >
      <legend className={styles.legend}>¿Para quién es la cuenta?</legend>
      <div className={styles.options}>
        {OPTIONS.map(({ value: option, title, Icon }) => (
          <label
            key={option}
            className={styles.option}
            data-checked={value === option || undefined}
          >
            <input
              type="radio"
              name={name ?? generatedName}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
            />
            <Icon className={styles.icon} size={16} aria-hidden="true" />
            {title}
          </label>
        ))}
      </div>
      <p id={hintId} className={styles.hint} aria-live="polite">
        {hint}
      </p>
    </fieldset>
  );
}
