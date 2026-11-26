import { productShotProps } from "../../config/media.ts";
import { useRef, useState } from "react";
import {
  CarpetaAbiertaIcon,
  InicioIcon,
  RelojIcon,
} from "../../components/ui/icons.tsx";
import { SectionHeading } from "./SectionHeading.tsx";
import section from "./Section.module.css";
import styles from "./ProductTour.module.css";

const VIEWS = [
  {
    id: "resumen",
    title: "Su despacho de un vistazo",
    icon: InicioIcon,
    text: "Su día empieza con lo que importa: los casos abiertos, las pruebas por sellar y los plazos de la semana.",
    alt: "Inicio de ALETHEIA con la bienvenida del despacho y los indicadores de casos y pruebas, en una cuenta de ejemplo.",
  },
  {
    id: "evidencias",
    title: "Cada prueba en su caso",
    icon: CarpetaAbiertaIcon,
    text: "Reciba chats, audios y documentos de su cliente y guárdelos tal como llegaron, con su fecha y su hora.",
    alt: "Pestaña Pruebas de un caso laboral de ejemplo, con el formulario para agregar una prueba.",
  },
  {
    id: "tareas",
    title: "Plazos que no se escapan",
    icon: RelojIcon,
    text: "Asigne tareas a su equipo con fecha límite y reciba un aviso antes de cada vencimiento.",
    alt: "Pestaña Tareas y plazos de un caso de ejemplo, con tres tareas asignadas y sus fechas límite.",
  },
];
export function ProductTour() {
  const [selected, setSelected] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const active = VIEWS[selected]!;
  return (
    <section
      id="recorrido"
      className={section.section}
      aria-labelledby="titulo-producto"
    >
      <div className={section.inner}>
        <SectionHeading
          id="titulo-producto"
          title="Así se ve su espacio de trabajo"
          lead="Pantallas reales de ALETHEIA con una cuenta de ejemplo."
        />
        <div
          className={styles.tabs}
          role="tablist"
          aria-label="Recorrido por el producto"
        >
          {VIEWS.map((view, index) => (
            <button
              key={view.id}
              type="button"
              role="tab"
              id={"vista-" + view.id}
              aria-selected={selected === index}
              aria-controls={"panel-" + view.id}
              tabIndex={selected === index ? 0 : -1}
              ref={(node) => {
                buttons.current[index] = node;
              }}
              onClick={() => setSelected(index)}
              onKeyDown={(event) => {
                const target =
                  event.key === "ArrowRight"
                    ? (index + 1) % VIEWS.length
                    : event.key === "ArrowLeft"
                      ? (index + VIEWS.length - 1) % VIEWS.length
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? VIEWS.length - 1
                          : null;
                if (target !== null) {
                  event.preventDefault();
                  setSelected(target);
                  buttons.current[target]?.focus();
                }
              }}
            >
              <svg
                className={styles.travelingBorder}
                aria-hidden="true"
                focusable="false"
              >
                <rect
                  x="1"
                  y="1"
                  width="calc(100% - 2px)"
                  height="calc(100% - 2px)"
                  rx="15"
                  pathLength="100"
                />
              </svg>
              <span className={styles.tabInner}>
                <span className={styles.icon}>
                  <view.icon size={18} aria-hidden="true" />
                </span>
                {view.title}
              </span>
            </button>
          ))}
        </div>
        <div
          role="tabpanel"
          id={"panel-" + active.id}
          aria-labelledby={"vista-" + active.id}
          tabIndex={0}
          className={styles.panel}
        >
          <div className={styles.browser} aria-hidden="true">
            <span />
            <span />
            <span />
            <span className={styles.address}>aletheia.sbs/app</span>
          </div>
          <img
            key={active.id}
            {...productShotProps(
              "/media/producto/" + active.id + ".webp",
              "(min-width: 900px) 60vw, 92vw",
            )}
            width={1260}
            height={720}
            loading="lazy"
            decoding="async"
            alt={active.alt}
          />
          <p key={"texto-" + active.id}>{active.text}</p>
        </div>
      </div>
    </section>
  );
}
