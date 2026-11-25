/** El texto sin la marca de los enlaces [texto](/ruta), para buscar y para las llaves de React. */
export function plainText(text: string): string {
  return text.replace(/\[([^\]]+)\]\(\/[^)\s]*\)/g, "$1");
}
