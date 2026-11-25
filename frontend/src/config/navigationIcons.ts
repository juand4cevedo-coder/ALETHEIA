import type { IconComponent } from "../components/ui/icons.tsx";
import {
  CarpetaAbiertaIcon,
  LibroIcon,
  OjoIcon,
  UsuariosIcon,
} from "../components/ui/icons.tsx";

// Ícono de cada grupo del menú, por su título. Va aparte de navigation.ts a propósito: el menú
// de escritorio y el móvil lo cargan cuando se abren, y la entrada del sitio no lo descarga.
export const GROUP_ICONS: Record<string, IconComponent> = {
  Producto: CarpetaAbiertaIcon,
  Equipos: UsuariosIcon,
  Recursos: LibroIcon,
  ALETHEIA: OjoIcon,
};
