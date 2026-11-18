import styles from "./Skeleton.module.css";

type SkeletonProps = {
  /** Alto del bloque; por defecto una línea de texto. */
  height?: string;
  width?: string;
};

// Marcador de carga: el mismo tamaño que el contenido que va a ocupar, para que nada salte al
// llegar. Nunca reemplaza el role="status" que anuncia la carga a quien usa lector de pantalla;
// este componente es solo el marcador visual, aria-hidden.
export function Skeleton({ height = "1em", width = "100%" }: SkeletonProps) {
  return (
    <span
      className={styles.skeleton}
      style={{ height, width }}
      aria-hidden="true"
    />
  );
}
