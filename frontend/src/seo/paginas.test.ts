import { describe, expect, it } from "vitest";

import { LEGAL_PAGES } from "../config/routes.ts";
import { DOCUMENTATION } from "../content/documentation.ts";
import { HELP, JOURNAL } from "../content/journal.ts";
import { LEGAL_DOCUMENTS } from "../features/legal/documents.ts";
import {
  metaArticulo,
  metaAyuda,
  metaGuia,
  metaLegal,
  resumir,
  tituloConMarca,
} from "./contenidos.ts";
import { LARGO_MAXIMO_TITULO } from "./paginas.ts";
import { PAGINAS, paginaInformativa } from "./fichas.ts";

// La 404 no se indexa: no lleva descripción y se revisa aparte.
const fijas = Object.values(PAGINAS).filter((meta) => meta.indexable);
const guias = DOCUMENTATION.map((guia) => guia.slug);
const dinamicas = [
  ...JOURNAL.map(metaArticulo),
  ...DOCUMENTATION.map((guia) => metaGuia(guia)),
  ...HELP.map((ayuda) => metaAyuda(ayuda, guias)),
  ...LEGAL_PAGES.map(({ slug }) => metaLegal(LEGAL_DOCUMENTS[slug])),
];

describe("fichas de las páginas públicas", () => {
  it.each(fijas.map((meta) => [meta.ruta, meta]))(
    "%s: título con la marca al final y descripción de 120 a 155 caracteres",
    (_, meta) => {
      expect(meta.titulo.length).toBeLessThanOrEqual(LARGO_MAXIMO_TITULO);
      expect(meta.titulo).toMatch(/ \| ALETHEIA$/);
      expect(meta.titulo).not.toMatch(/^ALETHEIA/);
      expect(meta.descripcion.length).toBeGreaterThanOrEqual(120);
      expect(meta.descripcion.length).toBeLessThanOrEqual(155);
    },
  );

  it("ningún título ni descripción se repite", () => {
    const todas = [...fijas, ...dinamicas].filter(
      (meta) => !meta.ruta.startsWith("/ayuda/"),
    );
    expect(new Set(todas.map((meta) => meta.titulo)).size).toBe(todas.length);
    expect(new Set(fijas.map((meta) => meta.descripcion)).size).toBe(
      fijas.length,
    );
  });

  it("la portada dice para quién es el software", () => {
    expect(PAGINAS.inicio.titulo).toMatch(/^Software para abogados/);
    expect(PAGINAS.verificador.titulo).toBe(
      "Verificar el hash SHA-256 de un archivo | ALETHEIA",
    );
  });

  it("los textos no usan caracteres que el sitio evita", () => {
    for (const meta of fijas) {
      expect(`${meta.titulo} ${meta.descripcion}`).not.toMatch(/[—–«»·§→…−]/);
    }
  });

  it.each(dinamicas.map((meta) => [meta.ruta, meta]))(
    "%s: título de 60 caracteres o menos (o el titular tal cual) y descripción presente",
    (_, meta) => {
      if (meta.titulo.length > LARGO_MAXIMO_TITULO) {
        expect(meta.titulo).not.toMatch(/ \| [^|]*ALETHEIA$/);
      }
      expect(meta.descripcion.length).toBeGreaterThan(40);
      expect(meta.descripcion.length).toBeLessThanOrEqual(160);
      expect(meta.canonica).toMatch(/^https:\/\/aletheia\.sbs\//);
    },
  );

  it("los artículos son de tipo article con su fecha y su migas", () => {
    const meta = metaArticulo(JOURNAL[0]!);
    expect(meta.tipo).toBe("article");
    expect(meta.publicado).toBe(JOURNAL[0]!.date);
    expect(meta.migas?.map((miga) => miga.ruta)).toEqual(["/", "/blog"]);
  });

  it("/docs declara como principal la guía que muestra y no va en el mapa", () => {
    const meta = metaGuia(DOCUMENTATION[0]!, "/docs");
    expect(meta.ruta).toBe("/docs");
    expect(meta.canonica).toBe(
      `https://aletheia.sbs/docs/${DOCUMENTATION[0]!.slug}`,
    );
    expect(meta.enMapa).toBe(false);
    expect(metaGuia(DOCUMENTATION[0]!).enMapa).toBe(true);
  });

  it("una guía de ayuda que repite la documentación apunta a ella", () => {
    const repetida = metaAyuda(
      { slug: "crear-un-caso", title: "Crear un caso", text: "Texto." },
      ["crear-un-caso"],
    );
    expect(repetida.canonica).toBe("https://aletheia.sbs/docs/crear-un-caso");
    expect(repetida.enMapa).toBe(false);
    const propia = metaAyuda(
      { slug: "otra", title: "Otra guía", text: "Texto." },
      ["crear-un-caso"],
    );
    expect(propia.canonica).toBe("https://aletheia.sbs/ayuda/otra");
    expect(propia.enMapa).toBe(true);
  });

  it("la página 404 no se indexa ni declara dirección canónica", () => {
    expect(PAGINAS.noEncontrada.indexable).toBe(false);
    expect(PAGINAS.noEncontrada.canonica).toBe("");
    expect(PAGINAS.noEncontrada.descripcion).toBe("");
  });

  it("encuentra las páginas informativas por su segmento", () => {
    expect(paginaInformativa("filosofia")).toBe(PAGINAS.filosofia);
    expect(paginaInformativa("noEncontrada")).toBeUndefined();
    expect(paginaInformativa("no-existe")).toBeUndefined();
  });
});

describe("tituloConMarca", () => {
  it("usa el contexto si cabe, si no solo la marca y si no el nombre", () => {
    expect(tituloConMarca("Corto", "Blog de ALETHEIA")).toBe(
      "Corto | Blog de ALETHEIA",
    );
    const largo = "Un titular largo para un artículo del blog";
    expect(tituloConMarca(largo, "Blog de ALETHEIA")).toBe(
      `${largo} | ALETHEIA`,
    );
    const enorme = "x".repeat(70);
    expect(tituloConMarca(enorme)).toBe(enorme);
  });
});

describe("resumir", () => {
  it("deja igual un texto corto", () => {
    expect(resumir("Una frase corta.")).toBe("Una frase corta.");
  });

  it("corta en la última frase completa que cabe", () => {
    const texto =
      "Ingrese a su espacio de trabajo y abra Casos. Si su rol permite crear casos y su correo está verificado, verá Nuevo caso. Complete el nombre y los datos que tenga.";
    const resumen = resumir(texto);
    expect(resumen.length).toBeLessThanOrEqual(155);
    expect(resumen).toMatch(/verá Nuevo caso\.$/);
  });

  it("sin una frase completa que quepa, pide una descripción propia en vez de cortar", () => {
    expect(() => resumir("palabra ".repeat(40))).toThrow(
      /sin cortar una frase/,
    );
  });
});
