import { useEffect, useId, useRef, useState } from "react";

import { arco, guilloche, marcas, ojo } from "../../brand/geometria.ts";
import styles from "./Emblema.module.css";
import { movimientoReducido } from "../../lib/preferencias.ts";

const C = 120;
const MARCAS = marcas(C, C, 95, 5, 10);
const BANDA = [0, 1, 2, 3].map((k) =>
  guilloche(C, C, 66, 8, 24, (k * Math.PI) / 2),
);

/** El emblema completo: el sello con las 64 marcas de la huella, la banda de guilloché y el ojo.
 * Al entrar en pantalla se dibuja trazo por trazo, una sola vez; con movimiento reducido aparece
 * completo. Es decorativo salvo que se le pase `titulo`. */
export function Emblema({
  tamano = 240,
  titulo,
  leyenda = true,
}: {
  tamano?: number;
  titulo?: string;
  leyenda?: boolean;
}) {
  const id = useId();
  const ref = useRef<SVGSVGElement>(null);
  // Espera a entrar en pantalla solo si hay con qué observarlo y el movimiento está permitido.
  const [dibujo, setDibujo] = useState<"listo" | "espera" | "dibuja">(() =>
    typeof IntersectionObserver !== "undefined" &&
    !movimientoReducido()
      ? "espera"
      : "listo",
  );
  useEffect(() => {
    const el = ref.current;
    if (!el || dibujo !== "espera") return;
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada?.isIntersecting) {
          setDibujo("dibuja");
          observador.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, [dibujo]);
  return (
    <svg
      ref={ref}
      data-dibujo={dibujo}
      className={styles.emblema}
      viewBox="0 0 240 240"
      width={tamano}
      height={tamano}
      role={titulo ? "img" : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
      focusable="false"
    >
      <defs>
        <path id={`${id}-arriba`} d={arco(C, C, 106, true)} />
        <path id={`${id}-abajo`} d={arco(C, C, 110, false)} />
      </defs>
      <g className={styles.tinta}>
        <circle
          className={styles.trazo}
          cx={C}
          cy={C}
          r={117}
          pathLength={1}
          strokeWidth={1.6}
        />
        <circle
          className={styles.trazo}
          cx={C}
          cy={C}
          r={99}
          pathLength={1}
          strokeWidth={1}
        />
        <g className={styles.marcas}>
          {MARCAS.map((m, i) => (
            <path
              key={i}
              d={m.d}
              strokeWidth={m.larga ? 1.8 : 1}
              style={{ ["--i" as string]: i }}
            />
          ))}
        </g>
        <circle
          className={styles.trazo}
          cx={C}
          cy={C}
          r={80}
          pathLength={1}
          strokeWidth={1}
        />
      </g>
      <g className={styles.laton}>
        {BANDA.map((d, i) => (
          <path
            key={i}
            className={styles.trazo}
            d={d}
            pathLength={1}
            strokeWidth={0.55}
            style={{ ["--i" as string]: i }}
          />
        ))}
      </g>
      <g className={styles.tinta}>
        <circle
          className={styles.trazo}
          cx={C}
          cy={C}
          r={52}
          pathLength={1}
          strokeWidth={1}
        />
        <path
          className={styles.trazo}
          d={ojo(C, C, 84, 34)}
          pathLength={1}
          strokeWidth={3}
        />
        <circle
          className={styles.trazo}
          cx={C}
          cy={C}
          r={15.5}
          pathLength={1}
          strokeWidth={2.6}
        />
      </g>
      <g className={styles.laton}>
        <circle
          className={styles.trazo}
          cx={C}
          cy={C}
          r={10}
          pathLength={1}
          strokeWidth={1.2}
        />
        <circle className={styles.pupila} cx={C} cy={C} r={5.2} />
      </g>
      {leyenda && (
        <g className={styles.leyenda}>
          <text>
            <textPath
              href={`#${id}-arriba`}
              startOffset="50%"
              textAnchor="middle"
            >
              ALETHEIA
            </textPath>
          </text>
          <text>
            <textPath
              href={`#${id}-abajo`}
              startOffset="50%"
              textAnchor="middle"
            >
              HUELLA, SELLO Y CUSTODIA
            </textPath>
          </text>
        </g>
      )}
    </svg>
  );
}
