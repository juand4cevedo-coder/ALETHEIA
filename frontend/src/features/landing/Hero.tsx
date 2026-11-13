import { ButtonLink } from "../../components/ui/ButtonLink.tsx";
import { FlechaDerechaIcon } from "../../components/ui/icons.tsx";
import { ROUTES } from "../../config/routes.ts";
import { SIGN_UP_LABEL } from "../../config/site.ts";
import { DocumentScene } from "./DocumentScene.tsx";
import styles from "./Hero.module.css";

export function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="titulo-inicio">
      <div className={styles.scene}>
        <div className={styles.intro}>
          <a href="#como-funciona" className={styles.eyebrow}>
            <span>
              Un lugar para cada caso{" "}
              <FlechaDerechaIcon size={14} aria-hidden="true" />
            </span>
          </a>
          <h1 id="titulo-inicio" className={styles.title}>
            Su trabajo.
            <br />
            Con claridad.
          </h1>
          <p className={styles.lead}>
            Organice sus casos, reúna a su equipo y conserve el contexto de cada
            decisión. Más orden para trabajar con tranquilidad.
          </p>
          <div className={styles.actions}>
            <ButtonLink to={ROUTES.signUp}>{SIGN_UP_LABEL}</ButtonLink>
            <ButtonLink to="/docs" variant="text">
              Documentación <FlechaDerechaIcon size={16} aria-hidden="true" />
            </ButtonLink>
          </div>
        </div>
        <DocumentScene />
      </div>
      <div className={styles.benefits}>
        <p>Para quienes cuidan cada detalle de un caso.</p>
        <ul>
          <li>Abogados independientes</li>
          <li>Firmas jurídicas</li>
          <li>Equipos de trabajo</li>
        </ul>
      </div>
    </section>
  );
}
