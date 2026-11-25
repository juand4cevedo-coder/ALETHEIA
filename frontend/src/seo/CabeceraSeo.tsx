import type { MetaPagina } from "./paginas.ts";

/** Título, descripción y dirección canónica de una página pública. React 19 las sube al
 * <head>; el HTML prerenderizado trae las mismas y main.tsx las retira antes de dibujar, así
 * que nunca quedan dos. */
export function CabeceraSeo({ meta }: { meta: MetaPagina }) {
  return (
    <>
      <title>{meta.titulo}</title>
      {meta.descripcion && (
        <meta name="description" content={meta.descripcion} />
      )}
      {meta.canonica && <link rel="canonical" href={meta.canonica} />}
      {!meta.indexable && <meta name="robots" content="noindex" />}
    </>
  );
}
