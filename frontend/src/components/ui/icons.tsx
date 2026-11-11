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

import { TRAZADOS } from "./icons.paths.ts";

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

function crearIcono(clave: string): IconComponent {
  const elementos = TRAZADOS[clave] ?? [];
  const Icono = forwardRef<SVGSVGElement, IconProps>(
    (
      { size = TAMANO_PREDETERMINADO, title, ...resto },
      ref: Ref<SVGSVGElement>,
    ) => (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 256 256"
        fill="currentColor"
        {...resto}
        {...accesibilidad(title, resto)}
      >
        {title ? <title>{title}</title> : null}
        {elementos.map(([Etiqueta, atributos], i) => (
          <Etiqueta key={i} {...atributos} />
        ))}
      </svg>
    ),
  );
  Icono.displayName = clave + "Icon";
  return Icono;
}

export const FlechaDerechaIcon = crearIcono("FlechaDerecha");
export const FlechaDiagonalIcon = crearIcono("FlechaDiagonal");
export const VerificadoIcon = crearIcono("Verificado");
export const EdificioIcon = crearIcono("Edificio");
export const VistoIcon = crearIcono("Visto");
export const ChevronAbajoIcon = crearIcono("ChevronAbajo");
export const ChevronDerechaIcon = crearIcono("ChevronDerecha");
export const CirculoAlertaIcon = crearIcono("CirculoAlerta");
export const CirculoVistoIcon = crearIcono("CirculoVisto");
export const CirculoProhibidoIcon = crearIcono("CirculoProhibido");
export const RelojIcon = crearIcono("Reloj");
export const GalletaIcon = crearIcono("Galleta");
export const CopiarIcon = crearIcono("Copiar");
export const DescargarIcon = crearIcono("Descargar");
export const OjoIcon = crearIcono("Ojo");
export const OjoTachadoIcon = crearIcono("OjoTachado");
export const ArchivoComprimidoIcon = crearIcono("ArchivoComprimido");
export const ArchivoBusquedaIcon = crearIcono("ArchivoBusqueda");
export const ArchivoSubirIcon = crearIcono("ArchivoSubir");
export const ArchivoEquisIcon = crearIcono("ArchivoEquis");
export const CarpetaAbiertaIcon = crearIcono("CarpetaAbierta");
export const DiscoIcon = crearIcono("Disco");
export const HistorialIcon = crearIcono("Historial");
export const InicioIcon = crearIcono("Inicio");
export const InfoIcon = crearIcono("Info");
export const LlaveIcon = crearIcono("Llave");
export const InstitucionIcon = crearIcono("Institucion");
export const PortatilIcon = crearIcono("Portatil");
export const EnlaceIcon = crearIcono("Enlace");
export const VinculoIcon = crearIcono("Vinculo");
export const MenuIcon = crearIcono("Menu");
export const CargandoIcon = crearIcono("Cargando");
export const CandadoIcon = crearIcono("Candado");
export const SalirIcon = crearIcono("Salir");
export const CorreoIcon = crearIcono("Correo");
export const DispositivosIcon = crearIcono("Dispositivos");
export const MasIcon = crearIcono("Mas");
export const ImprimirIcon = crearIcono("Imprimir");
export const ReciboIcon = crearIcono("Recibo");
export const ActualizarIcon = crearIcono("Actualizar");
export const BalanzaIcon = crearIcono("Balanza");
export const BuscarIcon = crearIcono("Buscar");
export const EscudoIcon = crearIcono("Escudo");
export const EscudoAlertaIcon = crearIcono("EscudoAlerta");
export const EscudoVistoIcon = crearIcono("EscudoVisto");
export const AdvertenciaIcon = crearIcono("Advertencia");
export const EnlaceRotoIcon = crearIcono("EnlaceRoto");
export const SubirIcon = crearIcono("Subir");
export const UsuarioAjustesIcon = crearIcono("UsuarioAjustes");
export const UsuarioQuitarIcon = crearIcono("UsuarioQuitar");
export const UsuarioAgregarIcon = crearIcono("UsuarioAgregar");
export const UsuarioIcon = crearIcono("Usuario");
export const UsuariosIcon = crearIcono("Usuarios");
export const CerrarIcon = crearIcono("Cerrar");

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

/** Huella de un archivo: crestas concéntricas con 3 px entre ejes, abiertas por abajo. */
export const HuellaIcon = crearPropio(
  "HuellaIcon",
  <>
    <path d="M3 16v-4a9 9 0 0 1 18 0v1" />
    <path d="M21 16.5v2.5" />
    <path d="M6 20v-8a6 6 0 0 1 12 0v5" />
    <path d="M9 21v-9a3 3 0 0 1 6 0v6" />
    <path d="M12 14v7" />
  </>,
);

/** Sello de tiempo: borde dentado y las manecillas de un reloj. */
export const SelloIcon = crearPropio(
  "SelloIcon",
  <>
    <path d="M12 2.2L14.17 3.89L16.9 3.51L17.94 6.06L20.49 7.1L20.11 9.83L21.8 12L20.11 14.17L20.49 16.9L17.94 17.94L16.9 20.49L14.17 20.11L12 21.8L9.83 20.11L7.1 20.49L6.06 17.94L3.51 16.9L3.89 14.17L2.2 12L3.89 9.83L3.51 7.1L6.06 6.06L7.1 3.51L9.83 3.89z" />
    <path d="M12 8v4l2.5 1.5" />
  </>,
);

/** Cadena de custodia: dos eslabones inclinados que se enlazan por el centro. */
export const CadenaIcon = crearPropio(
  "CadenaIcon",
  <>
    <rect
      x="3"
      y="11.5"
      width="12"
      height="7"
      rx="3.5"
      transform="rotate(-45 9 15)"
    />
    <rect
      x="9"
      y="5.5"
      width="12"
      height="7"
      rx="3.5"
      transform="rotate(-45 15 9)"
    />
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
