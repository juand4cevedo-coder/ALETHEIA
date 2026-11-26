import { ButtonLink } from "../../components/ui/ButtonLink.tsx";
import { fotoProps } from "../../config/fotos.ts";
import { ROUTES } from "../../config/routes.ts";
import { SIGN_UP_LABEL } from "../../config/site.ts";
import styles from "./Hero.module.css";

// Portada (UI-001): un equipo joven de abogados a pantalla completa, con lo que ALETHEIA hace
// por ellos sobre un degradado de tinta. El movimiento es CSS.
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
      </div>
    </section>
  );
}
