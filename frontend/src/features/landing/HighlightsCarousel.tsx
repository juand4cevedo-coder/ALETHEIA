import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { Link } from "react-router";

import { FlechaDerechaIcon } from "../../components/ui/icons.tsx";
import { Lamina, type Motivo } from "../../components/brand/Lamina.tsx";
import { productShotProps } from "../../config/media.ts";
import styles from "./HighlightsCarousel.module.css";
import section from "./Section.module.css";
import { SectionHeading } from "./SectionHeading.tsx";

// Cada diapositiva usa una imagen distinta de las demás y de las del resto de la página. Las
// capturas son del producto real; la de equipo es una lámina de la marca, no una foto de banco.
type Visual =
  | { kind: "product"; image: string; alt: string }
  | { kind: "lamina"; motivo: Motivo };

type Slide = {
  eyebrow: string;
  title: string;
  text: string;
  metric: string;
  detail: string;
  to: string;
  link: string;
  visual: Visual;
};

const SLIDES: readonly Slide[] = [
  {
    eyebrow: "Tareas y plazos",
    title: "Cada responsabilidad, con su fecha y su responsable.",
    text: "Asigne tareas dentro del caso, fije prioridades y plazos y vea qué vence primero sin revisar mensajes dispersos.",
    metric: "Un tablero",
    detail: "para lo que vence esta semana",
    visual: {
      kind: "product",
      image: "/media/producto/tareas.webp",
      alt: "Pestaña de tareas y plazos de un caso, con prioridades y fechas límite.",
    },
    to: "/docs/crear-un-caso",
    link: "Conocer la gestión de casos",
  },
  {
    eyebrow: "Evidencias",
    title: "Cada archivo conserva su huella y su origen.",
    text: "Al recibirlo se calcula su huella SHA-256 y se cifra. Quedan registrados quién lo subió, de dónde viene y cuándo.",
    metric: "Original intacto",
    detail: "con huella desde el primer momento",
    visual: {
      kind: "product",
      image: "/media/producto/evidencias.webp",
      alt: "Lista de archivos conservados de un caso con su origen declarado y su tipo detectado.",
    },
    to: "/seguridad",
    link: "Revisar cómo se protege",
  },
  {
    eyebrow: "Equipo",
    title: "Cada persona entra con una responsabilidad clara.",
    text: "Invite colaboradores y asigne un rol a cada uno. Las notas y las tareas quedan en el caso que les corresponde.",
    metric: "Roles claros",
    detail: "para trabajar en conjunto",
    visual: { kind: "lamina", motivo: "acceso" },
    to: "/empresa",
    link: "Ver ALETHEIA para equipos",
  },
  {
    eyebrow: "Integridad",
    title: "Compruebe cambios sin entregar el archivo a terceros.",
    text: "Calcule y compare huellas SHA-256 directamente en el navegador. El archivo permanece en su dispositivo durante el proceso.",
    metric: "Local",
    detail: "el archivo no se envía",
    visual: {
      kind: "product",
      image: "/media/producto/verificador.webp",
      alt: "Comprobador de archivos de ALETHEIA, que compara un archivo con su manifiesto en el navegador.",
    },
    to: "/verificador",
    link: "Probar el comprobador",
  },
];

const AUTOPLAY_MS = 6500;
const SWIPE_PX = 48;

export function HighlightsCarousel() {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [interacting, setInteracting] = useState(false);
  const labelId = useId();
  const slide = SLIDES[active]!;
  const swipeStart = useRef<number | null>(null);

  useEffect(() => {
    if (!playing || interacting) return;
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) return;
    // Un temporizador por diapositiva: al elegir otra, la barra y la cuenta parten de cero.
    const timer = window.setTimeout(
      () => setActive((current) => (current + 1) % SLIDES.length),
      AUTOPLAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [active, playing, interacting]);

  function go(delta: number) {
    setActive((current) => (current + delta + SLIDES.length) % SLIDES.length);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") go(1);
    if (event.key === "ArrowLeft") go(-1);
  }

  // El deslizamiento solo se atiende con el dedo: con el ratón se usan las flechas y la barra.
  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse") swipeStart.current = event.clientX;
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (swipeStart.current === null) return;
    const distance = event.clientX - swipeStart.current;
    swipeStart.current = null;
    if (Math.abs(distance) >= SWIPE_PX) go(distance < 0 ? 1 : -1);
  }

  return (
    <section
      className={`${section.section} ${styles.section}`}
      aria-labelledby={labelId}
    >
      <div className={section.inner}>
        <SectionHeading
          id={labelId}
          title="Lo que pasa en un caso queda guardado dentro de ese caso"
          lead="Plazos, archivos y responsables se consultan en el mismo lugar, sin buscar después en el correo o en una carpeta compartida."
        />
        <div
          className={styles.carousel}
          role="region"
          aria-roledescription="carrusel"
          aria-label="Capacidades de ALETHEIA"
          onKeyDown={onKeyDown}
          onMouseEnter={() => setInteracting(true)}
          onMouseLeave={() => setInteracting(false)}
          onFocusCapture={() => setInteracting(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setInteracting(false);
          }}
        >
          <div
            className={styles.stage}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              swipeStart.current = null;
            }}
          >
            {SLIDES.map((item, index) => (
              <div
                key={item.title}
                className={styles.visual}
                data-kind={item.visual.kind}
                data-active={index === active}
                aria-hidden={index === active ? undefined : true}
              >
                {item.visual.kind === "product" ? (
                  <img
                    {...productShotProps(
                      item.visual.image,
                      "(min-width: 820px) 47vw, 86vw",
                    )}
                    alt={index === active ? item.visual.alt : ""}
                    width={1260}
                    height={720}
                    loading={index === 0 ? "eager" : "lazy"}
                    decoding="async"
                    draggable={false}
                  />
                ) : (
                  <Lamina motivo={item.visual.motivo} />
                )}
              </div>
            ))}
            <div className={styles.counter} aria-hidden="true">
              <strong>{String(active + 1).padStart(2, "0")}</strong>
              <span>/ {String(SLIDES.length).padStart(2, "0")}</span>
            </div>
          </div>
          <article
            className={styles.copy}
            aria-live="polite"
            aria-atomic="true"
            key={`${slide.title}-copy`}
          >
            <p className={styles.eyebrow}>{slide.eyebrow}</p>
            <h3>{slide.title}</h3>
            <p className={styles.description}>{slide.text}</p>
            <div className={styles.metric}>
              <strong>{slide.metric}</strong>
              <span>{slide.detail}</span>
            </div>
            <Link to={slide.to} className={styles.link}>
              {slide.link}
              <FlechaDerechaIcon size={18} aria-hidden="true" />
            </Link>
          </article>
          <div className={styles.controls} aria-label="Controles del carrusel">
            <div className={styles.dots}>
              {SLIDES.map((item, index) => (
                <button
                  key={item.title}
                  type="button"
                  className={styles.dot}
                  aria-label={`Mostrar ${index + 1} de ${SLIDES.length}: ${item.eyebrow}`}
                  aria-current={active === index ? "true" : undefined}
                  onClick={() => setActive(index)}
                >
                  <span className={styles.dotLabel}>{item.eyebrow}</span>
                  <span
                    className={styles.progress}
                    data-running={
                      active === index && playing && !interacting
                        ? "true"
                        : "false"
                    }
                  />
                </button>
              ))}
            </div>
            <div className={styles.buttons}>
              <button
                type="button"
                className={styles.round}
                onClick={() => go(-1)}
              >
                <FlechaDerechaIcon
                  className={styles.flip}
                  size={18}
                  aria-hidden="true"
                />
                <span className="visually-hidden">Diapositiva anterior</span>
              </button>
              <button
                type="button"
                className={styles.round}
                onClick={() => go(1)}
              >
                <FlechaDerechaIcon size={18} aria-hidden="true" />
                <span className="visually-hidden">Diapositiva siguiente</span>
              </button>
              <button
                type="button"
                className={styles.toggle}
                aria-pressed={!playing}
                onClick={() => setPlaying((current) => !current)}
              >
                {playing ? "Pausar" : "Reanudar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
