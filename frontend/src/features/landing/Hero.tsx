import { ButtonLink } from "../../components/ui/ButtonLink.tsx";
import { FlechaDerechaIcon } from "../../components/ui/icons.tsx";
import { ROUTES } from "../../config/routes.ts";
import { SIGN_UP_LABEL } from "../../config/site.ts";
import styles from "./Hero.module.css";

export function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="titulo-inicio">
      <img
        src="/media/campaign/hero-real.jpg"
        alt="Profesionales colaborando en una oficina"
        className={styles.photo}
        fetchPriority="high"
        decoding="async"
      />
      <div className={styles.scrim} aria-hidden="true" />
      <div className={styles.content}>
        <h1 id="titulo-inicio" className={styles.title}>
          Sus casos cambian.
          <br />
          Su control también.
        </h1>
        <div className={styles.panel}>
          <p className={styles.panelTitle}>Empiece con un caso real</p>
          <p className={styles.lead}>
            Organice expedientes, reúna a su equipo y conserve el contexto de
            cada decisión en un solo lugar.
          </p>
          <div className={styles.actions}>
            <ButtonLink to={ROUTES.signUp}>
              {SIGN_UP_LABEL}
              <FlechaDerechaIcon size={18} aria-hidden="true" />
            </ButtonLink>
            <ButtonLink to="/#como-funciona" variant="text">
              Conocer el producto
            </ButtonLink>
          </div>
        </div>
      </div>
      <a className={styles.next} href="#como-funciona">
        <span className="visually-hidden">Ir a la siguiente sección</span>
        <FlechaDerechaIcon size={20} aria-hidden="true" />
      </a>
    </section>
  );
}
