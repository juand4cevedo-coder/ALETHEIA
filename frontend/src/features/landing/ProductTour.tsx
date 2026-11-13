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
    title: "Su trabajo a la vista",
    icon: InicioIcon,
    text: "Casos abiertos, cerrados y registros de actividad. Los datos de su espacio, sin reconstruirlos a mano.",
    alt: "Panel real de Aletheia con tres casos abiertos y tres registros de custodia en una cuenta de revisión.",
  },
  {
    id: "casos",
    title: "Cada caso en su lugar",
    icon: CarpetaAbiertaIcon,
    text: "Filtre por título, radicado o despacho y retome el asunto que necesita.",
    alt: "Listado real de tres casos de ejemplo con sus especialidades y estado de verificación.",
  },
  {
    id: "actividad",
    title: "El contexto de cada paso",
    icon: RelojIcon,
    text: "Consulte quién abrió el caso, cuándo lo hizo y el registro asociado a esa acción.",
    alt: "Detalle real del caso Correspondencia de ejemplo y su evento de apertura, identificado como sin verificar.",
  },
];
export function ProductTour() {
  const [selected, setSelected] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const active = VIEWS[selected]!;
  return (
    <section
      data-reveal
      id="recorrido"
      className={section.section}
      aria-labelledby="titulo-producto"
    >
      <div className={section.inner}>
        <SectionHeading
          id="titulo-producto"
          title="Todo tiene su lugar."
          lead="Una vista clara del trabajo. El detalle, cuando lo necesita."
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
          <img
            key={active.id}
            src={"/media/producto-" + active.id + ".webp"}
            width={1260}
            height={720}
            loading="lazy"
            decoding="async"
            alt={active.alt}
          />
          <p>{active.text}</p>
        </div>
        <p className={styles.caption}>
          Capturas de la aplicación con datos locales de demostración.
        </p>
      </div>
    </section>
  );
}
