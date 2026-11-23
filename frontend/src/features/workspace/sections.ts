import type { Me } from "../../api/generated";
import { ROUTES } from "../../config/routes.ts";
import {
  CalendarioIcon,
  CarpetaAbiertaIcon,
  CorreoIcon,
  TareasIcon,
  EdificioIcon,
  HuellaIcon,
  InicioIcon,
  ReciboIcon,
  UsuarioIcon,
  UsuariosIcon,
  type IconComponent,
} from "../../components/ui/icons.tsx";
import { managesOrganization, managesTasks, managesTeam } from "./roles.ts";

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
export const GROUPS: readonly { label: string; items: readonly Item[] }[] = [
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
        to: ROUTES.calendar,
        label: "Calendario",
        icon: CalendarioIcon,
        visible: (me) => me.organization != null && !me.platform_admin,
      },
      {
        to: ROUTES.taskTemplates,
        label: "Plantillas de tareas",
        icon: TareasIcon,
        visible: (me) => managesTasks(me.organization?.role),
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

/** Las secciones que ve esta persona, en el orden del menú. La paleta de comandos las ofrece
 * como destinos para que ambas muestren siempre lo mismo. */
export function visibleSections(
  me: Me,
): { to: string; label: string; icon: IconComponent }[] {
  return GROUPS.flatMap((group) => group.items)
    .filter((item) => item.visible?.(me) ?? true)
    .map(({ to, label, icon }) => ({ to, label, icon }));
}
