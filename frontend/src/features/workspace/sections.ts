import type { Me } from "../../api/generated";
import { ROUTES } from "../../config/routes.ts";
import {
  ArchivoBusquedaIcon,
  BalanzaIcon,
  CalendarioIcon,
  CarpetaAbiertaIcon,
  CorreoIcon,
  EdificioIcon,
  EtiquetaIcon,
  GraficaIcon,
  HuellaIcon,
  InicioIcon,
  PulsoIcon,
  ReciboIcon,
  TareasIcon,
  UsuarioIcon,
  UsuariosIcon,
  type IconComponent,
} from "../../components/ui/icons.tsx";
import { managesOrganization, managesTasks, managesTeam } from "./roles.ts";

export type SectionItem = {
  to: string;
  label: string;
  icon: IconComponent;
  /** Solo las portadas coinciden exacto: las demás secciones incluyen sus subrutas. */
  end?: boolean;
  /** Si la persona ve la opción; sin regla, la ven todos los roles. */
  visible?: (me: Me) => boolean;
  /** Muestra a su lado el número de casos abiertos. */
  openCount?: boolean;
};

export type SectionGroup = {
  /** Identificador estable: con él se recuerda si el grupo quedó plegado. */
  id: string;
  label: string;
  items: readonly SectionItem[];
};

const inFirm = (me: Me) => me.organization != null && !me.platform_admin;
const platform = (me: Me) => me.platform_admin;

// Secciones del espacio de trabajo en el orden del menú lateral. Cada grupo responde a una
// pregunta distinta: qué trabajo tengo, cómo está mi despacho, cómo va la plataforma y quién
// soy. El menú nunca anuncia lo que todavía no funciona ni lo que el rol no puede hacer.
const GROUPS: readonly SectionGroup[] = [
  {
    id: "trabajo",
    label: "Trabajo",
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
        visible: inFirm,
      },
      {
        to: ROUTES.calendar,
        label: "Calendario",
        icon: CalendarioIcon,
        visible: inFirm,
      },
      {
        to: ROUTES.archive,
        label: "Banco de datos",
        icon: ArchivoBusquedaIcon,
        visible: inFirm,
      },
      {
        to: ROUTES.taskTemplates,
        label: "Plantillas de tareas",
        icon: TareasIcon,
        visible: (me) => managesTasks(me.organization?.role),
      },
    ],
  },
  {
    id: "despacho",
    label: "Despacho",
    items: [
      {
        to: ROUTES.members,
        label: "Equipo",
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
        to: ROUTES.billing,
        label: "Plan y facturación",
        icon: ReciboIcon,
        visible: (me) =>
          inFirm(me) && managesOrganization(me.organization?.role),
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
    id: "plataforma",
    label: "Plataforma",
    items: [
      {
        to: ROUTES.platform,
        label: "Resumen",
        icon: InicioIcon,
        end: true,
        visible: platform,
      },
      {
        to: ROUTES.platformSupport,
        label: "Solicitudes y PQR",
        icon: BalanzaIcon,
        visible: platform,
      },
    ],
  },
  {
    id: "clientes",
    label: "Clientes",
    items: [
      {
        to: ROUTES.platformOrganizations,
        label: "Despachos",
        icon: EdificioIcon,
        visible: platform,
      },
      {
        to: ROUTES.platformAccounts,
        label: "Cuentas",
        icon: UsuariosIcon,
        visible: platform,
      },
    ],
  },
  {
    id: "comercial",
    label: "Comercial",
    items: [
      {
        to: ROUTES.platformPlans,
        label: "Planes y cortesías",
        icon: EtiquetaIcon,
        visible: platform,
      },
      {
        to: ROUTES.platformBilling,
        label: "Ingresos",
        icon: ReciboIcon,
        visible: platform,
      },
    ],
  },
  {
    id: "operacion",
    label: "Operación",
    items: [
      {
        to: ROUTES.platformOperations,
        label: "Tareas y pagos",
        icon: PulsoIcon,
        visible: platform,
      },
      {
        to: ROUTES.platformVitals,
        label: "Rendimiento real",
        icon: GraficaIcon,
        visible: platform,
      },
      {
        to: ROUTES.platformAudit,
        label: "Auditoría",
        icon: HuellaIcon,
        visible: platform,
      },
    ],
  },
  {
    id: "cuenta",
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

/** Los grupos que ve esta persona, cada uno con solo sus secciones visibles. */
export function visibleGroups(me: Me): SectionGroup[] {
  return GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.visible?.(me) ?? true),
  })).filter((group) => group.items.length > 0);
}

/** Las secciones que ve esta persona, en el orden del menú. La paleta de comandos las ofrece
 * como destinos para que ambas muestren siempre lo mismo. */
export function visibleSections(
  me: Me,
): { to: string; label: string; icon: IconComponent; group: string }[] {
  return visibleGroups(me).flatMap((group) =>
    group.items.map(({ to, label, icon }) => ({
      to,
      label,
      icon,
      group: group.label,
    })),
  );
}
