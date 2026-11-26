import type { CSSProperties } from "react";

import section from "./Section.module.css";
import styles from "./StatsSection.module.css";

const AREAS = [
  "Derecho laboral",
  "Familia",
  "Penal",
  "Civil y comercial",
  "Responsabilidad médica",
  "Seguros",
  "Administrativo",
  "Consumidor",
] as const;

// Cifras que se cumplen siempre: salen de las condiciones de la prueba y de la política de
// conservación, no de estadísticas de uso. El número sube de cero a su valor al entrar en
// pantalla, solo con CSS (StatsSection.module.css); sin movimiento, se ve el valor final.
const CIFRAS = [
  { valor: 14, sufijo: "", texto: "días para probarla completa, sin tarjeta" },
  { valor: 10, sufijo: "", texto: "años guardamos cada prueba que suba" },
  { valor: 100, sufijo: "%", texto: "de sus casos se pueden exportar siempre" },
] as const;

export function StatsSection() {
  return (
    <section className={styles.section} aria-label="ALETHEIA en cifras">
      {/* Cinta de áreas del derecho: se repite dos veces para que el desplazamiento no corte. */}
      <div className={styles.ribbon} aria-hidden="true">
        <div className={styles.track}>
          {[...AREAS, ...AREAS].map((area, i) => (
            <span key={i}>{area}</span>
          ))}
        </div>
      </div>
      <div className={`${section.inner} ${styles.grid}`}>
        {CIFRAS.map((cifra) => (
          <div key={cifra.texto} className={styles.stat}>
            <p
              className={styles.number}
              style={{ "--n": cifra.valor } as CSSProperties}
            >
              <span className="visually-hidden">
                {cifra.valor}
                {cifra.sufijo}
              </span>
              <span aria-hidden="true" />
              {cifra.sufijo && <span aria-hidden="true">{cifra.sufijo}</span>}
            </p>
            <p className={styles.text}>{cifra.texto}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
