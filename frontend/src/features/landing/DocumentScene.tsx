import { HuellaIcon } from "../../components/ui/icons.tsx";
import styles from "./DocumentScene.module.css";

export function DocumentScene() {
  return (
    <div className={styles.scene} aria-hidden="true">
      <div className={styles.field} />
      <div className={styles.plate}>
        <div className={styles.engraving}>
          <HuellaIcon size={112} />
        </div>
        <div className={styles.scan} />
      </div>
    </div>
  );
}
