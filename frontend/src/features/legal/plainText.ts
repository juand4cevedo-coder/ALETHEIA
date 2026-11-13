// Versión en texto plano de una política, para descargarla (Ley 1480 de 2011, art. 50,
// literal d: las condiciones deben poder consultarse, imprimirse y descargarse) y para calcular
// su huella. La huella que muestra la página es la SHA-256 de exactamente estos bytes, así que
// quien descarga el archivo puede comprobarla con cualquier herramienta, por ejemplo
// Get-FileHash en PowerShell o sha256sum en Linux.

const BLOCKS = new Set(["P", "LI", "H2", "H3", "DT", "DD", "TR", "CAPTION"]);

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function inlineText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (!(node instanceof HTMLElement)) return "";
  return Array.from(node.childNodes, inlineText).join("");
}

function blockText(element: HTMLElement): string {
  if (element.tagName === "TR") {
    return Array.from((element as HTMLTableRowElement).cells, (cell) =>
      clean(inlineText(cell)),
    ).join(" | ");
  }
  const text = clean(inlineText(element));
  switch (element.tagName) {
    case "H2":
      return `\n${text.toUpperCase()}`;
    case "H3":
      return `\n${text}`;
    case "LI": {
      const list = element.parentElement;
      if (list?.tagName === "OL") {
        return `${Array.from(list.children).indexOf(element) + 1}. ${text}`;
      }
      return `- ${text}`;
    }
    case "DT":
      return `${text}:`;
    default:
      return text;
  }
}

/** Recorre los bloques de texto en el orden del documento y arma una línea por bloque. */
export function extractPlainText(root: HTMLElement): string {
  const lines: string[] = [];
  const visit = (element: Element) => {
    if (!(element instanceof HTMLElement)) return;
    // Un bloque ya incluye el texto de lo que lleva dentro: no se vuelve a recorrer.
    if (BLOCKS.has(element.tagName)) {
      const line = blockText(element);
      if (line.trim()) lines.push(line);
      return;
    }
    for (const child of element.children) visit(child);
  };
  visit(root);
  return `${lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()}\n`;
}

/** Huella SHA-256 en hexadecimal, o null si el navegador no ofrece Web Crypto. */
export async function sha256Hex(text: string): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
