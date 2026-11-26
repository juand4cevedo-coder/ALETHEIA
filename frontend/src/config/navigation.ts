import { LEGAL_PAGES, legalRoute, ROUTES } from "./routes.ts";

export type NavigationLink = {
  to: string;
  label: string;
  description?: string;
};
export type NavigationGroup = {
  title: string;
  links: NavigationLink[];
  // El ícono de cada grupo vive en navigationIcons.ts, que solo se descarga al abrir un menú.
  feature: { to: string; title: string; text: string };
};

export const NAVIGATION: NavigationGroup[] = [
  {
    title: "Producto",
    links: [
      {
        to: ROUTES.howItWorks,
        label: "Gestión de casos",
        description: "Radicado, equipo, tareas y evidencia de cada asunto.",
      },
      {
        to: "/empresa",
        label: "Equipo y permisos",
        description: "Cada persona ve solo los casos donde la agregan.",
      },
      {
        to: ROUTES.verifier,
        label: "Comprobador de archivos",
        description: "Compare un archivo con el manifiesto de su paquete.",
      },
      {
        to: "/seguridad",
        label: "Seguridad",
        description: "Cifrado por caso, custodia y verificación en dos pasos.",
      },
    ],
    feature: {
      to: "/#recorrido",
      title: "Su espacio de trabajo",
      text: "Capturas reales del panel, los casos y la custodia.",
    },
  },
  {
    title: "Equipos",
    links: [
      {
        to: "/empresa",
        label: "Para firmas jurídicas",
        description:
          "Roles, cupos y precio para un despacho de varias personas.",
      },
      {
        to: "/docs/invitar-al-equipo",
        label: "Colaboración y roles",
        description:
          "Qué puede hacer un abogado, un asistente o un administrador.",
      },
      {
        to: "/seguridad",
        label: "Controles de acceso",
        description: "Sesiones, permisos por caso y auditoría del despacho.",
      },
      {
        to: "/soporte",
        label: "Hablemos de su equipo",
        description: "Teléfono, correo y plazos de respuesta.",
      },
    ],
    feature: {
      to: "/empresa",
      title: "Un despacho, varios casos",
      text: "Así trabaja un equipo de cinco personas en ALETHEIA.",
    },
  },
  {
    title: "Recursos",
    links: [
      {
        to: "/docs/introduccion",
        label: "Documentación",
        description:
          "Guías paso a paso, de la cuenta al paquete de preservación.",
      },
      {
        to: "/blog",
        label: "Artículos",
        description: "Evidencia digital, Ley 527 y práctica del despacho.",
      },
      {
        to: "/ayuda",
        label: "Base de conocimiento",
        description: "Respuestas cortas a las dudas más comunes.",
      },
    ],
    feature: {
      to: "/docs/introduccion",
      title: "Su primer caso en diez minutos",
      text: "De crear la cuenta a subir el primer archivo sellado.",
    },
  },
  {
    title: "Nosotros",
    links: [
      {
        to: "/nosotros",
        label: "Sobre ALETHEIA",
        description: "Quién lo construye y quién responde por sus datos.",
      },
      {
        to: "/filosofia",
        label: "Nuestra filosofía",
        description: "Lo que hace, lo que no hace y por qué.",
      },
      {
        to: "/seguridad",
        label: "Seguridad",
        description: "Cifrado, custodia y control de acceso.",
      },
      {
        to: "/estado",
        label: "Estado del servicio",
        description: "Compruebe si el servicio responde ahora.",
      },
    ],
    feature: {
      to: "/nosotros",
      title: "Quién está detrás",
      text: "El fundador, desde Bello, Antioquia, con nombre y contacto.",
    },
  },
];

export const FOOTER_NAVIGATION: { title: string; links: NavigationLink[] }[] = [
  { title: "Producto", links: NAVIGATION[0]!.links },
  {
    title: "Recursos",
    links: [
      { to: "/docs/introduccion", label: "Documentación" },
      { to: "/blog", label: "Blog" },
      { to: ROUTES.pricing, label: "Precios" },
      { to: "/marca", label: "Marca" },
    ],
  },
  {
    title: "Compañía",
    links: [
      { to: "/nosotros", label: "Sobre ALETHEIA" },
      { to: "/filosofia", label: "Filosofía" },
      { to: "/empresa", label: "Para equipos" },
    ],
  },
  {
    title: "Ayuda",
    links: [
      { to: "/soporte", label: "Soporte" },
      { to: "/estado", label: "Estado del servicio" },
      { to: "/ayuda", label: "Base de conocimiento" },
    ],
  },
  {
    title: "Legal",
    links: [
      { to: "/legal", label: "Información legal" },
      ...LEGAL_PAGES.map((page) => ({
        to: legalRoute(page.slug),
        label: page.label,
      })),
    ],
  },
];
