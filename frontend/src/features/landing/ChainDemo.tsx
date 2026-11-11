import { useState } from "react";

import { buttonClassName } from "../../components/ui/buttonStyles.ts";
import { Hash } from "../../components/ui/Hash.tsx";
import {
  ALTERED_INDEX,
  ALTERED_TIME,
  CHAIN_EVENTS,
  GENESIS,
  chainRecord,
} from "./chain.ts";
import styles from "./ChainDemo.module.css";
import { useSha256 } from "./useSha256.ts";
import { EnlaceIcon, EnlaceRotoIcon } from "../../components/ui/icons.tsx";

/** Demostración de la cadena: cambiar un registro rompe la cadena desde ese evento. */
export function ChainDemo() {
  const [altered, setAltered] = useState(false);
  const target = CHAIN_EVENTS[ALTERED_INDEX];
  const alteredNumber = ALTERED_INDEX + 1;
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
        <p className={styles.case}>Despido sin justa causa, Torres</p>
        <p className={styles.file} translate="no">
          chat_cliente.zip
        </p>
      </div>

      <ol className={styles.chain}>
        {CHAIN_EVENTS.map((event, index) => {
          const broken = altered && index >= ALTERED_INDEX;
          const isTarget = altered && index === ALTERED_INDEX;
          const LinkIcon = broken ? EnlaceRotoIcon : EnlaceIcon;
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
                  <span>Evento {index + 1}</span>
                  <time className={isTarget ? styles.tampered : styles.time}>
                    {isTarget ? ALTERED_TIME : event.time}
                  </time>
                </p>
                <p className={styles.text}>{event.text}</p>
                {isTarget && (
                  <p className={styles.note}>
                    Registro modificado. La hora original era {event.time}
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
                    <dt>Huella registrada</dt>
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
                    Su huella anterior ya no coincide con la del evento{" "}
                    {alteredNumber}.
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
            <EnlaceRotoIcon size={16} aria-hidden="true" />
          ) : (
            <EnlaceIcon size={16} aria-hidden="true" />
          )}
          {altered
            ? `La cadena se rompe en el evento ${alteredNumber}`
            : "Cada huella anterior coincide con la del evento previo"}
        </p>
        <button
          type="button"
          className={buttonClassName({ variant: "secondary", size: "sm" })}
          onClick={() => setAltered((value) => !value)}
        >
          {altered
            ? "Restaurar la hora original"
            : `Cambiar la hora del evento ${alteredNumber}`}
        </button>
      </div>
    </div>
  );
}
