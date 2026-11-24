import { useId } from "react";

import {
  LunaIcon,
  MonitorIcon,
  SolIcon,
  type IconComponent,
} from "../../components/ui/icons.tsx";
import {
  originOf,
  setThemePreference,
  THEME_LABELS,
  useTheme,
  type ThemePreference,
} from "./theme.ts";
import styles from "./ThemeToggle.module.css";

const OPTIONS: { value: ThemePreference; icon: IconComponent }[] = [
  { value: "light", icon: SolIcon },
  { value: "dark", icon: LunaIcon },
  { value: "system", icon: MonitorIcon },
];

/** Selector de tres posiciones para menús y pies de página: claro, oscuro o el del sistema. */
export function ThemeChooser({
  className,
  tone = "default",
}: {
  className?: string;
  tone?: "default" | "inverse";
}) {
  const { preference } = useTheme();
  const name = useId();
  return (
    <fieldset
      className={[styles.chooser, className].filter(Boolean).join(" ")}
      data-tone={tone}
    >
      <legend className="visually-hidden">Modo de color</legend>
      {OPTIONS.map(({ value, icon: Icon }) => (
        <label key={value} className={styles.option}>
          <input
            type="radio"
            name={name}
            value={value}
            checked={preference === value}
            onChange={(event) =>
              setThemePreference(
                value,
                originOf(
                  event.currentTarget.parentElement ?? event.currentTarget,
                ),
              )
            }
          />
          <Icon size={16} aria-hidden="true" />
          <span>{THEME_LABELS[value]}</span>
        </label>
      ))}
    </fieldset>
  );
}
