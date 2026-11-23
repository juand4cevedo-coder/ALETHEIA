import type { IconComponent } from "./icons.tsx";
import styles from "./IconTile.module.css";

type IconTileProps = {
  icon: IconComponent;
  /** suave: fondo lila y trazo violeta; sólido: fondo violeta y trazo blanco. */
  tone?: "soft" | "solid";
  size?: "md" | "lg";
};

/** Ícono sobre un recuadro de esquinas redondeadas. Da peso visual a las tarjetas y a los
 * menús sin recurrir a imágenes; es decorativo, el texto que lo acompaña dice lo mismo. */
export function IconTile({
  icon: Icon,
  tone = "soft",
  size = "md",
}: IconTileProps) {
  return (
    <span
      className={styles.tile}
      data-tone={tone}
      data-size={size}
      aria-hidden="true"
    >
      <Icon size={size === "lg" ? 26 : 20} />
    </span>
  );
}
