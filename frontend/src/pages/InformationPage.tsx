import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { ButtonLink } from "../components/ui/ButtonLink.tsx";
import { FlechaDerechaIcon } from "../components/ui/icons.tsx";
import { LEGAL_PAGES, legalRoute } from "../config/routes.ts";
import { CONTACT_EMAIL, pageTitle, SITE_URL } from "../config/site.ts";
import { HELP } from "../content/journal.ts";
import logo from "../assets/simbolo.svg";
import { NotFoundPage } from "./NotFoundPage.tsx";
import styles from "./EditorialPage.module.css";

type Section = { title: string; text: string };
const PAGES: Record<
  string,
  { title: string; lead: string; sections: Section[] }
> = {
  filosofia: {
    title: "La claridad es el punto de partida.",
    lead: "Cada decisión de Aletheia parte de una pregunta: ¿esto ayuda a trabajar con más confianza?",
    sections: [
      {
        title: "Hacer visible lo importante",
        text: "Aletheia toma su nombre de la idea griega de verdad y desocultamiento. En el producto, esa intención se traduce en contexto: entender qué se está consultando, quién participa y qué permite concluir una comprobación.",
      },
      {
        title: "Dar espacio al trabajo",
        text: "La interfaz acompaña. Los títulos orientan, las acciones tienen una prioridad clara y el detalle aparece cuando se necesita. La calma no depende de ocultar información, sino de presentarla en el momento adecuado.",
      },
      {
        title: "Decir exactamente lo que hacemos",
        text: "Una huella permite comparar contenido. Un permiso controla acceso. Ninguno reemplaza el criterio profesional ni la valoración de una autoridad judicial. Preferimos explicar esos límites con claridad.",
      },
    ],
  },
  nosotros: {
    title: "Detrás de cada caso, hay algo que importa.",
    lead: "Construimos Aletheia para dar orden al trabajo jurídico y cuidado a la información que lo sostiene.",
    sections: [
      {
        title: "Un producto con un propósito concreto",
        text: "Reunir los casos, las personas y su contexto en un mismo espacio. Aletheia está pensada para abogados independientes y equipos que necesitan trabajar con responsabilidades claras.",
      },
      {
        title: "Cuidado en lo visible y en lo que no se ve",
        text: "La experiencia incluye tanto encontrar un caso como comprobar quién puede acceder a él. Por eso el diseño, los permisos y los datos se trabajan como partes del mismo producto.",
      },
      {
        title: "Una conversación abierta",
        text: "Las preguntas sobre el producto y las dificultades al usarlo ayudan a mejorarlo. Puede contactar al equipo desde soporte. No incluya documentos de casos ni datos confidenciales en su primer mensaje.",
      },
    ],
  },
  seguridad: {
    title: "El cuidado empieza por dentro.",
    lead: "Controles concretos para proteger el acceso y mantener claras las responsabilidades.",
    sections: [
      {
        title: "Acceso por organización y por caso",
        text: "Las operaciones comprueban los permisos en el servidor. Ser parte de una organización o administrarla no concede acceso automático a todos sus casos: cada caso tiene sus propios miembros.",
      },
      {
        title: "Sesiones bajo su control",
        text: "La cuenta permite cambiar la contraseña y cerrar sesiones. Las contraseñas no se guardan como texto legible. Las operaciones que modifican información comprueban el origen de la solicitud y la sesión correspondiente.",
      },
      {
        title: "Comprobación local",
        text: "El comparador SHA-256 de la portada procesa el archivo en su navegador. Su contenido no se envía al servidor para calcular la huella. El límite de tamaño evita que una comprobación consuma memoria sin control.",
      },
      {
        title: "Reportar un problema de seguridad",
        text: "Escriba a contacto@aletheia.sbs con una descripción y los pasos para reproducir el problema. No envíe contraseñas, tokens ni información de terceros. Coordinaremos un canal adecuado si necesitamos más detalles.",
      },
    ],
  },
  soporte: {
    title: "Estamos para ayudar.",
    lead: "Encuentre una respuesta o cuéntenos qué ocurrió. Sin vueltas.",
    sections: [
      {
        title: "Antes de escribir",
        text: "La base de conocimiento explica cómo crear casos, invitar al equipo, recuperar el acceso y comprobar archivos. Si una página no carga, también puede consultar el estado actual de la conexión con el servicio.",
      },
      {
        title: "Cuéntenos el problema",
        text: "Indique la pantalla, la acción que intentó y el mensaje que apareció. Si ve un identificador de solicitud, inclúyalo. Evite adjuntar expedientes, contraseñas o datos personales de terceros.",
      },
    ],
  },
  empresa: {
    title: "Un espacio para su equipo.",
    lead: "Casos organizados, responsabilidades claras y acceso limitado a quienes participan.",
    sections: [
      {
        title: "La organización como punto de encuentro",
        text: "Reúna a su equipo mediante invitaciones individuales. Los roles distinguen las responsabilidades de administración y trabajo; la participación en cada caso mantiene separado el acceso a los asuntos.",
      },
      {
        title: "Conversemos sobre su práctica",
        text: "El tamaño del equipo y su forma de trabajar determinan lo que necesita. Consulte los planes o escríbanos para explicar su escenario. Las condiciones de cualquier servicio se acuerdan antes de contratar.",
      },
    ],
  },
};

function ServiceStatus() {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ ok: boolean; at: Date } | null>(null);
  const [pending, setPending] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let active = true;
    void fetch("/api/v1/health", {
      signal: controller.signal,
      cache: "no-store",
      credentials: "omit",
    })
      .then(async (response) => {
        const body: unknown = await response.json();
        return (
          response.ok &&
          typeof body === "object" &&
          body !== null &&
          "status" in body &&
          body.status === "ok" &&
          "database" in body &&
          body.database === "ok"
        );
      })
      .catch(() => false)
      .then((ok) => {
        if (active) {
          setResult({ ok, at: new Date() });
          setPending(false);
        }
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt]);
  return (
    <div className={styles.statusPanel}>
      <div role="status" aria-live="polite">
        <h2>
          {pending
            ? "Comprobando el servicio..."
            : result?.ok
              ? "El servicio responde"
              : "No pudimos confirmar la conexión"}
        </h2>
        <p>
          {pending
            ? "Consultando la API y la base de datos."
            : result?.ok
              ? "La API y su conexión con la base de datos respondieron correctamente."
              : "Puede haber una interrupción del servicio o un problema de conexión desde su dispositivo."}
        </p>
      </div>
      {result && (
        <p className={styles.kicker}>
          Comprobación:{" "}
          {result.at.toLocaleString("es-CO", { timeZone: "America/Bogota" })}{" "}
          (Colombia)
        </p>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setPending(true);
          setAttempt((a) => a + 1);
        }}
      >
        Comprobar de nuevo
      </button>
      <p>
        Esta consulta muestra el estado actual desde su conexión. No representa
        un historial de disponibilidad ni comprueba todos los servicios
        externos.
      </p>
    </div>
  );
}

export function InformationPage() {
  const { pathname } = useLocation();
  const key = pathname.slice(1);
  const page = PAGES[key];
  const specialPages: Record<string, string[]> = {
    legal: [
      "Información legal",
      "Las condiciones del servicio y el cuidado de sus datos, en un mismo lugar.",
    ],
    marca: ["La marca Aletheia", "Una identidad que parte de la claridad."],
    estado: [
      "Estado del servicio",
      "Una consulta directa, con la hora de la comprobación.",
    ],
  };
  const special = specialPages[key];
  if (!page && !special) return <NotFoundPage />;
  const title = page?.title ?? special![0]!;
  const lead = page?.lead ?? special![1]!;
  return (
    <div className={styles.page}>
      <title>{pageTitle(title)}</title>
      <meta name="description" content={lead} />
      <link rel="canonical" href={SITE_URL + pathname} />
      <header className={styles.centerHead}>
        <div className={styles.brandTile}>
          <img src={logo} width={48} height={48} alt="" />
        </div>
        <h1>{title}</h1>
        <p>{lead}</p>
      </header>
      {page && (
        <div className={styles.principles}>
          {page.sections.map((section, i) => (
            <section key={section.title}>
              <span aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h2>{section.title}</h2>
                <p>{section.text}</p>
              </div>
            </section>
          ))}
        </div>
      )}
      {key === "legal" && (
        <div className={styles.cards}>
          {LEGAL_PAGES.map((item) => (
            <Link to={legalRoute(item.slug)} key={item.slug}>
              <h2>{item.label}</h2>
              <p>
                Consulte el documento vigente, su fecha y los datos de contacto
                del responsable.
              </p>
              <FlechaDerechaIcon size={18} aria-hidden="true" />
            </Link>
          ))}
        </div>
      )}
      {key === "marca" && (
        <>
          <div className={styles.wordmarkSample}>
            <img src={logo} alt="" width={80} height={80} />
            <span>Aletheia</span>
          </div>
          <div className={styles.prose}>
            <h2>El símbolo de Aletheia</h2>
            <p>
              El símbolo reúne seis trazos en una misma figura. Sus dos
              versiones, clara y oscura, permiten conservar el contraste sobre
              diferentes superficies. Utilice el archivo vectorial para mantener
              la nitidez en cualquier tamaño.
            </p>
            <h2>Uso del nombre</h2>
            <p>
              Se escribe Aletheia. Mantenga el símbolo proporcionado, con
              espacio alrededor y contraste suficiente. No añada sombras ni
              estire la imagen.
            </p>
            <a href="/brand/symbol-white.svg" download="aletheia-blanco.svg">
              Descargar símbolo blanco (SVG)
            </a>
            <p>
              <a href="/brand/symbol-dark.svg" download="aletheia.svg">
                Descargar símbolo oscuro (SVG)
              </a>
            </p>
          </div>
        </>
      )}
      {key === "estado" && <ServiceStatus />}
      {["soporte", "empresa"].includes(key) && (
        <div className={styles.centerActions}>
          <ButtonLink to={"mailto:" + CONTACT_EMAIL}>
            Escribir a Aletheia
          </ButtonLink>
          <Link to="/ayuda">Consultar la base de conocimiento</Link>
        </div>
      )}
    </div>
  );
}

export function KnowledgePage() {
  const { slug } = useParams();
  const [search, setSearch] = useState("");
  const article = HELP.find((item) => item.slug === slug);
  if (slug && !article) return <NotFoundPage />;
  const filtered = HELP.filter((item) =>
    item.title.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className={styles.docs}>
      <title>{pageTitle(article?.title ?? "Base de conocimiento")}</title>
      <aside className={styles.docsNav}>
        <Link to="/ayuda">Base de conocimiento</Link>
        <label>
          <span className="visually-hidden">Buscar ayuda</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar una guía"
          />
        </label>
        <nav aria-label="Guías">
          {filtered.map((item) => (
            <Link
              aria-current={item.slug === slug ? "page" : undefined}
              key={item.slug}
              to={"/ayuda/" + item.slug}
            >
              {item.title}
            </Link>
          ))}
        </nav>
        {!filtered.length && <p>No encontramos esa guía.</p>}
      </aside>
      <article className={styles.docsBody}>
        {article ? (
          <>
            <p className={styles.kicker}>Guía de uso</p>
            <h1>{article.title}</h1>
            <p>{article.text}</p>
            <ButtonLink to={article.related}>
              Abrir en Aletheia <FlechaDerechaIcon size={16} />
            </ButtonLink>
            <Link to="/soporte">Necesito ayuda con este tema</Link>
          </>
        ) : (
          <>
            <p className={styles.kicker}>Ayuda</p>
            <h1>Un buen lugar para empezar.</h1>
            <p>Guías breves para encontrar su camino dentro de Aletheia.</p>
            <div className={styles.cards}>
              {HELP.map((item) => (
                <Link key={item.slug} to={"/ayuda/" + item.slug}>
                  <h2>{item.title}</h2>
                  <FlechaDerechaIcon size={18} />
                </Link>
              ))}
            </div>
          </>
        )}
      </article>
    </div>
  );
}
