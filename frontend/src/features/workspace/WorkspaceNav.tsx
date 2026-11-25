import { useQuery } from "@tanstack/react-query";
import { type RefObject, useLayoutEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router";

import type { Me } from "../../api/generated";
import { listCasesOptions } from "../../api/generated/@tanstack/react-query.gen.ts";
import {
  ChevronAbajoIcon,
  PanelLateralIcon,
} from "../../components/ui/icons.tsx";
import {
  setCompact,
  toggleGroup,
  useNavPreferences,
} from "./navPreferences.ts";
import { visibleGroups } from "./sections.ts";
import styles from "./WorkspaceNav.module.css";

/** Casos abiertos de la persona. Pide una sola fila: el número sale de los totales de la lista,
 * que no dependen del tamaño de la página. Si falla, el menú queda sin número. */
function useOpenCases(enabled: boolean): number | undefined {
  const { data } = useQuery({
    ...listCasesOptions({ query: { status: "open", limit: 1 } }),
    enabled,
    select: (page) => page.totals.open,
  });
  return data;
}

type Indicator = { top: number; height: number } | null;

/**
 * El fondo del enlace activo es una sola pieza que se desliza de un enlace a otro: al cambiar de
 * pantalla se ve de dónde viene y a dónde va. Se mide sobre el contenedor que se desplaza, y se
 * vuelve a medir cuando un grupo se pliega o se despliega.
 */
function useIndicator(
  scroller: RefObject<HTMLDivElement | null>,
  pathname: string,
  folded: readonly string[],
  compact: boolean,
): Indicator {
  const [indicator, setIndicator] = useState<Indicator>(null);
  useLayoutEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const measure = () => {
      const active = root.querySelector<HTMLElement>("[aria-current=page]");
      const hidden = active?.closest("[inert]");
      if (!active || hidden || active.offsetParent === null) {
        setIndicator(null);
        return;
      }
      const rootBox = root.getBoundingClientRect();
      const box = active.getBoundingClientRect();
      setIndicator({
        top: box.top - rootBox.top + root.scrollTop,
        height: box.height,
      });
    };
    measure();
    if (typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(measure);
    for (const child of root.children) observer.observe(child);
    return () => observer.disconnect();
  }, [scroller, pathname, folded, compact]);
  return indicator;
}

// Menú del espacio de trabajo (CMP-UI-011). Grupos con nombre que se pliegan y se recuerdan,
// un indicador que se desliza al enlace activo y, en escritorio, un modo compacto de solo
// íconos. En celular el mismo menú vive dentro del cajón que abre el encabezado (AppShell).
export function WorkspaceNav({
  me,
  variant = "sidebar",
  onNavigate,
}: {
  me: Me;
  variant?: "sidebar" | "drawer";
  onNavigate?: () => void;
}) {
  const groups = visibleGroups(me);
  const openCases = useOpenCases(me.organization != null && !me.platform_admin);
  const { compact: storedCompact, folded } = useNavPreferences();
  const compact = variant === "sidebar" && storedCompact;
  const { pathname } = useLocation();
  const scroller = useRef<HTMLDivElement>(null);
  const indicator = useIndicator(scroller, pathname, folded, compact);

  return (
    <nav
      className={styles.nav}
      aria-label="Espacio de trabajo"
      data-variant={variant}
      data-compact={compact || undefined}
    >
      <div ref={scroller} className={styles.scroller}>
        <span
          className={styles.indicator}
          aria-hidden="true"
          data-visible={indicator !== null}
          style={
            indicator
              ? {
                  transform: `translateY(${indicator.top}px)`,
                  height: indicator.height,
                }
              : undefined
          }
        />
        {groups.map((group) => {
          const isFolded = !compact && folded.includes(group.id);
          const holdsActive = group.items.some((item) =>
            item.end ? pathname === item.to : pathname.startsWith(item.to),
          );
          const bodyId = `menu-${variant}-${group.id}`;
          return (
            <section className={styles.group} key={group.id}>
              <h2 className={styles.groupHeading}>
                <button
                  type="button"
                  className={styles.groupToggle}
                  aria-expanded={!isFolded}
                  aria-controls={bodyId}
                  onClick={() => toggleGroup(group.id)}
                  tabIndex={compact ? -1 : undefined}
                >
                  <span className={styles.groupLabel}>{group.label}</span>
                  {isFolded && holdsActive && (
                    <span className={styles.activeDot}>
                      <span className="visually-hidden">
                        (contiene la pantalla actual)
                      </span>
                    </span>
                  )}
                  <ChevronAbajoIcon
                    size={12}
                    aria-hidden="true"
                    className={styles.groupChevron}
                  />
                </button>
              </h2>
              <div
                id={bodyId}
                className={styles.groupBody}
                data-open={!isFolded}
                inert={isFolded}
              >
                <ul className={styles.list}>
                  {group.items.map(
                    ({ to, label, icon: Icon, end, openCount }) => (
                      <li key={to}>
                        <NavLink
                          to={to}
                          end={end}
                          viewTransition
                          className={styles.link}
                          data-tooltip={compact ? label : undefined}
                          onClick={onNavigate}
                        >
                          <Icon
                            size={18}
                            aria-hidden="true"
                            className={styles.icon}
                          />
                          <span className={styles.label}>{label}</span>
                          {openCount && openCases !== undefined && (
                            <span className={styles.count}>
                              <span aria-hidden="true">{openCases}</span>
                              <span className="visually-hidden">
                                {`, ${openCases} ${openCases === 1 ? "abierto" : "abiertos"}`}
                              </span>
                            </span>
                          )}
                        </NavLink>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            </section>
          );
        })}
      </div>
      {variant === "sidebar" && (
        <div className={styles.foot}>
          <button
            type="button"
            className={styles.compactToggle}
            onClick={() => setCompact(!compact)}
            data-tooltip={compact ? "Expandir el menú" : undefined}
          >
            <PanelLateralIcon size={18} aria-hidden="true" />
            <span className={styles.label}>
              {compact ? "Expandir el menú" : "Compactar el menú"}
            </span>
          </button>
        </div>
      )}
    </nav>
  );
}
