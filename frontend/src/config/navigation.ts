import { LEGAL_PAGES, legalRoute, ROUTES } from "./routes.ts";

export type NavigationLink = {
  to: string;
  label: string;
  description?: string;
};
export type NavigationGroup = {
  title: string;
  links: NavigationLink[];
  feature: { to: string; title: string; text: string; illustration: string };
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
        to: ROUTES.verifierSection,
        label: "Comprobador de archivos",
        description: "Compare una huella SHA-256.",
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
      illustration: "workspace",
    },
  },
  {
    title: "Compañía",
    links: [
      { to: "/nosotros", label: "Sobre Aletheia" },
      { to: "/filosofia", label: "Nuestra filosofía" },
      { to: "/blog", label: "Blog" },
      { to: "/marca", label: "Marca" },
    ],
    feature: {
      to: "/filosofia",
      title: "La claridad empieza aquí",
      text: "El propósito detrás de Aletheia.",
      illustration: "brand",
    },
  },
  {
    title: "Equipos",
    links: [
      { to: "/empresa", label: "Para firmas jurídicas" },
      { to: "/docs/invitar-al-equipo", label: "Colaboración y roles" },
      { to: "/seguridad", label: "Controles de acceso" },
      { to: "/soporte", label: "Hablemos de su equipo" },
    ],
    feature: {
      to: "/empresa",
      title: "Un mismo contexto",
      text: "Personas, casos y responsabilidades.",
      illustration: "team",
    },
  },
  {
    title: "Ayuda",
    links: [
      { to: "/soporte", label: "Contactar con soporte" },
      { to: "/ayuda", label: "Base de conocimiento" },
      { to: "/estado", label: "Estado del servicio" },
      { to: "/legal", label: "Información legal" },
    ],
    feature: {
      to: "/ayuda/recuperar-el-acceso",
      title: "Encuentre una respuesta",
      text: "Una guía para cada primer paso.",
      illustration: "help",
    },
  },
  {
    title: "Docs",
    links: [
      {
        to: "/docs",
        label: "Introducción",
        description: "Empiece a trabajar con Aletheia.",
      },
      {
        to: "/docs/crear-un-caso",
        label: "Casos",
        description: "Cree y encuentre sus asuntos.",
      },
      {
        to: "/docs/invitar-al-equipo",
        label: "Organizaciones",
        description: "Invite a las personas de su equipo.",
      },
      {
        to: "/docs/verificar-un-archivo",
        label: "Integridad",
        description: "Entienda la comparación de huellas.",
      },
    ],
    feature: {
      to: "/docs",
      title: "De la idea al primer caso",
      text: "Documentación en español.",
      illustration: "docs",
    },
  },
  {
    title: "Recursos",
    links: [
      { to: "/blog", label: "Artículos y novedades" },
      {
        to: "/blog/que-dice-una-huella-sha256",
        label: "Entender una huella digital",
      },
      { to: ROUTES.verifierSection, label: "Probar el comprobador" },
      { to: "/marca", label: "Recursos de marca" },
    ],
    feature: {
      to: "/blog",
      title: "Cada detalle cuenta",
      text: "Lecturas para su práctica diaria.",
      illustration: "journal",
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
