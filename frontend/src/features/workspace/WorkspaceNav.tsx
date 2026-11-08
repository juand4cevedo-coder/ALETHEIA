import { House, type LucideIcon, UserRound, UsersRound } from "lucide-react";
import { NavLink } from "react-router";

import type { Me } from "../../api/generated";
import { ROUTES } from "../../config/routes.ts";
import { managesTeam } from "./roles.ts";
import styles from "./WorkspaceNav.module.css";

type Item = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Solo el inicio coincide exacto: las demás secciones incluyen sus subrutas. */
  end?: boolean;
  /** Si la persona ve la opción; sin regla, la ven todos los roles. */
  visible?: (me: Me) => boolean;
};

// Secciones del espacio de trabajo en el orden del menú lateral (Diseño UX/UI, 4.2). Cada
// historia agrega la suya cuando existe: el menú nunca anuncia lo que todavía no funciona.
const ITEMS: readonly Item[] = [
  { to: ROUTES.app, label: "Inicio", icon: House, end: true },
  {
    to: ROUTES.members,
    label: "Miembros",
    icon: UsersRound,
    visible: (me) => managesTeam(me.organization?.role),
  },
  { to: ROUTES.account, label: "Mi cuenta", icon: UserRound },
];

// Menú lateral del espacio de trabajo (CMP-UI-011). En pantallas anchas es una columna fija a
// la izquierda; en tabletas y celulares, una franja bajo el encabezado que se desliza de lado.
// Cada persona ve solo las secciones de su rol, aunque la API también lo exige.
export function WorkspaceNav({ me }: { me: Me }) {
  const items = ITEMS.filter((item) => item.visible?.(me) ?? true);

  return (
    <nav className={styles.nav} aria-label="Espacio de trabajo">
      <ul className={styles.list}>
        {items.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                isActive ? `${styles.link} ${styles.active}` : styles.link
              }
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
