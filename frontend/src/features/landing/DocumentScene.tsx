import styles from "./Hero.module.css";

const outerMarks = Array.from({ length: 24 }, (_, index) => index);
const innerMarks = Array.from({ length: 12 }, (_, index) => index);

export function DocumentScene() {
  return (
    <div className={styles.visual} aria-hidden="true">
      <div className={styles.horizon} />
      <div className={styles.cryptoScene}>
        <div className={styles.orbitOuter}>
          {outerMarks.map((mark) => (
            <i
              key={mark}
              style={{
                transform: `rotate(${mark * 15}deg) translateY(-148px)`,
              }}
            />
          ))}
        </div>
        <div className={styles.orbitMiddle}>
          {innerMarks.map((mark) => (
            <i
              key={mark}
              style={{
                transform: `rotate(${mark * 30}deg) translateY(-104px)`,
              }}
            />
          ))}
        </div>
        <div className={styles.orbitInner} />
        <div className={styles.cryptoCore}>
          <svg viewBox="0 0 100 100" fill="none" focusable="false">
            <path d="M31 43V32a19 19 0 0 1 38 0v11" />
            <rect x="23" y="43" width="54" height="43" rx="7" />
            <circle cx="50" cy="62" r="4" />
            <path d="M50 66v9" />
          </svg>
        </div>
        <span className={styles.cryptoLabel}>SHA-256 / 256 BITS</span>
      </div>
    </div>
  );
}
