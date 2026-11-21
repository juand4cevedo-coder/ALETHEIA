import { LEGAL_PAGES, legalRoute, ROUTES } from "./routes.ts";

export type NavigationLink = {
  to: string;
  label: string;
  description?: string;
};
export type NavigationGroup = {
  title: string;
  links: NavigationLink[];
  feature: { to: string; title: string; text: string; image: string };
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
      image: "/media/campaign/producto-real.jpg",
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
      image: "/media/campaign/equipo-real.jpg",
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
      { to: "/blog", label: "Artículos y novedades" },
      { to: ROUTES.verifierSection, label: "Probar el comprobador" },
      { to: "/ayuda", label: "Base de conocimiento" },
    ],
    feature: {
      to: "/docs",
      title: "Del primer paso al caso",
      text: "Guías, respuestas y recursos en español.",
      image: "/media/campaign/producto-real.jpg",
    },
  },
  {
    title: "Aletheia",
    links: [
      { to: "/nosotros", label: "Sobre Aletheia" },
      { to: "/filosofia", label: "Nuestra filosofía" },
      { to: "/seguridad", label: "Seguridad" },
      { to: "/estado", label: "Estado del servicio" },
    ],
    feature: {
      to: "/nosotros",
      title: "La claridad empieza aquí",
      text: "Conozca el propósito detrás de Aletheia.",
      image: "/media/campaign/hero-real.jpg",
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
