import { ButtonLink } from "../../components/ui/ButtonLink.tsx";
import { fotoProps } from "../../config/fotos.ts";
import { ROUTES } from "../../config/routes.ts";
import { SIGN_UP_LABEL } from "../../config/site.ts";
import styles from "./Hero.module.css";

// Portada (UI-001): un equipo joven de abogados a pantalla completa, con lo que ALETHEIA hace
// por ellos sobre un degradado de tinta y dos fichas de lo que pasa en la aplicación. El
// movimiento es CSS.
export function Hero() {
  return (
    <section
      className={`${styles.hero} on-ink`}
      aria-labelledby="titulo-inicio"
    >
      <img
        className={styles.photo}
        {...fotoProps("equipo-portada", "100vw")}
        alt="Equipo de abogados jóvenes en su oficina"
        width={1920}
        height={1080}
        fetchPriority="high"
      />
      <div className={styles.inner}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>
            Para abogados y despachos en Colombia
          </p>
          <h1 id="titulo-inicio" className={styles.title}>
            Sus pruebas digitales, <em>listas para el juzgado.</em>
          </h1>
          <p className={styles.lead}>
            Guarde los chats, correos, audios y documentos de sus clientes desde
            el día en que llegan, organice cada caso con su equipo y demuestre
            ante el juez que nadie los modificó.
          </p>
          <div className={styles.actions}>
            <ButtonLink to={ROUTES.signUp}>{SIGN_UP_LABEL}</ButtonLink>
            <ButtonLink to="/#como-le-ayuda" variant="secondary">
              Cómo le ayuda
            </ButtonLink>
          </div>
        </div>

        <div className={styles.scene} aria-hidden="true">
          <div className={`${styles.card} ${styles.cardSaved}`}>
            <span className={`${styles.cardIcon} ${styles.iconOk}`} />
            <span>
              <strong>Chat de WhatsApp guardado</strong>
              <small>Caso Restrepo, hoy 9:14 a. m.</small>
            </span>
          </div>
          <div className={`${styles.card} ${styles.cardReady}`}>
            <span className={`${styles.cardIcon} ${styles.iconInk}`}>12</span>
            <span>
              <strong>Listo para el juez</strong>
              <small>Expediente con 12 pruebas</small>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
