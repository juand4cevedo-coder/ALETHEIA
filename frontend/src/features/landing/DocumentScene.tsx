import styles from "./Hero.module.css";

const digest = ["8f2a", "6c91", "b4e7", "03d5"];

/** Ilustración del recorrido de un archivo hacia su huella, sin representar un cálculo real. */
export function DocumentScene() {
  return (
    <div className={styles.visual} aria-hidden="true">
      <div className={styles.hashScene}>
        <div className={styles.hashGrid} />
        <div className={styles.fileGlyph}>
          <span className={styles.fileFold} />
          <span className={styles.fileLine} />
          <span className={styles.fileLine} />
          <span className={styles.fileLineShort} />
        </div>
        <div className={styles.hashFlow}>
          <span className={styles.flowDot} />
          <span className={styles.flowDot} />
          <span className={styles.flowDot} />
        </div>
        <div className={styles.digestCard}>
          <span className={styles.digestHeading}>SHA-256</span>
          <span className={styles.digestRule} />
          <span className={styles.digestBits}>
            {digest.map((part) => (
              <span key={part}>{part}</span>
            ))}
          </span>
          <span className={styles.digestFoot}>FRAGMENTO ILUSTRATIVO</span>
        </div>
        <span className={styles.sceneLabel}>
          DEL ARCHIVO A SU HUELLA DIGITAL
        </span>
      </div>
    </div>
  );
}
