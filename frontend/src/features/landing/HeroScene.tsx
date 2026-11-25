import { useEffect, useRef, useState } from "react";

import { Emblema } from "../../components/brand/Emblema.tsx";
import styles from "./HeroScene.module.css";
import { coincide, movimientoReducido } from "../../lib/preferencias.ts";

// Huella ilustrativa del archivo de ejemplo; no corresponde a ninguna evidencia real.
const HUELLA =
  "88088bbae258de001fcfdf2393429559281dc88ffad645d889ebfabdcabcdc9a";
const HEX = "0123456789abcdef";
const GRUPOS = 8;

/** La huella se «calcula» al entrar: los caracteres cambian al azar y se fijan de izquierda a
 * derecha, como un cálculo que avanza. Con movimiento reducido se muestra fija. */
function useHuellaCalculada(): { texto: string; lista: boolean } {
  const [paso, setPaso] = useState(HUELLA.length);
  const animar = useRef(false);
  useEffect(() => {
    if (movimientoReducido()) return;
    animar.current = true;
    let actual = 0;
    let marco = 0;
    const tick = () => {
      actual += 1.6;
      setPaso(Math.min(HUELLA.length, Math.floor(actual)));
      if (actual < HUELLA.length) marco = requestAnimationFrame(tick);
    };
    const inicio = window.setTimeout(() => {
      setPaso(0);
      marco = requestAnimationFrame(tick);
    }, 520);
    return () => {
      window.clearTimeout(inicio);
      cancelAnimationFrame(marco);
    };
  }, []);
  const texto = [...HUELLA]
    .map((c, i) =>
      i < paso ? c : HEX[(i * 7 + paso * 13) % HEX.length]!,
    )
    .join("");
  return { texto, lista: paso >= HUELLA.length };
}

function enGrupos(huella: string): string[] {
  return Array.from({ length: GRUPOS }, (_, i) =>
    huella.slice(i * 8, i * 8 + 8),
  );
}

// Escena de la portada: el emblema al fondo, la ficha del sello al frente y la cadena de
// custodia al costado. En pantallas con puntero, las capas se desplazan unos píxeles con el
// cursor, cada una a su profundidad.
export function HeroScene() {
  const escena = useRef<HTMLDivElement>(null);
  const { texto, lista } = useHuellaCalculada();

  useEffect(() => {
    const el = escena.current;
    if (!el) return;
    if (
      !coincide("(hover: hover) and (pointer: fine)") ||
      movimientoReducido()
    )
      return;
    let marco = 0;
    const mover = (evento: PointerEvent) => {
      cancelAnimationFrame(marco);
      marco = requestAnimationFrame(() => {
        const caja = el.getBoundingClientRect();
        const x = (evento.clientX - caja.left) / caja.width - 0.5;
        const y = (evento.clientY - caja.top) / caja.height - 0.5;
        el.style.setProperty("--px", x.toFixed(3));
        el.style.setProperty("--py", y.toFixed(3));
      });
    };
    const soltar = () => {
      el.style.setProperty("--px", "0");
      el.style.setProperty("--py", "0");
    };
    window.addEventListener("pointermove", mover, { passive: true });
    document.addEventListener("pointerleave", soltar);
    return () => {
      cancelAnimationFrame(marco);
      window.removeEventListener("pointermove", mover);
      document.removeEventListener("pointerleave", soltar);
    };
  }, []);

  return (
    <div ref={escena} className={styles.scene} aria-hidden="true">
      <div className={styles.emblem}>
        <Emblema tamano={420} />
      </div>

      <figure className={styles.stamp}>
        <figcaption className={styles.stampHead}>
          <span>Sello de tiempo</span>
          <span className={styles.chip} data-listo={lista || undefined}>
            {lista ? "Sellado" : "Calculando"}
          </span>
        </figcaption>
        <dl className={styles.data}>
          <div>
            <dt>Archivo</dt>
            <dd>chat-whatsapp.txt</dd>
          </div>
          <div>
            <dt>Huella SHA&#8209;256</dt>
            <dd className={styles.hash}>
              {enGrupos(texto).map((grupo, i) => (
                <span key={i}>{grupo}</span>
              ))}
            </dd>
          </div>
          <div>
            <dt>Autoridad</dt>
            <dd>DigiCert, RFC 3161</dd>
          </div>
          <div>
            <dt>Fecha y hora</dt>
            <dd>3 de marzo de 2026, 9:14:08</dd>
          </div>
        </dl>
      </figure>

      <figure className={styles.chain}>
        <figcaption>Cadena de custodia</figcaption>
        <ol>
          <li>
            <strong>Subido</strong>
            <span>Laura Restrepo, origen declarado</span>
          </li>
          <li>
            <strong>Descargado</strong>
            <span>Andrés Gómez, abogado del caso</span>
          </li>
          <li>
            <strong>Exportado</strong>
            <span>Paquete de preservación</span>
          </li>
        </ol>
      </figure>
    </div>
  );
}
