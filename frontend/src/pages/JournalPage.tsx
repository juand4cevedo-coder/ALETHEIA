import { useState } from "react";
import { Link, useParams } from "react-router";
import {
  JOURNAL,
  JOURNAL_AUTHOR,
  JOURNAL_AUTHOR_NOTE,
} from "../content/journal.ts";
import { BuscarIcon, FlechaDerechaIcon } from "../components/ui/icons.tsx";
import { CabeceraSeo } from "../seo/CabeceraSeo.tsx";
import { PAGINAS } from "../seo/fichas.ts";
import { metaArticulo } from "../seo/contenidos.ts";
import { NotFoundPage } from "./NotFoundPage.tsx";
import { LinkedParagraph } from "../components/content/LinkedParagraph.tsx";
import { plainText } from "../components/content/plainText.ts";
import styles from "./EditorialPage.module.css";
import { Lamina } from "../components/brand/Lamina.tsx";

// Fecha de publicación, sin hora: se formatea en UTC para que "2026-10-05" lea 5 de octubre,
// no el 4 por la noche al convertir a la hora de Colombia.
function formatPublishDate(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

// Del más reciente al más antiguo.
const BY_DATE = [...JOURNAL].sort((a, b) => b.date.localeCompare(a.date));

export function JournalPage() {
  const { slug } = useParams();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const article = JOURNAL.find((item) => item.slug === slug);
  if (slug && !article) return <NotFoundPage />;
  if (article)
    return (
      <article className={styles.article}>
        <CabeceraSeo meta={metaArticulo(article)} />
        <Link className={styles.back} to="/blog">
          Volver al blog
        </Link>
        <header className={styles.articleHead}>
          <h1>{article.title}</h1>
          <p>{article.summary}</p>
          <p className={styles.byline}>
            <span>
              Por <strong>{JOURNAL_AUTHOR}</strong>
            </span>
            <time dateTime={article.date}>
              {formatPublishDate(article.date)}
            </time>
            {article.updated && article.updated !== article.date && (
              <span>
                Actualizado el{" "}
                <time dateTime={article.updated}>
                  {formatPublishDate(article.updated)}
                </time>
              </span>
            )}
            <span>{article.category}</span>
          </p>
          <p className={styles.authorNote}>
            {JOURNAL_AUTHOR_NOTE} <Link to="/nosotros">Quién escribe</Link>
          </p>
        </header>
        <figure className={styles.articleCover}>
          <Lamina motivo={article.motivo} />
        </figure>
        <div className={styles.prose}>
          {article.sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.paragraphs.map((p) => (
                <LinkedParagraph key={plainText(p)} text={p} />
              ))}
            </section>
          ))}
        </div>
        <aside className={styles.related}>
          <p>Siga explorando</p>
          {BY_DATE.filter((item) => item.slug !== slug).map((item) => (
            <Link to={"/blog/" + item.slug} key={item.slug}>
              {item.title} <FlechaDerechaIcon size={16} />
            </Link>
          ))}
        </aside>
      </article>
    );
  const normalized = query
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const results = BY_DATE.filter(
    (item) =>
      (category === "Todos" || item.category === category) &&
      (item.title + " " + item.summary)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .includes(normalized),
  );
  // Sin filtros, el más reciente va destacado a todo el ancho y el resto en la retícula.
  const destacado =
    category === "Todos" && !query.trim() ? results[0] : undefined;
  const resto = destacado ? results.slice(1) : results;
  return (
    <div className={styles.page}>
      <CabeceraSeo meta={PAGINAS.blog} />
      <header className={styles.blogHead}>
        <div>
          <h1>Blog</h1>
        </div>
        <label className={styles.search}>
          <BuscarIcon size={18} aria-hidden="true" />
          <span className="visually-hidden">Buscar artículos</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar artículos..."
          />
        </label>
      </header>
      <div className={styles.filters} role="group" aria-label="Categorías">
        {["Todos", ...new Set(JOURNAL.map((item) => item.category))].map(
          (item) => (
            <button
              key={item}
              aria-pressed={category === item}
              onClick={() => setCategory(item)}
              type="button"
            >
              {item}
            </button>
          ),
        )}
      </div>
      <p className="visually-hidden" role="status">
        {results.length} artículos
      </p>
      {destacado && (
        <Link className={styles.featured} to={"/blog/" + destacado.slug}>
          <figure className={styles.cardCover}>
            <Lamina motivo={destacado.motivo} />
          </figure>
          <div className={styles.featuredText}>
            <p className={styles.kicker}>
              {destacado.category}, {formatPublishDate(destacado.date)}
            </p>
            <h2>{destacado.title}</h2>
            <p>{destacado.summary}</p>
            <span className={styles.read}>
              Leer artículo <FlechaDerechaIcon size={16} aria-hidden="true" />
            </span>
          </div>
        </Link>
      )}
      <div className={styles.blogGrid}>
        {resto.map((item) => (
          <Link
            className={styles.blogCard}
            to={"/blog/" + item.slug}
            key={item.slug}
          >
            <figure className={styles.cardCover}>
              <Lamina motivo={item.motivo} />
            </figure>
            <p className={styles.kicker}>
              {item.category}, {formatPublishDate(item.date)}
            </p>
            <h2>{item.title}</h2>
            <p>{item.summary}</p>
            <span className={styles.read}>
              Leer artículo <FlechaDerechaIcon size={16} aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>
      {!results.length && (
        <div className={styles.empty}>
          <h2>No encontramos ese tema</h2>
          <p>Pruebe con otra palabra o cambie la categoría.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCategory("Todos");
            }}
          >
            Ver todos los artículos
          </button>
        </div>
      )}
    </div>
  );
}
