import { useQuery } from "@tanstack/react-query";
import { NavLink } from "react-router";

import type { Me } from "../../api/generated";
import { listCasesOptions } from "../../api/generated/@tanstack/react-query.gen.ts";
import { ROUTES } from "../../config/routes.ts";
import { managesOrganization, managesTeam } from "./roles.ts";
import styles from "./WorkspaceNav.module.css";
import {
  CarpetaAbiertaIcon,
  CorreoIcon,
  EdificioIcon,
  HuellaIcon,
  InicioIcon,
  ReciboIcon,
  UsuarioIcon,
  UsuariosIcon,
  type IconComponent,
} from "../../components/ui/icons.tsx";

type Item = {
  to: string;
  label: string;
  icon: IconComponent;
  /** Solo el inicio coincide exacto: las demás secciones incluyen sus subrutas. */
  end?: boolean;
  /** Si la persona ve la opción; sin regla, la ven todos los roles. */
  visible?: (me: Me) => boolean;
  /** Muestra a su lado el número de casos abiertos. */
  openCount?: boolean;
};

// Secciones del espacio de trabajo en el orden del menú lateral (Diseño UX/UI, 4.2). Cada
// historia agrega la suya cuando existe: el menú nunca anuncia lo que todavía no funciona.
const GROUPS: readonly { label: string; items: readonly Item[] }[] = [
  {
    label: "Despacho",
    items: [
      {
        to: ROUTES.app,
        label: "Inicio",
        icon: InicioIcon,
        end: true,
        visible: (me) => !me.platform_admin,
      },
      {
        to: ROUTES.cases,
        label: "Casos",
        icon: CarpetaAbiertaIcon,
        openCount: true,
        visible: (me) => me.organization != null && !me.platform_admin,
      },
      {
        to: ROUTES.members,
        label: "Miembros",
        icon: UsuariosIcon,
        visible: (me) => managesTeam(me.organization?.role),
      },
      {
        to: ROUTES.organization,
        label: "Organización",
        icon: EdificioIcon,
        visible: (me) => managesOrganization(me.organization?.role),
      },
      {
        to: ROUTES.organizationAudit,
        label: "Auditoría de seguridad",
        icon: HuellaIcon,
        visible: (me) => managesTeam(me.organization?.role),
      },
    ],
  },
  {
    label: "Plataforma",
    items: [
      {
        to: ROUTES.platform,
        label: "Cuentas de plataforma",
        icon: UsuariosIcon,
        end: true,
        visible: (me) => me.platform_admin,
      },
      {
        to: ROUTES.platformBilling,
        label: "Facturación",
        icon: ReciboIcon,
        visible: (me) => me.platform_admin,
      },
      {
        to: ROUTES.platformSupport,
        label: "Solicitudes de usuarios",
        icon: CorreoIcon,
        visible: (me) => me.platform_admin,
      },
      {
        to: ROUTES.platformAudit,
        label: "Auditoría",
        icon: HuellaIcon,
        visible: (me) => me.platform_admin,
      },
    ],
  },
  {
    label: "Cuenta",
    items: [
      { to: ROUTES.account, label: "Mi cuenta", icon: UsuarioIcon },
      {
        to: ROUTES.support,
        label: "Pedir soporte",
        icon: CorreoIcon,
        visible: (me) => !me.platform_admin,
      },
    ],
  },
];

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
    label:
      group.label === "Despacho" && me.platform_admin ? "Equipo" : group.label,
    items: group.items.filter((item) => item.visible?.(me) ?? true),
  })).filter((group) => group.items.length > 0);
  // Sin organización no hay casos que contar.
  const openCases = useOpenCases(me.organization != null && !me.platform_admin);

  return (
    <nav className={styles.nav} aria-label="Espacio de trabajo">
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
