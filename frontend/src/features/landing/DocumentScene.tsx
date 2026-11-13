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
            <path d="M50 7 87 28v44L50 93 13 72V28L50 7Z" />
            <path d="M50 7v22m37-1L68 39m19 33L68 61M50 93V71M13 72l19-11M13 28l19 11M50 29 68 39v22L50 71 32 61V39l18-10Z" />
            <path d="m32 39 36 22m0-22L32 61" />
            <circle cx="50" cy="50" r="5" />
          </svg>
        </div>
        <span className={styles.cryptoLabel}>SHA-256 / 256 BITS</span>
      </div>
    </div>
  );
}
