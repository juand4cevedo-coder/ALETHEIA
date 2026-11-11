// Módulo solo de íconos generados por fábricas: la recarga en caliente no aplica.
/* oxlint-disable react/only-export-components */
// Íconos de la interfaz: única puerta de entrada. Phosphor en peso regular más los cuatro
// propios (huella, sello, cadena y paquete), dibujados con el mismo trazo. Ningún archivo
// importa íconos de otra parte. Cada ícono se importa por separado para no inflar el paquete.
import {
  type ComponentType,
  forwardRef,
  type ReactElement,
  type Ref,
  type SVGProps,
} from "react";

import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr/ArrowUpRight";
import { SealCheck } from "@phosphor-icons/react/dist/ssr/SealCheck";
import { Buildings } from "@phosphor-icons/react/dist/ssr/Buildings";
import { Check } from "@phosphor-icons/react/dist/ssr/Check";
import { CaretDown } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { CaretRight } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { WarningCircle } from "@phosphor-icons/react/dist/ssr/WarningCircle";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import { Prohibit } from "@phosphor-icons/react/dist/ssr/Prohibit";
import { Clock } from "@phosphor-icons/react/dist/ssr/Clock";
import { Cookie } from "@phosphor-icons/react/dist/ssr/Cookie";
import { Copy } from "@phosphor-icons/react/dist/ssr/Copy";
import { DownloadSimple } from "@phosphor-icons/react/dist/ssr/DownloadSimple";
import { Eye } from "@phosphor-icons/react/dist/ssr/Eye";
import { EyeSlash } from "@phosphor-icons/react/dist/ssr/EyeSlash";
import { FileZip } from "@phosphor-icons/react/dist/ssr/FileZip";
import { FileMagnifyingGlass } from "@phosphor-icons/react/dist/ssr/FileMagnifyingGlass";
import { FileArrowUp } from "@phosphor-icons/react/dist/ssr/FileArrowUp";
import { FileX } from "@phosphor-icons/react/dist/ssr/FileX";
import { FolderOpen } from "@phosphor-icons/react/dist/ssr/FolderOpen";
import { HardDrive } from "@phosphor-icons/react/dist/ssr/HardDrive";
import { ClockCounterClockwise } from "@phosphor-icons/react/dist/ssr/ClockCounterClockwise";
import { House } from "@phosphor-icons/react/dist/ssr/House";
import { Info } from "@phosphor-icons/react/dist/ssr/Info";
import { Key } from "@phosphor-icons/react/dist/ssr/Key";
import { Bank } from "@phosphor-icons/react/dist/ssr/Bank";
import { Laptop } from "@phosphor-icons/react/dist/ssr/Laptop";
import { LinkSimple } from "@phosphor-icons/react/dist/ssr/LinkSimple";
import { Link } from "@phosphor-icons/react/dist/ssr/Link";
import { List } from "@phosphor-icons/react/dist/ssr/List";
import { CircleNotch } from "@phosphor-icons/react/dist/ssr/CircleNotch";
import { Lock } from "@phosphor-icons/react/dist/ssr/Lock";
import { SignOut } from "@phosphor-icons/react/dist/ssr/SignOut";
import { Envelope } from "@phosphor-icons/react/dist/ssr/Envelope";
import { Devices } from "@phosphor-icons/react/dist/ssr/Devices";
import { Plus } from "@phosphor-icons/react/dist/ssr/Plus";
import { Printer } from "@phosphor-icons/react/dist/ssr/Printer";
import { Receipt } from "@phosphor-icons/react/dist/ssr/Receipt";
import { ArrowsClockwise } from "@phosphor-icons/react/dist/ssr/ArrowsClockwise";
import { Scales } from "@phosphor-icons/react/dist/ssr/Scales";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";
import { Shield } from "@phosphor-icons/react/dist/ssr/Shield";
import { ShieldWarning } from "@phosphor-icons/react/dist/ssr/ShieldWarning";
import { ShieldCheck } from "@phosphor-icons/react/dist/ssr/ShieldCheck";
import { Warning } from "@phosphor-icons/react/dist/ssr/Warning";
import { LinkSimpleBreak } from "@phosphor-icons/react/dist/ssr/LinkSimpleBreak";
import { UploadSimple } from "@phosphor-icons/react/dist/ssr/UploadSimple";
import { UserGear } from "@phosphor-icons/react/dist/ssr/UserGear";
import { UserMinus } from "@phosphor-icons/react/dist/ssr/UserMinus";
import { UserPlus } from "@phosphor-icons/react/dist/ssr/UserPlus";
import { User } from "@phosphor-icons/react/dist/ssr/User";
import { Users } from "@phosphor-icons/react/dist/ssr/Users";
import { X } from "@phosphor-icons/react/dist/ssr/X";

/** Props comunes de todos los íconos de la interfaz. */
export type IconProps = Omit<
  SVGProps<SVGSVGElement>,
  "ref" | "width" | "height"
> & {
  /** Lado en píxeles. En la interfaz son 16; en encabezados, 20. */
  size?: number | string;
  /** Nombre accesible. Sin él, el ícono es decorativo y se oculta a lectores de pantalla. */
  title?: string;
};

/** Tipo de cualquier ícono de este módulo, para recibirlo como prop. */
export type IconComponent = ComponentType<IconProps>;

const TAMANO_PREDETERMINADO = 16;

/** Atributos de accesibilidad: decorativo salvo que se pase un título o una etiqueta. */
function accesibilidad(
  title: string | undefined,
  props: IconProps,
): Record<string, unknown> {
  const nombrado = Boolean(title) || Boolean(props["aria-label"]);
  if (nombrado) return { role: "img" };
  return { "aria-hidden": props["aria-hidden"] ?? true };
}

type BasePhosphor = ComponentType<
  {
    size?: number | string;
    weight?: "regular";
    alt?: string;
    ref?: Ref<SVGSVGElement>;
  } & Omit<SVGProps<SVGSVGElement>, "ref" | "width" | "height">
>;

function crearIcono(Base: BasePhosphor, nombre: string): IconComponent {
  const Icono = forwardRef<SVGSVGElement, IconProps>(
    ({ size = TAMANO_PREDETERMINADO, title, ...resto }, ref) => (
      <Base
        ref={ref}
        weight="regular"
        size={size}
        alt={title}
        {...resto}
        {...accesibilidad(title, resto)}
      />
    ),
  );
  Icono.displayName = nombre;
  return Icono;
}

export const FlechaDerechaIcon = crearIcono(ArrowRight, "FlechaDerechaIcon");
export const FlechaDiagonalIcon = crearIcono(
  ArrowUpRight,
  "FlechaDiagonalIcon",
);
export const VerificadoIcon = crearIcono(SealCheck, "VerificadoIcon");
export const EdificioIcon = crearIcono(Buildings, "EdificioIcon");
export const VistoIcon = crearIcono(Check, "VistoIcon");
export const ChevronAbajoIcon = crearIcono(CaretDown, "ChevronAbajoIcon");
export const ChevronDerechaIcon = crearIcono(CaretRight, "ChevronDerechaIcon");
export const CirculoAlertaIcon = crearIcono(WarningCircle, "CirculoAlertaIcon");
export const CirculoVistoIcon = crearIcono(CheckCircle, "CirculoVistoIcon");
export const CirculoProhibidoIcon = crearIcono(
  Prohibit,
  "CirculoProhibidoIcon",
);
export const RelojIcon = crearIcono(Clock, "RelojIcon");
export const GalletaIcon = crearIcono(Cookie, "GalletaIcon");
export const CopiarIcon = crearIcono(Copy, "CopiarIcon");
export const DescargarIcon = crearIcono(DownloadSimple, "DescargarIcon");
export const OjoIcon = crearIcono(Eye, "OjoIcon");
export const OjoTachadoIcon = crearIcono(EyeSlash, "OjoTachadoIcon");
export const ArchivoComprimidoIcon = crearIcono(
  FileZip,
  "ArchivoComprimidoIcon",
);
export const ArchivoBusquedaIcon = crearIcono(
  FileMagnifyingGlass,
  "ArchivoBusquedaIcon",
);
export const ArchivoSubirIcon = crearIcono(FileArrowUp, "ArchivoSubirIcon");
export const ArchivoEquisIcon = crearIcono(FileX, "ArchivoEquisIcon");
export const CarpetaAbiertaIcon = crearIcono(FolderOpen, "CarpetaAbiertaIcon");
export const DiscoIcon = crearIcono(HardDrive, "DiscoIcon");
export const HistorialIcon = crearIcono(ClockCounterClockwise, "HistorialIcon");
export const InicioIcon = crearIcono(House, "InicioIcon");
export const InfoIcon = crearIcono(Info, "InfoIcon");
export const LlaveIcon = crearIcono(Key, "LlaveIcon");
export const InstitucionIcon = crearIcono(Bank, "InstitucionIcon");
export const PortatilIcon = crearIcono(Laptop, "PortatilIcon");
export const EnlaceIcon = crearIcono(LinkSimple, "EnlaceIcon");
export const VinculoIcon = crearIcono(Link, "VinculoIcon");
export const MenuIcon = crearIcono(List, "MenuIcon");
export const CargandoIcon = crearIcono(CircleNotch, "CargandoIcon");
export const CandadoIcon = crearIcono(Lock, "CandadoIcon");
export const SalirIcon = crearIcono(SignOut, "SalirIcon");
export const CorreoIcon = crearIcono(Envelope, "CorreoIcon");
export const DispositivosIcon = crearIcono(Devices, "DispositivosIcon");
export const MasIcon = crearIcono(Plus, "MasIcon");
export const ImprimirIcon = crearIcono(Printer, "ImprimirIcon");
export const ReciboIcon = crearIcono(Receipt, "ReciboIcon");
export const ActualizarIcon = crearIcono(ArrowsClockwise, "ActualizarIcon");
export const BalanzaIcon = crearIcono(Scales, "BalanzaIcon");
export const BuscarIcon = crearIcono(MagnifyingGlass, "BuscarIcon");
export const EscudoIcon = crearIcono(Shield, "EscudoIcon");
export const EscudoAlertaIcon = crearIcono(ShieldWarning, "EscudoAlertaIcon");
export const EscudoVistoIcon = crearIcono(ShieldCheck, "EscudoVistoIcon");
export const AdvertenciaIcon = crearIcono(Warning, "AdvertenciaIcon");
export const EnlaceRotoIcon = crearIcono(LinkSimpleBreak, "EnlaceRotoIcon");
export const SubirIcon = crearIcono(UploadSimple, "SubirIcon");
export const UsuarioAjustesIcon = crearIcono(UserGear, "UsuarioAjustesIcon");
export const UsuarioQuitarIcon = crearIcono(UserMinus, "UsuarioQuitarIcon");
export const UsuarioAgregarIcon = crearIcono(UserPlus, "UsuarioAgregarIcon");
export const UsuarioIcon = crearIcono(User, "UsuarioIcon");
export const UsuariosIcon = crearIcono(Users, "UsuariosIcon");
export const CerrarIcon = crearIcono(X, "CerrarIcon");

// Íconos propios. Cuadrícula de 24 px, trazo de 1,5 (el de Phosphor regular a 24 px),
// extremos y uniones redondeados, color heredado del texto.
function crearPropio(nombre: string, trazado: ReactElement): IconComponent {
  const Icono = forwardRef<SVGSVGElement, IconProps>(
    ({ size = TAMANO_PREDETERMINADO, title, ...resto }, ref) => (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...resto}
        {...accesibilidad(title, resto)}
      >
        {title ? <title>{title}</title> : null}
        {trazado}
      </svg>
    ),
  );
  Icono.displayName = nombre;
  return Icono;
}

/** Huella de un archivo: crestas concéntricas abiertas, como una huella dactilar. */
export const HuellaIcon = crearPropio(
  "HuellaIcon",
  <>
    <path d="M7 19.5c.8-1.6 1.2-3.5 1.2-5.5a3.8 3.8 0 0 1 7.6 0c0 1.2-.1 2.4-.3 3.5" />
    <path d="M4 15.5c.7-1.4 1-2.9 1-4.5a7 7 0 0 1 14 0c0 .9 0 1.9-.2 2.8" />
    <path d="M12 14c0 2.2-.4 4.2-1.2 6" />
    <path d="M8 4.7A9 9 0 0 1 21 11c0 1.4-.1 2.8-.4 4.1" />
    <path d="M15.5 20.3c.4-.9.7-1.8.9-2.8" />
  </>,
);

/** Sello de tiempo: doble anillo de sello con las manecillas de un reloj. */
export const SelloIcon = crearPropio(
  "SelloIcon",
  <>
    <circle cx="12" cy="12" r="9.25" />
    <circle cx="12" cy="12" r="6.5" />
    <path d="M12 8.5V12l2.5 1.5" />
  </>,
);

/** Cadena de custodia: dos eslabones unidos entre sí. */
export const CadenaIcon = crearPropio(
  "CadenaIcon",
  <>
    <rect x="2.5" y="8.5" width="11" height="7" rx="3.5" />
    <rect x="10.5" y="8.5" width="11" height="7" rx="3.5" />
  </>,
);

/** Paquete de preservación: caja cerrada vista en perspectiva. */
export const PaqueteIcon = crearPropio(
  "PaqueteIcon",
  <>
    <path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z" />
    <path d="M3.5 7.5L12 12l8.5-4.5" />
    <path d="M12 12v9" />
  </>,
);
