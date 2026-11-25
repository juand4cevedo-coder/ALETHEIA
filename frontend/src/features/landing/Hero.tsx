import { ButtonLink } from "../../components/ui/ButtonLink.tsx";
import { FlechaDerechaIcon } from "../../components/ui/icons.tsx";
import { ROUTES } from "../../config/routes.ts";
import { SIGN_UP_LABEL } from "../../config/site.ts";
import { HeroScene } from "./HeroScene.tsx";
import styles from "./Hero.module.css";

// Lo que se promete junto al botón: lo que de verdad pasa al empezar la prueba.
const PROMISES = [
  "14 días sin tarjeta",
  "Nada se cobra solo",
  "Sus casos se exportan siempre",
] as const;

// Portada (UI-001): a la izquierda, qué es ALETHEIA y la acción; a la derecha, la escena del
// producto, que muestra lo que pasa con un archivo en vez de una foto de banco. El fondo es un
// grabado de guilloché, como el de un certificado, en el color del tema.
export function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="titulo-inicio">
      <div className={styles.engraving} aria-hidden="true" />
      <div className={styles.inner}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>
            <span className={styles.seal} aria-hidden="true" />
            Para abogados independientes y despachos en Colombia
          </p>
          <h1 id="titulo-inicio" className={styles.title}>
            La evidencia digital de sus casos, con huella y{" "}
            <em>sello de tiempo</em> desde el día en que la recibe.
          </h1>
          <p className={styles.lead}>
            Cada archivo queda con su huella SHA&#8209;256, su sello de tiempo y
            su cadena de custodia. Cuando lo necesite, el caso se exporta en un
            paquete que cualquier persona puede verificar por su cuenta.
          </p>
          <div className={styles.actions}>
            <ButtonLink to={ROUTES.signUp}>
              {SIGN_UP_LABEL}
              <FlechaDerechaIcon size={18} aria-hidden="true" />
            </ButtonLink>
            <ButtonLink to="/#como-funciona" variant="secondary">
              Ver cómo funciona
            </ButtonLink>
          </div>
          <ul className={styles.promises} aria-label="Condiciones de la prueba">
            {PROMISES.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <HeroScene />
      </div>
    </section>
  );
}
