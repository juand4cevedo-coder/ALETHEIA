import { describe, expect, it } from "vitest";

import { DOCUMENTATION } from "../content/documentation.ts";
import { JOURNAL } from "../content/journal.ts";
import { PLANES_PUBLICADOS } from "./catalogo.ts";
import { AUTOR, datosEstructurados } from "./estructurados.ts";
import { PAGINAS } from "./fichas.ts";
import { metaArticulo, metaGuia } from "./contenidos.ts";

const preguntas = [{ pregunta: "¿Qué es?", respuesta: "Una prueba." }];
const contexto = { nombre: "Página", planes: PLANES_PUBLICADOS, preguntas };
const sinPreguntas = { ...contexto, preguntas: [] };

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
  it("todas las páginas declaran la organización, el sitio y su fundador", () => {
    const datos = datosEstructurados(PAGINAS.seguridad, sinPreguntas);
    expect(datos["@context"]).toBe("https://schema.org");
    expect(tipos(datos)).toEqual(["Organization", "WebSite", "Person"]);
    expect(del(datos, "Organization")).toMatchObject({
      name: "ALETHEIA",
      email: "contacto@aletheia.sbs",
      founder: { "@id": "https://aletheia.sbs/nosotros#fundador" },
    });
    expect(del(datos, "Person")).toMatchObject({
      "@id": "https://aletheia.sbs/nosotros#fundador",
      name: AUTOR,
      url: "https://aletheia.sbs/nosotros",
      jobTitle: "Fundador de ALETHEIA",
    });
  });

  it("la portada lleva la aplicación con sus precios en pesos y las preguntas", () => {
    const datos = datosEstructurados(PAGINAS.inicio, contexto);
    expect(tipos(datos)).toEqual([
      "Organization",
      "WebSite",
      "Person",
      "SoftwareApplication",
      "FAQPage",
    ]);
    const ofertas = del(datos, "SoftwareApplication").offers as {
      name: string;
      price: number;
      priceCurrency: string;
      addOn?: { priceSpecification: { price: number } };
      eligibleDuration?: { value: number; unitCode: string };
      priceSpecification?: unknown;
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
    const prueba = ofertas.find((oferta) => oferta.name === "Prueba")!;
    expect(prueba.eligibleDuration).toEqual({
      "@type": "QuantitativeValue",
      value: 14,
      unitCode: "DAY",
    });
    expect(prueba.priceSpecification).toBeUndefined();
    expect(del(datos, "FAQPage").mainEntity).toEqual([
      {
        "@type": "Question",
        name: "¿Qué es?",
        acceptedAnswer: { "@type": "Answer", text: "Una prueba." },
      },
    ]);
  });

  it("precios lleva la aplicación y sus propias preguntas", () => {
    expect(tipos(datosEstructurados(PAGINAS.precios, contexto))).toEqual([
      "Organization",
      "WebSite",
      "Person",
      "SoftwareApplication",
      "FAQPage",
    ]);
  });

  it("el comprobador se declara como una herramienta gratuita", () => {
    const datos = datosEstructurados(PAGINAS.verificador, sinPreguntas);
    expect(del(datos, "WebApplication")).toMatchObject({
      url: "https://aletheia.sbs/verificador",
      isAccessibleForFree: true,
      offers: { price: 0, priceCurrency: "COP" },
    });
  });

  it("una guía de la documentación es un artículo técnico", () => {
    const guia = DOCUMENTATION.find((item) => item.slug === "subir-evidencia")!;
    const meta = metaGuia(guia);
    const datos = datosEstructurados(meta, {
      ...sinPreguntas,
      nombre: guia.title,
    });
    expect(del(datos, "TechArticle")).toMatchObject({
      headline: guia.title,
      mainEntityOfPage: meta.canonica,
    });
  });

  it("un artículo lleva autor, fechas y su ruta de navegación", () => {
    const articulo = JOURNAL.find((item) => item.updated)!;
    const meta = metaArticulo(articulo);
    const datos = datosEstructurados(meta, {
      ...sinPreguntas,
      nombre: articulo.title,
    });
    expect(del(datos, "Article")).toMatchObject({
      headline: articulo.title,
      datePublished: articulo.date,
      dateModified: articulo.updated,
      author: { "@id": "https://aletheia.sbs/nosotros#fundador" },
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
