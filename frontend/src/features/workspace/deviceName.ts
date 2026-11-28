// El navegador y el sistema de una cadena User-Agent, dichos como los diría una persona: «Edge en
// Windows», «Safari en iPhone». La cadena completa sigue disponible para quien la necesite (la
// exportación CSV la trae tal cual); en pantalla basta con reconocer el equipo.

const BROWSERS: readonly [RegExp, string][] = [
  [/Edg(A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/Safari\//, "Safari"],
];

const SYSTEMS: readonly [RegExp, string][] = [
  [/iPhone/, "iPhone"],
  [/iPad/, "iPad"],
  [/Android/, "Android"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "Mac"],
  [/CrOS/, "Chromebook"],
  [/Linux/, "Linux"],
];

/** «Edge en Windows», o la parte que se reconozca. null si no hay cadena. */
export function deviceName(
  userAgent: string | null | undefined,
): string | null {
  if (!userAgent) return null;
  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1];
  const system = SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1];
  if (browser && system) return `${browser} en ${system}`;
  return browser ?? system ?? "Otro navegador";
}
