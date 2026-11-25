import { useId, useState } from "react";

import type { PlatformSignupDay } from "../../api/generated";
import styles from "./SignupsChart.module.css";
import { formatDay } from "./labels.ts";

// Cuentas nuevas por día en los últimos 30 días. Una sola serie: el título la nombra y no hace
// falta leyenda. Cada barra muestra su valor al apuntarla o enfocarla, y la tabla debajo dice
// lo mismo para quien no ve la gráfica.
export function SignupsChart({ days }: { days: readonly PlatformSignupDay[] }) {
  const tableId = useId();
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((day) => day.accounts));
  const total = days.reduce((sum, day) => sum + day.accounts, 0);
  const active = hovered === null ? null : days[hovered];
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>
        <span className={styles.total}>{total}</span>
        <span>
          {total === 1 ? "cuenta nueva" : "cuentas nuevas"} en los últimos 30
          días
        </span>
      </figcaption>
      <div
        className={styles.plot}
        aria-describedby={tableId}
        onPointerLeave={() => setHovered(null)}
      >
        <div className={styles.grid} aria-hidden="true">
          <span>{max}</span>
          <span>0</span>
        </div>
        <ol className={styles.bars} aria-hidden="true">
          {days.map((day, index) => (
            <li
              key={day.day}
              className={styles.slot}
              data-active={hovered === index || undefined}
              onPointerEnter={() => setHovered(index)}
            >
              <span
                className={styles.bar}
                style={{
                  height: `${Math.max(day.accounts === 0 ? 0 : 6, (day.accounts / max) * 100)}%`,
                  animationDelay: `${index * 12}ms`,
                }}
              />
            </li>
          ))}
        </ol>
        {active && hovered !== null && (
          <div
            className={styles.tooltip}
            style={{ left: `${((hovered + 0.5) / days.length) * 100}%` }}
            aria-hidden="true"
          >
            <strong>{active.accounts}</strong>
            <span>{formatDay(active.day)}</span>
          </div>
        )}
        <div className={styles.axis} aria-hidden="true">
          <span>{formatDay(days[0]?.day ?? "")}</span>
          <span>Hoy</span>
        </div>
      </div>
      <details className={styles.details}>
        <summary>Ver los datos en una tabla</summary>
        <table id={tableId} className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Día</th>
              <th scope="col">Cuentas nuevas</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.day}>
                <th scope="row">{formatDay(day.day)}</th>
                <td>{day.accounts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
