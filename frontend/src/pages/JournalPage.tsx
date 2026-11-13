import { useState } from "react";
import { Link, useParams } from "react-router";
import { JOURNAL } from "../content/journal.ts";
import { pageTitle, SITE_URL } from "../config/site.ts";
import { BuscarIcon, FlechaDerechaIcon } from "../components/ui/icons.tsx";
import { NotFoundPage } from "./NotFoundPage.tsx";
import styles from "./EditorialPage.module.css";

export function JournalPage() {
  const { slug } = useParams();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const article = JOURNAL.find((item) => item.slug === slug);
  if (slug && !article) return <NotFoundPage />;
  if (article)
    return (
      <article className={styles.article}>
        <title>{pageTitle(article.title)}</title>
        <meta name="description" content={article.summary} />
        <link rel="canonical" href={SITE_URL + "/blog/" + article.slug} />
        <Link className={styles.back} to="/blog">
          Volver al blog
        </Link>
        <header className={styles.articleHead}>
          <p className={styles.kicker}>{article.category}</p>
          <h1>{article.title}</h1>
          <p>{article.summary}</p>
          <small>Equipo Aletheia, 12 de noviembre de 2026</small>
        </header>
        <div
          className={`${styles.articleVisual} ${styles.articleHero}`}
          data-kind={article.category}
          aria-hidden="true"
        >
          <span>
            {article.category === "Integridad"
              ? "SHA-256"
              : article.category === "Seguridad"
                ? "Acceso"
                : "Contexto"}
          </span>
          <small>Aletheia</small>
        </div>
        <div className={styles.prose}>
          {article.sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </section>
          ))}
        </div>
        <aside className={styles.related}>
          <p>Siga explorando</p>
          {JOURNAL.filter((item) => item.slug !== slug).map((item) => (
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
  const results = JOURNAL.filter(
    (item) =>
      (category === "Todos" || item.category === category) &&
      (item.title + " " + item.summary)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .includes(normalized),
  );
  return (
    <div className={styles.page}>
      <title>{pageTitle("Blog")}</title>
      <meta
        name="description"
        content="Notas de Aletheia sobre organización, permisos e integridad digital."
      />
      <link rel="canonical" href={SITE_URL + "/blog"} />
      <header className={styles.blogHead}>
        <div>
          <p className={styles.kicker}>Ideas para trabajar mejor</p>
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
      <div className={styles.blogGrid}>
        {results.map((item, index) => (
          <Link
            className={styles.blogCard}
            to={"/blog/" + item.slug}
            key={item.slug}
          >
            <div
              className={styles.articleVisual}
              data-kind={item.category}
              aria-hidden="true"
            >
              <span>
                {item.category === "Integridad"
                  ? "SHA-256"
                  : item.category === "Seguridad"
                    ? "Acceso"
                    : "Contexto"}
              </span>
              <small>
                {index === 0
                  ? "Cada detalle cuenta."
                  : "La claridad empieza aquí."}
              </small>
            </div>
            <p className={styles.kicker}>{item.category}, 12 nov 2026</p>
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
