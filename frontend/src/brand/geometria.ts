// Geometría de la marca (ADR-060). Todo se calcula con números exactos para que el símbolo, el
// emblema y el logotipo sean los mismos en el sitio, en los íconos y en los correos. La usan los
// componentes de React y el script que genera los archivos de public/brand (scripts/marca.mjs).
//
// Cada parte cuenta algo del producto:
// - El ojo es la aletheia griega, el desocultamiento: ver lo que pasó con un archivo.
// - La pupila es de latón, el color del sello: lo que se ve queda sellado.
// - El anillo de 64 marcas son los 64 caracteres de una huella SHA-256, en ocho grupos de ocho,
//   como la aplicación muestra cada huella.
// - La banda de guilloché es el grabado de seguridad de los billetes y los certificados
//   notariales: un trazo difícil de copiar, como una cadena de custodia.
// - Las A del logotipo son lambdas (Λ), por la raíz griega del nombre.

const redondear = (n: number) => Math.round(n * 100) / 100;

/** El ojo: dos párpados de curva cuadrática que se cierran en las comisuras. */
export function ojo(
  cx: number,
  cy: number,
  ancho: number,
  alto: number,
): string {
  const x0 = cx - ancho / 2;
  const x1 = cx + ancho / 2;
  return [
    `M${redondear(x0)} ${cy}`,
    `Q${cx} ${redondear(cy - alto)} ${redondear(x1)} ${cy}`,
    `Q${cx} ${redondear(cy + alto)} ${redondear(x0)} ${cy}`,
    "Z",
  ].join(" ");
}

/** Las 64 marcas de la huella: una larga cada ocho. */
export function marcas(
  cx: number,
  cy: number,
  exterior: number,
  corta: number,
  larga: number,
): { d: string; larga: boolean }[] {
  return Array.from({ length: 64 }, (_, i) => {
    const angulo = (i / 64) * Math.PI * 2 - Math.PI / 2;
    const esLarga = i % 8 === 0;
    const interior = exterior - (esLarga ? larga : corta);
    const [c, s] = [Math.cos(angulo), Math.sin(angulo)];
    return {
      d: `M${redondear(cx + interior * c)} ${redondear(cy + interior * s)}L${redondear(cx + exterior * c)} ${redondear(cy + exterior * s)}`,
      larga: esLarga,
    };
  });
}

/** Una curva de la banda de guilloché: un círculo modulado por una onda de `ondas` crestas. Tres
 * curvas desfasadas un tercio de onda forman el tejido. */
export function guilloche(
  cx: number,
  cy: number,
  radio: number,
  amplitud: number,
  ondas: number,
  fase: number,
  puntos = 720,
): string {
  const partes: string[] = [];
  for (let i = 0; i <= puntos; i += 1) {
    const t = (i / puntos) * Math.PI * 2;
    const r = radio + amplitud * Math.sin(ondas * t + fase);
    const x = cx + r * Math.cos(t);
    const y = cy + r * Math.sin(t);
    partes.push(`${i === 0 ? "M" : "L"}${redondear(x)} ${redondear(y)}`);
  }
  return partes.join("") + "Z";
}

/** Un arco para escribir texto a lo largo del sello. `arriba` lo recorre de izquierda a derecha
 * por la parte superior; si no, por la inferior, también de izquierda a derecha. */
export function arco(
  cx: number,
  cy: number,
  r: number,
  arriba: boolean,
): string {
  return arriba
    ? `M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}`
    : `M${cx - r} ${cy} A${r} ${r} 0 0 0 ${cx + r} ${cy}`;
}

// Logotipo monolineal. Cada letra son trazos rectos sobre una altura de 20 unidades; el ancho y
// el espacio entre letras se ajustaron a ojo para que el blanco entre ellas se vea parejo.
const LETRAS: Record<string, { ancho: number; trazos: string[] }> = {
  A: { ancho: 15.5, trazos: ["M0 20L7.75 0L15.5 20"] },
  L: { ancho: 10.5, trazos: ["M0 0V20H10.5"] },
  E: { ancho: 10.5, trazos: ["M10.5 0H0V20H10.5", "M0 10H9"] },
  T: { ancho: 13, trazos: ["M0 0H13", "M6.5 0V20"] },
  H: { ancho: 13, trazos: ["M0 0V20", "M13 0V20", "M0 10H13"] },
  I: { ancho: 0, trazos: ["M0 0V20"] },
};
// Espacio óptico entre cada par: las diagonales de la lambda piden menos aire.
const ESPACIO = 7.2;
const AJUSTES: Record<string, number> = {
  AL: -1.2,
  IA: -1,
  LE: 0.4,
  ET: -0.6,
  TH: -0.6,
};

/** Trazos del logotipo ALETHEIA y su ancho total, en unidades de 20 de alto. */
export function logotipo(palabra = "ALETHEIA"): { d: string; ancho: number } {
  let x = 0;
  const trazos: string[] = [];
  [...palabra].forEach((letra, i) => {
    const forma = LETRAS[letra];
    if (!forma) throw new Error(`El logotipo no tiene la letra ${letra}`);
    for (const t of forma.trazos) {
      trazos.push(
        t.replace(
          /([MLHV])([\d.]+)(?: ([\d.]+))?/g,
          (_, cmd: string, a: string, b?: string) => {
            if (cmd === "V") return `V${a}`;
            if (cmd === "H") return `H${redondear(Number(a) + x)}`;
            return `${cmd}${redondear(Number(a) + x)} ${b}`;
          },
        ),
      );
    }
    const siguiente = palabra[i + 1];
    if (siguiente)
      x += forma.ancho + ESPACIO + (AJUSTES[letra + siguiente] ?? 0);
    else x += forma.ancho;
  });
  return { d: trazos.join(""), ancho: redondear(x) };
}

/** Colores fijos de la marca para los archivos estáticos (íconos, correos, imagen social). En la
 * interfaz se usan los tokens de tokens.css. */
export const COLORES_MARCA = {
  tinta: "#55278a",
  tintaClara: "#7a52b8",
  laton: "#d9b871",
  latonOscuro: "#7a5a22",
  papel: "#ffffff",
  noche: "#121016",
} as const;

/** El símbolo de 64 unidades: recuadro de tinta, ojo blanco, iris y pupila de latón. Es la
 * versión que se lee a 16 px; el emblema es la versión completa. */
export function simboloSvg(
  fondo: string,
  trazo: string,
  pupila: string,
  variante = "default",
): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" data-brand="aletheia-eye" data-variant="${variante}">`,
    `<rect width="64" height="64" rx="15" fill="${fondo}"/>`,
    `<path d="${ojo(32, 32, 48, 22)}" fill="none" stroke="${trazo}" stroke-width="4" stroke-linejoin="round"/>`,
    `<circle cx="32" cy="32" r="9.4" fill="none" stroke="${trazo}" stroke-width="3.4"/>`,
    `<circle cx="32" cy="32" r="4.3" fill="${pupila}"/>`,
    `</svg>`,
  ].join("");
}

/** El emblema completo en 240 unidades, para piezas grandes y archivos estáticos. */
export function emblemaSvg(
  tinta: string,
  laton: string,
  fondo = "none",
): string {
  const c = 120;
  const ticks = marcas(c, c, 95, 5, 10)
    .map((m) => `<path d="${m.d}" stroke-width="${m.larga ? 1.8 : 1}"/>`)
    .join("");
  const banda = [0, 1, 2, 3]
    .map(
      (k) =>
        `<path d="${guilloche(c, c, 66, 8, 24, (k * Math.PI) / 2)}" stroke="${laton}" stroke-width="0.55"/>`,
    )
    .join("");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" data-brand="aletheia-emblema">`,
    fondo === "none" ? "" : `<rect width="240" height="240" fill="${fondo}"/>`,
    `<g fill="none" stroke="${tinta}" stroke-linecap="round" stroke-linejoin="round">`,
    `<circle cx="${c}" cy="${c}" r="117" stroke-width="1.6"/>`,
    `<circle cx="${c}" cy="${c}" r="99" stroke-width="1"/>`,
    ticks,
    `<circle cx="${c}" cy="${c}" r="80" stroke-width="1"/>`,
    banda,
    `<circle cx="${c}" cy="${c}" r="52" stroke-width="1"/>`,
    `<path d="${ojo(c, c, 84, 34)}" stroke-width="3"/>`,
    `<circle cx="${c}" cy="${c}" r="15.5" stroke-width="2.6"/>`,
    `<circle cx="${c}" cy="${c}" r="10" stroke="${laton}" stroke-width="1.2"/>`,
    `<circle cx="${c}" cy="${c}" r="5.2" fill="${laton}" stroke="none"/>`,
    `</g></svg>`,
  ].join("");
}

/** El logotipo como SVG, de 20 unidades de alto más el margen del trazo. */
export function logotipoSvg(color: string, grosor = 3.1): string {
  const { d, ancho } = logotipo();
  const m = grosor;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-m} ${-m} ${ancho + 2 * m} ${20 + 2 * m}" data-brand="aletheia-logotipo"><path d="${d}" fill="none" stroke="${color}" stroke-width="${grosor}" stroke-linejoin="miter" stroke-miterlimit="4" stroke-linecap="square"/></svg>`;
}
