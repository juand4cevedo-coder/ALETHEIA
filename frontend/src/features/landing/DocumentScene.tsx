import styles from "./DocumentScene.module.css";

/** Emblema de custodia: núcleo protegido y dos anillos que giran sin datos ficticios. */
export function DocumentScene() {
  return (
    <div className={styles.visual} aria-hidden="true">
      <div className={styles.sculpture}>
        <div className={styles.ambient} />
        <div className={styles.orbit} />
        <div className={styles.outerRing} />
        <div className={styles.innerRing} />
        <div className={styles.core}>
          <div className={styles.coreInset}>
            <span className={styles.keyhole} />
          </div>
        </div>
        <div className={styles.spark} />
      </div>
    </div>
  );
}
