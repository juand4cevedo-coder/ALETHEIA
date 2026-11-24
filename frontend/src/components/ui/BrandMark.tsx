import styles from "./BrandMark.module.css";

// Símbolo de Aletheia en el modo de color vigente. En el oscuro el recuadro sube a un violeta
// más luminoso: el de la marca vibra sobre un fondo casi negro y pierde el borde. El cambio de
// archivo lo hace el CSS (BrandMark.module.css), sin código: la portada no paga por él.
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <img
      className={styles.mark}
      src="/brand/symbol-dark.svg"
      alt=""
      width={size}
      height={size}
    />
  );
}
