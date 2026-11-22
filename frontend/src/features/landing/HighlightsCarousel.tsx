import { useEffect, useId, useState } from "react";
import { Link } from "react-router";

import { FlechaDerechaIcon } from "../../components/ui/icons.tsx";
import styles from "./HighlightsCarousel.module.css";
import section from "./Section.module.css";
import { SectionHeading } from "./SectionHeading.tsx";

const SLIDES = [
  {
    eyebrow: "Control del trabajo",
    title: "Vea el estado de su práctica sin reconstruirlo a mano.",
    text: "Casos abiertos, actividad reciente y responsabilidades reunidas en una vista diseñada para decidir qué sigue.",
    metric: "Una vista",
    detail: "para recuperar el contexto",
    image: "/media/campaign/producto-real.jpg",
    alt: "Equipo profesional trabajando en un espacio contemporáneo",
    to: "/#recorrido",
    link: "Explorar el producto",
  },
  {
    eyebrow: "Casos",
    title: "Cada asunto conserva su identidad y su recorrido.",
    text: "Radicado, especialidad, despacho, integrantes y estado permanecen conectados para que el equipo trabaje sobre la misma información.",
    metric: "Un lugar",
    detail: "para cada caso",
    image: "/media/campaign/hero-real.jpg",
    alt: "Profesionales revisando información en conjunto",
    to: "/docs/crear-un-caso",
    link: "Conocer la gestión de casos",
  },
  {
    eyebrow: "Actividad",
    title: "El contexto no desaparece cuando cambia la jornada.",
    text: "Consulte aperturas, responsables y movimientos relevantes sin depender de mensajes dispersos ni memoria informal.",
    metric: "Continuidad",
    detail: "entre personas y decisiones",
    image: "/media/campaign/equipo-real.jpg",
    alt: "Grupo profesional coordinando su trabajo",
    to: "/seguridad",
    link: "Revisar controles y actividad",
  },
  {
    eyebrow: "Equipo",
    title: "Cada persona entra con una responsabilidad clara.",
    text: "Invite colaboradores, asigne roles y mantenga la conversación alrededor del caso, no alrededor de archivos sueltos.",
    metric: "Roles claros",
    detail: "para trabajar en conjunto",
    image: "/media/campaign/equipo-real.jpg",
    alt: "Equipo profesional colaborando en una oficina",
    to: "/empresa",
    link: "Ver Aletheia para equipos",
  },
  {
    eyebrow: "Integridad",
    title: "Compruebe cambios sin entregar el archivo a terceros.",
    text: "Calcule y compare huellas SHA-256 directamente en el navegador. El archivo permanece en su dispositivo durante el proceso.",
    metric: "Local",
    detail: "el archivo no se envía",
    image: "/media/producto-actividad.webp",
    alt: "Vista de actividad de un caso en Aletheia",
    to: "/verificador",
    link: "Probar el comprobador",
  },
] as const;

const AUTOPLAY_MS = 6500;

export function HighlightsCarousel() {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [interacting, setInteracting] = useState(false);
  const labelId = useId();
  const slide = SLIDES[active]!;

  useEffect(() => {
    if (!playing || interacting) return;
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) return;
    const timer = window.setInterval(
      () => setActive((current) => (current + 1) % SLIDES.length),
      AUTOPLAY_MS,
    );
    return () => window.clearInterval(timer);
  }, [playing, interacting]);

  function select(index: number) {
    setActive(index);
  }

  return (
    <section
      className={`${section.section} ${styles.section}`}
      aria-labelledby={labelId}
    >
      <div className={section.inner}>
        <SectionHeading
          id={labelId}
          title="Mucho más que ordenar expedientes."
          lead="Un espacio completo para entender el trabajo, coordinar al equipo y conservar el contexto de cada caso."
        />
        <div
          className={styles.carousel}
          role="region"
          aria-roledescription="carrusel"
          aria-label="Capacidades de Aletheia"
          onMouseEnter={() => setInteracting(true)}
          onMouseLeave={() => setInteracting(false)}
          onFocusCapture={() => setInteracting(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setInteracting(false);
          }}
        >
          <div className={styles.visual} key={slide.title}>
            <img src={slide.image} alt={slide.alt} loading="lazy" />
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
                  onClick={() => select(index)}
                >
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
    </section>
  );
}
