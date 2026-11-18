import { type ReactNode, useId, useRef } from "react";

import styles from "./Tabs.module.css";

type Tab<K extends string> = {
  key: K;
  label: ReactNode;
  count?: number;
  panel: ReactNode;
};

type TabsProps<K extends string> = {
  label: string;
  tabs: readonly Tab<K>[];
  active: K;
  onChange: (key: K) => void;
};

// Pestañas accesibles (patrón WAI-ARIA tablist, con foco itinerante y flechas), el mismo
// comportamiento que ya usa la ficha del caso, generalizado para el resto del espacio de trabajo.
export function Tabs<K extends string>({
  label,
  tabs,
  active,
  onChange,
}: TabsProps<K>) {
  const baseId = useId();
  const tabRefs = useRef<Partial<Record<K, HTMLButtonElement | null>>>({});

  function move(event: React.KeyboardEvent<HTMLButtonElement>) {
    const index = tabs.findIndex((tab) => tab.key === active);
    const targets: Record<string, number> = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index - 1 + tabs.length) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    };
    const next = targets[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const key = tabs[next]!.key;
    onChange(key);
    tabRefs.current[key]?.focus();
  }

  return (
    <div className={styles.root}>
      <div className={styles.tabs} role="tablist" aria-label={label}>
        {tabs.map(({ key, label: tabLabel, count }) => (
          <button
            key={key}
            ref={(node) => {
              tabRefs.current[key] = node;
            }}
            type="button"
            role="tab"
            id={`${baseId}-${key}-tab`}
            className={styles.tab}
            aria-selected={active === key}
            aria-controls={`${baseId}-${key}-panel`}
            tabIndex={active === key ? 0 : -1}
            onClick={() => onChange(key)}
            onKeyDown={move}
          >
            {tabLabel}
            {count != null && <span className={styles.count}>{count}</span>}
          </button>
        ))}
      </div>
      {tabs.map(({ key, panel }) => (
        <div
          key={key}
          role="tabpanel"
          id={`${baseId}-${key}-panel`}
          aria-labelledby={`${baseId}-${key}-tab`}
          tabIndex={0}
          hidden={active !== key}
          className={styles.panel}
        >
          {active === key && panel}
        </div>
      ))}
    </div>
  );
}
