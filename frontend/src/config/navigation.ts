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
        description: "Cada asunto, en su lugar.",
      },
      {
        to: "/empresa",
        label: "Equipo y permisos",
        description: "Acceso con responsabilidades claras.",
      },
      {
        to: ROUTES.verifier,
        label: "Comprobador de archivos",
        description: "Compare un archivo con su manifiesto.",
      },
      {
        to: "/seguridad",
        label: "Seguridad",
        description: "Conozca cómo cuidamos el acceso.",
      },
    ],
    feature: {
      to: "/#recorrido",
      title: "Su espacio de trabajo",
      text: "Conozca Aletheia por dentro.",
    },
  },
  {
    title: "Equipos",
    links: [
      {
        to: "/empresa",
        label: "Para firmas jurídicas",
        description: "Despachos con varias personas y casos.",
      },
      {
        to: "/docs/invitar-al-equipo",
        label: "Colaboración y roles",
        description: "Quién ve y hace qué en cada caso.",
      },
      {
        to: "/seguridad",
        label: "Controles de acceso",
        description: "Sesiones, permisos y auditoría.",
      },
      {
        to: "/soporte",
        label: "Hablemos de su equipo",
        description: "Resolvemos sus dudas de implementación.",
      },
    ],
    feature: {
      to: "/empresa",
      title: "Un mismo contexto",
      text: "Personas, casos y responsabilidades.",
    },
  },
  {
    title: "Recursos",
    links: [
      {
        to: "/docs",
        label: "Documentación",
        description: "Empiece a trabajar con Aletheia.",
      },
      {
        to: "/blog",
        label: "Artículos y novedades",
        description: "Ideas para trabajar con evidencia digital.",
      },
      {
        to: ROUTES.verifierSection,
        label: "Probar el comprobador",
        description: "Calcule una huella sin subir el archivo.",
      },
      {
        to: "/ayuda",
        label: "Base de conocimiento",
        description: "Respuestas a las preguntas frecuentes.",
      },
    ],
    feature: {
      to: "/docs",
      title: "Del primer paso al caso",
      text: "Guías, respuestas y recursos en español.",
    },
  },
  {
    title: "Aletheia",
    links: [
      {
        to: "/nosotros",
        label: "Sobre Aletheia",
        description: "Quiénes somos y qué hacemos.",
      },
      {
        to: "/filosofia",
        label: "Nuestra filosofía",
        description: "Preservar y documentar, nada más.",
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
      title: "La claridad empieza aquí",
      text: "Conozca el propósito detrás de Aletheia.",
    },
  },
];

export const FOOTER_NAVIGATION: { title: string; links: NavigationLink[] }[] = [
  { title: "Producto", links: NAVIGATION[0]!.links },
  {
    title: "Recursos",
    links: [
      { to: "/docs", label: "Documentación" },
      { to: "/blog", label: "Blog" },
      { to: ROUTES.pricing, label: "Precios" },
      { to: "/marca", label: "Marca" },
    ],
  },
  {
    title: "Compañía",
    links: [
      { to: "/nosotros", label: "Sobre Aletheia" },
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
