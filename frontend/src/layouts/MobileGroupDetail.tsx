import { Link } from "react-router";

import { IconTile } from "../components/ui/IconTile.tsx";
import { FlechaDerechaIcon } from "../components/ui/icons.tsx";
import type { NavigationGroup } from "../config/navigation.ts";
import { GROUP_ICONS } from "../config/navigationIcons.ts";
import styles from "./PublicLayout.module.css";

// Detalle de un grupo del menú móvil. Se carga aparte, al tocar un grupo (o al acercarse al menú):
// la entrada del sitio no descarga los íconos de los grupos.
export default function MobileGroupDetail({
  group,
  close,
}: {
  group: NavigationGroup;
  close: () => void;
}) {
  return (
    <section
      className={styles.mobileDetail}
      aria-labelledby="menu-movil-titulo"
    >
      <Link
        to={group.feature.to}
        className={styles.mobileFeature}
        onClick={close}
      >
        <IconTile icon={GROUP_ICONS[group.title]!} tone="soft" size="lg" />
        <h2 id="menu-movil-titulo">{group.title}</h2>
        <p>{group.feature.text}</p>
      </Link>
      <nav aria-label={`Opciones de ${group.title}`}>
        {group.links.map((link) => (
          <Link key={link.to} to={link.to} onClick={close}>
            <span>
              <strong>{link.label}</strong>
              {link.description && <small>{link.description}</small>}
            </span>
            <FlechaDerechaIcon size={18} aria-hidden="true" />
          </Link>
        ))}
      </nav>
    </section>
  );
}
