import { SelloIcon } from "../../components/ui/icons.tsx";
import styles from "./DocumentScene.module.css";

// Huella ilustrativa: la misma idea de StampCard, no una huella real.
const HASH_PREVIEW = "7f3a9c1e...d05e82b5";

/** Expedientes en custodia con el sello al frente: StampCard llevado al hero. */
export function DocumentScene() {
  return (
    <div className={styles.visual} aria-hidden="true">
      <div className={styles.stack}>
        <div className={styles.cardBack} />
        <div className={styles.cardMid} />
        <div className={styles.card}>
          <div className={styles.lines}>
            <span className={styles.lineTitle} />
            <span />
            <span />
            <span className={styles.lineShort} />
          </div>
          <p className={styles.hash}>{HASH_PREVIEW}</p>
        </div>
        <div className={styles.seal}>
          <SelloIcon size={64} />
        </div>
      </div>
    </div>
  );
}
