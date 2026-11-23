import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router";

import type { Me } from "../../api/generated";
import { listCasesOptions } from "../../api/generated/@tanstack/react-query.gen.ts";
import { GROUPS } from "./sections.ts";
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

// Menú lateral del espacio de trabajo (CMP-UI-011). En pantallas anchas es una columna a
// la izquierda; en tabletas y celulares, una franja bajo el encabezado que se desliza de lado.
// Cada persona ve solo las secciones de su rol, aunque la API también lo exige.
export function WorkspaceNav({ me }: { me: Me }) {
  const groups = GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.visible?.(me) ?? true),
  })).filter((group) => group.items.length > 0);
  // Sin organización no hay casos que contar.
  const openCases = useOpenCases(me.organization != null && !me.platform_admin);
  const navRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();

  // En celular la franja se desliza de lado: al montar y al cambiar de pantalla se centra el
  // enlace activo, para no perder la señal de dónde está la persona. Se asigna el scrollLeft de
  // la franja y nada más: scrollIntoView movería también al documento y pisaría la posición que
  // ScrollRestoration acaba de restaurar. No hace nada sin enlace activo ni si la franja cabe
  // entera (columna lateral de escritorio).
  useEffect(() => {
    const nav = navRef.current;
    if (!nav || nav.scrollWidth <= nav.clientWidth) return;
    const active = nav.querySelector("[aria-current=page]");
    if (!active) return;
    const navBox = nav.getBoundingClientRect();
    const box = active.getBoundingClientRect();
    nav.scrollLeft +=
      box.left - navBox.left - (nav.clientWidth - box.width) / 2;
  }, [pathname]);

  return (
    <nav ref={navRef} className={styles.nav} aria-label="Espacio de trabajo">
      <div className={styles.groups}>
        {groups.map((group) => (
          <section className={styles.group} key={group.label}>
            <h2 className={styles.groupLabel}>{group.label}</h2>
            <ul className={styles.list}>
              {group.items.map(({ to, label, icon: Icon, end, openCount }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      isActive ? `${styles.link} ${styles.active}` : styles.link
                    }
                  >
                    <Icon size={16} aria-hidden="true" />
                    {label}
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
              ))}
            </ul>
          </section>
        ))}
      </div>
    </nav>
  );
}
