import { ButtonLink } from "../../components/ui/ButtonLink.tsx";
import { FlechaDerechaIcon } from "../../components/ui/icons.tsx";
import { ROUTES } from "../../config/routes.ts";
import { SIGN_UP_LABEL, SIGN_UP_NOTE } from "../../config/site.ts";
import styles from "./Hero.module.css";
import { photoProps } from "../../config/media.ts";

export function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="titulo-inicio">
      <img
        {...photoProps("hero-real", "100vw")}
        alt="Profesionales colaborando en una oficina"
        className={styles.photo}
        width={1280}
        height={720}
        fetchPriority="high"
        decoding="async"
      />
      <div className={styles.scrim} aria-hidden="true" />
      <div className={styles.content}>
        <p className={styles.eyebrow}>
          Para abogados independientes y despachos en Colombia
        </p>
        <h1 id="titulo-inicio" className={styles.title}>
          La evidencia digital de sus casos, con huella y sello de tiempo desde
          el día en que la recibe.
        </h1>
        <div className={styles.panel}>
          <p className={styles.lead}>
            Cada archivo queda con su huella SHA-256, su sello de tiempo y su
            cadena de custodia. Cuando lo necesite, el caso se exporta en un
            paquete que cualquier persona puede verificar por su cuenta.
          </p>
          <div className={styles.actions}>
            <ButtonLink to={ROUTES.signUp}>
              {SIGN_UP_LABEL}
              <FlechaDerechaIcon size={18} aria-hidden="true" />
            </ButtonLink>
            <ButtonLink to="/#como-funciona" variant="text">
              Ver cómo funciona
            </ButtonLink>
          </div>
          <p className={styles.note}>{SIGN_UP_NOTE}</p>
        </div>
      </div>
      <a className={styles.next} href="#como-funciona">
        <span className="visually-hidden">Ir a la siguiente sección</span>
        <FlechaDerechaIcon size={20} aria-hidden="true" />
      </a>
    </section>
  );
}
