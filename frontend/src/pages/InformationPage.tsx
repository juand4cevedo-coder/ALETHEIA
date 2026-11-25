import { BrandMark } from "../components/ui/BrandMark.tsx";
import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { ButtonLink } from "../components/ui/ButtonLink.tsx";
import { FlechaDerechaIcon } from "../components/ui/icons.tsx";
import { DATA_CONTROLLER } from "../config/legal.ts";
import { mediaUrl } from "../config/media.ts";
import { LEGAL_PAGES, legalRoute, ROUTES } from "../config/routes.ts";
import { CONTACT_EMAIL } from "../config/site.ts";
import { DOCUMENTATION } from "../content/documentation.ts";
import { HELP } from "../content/journal.ts";
import { CabeceraSeo } from "../seo/CabeceraSeo.tsx";
import { PAGINAS, paginaInformativa } from "../seo/fichas.ts";
import { metaAyuda } from "../seo/contenidos.ts";
import { EnterprisePage } from "./EnterprisePage.tsx";
import { NotFoundPage } from "./NotFoundPage.tsx";
import styles from "./EditorialPage.module.css";

type Section = { title: string; text: string };
// Nombre de la persona fundadora como se escribe en la prosa, con tilde.
const FOUNDER = "Juan Diego Acevedo Calderón";
const PAGES: Record<
  string,
  { title: string; lead: string; sections: Section[] }
> = {
  filosofia: {
    title: "ALETHEIA dice exactamente lo que hace y lo que no",
    lead: "Cada decisión de Aletheia parte de una pregunta: ¿esto ayuda a trabajar con más confianza?",
    sections: [
      {
        title: "Hacer visible lo importante",
        text: "Aletheia toma su nombre de la idea griega de verdad y desocultamiento. En el producto, esa intención se traduce en contexto: entender qué se está consultando, quién participa y qué permite concluir una comprobación.",
      },
      {
        title: "Dar espacio al trabajo",
        text: "La interfaz acompaña. Los títulos orientan, las acciones tienen una prioridad clara y el detalle aparece cuando se necesita, sin esconder nada.",
      },
      {
        title: "Decir exactamente lo que hacemos",
        text: "Una huella permite comparar contenido. Un permiso controla acceso. Ninguno reemplaza el criterio profesional ni la valoración de una autoridad judicial. Preferimos explicar esos límites con claridad.",
      },
    ],
  },
  nosotros: {
    title: "Quién está detrás de ALETHEIA",
    lead: `ALETHEIA es un servicio de ${FOUNDER}, desde Bello, Antioquia. Él responde por el servicio y por el tratamiento de los datos que usted guarda en él.`,
    sections: [
      {
        title: "Por qué existe",
        text: "Buena parte de la evidencia de un caso llega hoy como un archivo: un chat exportado, un correo, un audio, un video. Mientras pasa de un correo a una memoria USB y de ahí a una carpeta compartida, nadie anota quién lo tuvo ni si cambió. ALETHEIA existe para que esa constancia empiece el día en que el abogado recibe el archivo: su huella SHA-256, su sello de tiempo y cada movimiento, en un registro al que solo se le pueden agregar eventos.",
      },
      {
        title: "Lo que hace y lo que no",
        text: "Conserva el original, anota lo que pasa con él y permite exportar un paquete que cualquier persona puede verificar por su cuenta. No certifica pruebas ni decide si son admisibles: esa valoración le corresponde a la autoridad judicial.",
      },
      {
        title: "Quién responde",
        text: `El servicio lo opera ${FOUNDER}, persona natural con NIT ${DATA_CONTROLLER.nit}, no responsable de IVA, con domicilio en ${DATA_CONTROLLER.address}. Es el responsable del tratamiento de los datos personales, como lo explica la política de tratamiento de datos. Puede escribirle a ${CONTACT_EMAIL}; no incluya documentos de casos ni datos confidenciales en su primer mensaje.`,
      },
    ],
  },
  seguridad: {
    title: "Cómo se protegen la evidencia y las cuentas de su despacho",
    lead: "Estos son los controles que ya funcionan en ALETHEIA. Si alguno cambia, esta página cambia con él.",
    sections: [
      {
        title: "Archivos cifrados, con una llave por caso",
        text: "Cada archivo de evidencia se guarda cifrado con AES-256-GCM. Cada caso tiene su propia llave, y esa llave se guarda envuelta por una llave maestra en AWS KMS, que nunca sale de ese servicio.",
      },
      {
        title: "Cada despacho, separado en la base de datos",
        text: "PostgreSQL aplica seguridad a nivel de fila (RLS): cada consulta solo alcanza las filas de la organización de quien la hace. Dentro del despacho, cada caso tiene sus miembros, y administrar la organización no abre todos los casos.",
      },
      {
        title: "Una custodia a la que solo se le agregan eventos",
        text: "La base de datos rechaza cualquier cambio o borrado de un evento de custodia ya escrito. Cada evento lleva la huella del anterior, así que una alteración rompe la cadena y aparece al verificarla.",
      },
      {
        title: "Un paquete que se verifica sin ALETHEIA",
        text: "El paquete de preservación trae los originales, el manifiesto con sus huellas, los eventos de custodia y los sellos RFC 3161. El verificador público compara huellas en el navegador, sin enviar el archivo y sin límite de tamaño, y los sellos se pueden revisar con herramientas comunes como OpenSSL.",
      },
      {
        title: "Doble factor y códigos de recuperación",
        text: "Puede activar un segundo factor con una aplicación de autenticación. Al hacerlo recibe códigos de recuperación de un solo uso, para entrar si pierde el teléfono.",
      },
      {
        title: "Auditoría para quien responde por el despacho",
        text: "El propietario y los administradores consultan los eventos de seguridad del despacho: ingresos, intentos fallidos, cambios de rol, invitaciones y cambios del doble factor.",
      },
      {
        title: "Verificación de persona en los accesos",
        text: "Al crear una cuenta, ingresar o recuperar la contraseña, el navegador resuelve un pequeño cálculo en segundo plano. Frena los intentos automáticos sin pedirle que reconozca imágenes y sin enviar sus datos a otro sitio.",
      },
      {
        title: "Contraseñas y sesiones",
        text: "Las contraseñas se guardan con Argon2id, nunca como texto. Desde su cuenta puede cambiarla y cerrar las sesiones abiertas en todos sus dispositivos.",
      },
      {
        title: "Reportar un problema de seguridad",
        text: `Escriba a ${CONTACT_EMAIL} con una descripción y los pasos para reproducir el problema. No envíe contraseñas, tokens ni información de terceros. Si necesitamos más detalles, acordamos con usted un canal adecuado.`,
      },
    ],
  },
  soporte: {
    title: "Pida ayuda desde su cuenta o escríbanos",
    lead: "Cada solicitud recibe un número de radicado y una fecha límite de respuesta.",
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
  // /empresa tiene su propia página, con el escenario de un despacho y el formulario de cotización.
  if (key === "empresa") return <EnterprisePage />;
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
      <CabeceraSeo meta={paginaInformativa(key) ?? PAGINAS.noEncontrada} />
      <header
        className={styles.centerHead}
        data-size={page ? "long" : undefined}
      >
        <div className={styles.brandTile}>
          <BrandMark size={84} />
        </div>
        <h1>{title}</h1>
        <p>{lead}</p>
      </header>
      {key === "nosotros" && <Founder />}
      {key === "soporte" && <SupportChannels />}
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
            <BrandMark size={80} />
            <span>Aletheia</span>
          </div>
          <div className={styles.prose}>
            <h2>El símbolo de Aletheia</h2>
            <p>
              El símbolo es un ojo dentro de un recuadro de esquinas
              redondeadas. El ojo expresa observación cuidadosa y búsqueda de
              claridad; el iris, el punto exacto en que se fija la huella de
              cada archivo. La versión violeta sirve sobre superficies claras y
              la blanca sobre superficies de marca.
            </p>
            <h2>Uso del nombre</h2>
            <p>
              Se escribe Aletheia. Mantenga el símbolo proporcionado, con un
              espacio libre mínimo equivalente al ancho del iris y contraste
              suficiente. No cambie sus proporciones ni añada sombras,
              inclinaciones o elementos alrededor del recuadro.
            </p>
            <a href="/brand/symbol-white.svg" download="aletheia-blanco.svg">
              Descargar símbolo blanco (SVG)
            </a>
            <p>
              <a href="/brand/symbol-dark.svg" download="aletheia.svg">
                Descargar símbolo violeta (SVG)
              </a>
            </p>
          </div>
        </>
      )}
      {key === "estado" && <ServiceStatus />}
      {key === "soporte" && (
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

/** La persona fundadora, con su foto real. */
function Founder() {
  const photo = (width: number) =>
    mediaUrl(`/media/team/fundador-${width}.webp`);
  return (
    <figure className={styles.founder}>
      <img
        src={photo(800)}
        srcSet={`${photo(480)} 480w, ${photo(800)} 800w, ${photo(1200)} 1200w`}
        sizes="(min-width: 900px) 400px, 88vw"
        width={800}
        height={1000}
        loading="lazy"
        decoding="async"
        alt={`${FOUNDER}, fundador de ALETHEIA`}
      />
      <figcaption>
        <span className={styles.founderRole}>Fundador</span>
        <strong>{FOUNDER}</strong>
        <p>
          Construye y opera ALETHEIA, y responde por el servicio y por los datos
          que su despacho guarda en él.
        </p>
        <dl>
          <div>
            <dt>Desde</dt>
            <dd>Bello, Antioquia</dd>
          </div>
          <div>
            <dt>Responsable del tratamiento</dt>
            <dd>NIT {DATA_CONTROLLER.nit}</dd>
          </div>
          <div>
            <dt>Contacto</dt>
            <dd>
              <a href={"mailto:" + CONTACT_EMAIL}>{CONTACT_EMAIL}</a>
            </dd>
          </div>
        </dl>
      </figcaption>
    </figure>
  );
}

// Canales y plazos de respuesta: los mismos de los términos (peticiones y reclamos) y de
// services/support.py. El teléfono es el publicado en los términos.
const RESPONSE_TIMES = [
  ["Ayuda con el servicio", "15 días hábiles"],
  ["Petición, queja o reclamo", "15 días hábiles"],
  ["Consulta sobre sus datos personales", "10 días hábiles"],
  ["Corregir, actualizar o suprimir sus datos", "15 días hábiles"],
  ["Devolución de un pago aprobada", "Hasta 15 días calendario"],
] as const;

function SupportChannels() {
  return (
    <div className={styles.support}>
      <ul className={styles.channels}>
        <li>
          <h2>Desde su cuenta</h2>
          <p>
            Entre a Pedir soporte y elija el tipo de solicitud. Queda radicada
            al instante y la sigue en esa misma pantalla.
          </p>
          <Link to={ROUTES.support}>Ir a Pedir soporte</Link>
        </li>
        <li>
          <h2>Por correo</h2>
          <p>
            Si no tiene cuenta o no puede ingresar. Le confirmamos el recibo con
            su radicado.
          </p>
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </li>
        <li>
          <h2>Por teléfono</h2>
          <p>
            El número del responsable del servicio, publicado en los términos.
          </p>
          <a href={DATA_CONTROLLER.phoneHref}>{DATA_CONTROLLER.phone}</a>
        </li>
      </ul>
      <section className={styles.times} aria-labelledby="plazos-respuesta">
        <h2 id="plazos-respuesta">Plazos máximos de respuesta</h2>
        <dl>
          {RESPONSE_TIMES.map(([kind, time]) => (
            <div key={kind}>
              <dt>{kind}</dt>
              <dd>{time}</dd>
            </div>
          ))}
        </dl>
        <p>
          Son los plazos que fija la ley. Los días hábiles van de lunes a
          viernes, sin contar los festivos de Colombia.
        </p>
      </section>
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
      <CabeceraSeo
        meta={
          article
            ? metaAyuda(
                article,
                DOCUMENTATION.map((guia) => guia.slug),
              )
            : PAGINAS.ayuda
        }
      />
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
            <h1>{article.title}</h1>
            <p>{article.text}</p>
            <ButtonLink to={article.related}>
              Abrir en Aletheia <FlechaDerechaIcon size={16} />
            </ButtonLink>
            <Link to="/soporte">Necesito ayuda con este tema</Link>
          </>
        ) : (
          <>
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
