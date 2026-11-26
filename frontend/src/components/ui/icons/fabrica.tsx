// Fábricas de los íconos de la interfaz. Nadie importa de aquí salvo icons.tsx y los archivos
// de esta carpeta: el resto del código usa components/ui/icons.tsx.
import {
  type ComponentType,
  forwardRef,
  type ReactElement,
  type Ref,
  type SVGProps,
} from "react";

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

/** Un elemento del dibujo de Phosphor, en su cuadrícula de 256 px. */
export type Elemento = readonly [
  etiqueta: "path" | "circle" | "rect" | "line" | "polyline",
  atributos: Readonly<Record<string, string>>,
];

const TAMANO_PREDETERMINADO = 16;

/** La capa suave de los duotone toma su color de --icon-duo y su opacidad de
 * --icon-duo-opacity. Sin ellas es el color del texto al 20 %, como en Phosphor; un contenedor
 * puede cambiarla, por ejemplo al latón de la marca en el enlace activo del menú. */
const CAPA_SUAVE = {
  fill: "var(--icon-duo, currentColor)",
  opacity: "var(--icon-duo-opacity, 0.2)",
} as const;

function conCapa(atributos: Readonly<Record<string, string>>) {
  if (atributos.opacity !== "0.2") return atributos;
  const { opacity: _opacidad, ...resto } = atributos;
  return { ...resto, style: CAPA_SUAVE };
}

/** Atributos de accesibilidad: decorativo salvo que se pase un título o una etiqueta. */
function accesibilidad(
  title: string | undefined,
  props: IconProps,
): Record<string, unknown> {
  const nombrado = Boolean(title) || Boolean(props["aria-label"]);
  if (nombrado) return { role: "img" };
  return { "aria-hidden": props["aria-hidden"] ?? true };
}

/** Ícono de Phosphor en peso duotone o regular: relleno con el color del texto, con la capa
 * suave al 20 % de opacidad que ya trae el dibujo. Cada ícono vive en su
 * propio archivo, así una pantalla descarga solo los que dibuja. */
export function crearIcono(
  clave: string,
  elementos: readonly Elemento[],
): IconComponent {
  const dibujo = elementos.map(
    ([etiqueta, atributos]) => [etiqueta, conCapa(atributos)] as const,
  );
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
        {dibujo.map(([Etiqueta, atributos], i) => (
          <Etiqueta key={i} {...atributos} />
        ))}
      </svg>
    ),
  );
  Icono.displayName = clave + "Icon";
  return Icono;
}

/** Ícono propio. Cuadrícula de 24 px, trazo de 1,5 (el de Phosphor regular a 24 px: 16 de 256), capa de relleno al 20 %, extremos
 * y uniones redondeados, color heredado del texto. */
export function crearPropio(
  nombre: string,
  trazado: ReactElement,
): IconComponent {
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
