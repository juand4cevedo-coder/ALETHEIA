import { Link2, Unlink } from "lucide-react";
import { useState } from "react";

import { Hash } from "../../components/ui/Hash.tsx";
import { CHAIN_EVENTS, GENESIS, chainRecord } from "./chain.ts";
import styles from "./ChainDemo.module.css";
import { useSha256 } from "./useSha256.ts";

// La alteración que se demuestra: antedatar el evento 2, el tipo de cambio que interesaría a
// quien quiere mover la hora de una prueba.
const ALTERED_INDEX = 1;
const ALTERED_TIME = "08:15:00";

/** Demostración B: cambiar un registro rompe la cadena desde ese evento en adelante. */
export function ChainDemo() {
  const [altered, setAltered] = useState(false);
  const target = CHAIN_EVENTS[ALTERED_INDEX];
  // La huella del registro alterado se calcula de verdad en el navegador; mientras no llega
  // (o si no hay Web Crypto) solo se dice que no coincide, sin inventar un valor.
  const { hash: recomputed } = useSha256(
    chainRecord(
      CHAIN_EVENTS[ALTERED_INDEX - 1].hash,
      ALTERED_TIME,
      target.text,
    ),
    "",
  );

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <p className={styles.caption}>Registro de custodia · Caso 2026-014</p>
        <span className={styles.fictitious}>Datos ficticios</span>
      </div>

      <ol className={styles.chain}>
        {CHAIN_EVENTS.map((event, index) => {
          const broken = altered && index >= ALTERED_INDEX;
          const isTarget = altered && index === ALTERED_INDEX;
          const LinkIcon = broken ? Unlink : Link2;
          return (
            <li
              key={event.hash}
              className={styles.event}
              data-broken={String(broken)}
            >
              <span className={styles.node} aria-hidden="true">
                <LinkIcon size={14} aria-hidden="true" />
              </span>
              <div className={styles.body}>
                <p className={styles.meta}>
                  <span className={styles.index}>Evento {index + 1}</span>
                  <time className={isTarget ? styles.tampered : styles.time}>
                    {isTarget ? ALTERED_TIME : event.time}
                  </time>
                </p>
                <p className={styles.text}>{event.text}</p>
                {isTarget && (
                  <p className={styles.note}>
                    Registro modificado: la hora original era {event.time}.
                  </p>
                )}

                <dl className={styles.hashes}>
                  <div>
                    <dt>Huella anterior</dt>
                    <dd>
                      <Hash
                        value={
                          index === 0 ? GENESIS : CHAIN_EVENTS[index - 1].hash
                        }
                        variant="short"
                        copyable={false}
                      />
                    </dd>
                  </div>
                  <div>
                    <dt>Huella</dt>
                    <dd>
                      <Hash
                        value={event.hash}
                        variant="short"
                        copyable={false}
                      />
                    </dd>
                  </div>
                  {isTarget && (
                    <div className={styles.recomputed}>
                      <dt>Huella recalculada</dt>
                      <dd>
                        {recomputed && (
                          <Hash
                            value={recomputed}
                            variant="short"
                            copyable={false}
                          />
                        )}
                        <span className={styles.verdict}>No coincide</span>
                      </dd>
                    </div>
                  )}
                </dl>

                {broken && !isTarget && (
                  <p className={styles.note}>
                    {index === ALTERED_INDEX + 1
                      ? "Su huella anterior ya no coincide con el evento 2."
                      : "Sin garantía: la cadena se rompió en el evento 2."}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div className={styles.footer}>
        <p
          role="status"
          className={altered ? styles.statusBroken : styles.statusIntact}
        >
          {altered ? (
            <Unlink size={16} aria-hidden="true" />
          ) : (
            <Link2 size={16} aria-hidden="true" />
          )}
          {altered
            ? "La cadena se rompe en el evento 2"
            : "La cadena está íntegra"}
        </p>
        <button
          type="button"
          className={styles.toggle}
          aria-pressed={altered}
          onClick={() => setAltered((value) => !value)}
        >
          Alterar el evento 2
        </button>
      </div>
    </div>
  );
}
