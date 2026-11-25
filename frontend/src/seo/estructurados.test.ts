import { describe, expect, it } from "vitest";

import { JOURNAL } from "../content/journal.ts";
import { PLANES_PUBLICADOS } from "./catalogo.ts";
import { AUTOR, datosEstructurados } from "./estructurados.ts";
import { PAGINAS } from "./fichas.ts";
import { metaArticulo } from "./contenidos.ts";

const preguntas = [{ pregunta: "¿Qué es?", respuesta: "Una prueba." }];
const contexto = { nombre: "Página", planes: PLANES_PUBLICADOS, preguntas };

function tipos(datos: Record<string, unknown>): string[] {
  return (datos["@graph"] as { "@type": string }[]).map(
    (item) => item["@type"],
  );
}

function del(datos: Record<string, unknown>, tipo: string) {
  return (datos["@graph"] as Record<string, unknown>[]).find(
    (item) => item["@type"] === tipo,
  )!;
}

describe("datos estructurados", () => {
  it("todas las páginas declaran la organización y el sitio", () => {
    const datos = datosEstructurados(PAGINAS.seguridad, contexto);
    expect(datos["@context"]).toBe("https://schema.org");
    expect(tipos(datos)).toEqual(["Organization", "WebSite"]);
    expect(del(datos, "Organization")).toMatchObject({
      name: "ALETHEIA",
      email: "contacto@aletheia.sbs",
      founder: { name: AUTOR },
    });
  });

  it("la portada lleva la aplicación con sus precios en pesos y las preguntas", () => {
    const datos = datosEstructurados(PAGINAS.inicio, contexto);
    expect(tipos(datos)).toEqual([
      "Organization",
      "WebSite",
      "SoftwareApplication",
      "FAQPage",
    ]);
    const ofertas = del(datos, "SoftwareApplication").offers as {
      name: string;
      price: number;
      priceCurrency: string;
      addOn?: { priceSpecification: { price: number } };
    }[];
    expect(ofertas.map((oferta) => oferta.name)).toEqual(
      PLANES_PUBLICADOS.map((plan) => plan.nombre),
    );
    expect(ofertas.every((oferta) => oferta.priceCurrency === "COP")).toBe(
      true,
    );
    const profesional = ofertas.find(
      (oferta) => oferta.name === "Profesional",
    )!;
    expect(profesional.price).toBe(59_900);
    expect(profesional.addOn?.priceSpecification.price).toBe(19_900);
    expect(del(datos, "FAQPage").mainEntity).toEqual([
      {
        "@type": "Question",
        name: "¿Qué es?",
        acceptedAnswer: { "@type": "Answer", text: "Una prueba." },
      },
    ]);
  });

  it("precios lleva la aplicación y no las preguntas de la portada", () => {
    expect(tipos(datosEstructurados(PAGINAS.precios, contexto))).toEqual([
      "Organization",
      "WebSite",
      "SoftwareApplication",
    ]);
  });

  it("un artículo lleva autor, fechas y su ruta de navegación", () => {
    const articulo = JOURNAL[0]!;
    const meta = metaArticulo(articulo);
    const datos = datosEstructurados(meta, {
      ...contexto,
      nombre: articulo.title,
    });
    expect(del(datos, "Article")).toMatchObject({
      headline: articulo.title,
      datePublished: articulo.date,
      dateModified: articulo.date,
      author: { "@type": "Person", name: "Juan Diego Acevedo Calderón" },
      mainEntityOfPage: meta.canonica,
    });
    const migas = del(datos, "BreadcrumbList").itemListElement as {
      position: number;
      name: string;
      item: string;
    }[];
    expect(migas.map((miga) => miga.item)).toEqual([
      "https://aletheia.sbs/",
      "https://aletheia.sbs/blog",
      meta.canonica,
    ]);
    expect(migas.at(-1)!.name).toBe(articulo.title);
  });
});
