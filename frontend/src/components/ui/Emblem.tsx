import markUrl from "../../assets/aletheia-mark.png";
import styles from "./Emblem.module.css";

export type EmblemState = "idle" | "working" | "done";

// Emblema de las pantallas de acceso: el logotipo dentro de un anillo de luz. Mientras la
// API responde, un arco recorre el anillo; cuando termina bien, el anillo se cierra completo.
// Es decorativo: el estado lo anuncian el botón y los mensajes de la página.
export function Emblem({ state = "idle" }: { state?: EmblemState }) {
  return (
    <div className={styles.emblem} data-state={state} aria-hidden="true">
      <svg className={styles.ring} viewBox="0 0 100 100">
        <circle className={styles.track} cx="50" cy="50" r="46" />
        <circle
          className={styles.arc}
          cx="50"
          cy="50"
          r="46"
          pathLength={100}
        />
      </svg>
      <img
        className={styles.mark}
        src={markUrl}
        alt=""
        width={34}
        height={32}
      />
    </div>
  );
}
