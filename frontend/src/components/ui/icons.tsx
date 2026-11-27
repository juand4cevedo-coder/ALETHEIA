// Módulo solo de íconos generados por fábricas: la recarga en caliente no aplica.
/* oxlint-disable react/only-export-components */
// Íconos de la interfaz: única puerta de entrada. Phosphor en peso duotone (regular en los controles pequeños) más los tres
// propios (sello, cadena y paquete), dibujados con el mismo trazo. Ningún archivo
// importa íconos de otra parte. Cada ícono de Phosphor vive en su archivo (carpeta icons): una
// pantalla descarga solo los que dibuja, y la landing no carga los del espacio de trabajo.
import { crearPropio } from "./icons/fabrica.tsx";

export type { IconComponent, IconProps } from "./icons/fabrica.tsx";

export { FlechaDerechaIcon } from "./icons/FlechaDerecha.ts";
export { FlechaDiagonalIcon } from "./icons/FlechaDiagonal.ts";
export { EdificioIcon } from "./icons/Edificio.ts";
export { VistoIcon } from "./icons/Visto.ts";
export { ChevronAbajoIcon } from "./icons/ChevronAbajo.ts";
export { ChevronDerechaIcon } from "./icons/ChevronDerecha.ts";
export { CirculoAlertaIcon } from "./icons/CirculoAlerta.ts";
export { CirculoVistoIcon } from "./icons/CirculoVisto.ts";
export { RelojIcon } from "./icons/Reloj.ts";
export { GalletaIcon } from "./icons/Galleta.ts";
export { DescargarIcon } from "./icons/Descargar.ts";
export { OjoIcon } from "./icons/Ojo.ts";
export { OjoTachadoIcon } from "./icons/OjoTachado.ts";
export { ArchivoBusquedaIcon } from "./icons/ArchivoBusqueda.ts";
export { ArchivoSubirIcon } from "./icons/ArchivoSubir.ts";
export { CarpetaAbiertaIcon } from "./icons/CarpetaAbierta.ts";
export { DiscoIcon } from "./icons/Disco.ts";
export { InicioIcon } from "./icons/Inicio.ts";
export { InfoIcon } from "./icons/Info.ts";
export { LlaveIcon } from "./icons/Llave.ts";
export { InstitucionIcon } from "./icons/Institucion.ts";
export { EnlaceIcon } from "./icons/Enlace.ts";
export { VinculoIcon } from "./icons/Vinculo.ts";
export { MenuIcon } from "./icons/Menu.ts";
export { CargandoIcon } from "./icons/Cargando.ts";
export { SalirIcon } from "./icons/Salir.ts";
export { CorreoIcon } from "./icons/Correo.ts";
export { DispositivosIcon } from "./icons/Dispositivos.ts";
export { MasIcon } from "./icons/Mas.ts";
export { ImprimirIcon } from "./icons/Imprimir.ts";
export { ReciboIcon } from "./icons/Recibo.ts";
export { ActualizarIcon } from "./icons/Actualizar.ts";
export { BalanzaIcon } from "./icons/Balanza.ts";
export { BuscarIcon } from "./icons/Buscar.ts";
export { EscudoAlertaIcon } from "./icons/EscudoAlerta.ts";
export { EscudoVistoIcon } from "./icons/EscudoVisto.ts";
export { AdvertenciaIcon } from "./icons/Advertencia.ts";
export { EnlaceRotoIcon } from "./icons/EnlaceRoto.ts";
export { UsuarioAjustesIcon } from "./icons/UsuarioAjustes.ts";
export { UsuarioQuitarIcon } from "./icons/UsuarioQuitar.ts";
export { UsuarioAgregarIcon } from "./icons/UsuarioAgregar.ts";
export { UsuarioIcon } from "./icons/Usuario.ts";
export { UsuariosIcon } from "./icons/Usuarios.ts";
export { CampanaIcon } from "./icons/Campana.ts";
export { CerrarIcon } from "./icons/Cerrar.ts";
export { HuellaIcon } from "./icons/Huella.ts";
export { LibroIcon } from "./icons/Libro.ts";
export { CalendarioIcon } from "./icons/Calendario.ts";
export { TareasIcon } from "./icons/Tareas.ts";
export { CandadoIcon } from "./icons/Candado.ts";
export { GraficaIcon } from "./icons/Grafica.ts";
export { DocumentoIcon } from "./icons/Documento.ts";

export { SolIcon } from "./icons/Sol.tsx";
export { LunaIcon } from "./icons/Luna.tsx";
export { MonitorIcon } from "./icons/Monitor.tsx";
export { PanelLateralIcon } from "./icons/PanelLateral.tsx";
export { PulsoIcon } from "./icons/Pulso.tsx";
export { EtiquetaIcon } from "./icons/Etiqueta.tsx";

// Íconos propios: ver crearPropio.

/** Sello de tiempo: borde dentado y las manecillas de un reloj. */
export const SelloIcon = /* @__PURE__ */ crearPropio(
  "SelloIcon",
  <>
    <path
      fill="currentColor"
      fillOpacity="0.2"
      d="M12 2.2L14.17 3.89L16.9 3.51L17.94 6.06L20.49 7.1L20.11 9.83L21.8 12L20.11 14.17L20.49 16.9L17.94 17.94L16.9 20.49L14.17 20.11L12 21.8L9.83 20.11L7.1 20.49L6.06 17.94L3.51 16.9L3.89 14.17L2.2 12L3.89 9.83L3.51 7.1L6.06 6.06L7.1 3.51L9.83 3.89z"
    />
    <path d="M12 8v4l2.5 1.5" />
  </>,
);

/** Cadena de custodia: dos eslabones inclinados que se enlazan por el centro. */
export const CadenaIcon = /* @__PURE__ */ crearPropio(
  "CadenaIcon",
  <>
    <rect
      fill="currentColor"
      fillOpacity="0.2"
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
export const PaqueteIcon = /* @__PURE__ */ crearPropio(
  "PaqueteIcon",
  <>
    <path
      fill="currentColor"
      fillOpacity="0.2"
      d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z"
    />
    <path d="M3.5 7.5L12 12l8.5-4.5" />
    <path d="M12 12v9" />
  </>,
);
