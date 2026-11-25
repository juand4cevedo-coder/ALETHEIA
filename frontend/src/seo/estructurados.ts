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
const IMAGEN = `${SITE_URL}/og-image.png`;

function organizacion(): Objeto {
  return {
    "@type": "Organization",
    "@id": ORGANIZACION,
    name: SITE_NAME,
    url: SITE_URL + "/",
    logo: `${SITE_URL}/icon-512.png`,
    email: CONTACT_EMAIL,
    founder: { "@type": "Person", name: AUTOR },
    address: {
      "@type": "PostalAddress",
      streetAddress: "Avenida 40 # 62-56",
      addressLocality: "Bello",
      addressRegion: "Antioquia",
      addressCountry: "CO",
    },
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
    offers: planes.map((plan) => ({
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
    })),
  };
}

function articulo(meta: MetaPagina, titular: string): Objeto {
  return {
    "@type": "Article",
    headline: titular,
    description: meta.descripcion,
    datePublished: meta.publicado,
    dateModified: meta.publicado,
    articleSection: meta.seccion,
    inLanguage: "es-CO",
    image: IMAGEN,
    author: { "@type": "Person", name: AUTOR },
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
 * (el titular del artículo o de la guía, sin la marca). */
export function datosEstructurados(
  meta: MetaPagina,
  contexto: {
    nombre: string;
    planes: readonly PlanPublicado[];
    preguntas: readonly Pregunta[];
  },
): Objeto {
  const grafo: Objeto[] = [organizacion(), sitio()];
  if (meta.ruta === "/" || meta.ruta === "/precios") {
    grafo.push(aplicacion(contexto.planes));
  }
  if (meta.ruta === "/" && contexto.preguntas.length) {
    grafo.push(preguntasFrecuentes(contexto.preguntas));
  }
  if (meta.tipo === "article") grafo.push(articulo(meta, contexto.nombre));
  if (meta.migas?.length) grafo.push(migas(meta, contexto.nombre));
  return { "@context": "https://schema.org", "@graph": grafo };
}
