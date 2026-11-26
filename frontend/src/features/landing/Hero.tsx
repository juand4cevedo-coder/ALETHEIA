import { ButtonLink } from "../../components/ui/ButtonLink.tsx";
import { fotoProps } from "../../config/fotos.ts";
import { ROUTES } from "../../config/routes.ts";
import { SIGN_UP_LABEL } from "../../config/site.ts";
import styles from "./Hero.module.css";

// Portada (UI-001): a la izquierda, lo que ALETHEIA hace por el abogado y la acción; a la
// derecha, un abogado en su despacho con dos fichas de lo que pasa en la aplicación. El
// movimiento es CSS.
export function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="titulo-inicio">
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

        <div className={styles.scene}>
          <img
            className={styles.photo}
            {...fotoProps("abogado-portada", "(max-width: 960px) 100vw, 44vw")}
            alt="Abogado en su despacho"
            width={1280}
            height={720}
            fetchPriority="high"
          />
          <div
            className={`${styles.card} ${styles.cardSaved}`}
            aria-hidden="true"
          >
            <span className={`${styles.cardIcon} ${styles.iconOk}`} />
            <span>
              <strong>Chat de WhatsApp guardado</strong>
              <small>Caso Restrepo, hoy 9:14 a. m.</small>
            </span>
          </div>
          <div
            className={`${styles.card} ${styles.cardReady}`}
            aria-hidden="true"
          >
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
