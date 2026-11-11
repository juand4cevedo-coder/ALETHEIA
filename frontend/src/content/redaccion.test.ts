/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

// Regla 1 de redacción (especificación de identidad, sección 9): ningún texto que vea la
// persona lleva los caracteres que delatan una plantilla. Se revisa el árbol sintáctico, no el
// texto plano, para que los comentarios no cuenten y las expresiones regulares tampoco.
const FORBIDDEN = ["·", "§", "—", "–", "…", "→", "−"] as const;

const SRC = join(import.meta.dirname, "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
      ? [path]
      : [];
  });
}

function relativePath(path: string): string {
  return relative(SRC, path).split(sep).join("/");
}

function inScope(path: string): boolean {
  return !relativePath(path).startsWith("api/generated/");
}

// Entidades HTML con nombre de los caracteres prohibidos. El texto de JSX y sus atributos las
// muestran decodificadas, así que se decodifican antes de revisar.
const NAMED_ENTITIES: Record<string, string> = {
  middot: "·",
  sect: "§",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  rarr: "→",
  minus: "−",
};

/** Decodifica las entidades con nombre de la lista y las numéricas (&#8230; y &#x2026;). */
function decodeEntities(text: string): string {
  return text.replace(
    /&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|([a-zA-Z]+));/g,
    (match, decimal?: string, hex?: string, name?: string) => {
      if (decimal) return String.fromCodePoint(Number(decimal));
      if (hex) return String.fromCodePoint(parseInt(hex, 16));
      return NAMED_ENTITIES[name ?? ""] ?? match;
    },
  );
}

/** Los textos de un archivo que pueden llegar a la pantalla: literales de cadena, plantillas y
 * texto de JSX. Las rutas de import y export no se muestran y se saltan. */
function visibleTexts(
  path: string,
  code: string,
): { line: number; text: string }[] {
  const file = ts.createSourceFile(
    path,
    code,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found: { line: number; text: string }[] = [];

  function add(node: ts.Node, text: string) {
    const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
    found.push({ line: line + 1, text });
  }

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (ts.isStringLiteral(node) && ts.isJsxAttribute(node.parent)) {
      // TypeScript entrega el atributo sin decodificar: «&middot;» llega tal cual.
      add(node, decodeEntities(node.text));
    } else if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node)
    ) {
      add(node, node.text);
    } else if (ts.isTemplateExpression(node)) {
      add(
        node,
        [
          node.head.text,
          ...node.templateSpans.map((span) => span.literal.text),
        ].join(""),
      );
    } else if (ts.isJsxText(node)) {
      add(node, decodeEntities(node.text));
    }
    ts.forEachChild(node, visit);
  }

  visit(file);
  return found;
}

function offenders(text: string): string[] {
  return FORBIDDEN.filter((char) => text.includes(char));
}

describe("redacción de la interfaz", () => {
  it("ningún texto visible lleva ·, §, rayas, puntos suspensivos, flechas ni el signo menos", () => {
    const problems = sourceFiles(SRC)
      .filter(inScope)
      .flatMap((path) =>
        visibleTexts(path, readFileSync(path, "utf8"))
          .filter(({ text }) => offenders(text).length > 0)
          .map(
            ({ line, text }) =>
              `${relativePath(path)}:${line} [${offenders(text).join(" ")}] ${text.trim()}`,
          ),
      );
    expect(problems).toEqual([]);
  });

  it("el título y la descripción de index.html tampoco los llevan", () => {
    const html = readFileSync(join(SRC, "..", "index.html"), "utf8").replace(
      /<!--[\s\S]*?-->/g,
      "",
    );
    const texts = [
      ...html.matchAll(/<title>([^<]*)<\/title>/g),
      ...html.matchAll(/content="([^"]*)"/g),
    ].map((match) => decodeEntities(match[1]!));
    expect(texts.filter((text) => offenders(text).length > 0)).toEqual([]);
  });

  it("la prueba detecta un carácter prohibido en un texto de JSX", () => {
    // Control de la propia prueba: si el recorrido dejara de leer JSX o los atributos, o si
    // empezara a leer comentarios, esto lo delata.
    const texts = visibleTexts(
      "control.tsx",
      'const a = <p title="Uno · dos">Cargando…</p>; // comentario con — que no cuenta',
    ).map(({ text }) => text);
    expect(texts.flatMap(offenders)).toEqual(["·", "…"]);
  });

  it("la prueba detecta los caracteres prohibidos escritos como entidades HTML", () => {
    const texts = visibleTexts(
      "control.tsx",
      'const a = <p title="a &middot; b" aria-label="x &#x2192; y">Cargando&hellip; &#8212; &#183;</p>;',
    ).map(({ text }) => text);
    expect(texts.map(offenders)).toEqual([["·"], ["→"], ["·", "—", "…"]]);
  });
});
