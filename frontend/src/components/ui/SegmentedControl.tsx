import { useId, useLayoutEffect, useRef, useState } from "react";

import styles from "./SegmentedControl.module.css";

type Option<T extends string> = { value: T; label: string };

// Control segmentado: elige una vista entre pocas opciones excluyentes (abiertas o resueltas,
// mensual o anual). Son botones de radio nativos, así funciona con flechas y lector de pantalla;
// la pieza que marca la opción elegida se desliza hasta ella.
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
}) {
  const name = useId();
  const root = useRef<HTMLFieldSetElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(
    null,
  );
  useLayoutEffect(() => {
    const checked = root.current?.querySelector<HTMLElement>(
      "label:has(input:checked)",
    );
    if (checked)
      setThumb({ left: checked.offsetLeft, width: checked.offsetWidth });
  }, [value]);
  return (
    <fieldset ref={root} className={styles.control}>
      <legend className="visually-hidden">{label}</legend>
      <span
        className={styles.thumb}
        aria-hidden="true"
        style={
          thumb
            ? { width: thumb.width, transform: `translateX(${thumb.left}px)` }
            : { opacity: 0 }
        }
      />
      {options.map((option) => (
        <label key={option.value} className={styles.option}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
