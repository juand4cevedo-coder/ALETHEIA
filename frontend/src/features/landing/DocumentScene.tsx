import styles from "./DocumentScene.module.css";

const facets = [
  "8F2A C691",
  "B4E7 03D5",
  "71AC 92F0",
  "6E42 A15B",
  "D38C 04EF",
  "19B7 5A62",
  "CE84 308D",
  "5F1A E2B9",
];

/** Sello abstracto de huella digital. Los fragmentos visibles son ilustrativos. */
export function DocumentScene() {
  return (
    <div className={styles.visual} aria-hidden="true">
      <div className={styles.hashScene}>
        <div className={styles.aura} />
        <div className={styles.orbit} />
        <div className={styles.seal}>
          {facets.map((facet, index) => (
            <div className={styles.sealFacet} key={facet}>
              <span className={styles.facetIndex}>0{index + 1} / 08</span>
              <span className={styles.facetMark} />
              <span className={styles.facetHash}>{facet}</span>
              <span className={styles.facetLabel}>SHA-256</span>
            </div>
          ))}
        </div>
        <div className={styles.sealCap} />
        <span className={styles.sceneLabel}>HUELLA DIGITAL SHA-256</span>
      </div>
    </div>
  );
}
