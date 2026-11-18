import styles from "./DocumentScene.module.css";

/** Un documento sellado: la misma idea que StampCard, en el lugar que antes ocupaba la escultura. */
export function DocumentScene() {
  return (
    <div className={styles.visual} aria-hidden="true">
      <div className={styles.document}>
        <div className={styles.lines}>
          <span />
          <span />
          <span />
          <span className={styles.lineShort} />
        </div>
        <div className={styles.seal}>
          <div className={styles.sealRing} />
          <div className={styles.sealMark} />
        </div>
      </div>
    </div>
  );
}
