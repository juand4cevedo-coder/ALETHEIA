import { CONTACT_EMAIL, SITE_NAME, SITE_URL } from "../config/site.ts";
import type { PlanPublicado } from "./catalogo.ts";
import type { MetaPagina } from "./paginas.ts";

// Datos estructurados (schema.org en JSON-LD) de cada página. Van en
// <script type="application/ld+json">: el navegador no los ejecuta, así que la política de
// seguridad de contenido (CSP), que prohíbe los scripts en línea, no los bloquea.

export type Pregunta = { pregunta: string; respuesta: string };
type Objeto = Record<string, unknown>;

export const AUTOR = "Juan Diego Acevedo Calderón";
const ORGANIZACION = `${SITE_URL}/#organizacion`;
const SITIO = `${SITE_URL}/#sitio`;
const FUNDADOR = `${SITE_URL}/nosotros#fundador`;

function organizacion(): Objeto {
  return {
    "@type": "Organization",
    "@id": ORGANIZACION,
    name: SITE_NAME,
    url: SITE_URL + "/",
    logo: `${SITE_URL}/icon-512.png`,
    email: CONTACT_EMAIL,
    founder: { "@id": FUNDADOR },
    address: {
      "@type": "PostalAddress",
      streetAddress: "Avenida 40 # 62-56",
      addressLocality: "Bello",
      addressRegion: "Antioquia",
      addressCountry: "CO",
    },
  };
}

/** Quien funda y escribe: la misma persona en la organización y en los artículos. */
function fundador(): Objeto {
  return {
    "@type": "Person",
    "@id": FUNDADOR,
    name: AUTOR,
    url: `${SITE_URL}/nosotros`,
    jobTitle: "Fundador de ALETHEIA",
    image: `${SITE_URL}/media/team/fundador-800.webp`,
    worksFor: { "@id": ORGANIZACION },
  };
}

function sitio(): Objeto {
  return {
    "@type": "WebSite",
    "@id": SITIO,
    name: SITE_NAME,
    url: SITE_URL + "/",
    inLanguage: "es-CO",
    publisher: { "@id": ORGANIZACION },
  };
}

function precio(valor: number, duracion: "P1M" | "P1Y"): Objeto {
  return {
    "@type": "UnitPriceSpecification",
    price: valor,
    priceCurrency: "COP",
    billingDuration: duracion,
  };
}

function oferta(plan: PlanPublicado): Objeto {
  if (plan.diasDePrueba !== null) {
    // La prueba no se cobra ni se renueva: dura unos días y termina.
    return {
      "@type": "Offer",
      name: plan.nombre,
      price: 0,
      priceCurrency: "COP",
      url: `${SITE_URL}/registro`,
      eligibleDuration: {
        "@type": "QuantitativeValue",
        value: plan.diasDePrueba,
        unitCode: "DAY",
      },
    };
  }
  return {
    "@type": "Offer",
    name: plan.nombre,
    price: plan.mensual,
    priceCurrency: "COP",
    url: `${SITE_URL}/precios`,
    priceSpecification: [
      precio(plan.mensual, "P1M"),
      ...(plan.anual === null ? [] : [precio(plan.anual, "P1Y")]),
    ],
    ...(plan.usuarioAdicional === null
      ? {}
      : {
          addOn: {
            "@type": "Offer",
            name: `Usuario adicional del plan ${plan.nombre}`,
            priceCurrency: "COP",
            priceSpecification: precio(plan.usuarioAdicional, "P1M"),
          },
        }),
  };
}

function aplicacion(planes: readonly PlanPublicado[]): Objeto {
  return {
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    url: SITE_URL + "/",
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Software jurídico",
    operatingSystem: "Web",
    inLanguage: "es-CO",
    publisher: { "@id": ORGANIZACION },
    offers: planes.map(oferta),
  };
}

/** El comprobador público: una herramienta gratuita que funciona en el navegador. */
function comprobador(meta: MetaPagina): Objeto {
  return {
    "@type": "WebApplication",
    name: "Comprobador de huellas SHA-256 de ALETHEIA",
    url: meta.canonica,
    description: meta.descripcion,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web",
    browserRequirements: "Un navegador actual con JavaScript",
    isAccessibleForFree: true,
    inLanguage: "es-CO",
    offers: { "@type": "Offer", price: 0, priceCurrency: "COP" },
    publisher: { "@id": ORGANIZACION },
  };
}

function articulo(meta: MetaPagina, titular: string): Objeto {
  return {
    "@type": "Article",
    headline: titular,
    description: meta.descripcion,
    datePublished: meta.publicado,
    dateModified: meta.actualizado ?? meta.publicado,
    articleSection: meta.seccion,
    inLanguage: "es-CO",
    image: SITE_URL + meta.imagen,
    author: { "@id": FUNDADOR },
    publisher: { "@id": ORGANIZACION },
    mainEntityOfPage: meta.canonica,
  };
}

/** Guía de la documentación. */
function guia(meta: MetaPagina, titular: string): Objeto {
  return {
    "@type": "TechArticle",
    headline: titular,
    description: meta.descripcion,
    inLanguage: "es-CO",
    author: { "@id": ORGANIZACION },
    publisher: { "@id": ORGANIZACION },
    mainEntityOfPage: meta.canonica,
  };
}

function migas(meta: MetaPagina, nombre: string): Objeto {
  const pasos = [...(meta.migas ?? []), { nombre, ruta: meta.ruta }];
  return {
    "@type": "BreadcrumbList",
    itemListElement: pasos.map((paso, indice) => ({
      "@type": "ListItem",
      position: indice + 1,
      name: paso.nombre,
      item: SITE_URL + paso.ruta,
    })),
  };
}

function preguntasFrecuentes(preguntas: readonly Pregunta[]): Objeto {
  return {
    "@type": "FAQPage",
    mainEntity: preguntas.map((item) => ({
      "@type": "Question",
      name: item.pregunta,
      acceptedAnswer: { "@type": "Answer", text: item.respuesta },
    })),
  };
}

/** Lo que cada página declara. `nombre` es como se llama la página en la ruta de navegación
 * (el titular del artículo o de la guía, sin la marca). `preguntas` son las de la página, tal
 * como se dibujan; si no tiene, va vacío. */
export function datosEstructurados(
  meta: MetaPagina,
  contexto: {
    nombre: string;
    planes: readonly PlanPublicado[];
    preguntas: readonly Pregunta[];
  },
): Objeto {
  const grafo: Objeto[] = [organizacion(), sitio(), fundador()];
  if (meta.ruta === "/" || meta.ruta === "/precios") {
    grafo.push(aplicacion(contexto.planes));
  }
  if (meta.ruta === "/verificador") grafo.push(comprobador(meta));
  if (contexto.preguntas.length) {
    grafo.push(preguntasFrecuentes(contexto.preguntas));
  }
  if (meta.tipo === "article") grafo.push(articulo(meta, contexto.nombre));
  if (meta.ruta.startsWith("/docs/") && meta.enMapa) {
    grafo.push(guia(meta, contexto.nombre));
  }
  if (meta.migas?.length) grafo.push(migas(meta, contexto.nombre));
  return { "@context": "https://schema.org", "@graph": grafo };
}
