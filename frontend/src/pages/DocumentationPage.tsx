import { useState } from "react";
import { Link, useParams } from "react-router";
import { DOCUMENTATION } from "../content/documentation.ts";
import { SITE_URL, pageTitle } from "../config/site.ts";
import { BuscarIcon, FlechaDerechaIcon } from "../components/ui/icons.tsx";
import { NotFoundPage } from "./NotFoundPage.tsx";
import styles from "./DocumentationPage.module.css";

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function DocumentationPage() {
  const { slug = "introduccion" } = useParams();
  const [search, setSearch] = useState("");
  const article = DOCUMENTATION.find((item) => item.slug === slug);
  if (!article) return <NotFoundPage />;
  const filtered = DOCUMENTATION.filter((item) =>
    normalize(item.title + " " + item.description).includes(normalize(search)),
  );
  const index = DOCUMENTATION.indexOf(article);
  const previous = DOCUMENTATION[index - 1];
  const next = DOCUMENTATION[index + 1];
  return (
    <div className={styles.layout}>
      <title>{pageTitle(article.title + " | Documentación")}</title>
      <meta name="description" content={article.description} />
      <link rel="canonical" href={SITE_URL + "/docs/" + article.slug} />
      <aside className={styles.sidebar}>
        <Link className={styles.docsBrand} to="/docs">
          Documentación
        </Link>
        <label className={styles.search}>
          <BuscarIcon size={17} aria-hidden="true" />
          <span className="visually-hidden">Buscar documentación</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar una guía..."
          />
        </label>
        <nav aria-label="Documentación">
          {[...new Set(filtered.map((item) => item.group))].map((group) => (
            <div className={styles.group} key={group}>
              <p>{group}</p>
              {filtered
                .filter((item) => item.group === group)
                .map((item) => (
                  <Link
                    key={item.slug}
                    to={"/docs/" + item.slug}
                    aria-current={item.slug === slug ? "page" : undefined}
                  >
                    {item.title}
                  </Link>
                ))}
            </div>
          ))}
          {!filtered.length && (
            <p role="status" className={styles.empty}>
              No encontramos esa guía. Pruebe con otra palabra.
            </p>
          )}
        </nav>
        <Link className={styles.support} to="/soporte">
          ¿Necesita ayuda? <FlechaDerechaIcon size={14} />
        </Link>
      </aside>
      <article className={styles.article}>
        <header>
          <p className={styles.category}>{article.group}</p>
          <h1>{article.title}</h1>
          <p className={styles.lead}>{article.description}</p>
        </header>
        {slug === "introduccion" && (
          <div className={styles.quickLinks}>
            {DOCUMENTATION.slice(1, 3).map((item) => (
              <Link key={item.slug} to={"/docs/" + item.slug}>
                <span>{item.title}</span>
                <FlechaDerechaIcon size={18} />
              </Link>
            ))}
          </div>
        )}
        {article.sections.map((section) => (
          <section key={section.id} id={section.id}>
            <h2>
              <a href={"#" + section.id}>{section.title}</a>
            </h2>
            {section.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
            {section.steps && (
              <ol className={styles.steps}>
                {section.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            )}
          </section>
        ))}
        {article.action && (
          <Link className={styles.action} to={article.action.to}>
            {article.action.label}
            <FlechaDerechaIcon size={16} />
          </Link>
        )}
        <nav
          className={styles.pagination}
          aria-label="Continuar la documentación"
        >
          {previous ? (
            <Link to={"/docs/" + previous.slug}>
              <small>Anterior</small>
              {previous.title}
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link to={"/docs/" + next.slug}>
              <small>Siguiente</small>
              {next.title}
              <FlechaDerechaIcon size={14} />
            </Link>
          )}
        </nav>
      </article>
      <aside className={styles.contents}>
        <p>En esta página</p>
        <nav aria-label="En esta página">
          {article.sections.map((section) => (
            <a key={section.id} href={"#" + section.id}>
              {section.title}
            </a>
          ))}
        </nav>
      </aside>
    </div>
  );
}
