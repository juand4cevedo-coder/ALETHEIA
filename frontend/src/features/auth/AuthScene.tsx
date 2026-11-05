import styles from "./AuthScene.module.css";

// Estrellas en posiciones fijas: la escena es la misma en cada visita y en cada prueba.
// Cada una es [x %, y %, tamaño en px, retraso del brillo en s].
const STARS: ReadonlyArray<readonly [number, number, number, number]> = [
  [6, 8, 1.5, 0.4],
  [14, 22, 1, 2.1],
  [21, 6, 2, 3.3],
  [27, 31, 1, 1.2],
  [33, 14, 1.5, 4.6],
  [39, 4, 1, 0.9],
  [46, 19, 1, 2.8],
  [52, 9, 2, 1.7],
  [58, 27, 1, 3.9],
  [63, 5, 1.5, 0.2],
  [69, 17, 1, 4.1],
  [74, 34, 1.5, 2.4],
  [79, 11, 1, 1.1],
  [85, 24, 2, 3.6],
  [91, 7, 1, 0.6],
  [95, 29, 1.5, 2.2],
  [10, 38, 1, 4.4],
  [43, 36, 1, 1.5],
  [88, 42, 1, 3.1],
  [3, 26, 1, 2.6],
];

// Fondo de las pantallas de acceso: el cielo antes del amanecer sobre una cordillera de
// picos triangulares, la misma figura del logotipo, con la cara izquierda de cada pico
// iluminada como las bandas del logo. Aletheia, en griego, es lo que sale de lo
// oculto: la luz que sube desde el horizonte cuenta esa idea sin decirla. Es decorativo y el
// lector de pantalla lo ignora.
export function AuthScene() {
  return (
    <div className={styles.scene} aria-hidden="true">
      <div className={styles.sky} />
      <div className={styles.dawn} />
      <div className={styles.stars}>
        {STARS.map(([x, y, size, delay]) => (
          <span
            key={`${x}-${y}`}
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: size,
              height: size,
              animationDelay: `${delay}s`,
            }}
          />
        ))}
      </div>
      <svg
        className={styles.range}
        viewBox="0 0 1440 420"
        preserveAspectRatio="xMidYMax slice"
      >
        <defs>
          <linearGradient id="pico-lejano" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3d5f9e" />
            <stop offset="1" stopColor="#1c2c4e" />
          </linearGradient>
          <linearGradient id="pico-medio" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#24427a" />
            <stop offset="1" stopColor="#14213d" />
          </linearGradient>
          <linearGradient id="pico-cercano" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#162a52" />
            <stop offset="1" stopColor="#0c1426" />
          </linearGradient>
        </defs>
        <g className={styles.far}>
          <path
            fill="url(#pico-lejano)"
            d="M0 300 L150 170 L290 290 L430 120 L600 300 L760 150 L930 300 L1080 110 L1260 290 L1360 190 L1440 260 L1440 420 L0 420 Z"
          />
          <path
            className={styles.lit}
            d="M150 170 L0 300 L192 360 Z M430 120 L290 290 L481 360 Z M760 150 L600 300 L811 360 Z M1080 110 L930 300 L1134 360 Z M1360 190 L1260 290 L1384 360 Z"
          />
        </g>
        <g className={styles.mid}>
          <path
            fill="url(#pico-medio)"
            d="M0 340 L120 250 L250 350 L400 200 L560 350 L700 230 L860 350 L1010 210 L1170 350 L1300 240 L1440 330 L1440 420 L0 420 Z"
          />
          <path
            className={styles.lit}
            d="M120 250 L0 340 L159 410 Z M400 200 L250 350 L448 410 Z M700 230 L560 350 L748 410 Z M1010 210 L860 350 L1058 410 Z M1300 240 L1170 350 L1342 410 Z"
          />
        </g>
        <g>
          <path
            fill="url(#pico-cercano)"
            d="M0 380 L190 300 L360 400 L560 290 L760 400 L940 310 L1130 400 L1300 320 L1440 380 L1440 420 L0 420 Z"
          />
          <path
            className={styles.litNear}
            d="M190 300 L0 380 L241 420 Z M560 290 L360 400 L620 420 Z M940 310 L760 400 L997 420 Z M1300 320 L1130 400 L1342 420 Z"
          />
        </g>
      </svg>
      <div className={styles.ground} />
    </div>
  );
}
