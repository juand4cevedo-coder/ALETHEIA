import { productShotProps } from "../config/media.ts";
import type { CSSProperties } from "react";
import { Link } from "react-router";
import {
  ArchivoBusquedaIcon,
  BalanzaIcon,
  CarpetaAbiertaIcon,
  CirculoAlertaIcon,
  CirculoVistoIcon,
  DocumentoIcon,
  EscudoVistoIcon,
  FlechaDerechaIcon,
  HuellaIcon,
  InfoIcon,
  LibroIcon,
  OjoIcon,
  UsuarioAgregarIcon,
  UsuariosIcon,
} from "../components/ui/icons.tsx";
import type { IconComponent } from "../components/ui/icons.tsx";
import { IconTile } from "../components/ui/IconTile.tsx";
import type { NavigationGroup } from "../config/navigation.ts";
import { GROUP_ICONS } from "../config/navigationIcons.ts";
import { ROUTES } from "../config/routes.ts";
import styles from "./PublicNavigation.module.css";

// Cada vínculo lleva su ícono y cada categoría una captura distinta del producto, para que el
// panel enseñe algo y no solo liste enlaces.
const LINK_ICONS: Record<string, IconComponent> = {
  [ROUTES.howItWorks]: CarpetaAbiertaIcon,
  [ROUTES.verifier]: ArchivoBusquedaIcon,
  [ROUTES.verifierSection]: HuellaIcon,
  "/empresa": UsuariosIcon,
  "/seguridad": EscudoVistoIcon,
  "/docs/invitar-al-equipo": UsuarioAgregarIcon,
  "/soporte": CirculoAlertaIcon,
  "/docs/introduccion": LibroIcon,
  "/blog": DocumentoIcon,
  "/ayuda": InfoIcon,
  "/nosotros": OjoIcon,
  "/filosofia": BalanzaIcon,
  "/estado": CirculoVistoIcon,
};
const FEATURE_SHOTS: Record<string, string> = {
  Producto: "/media/producto/resumen.webp",
  Equipos: "/media/producto/actividad.webp",
  Recursos: "/media/producto/verificador.webp",
  ALETHEIA: "/media/producto/paquete.webp",
};

// Se carga aparte: los íconos y la estructura del panel no pesan en la primera visita; el navegador
// los trae al acercarse al menú.
export default function NavigationPanelContent({
  group,
  close,
}: {
  group: NavigationGroup;
  close: () => void;
}) {
  return (
    <div className={styles.panelContent} key={group.title}>
      <Link to={group.feature.to} className={styles.feature} onClick={close}>
        <IconTile icon={GROUP_ICONS[group.title]!} tone="solid" size="lg" />
        <span className={styles.featureTitle}>{group.feature.title}</span>
        <small>{group.feature.text}</small>
        {FEATURE_SHOTS[group.title] && (
          <img
            className={styles.featureShot}
            {...productShotProps(FEATURE_SHOTS[group.title]!, "320px")}
            alt=""
            width={1260}
            height={720}
            loading="lazy"
            decoding="async"
          />
        )}
        <span className={styles.featureCta}>
          Conocer más
          <FlechaDerechaIcon size={14} aria-hidden="true" />
        </span>
      </Link>
      <div className={styles.links}>
        {group.links.map((link, position) => (
          <Link
            key={link.to}
            to={link.to}
            onClick={close}
            style={{ "--i": position } as CSSProperties}
          >
            {LINK_ICONS[link.to] && <IconTile icon={LINK_ICONS[link.to]!} />}
            <span className={styles.linkText}>
              <span className={styles.linkLabel}>
                {link.label}
                <FlechaDerechaIcon size={14} aria-hidden="true" />
              </span>
              {link.description && <small>{link.description}</small>}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
