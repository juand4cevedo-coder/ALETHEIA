import {
  type MetaPagina,
  PAGINA_INICIO,
  PAGINA_NO_ENCONTRADA,
  MARCA,
  pagina,
} from "./paginas.ts";
import { MIGA_INICIO } from "./contenidos.ts";

// Fichas de las páginas públicas de dirección fija (título, descripción y dirección canónica).
// Viven aparte de paginas.ts para que la descarga inicial solo lleve la de la portada y la 404.

/** Páginas públicas de dirección fija. */
export const PAGINAS = {
  inicio: PAGINA_INICIO,
  precios: pagina("/precios", {
    titulo: "Precios del software para abogados" + MARCA,
    descripcion:
      "Planes de ALETHEIA en pesos colombianos, con pago mensual o anual. Compare usuarios incluidos, almacenamiento y tamaño máximo por archivo de cada plan.",
  }),
  registro: pagina("/registro", {
    titulo: "Crear una cuenta para su despacho" + MARCA,
    descripcion:
      "Cree la cuenta de su despacho con Google o con su correo y empiece la prueba gratuita de ALETHEIA. No necesita tarjeta de crédito para registrarse.",
  }),
  verificador: pagina("/verificador", {
    titulo: "Verificar el hash SHA-256 de un archivo" + MARCA,
    descripcion:
      "Compare en su navegador un archivo con el manifiesto de un paquete de preservación de ALETHEIA mediante su hash SHA-256. El archivo no sale de su equipo.",
  }),
  blog: pagina("/blog", {
    titulo: "Blog sobre evidencia digital y práctica jurídica" + MARCA,
    descripcion:
      "Artículos para abogados sobre evidencia digital y el trabajo con casos, por ejemplo qué permite concluir una huella SHA-256 y qué no permite concluir.",
    migas: [MIGA_INICIO],
  }),
  ayuda: pagina("/ayuda", {
    titulo: "Base de conocimiento del software jurídico" + MARCA,
    descripcion:
      "Guías breves para usar ALETHEIA: crear un caso, invitar a su equipo, verificar un archivo con su manifiesto y recuperar el acceso a su cuenta.",
  }),
  filosofia: pagina("/filosofia", {
    titulo: "Cómo pensamos el software jurídico" + MARCA,
    descripcion:
      "Los principios con que se diseña ALETHEIA: mostrar el contexto de cada caso, explicar qué permite concluir una huella y no prometer más de lo que hace.",
  }),
  nosotros: pagina("/nosotros", {
    titulo: "Quién está detrás del software para abogados" + MARCA,
    descripcion:
      "Quién construye y opera ALETHEIA, quién responde por el servicio y por sus datos, y cómo escribirle con preguntas o problemas sobre el producto.",
  }),
  seguridad: pagina("/seguridad", {
    titulo: "Seguridad de los casos y la evidencia" + MARCA,
    descripcion:
      "Cómo protege ALETHEIA el acceso: un caso solo lo abren sus miembros, usted cierra sus sesiones desde la cuenta y la huella se calcula en su navegador.",
  }),
  soporte: pagina("/soporte", {
    titulo: "Soporte para usuarios del software jurídico" + MARCA,
    descripcion:
      "Resuelva sus dudas sobre ALETHEIA con la base de conocimiento o escríbanos indicando la pantalla, la acción que intentó y el mensaje que apareció.",
  }),
  empresa: pagina("/empresa", {
    titulo: "Software jurídico para firmas y equipos" + MARCA,
    descripcion:
      "Para firmas con varios abogados: cada persona entra con su propia invitación y su rol, y en ALETHEIA solo los miembros de un caso pueden abrirlo.",
  }),
  marca: pagina("/marca", {
    titulo: "Uso de la marca y descarga del símbolo" + MARCA,
    descripcion:
      "Uso del nombre y del símbolo de ALETHEIA: proporciones, espacio libre y contraste, con el símbolo violeta y el blanco para descargar en formato SVG.",
  }),
  estado: pagina("/estado", {
    titulo: "Estado del servicio" + MARCA,
    descripcion:
      "Consulte si ALETHEIA responde en este momento. La página prueba la conexión con la API y con la base de datos y muestra la hora de la comprobación.",
  }),
  legal: pagina("/legal", {
    titulo: "Términos, privacidad y textos legales" + MARCA,
    descripcion:
      "Textos legales de ALETHEIA: términos del servicio, tratamiento de datos personales, cookies y reembolsos, cada uno con su fecha de vigencia y su copia.",
  }),
  noEncontrada: PAGINA_NO_ENCONTRADA,
} satisfies Record<string, MetaPagina>;

/** Página informativa por su segmento («filosofia»), si existe. */
export function paginaInformativa(segmento: string): MetaPagina | undefined {
  const pagina = (PAGINAS as Record<string, MetaPagina>)[segmento];
  return pagina?.ruta === "/" + segmento ? pagina : undefined;
}
