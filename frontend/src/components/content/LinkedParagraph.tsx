import { Link } from "react-router";

const ENLACE = /(\[[^\]]+\]\(\/[^)\s]*\))/;
const PARTES = /^\[([^\]]+)\]\((\/[^)\s]*)\)$/;

/** Un párrafo con enlaces internos escritos [texto](/ruta). Lo usan el blog y la
 * documentación, cuyos textos viven en archivos de contenido y no en JSX. */
export function LinkedParagraph({ text }: { text: string }) {
  return (
    <p>
      {text.split(ENLACE).map((part, index) => {
        const link = PARTES.exec(part);
        return link ? (
          <Link key={index} to={link[2]!}>
            {link[1]}
          </Link>
        ) : (
          part
        );
      })}
    </p>
  );
}
