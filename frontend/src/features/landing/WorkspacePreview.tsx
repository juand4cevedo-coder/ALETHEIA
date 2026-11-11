import logoUrl from "../../assets/logo.svg";
import { buttonClassName } from "../../components/ui/buttonStyles.ts";
import { ChainStrip } from "../../components/ui/ChainStrip.tsx";
import { FilingNumber } from "../../components/ui/FilingNumber.tsx";
import { StatusBadge } from "../../components/ui/StatusBadge.tsx";
import { WORDMARK } from "../../config/site.ts";
import { custodyActionLabel } from "../cases/custodyActions.ts";
import { CustodyStrip } from "../cases/CustodyStrip.tsx";
import { describeEvidenceByType } from "../cases/evidenceTypes.ts";
import styles from "./WorkspacePreview.module.css";
import {
  CarpetaAbiertaIcon,
  ChevronAbajoIcon,
  InicioIcon,
  MasIcon,
  UsuarioIcon,
  UsuariosIcon,
} from "../../components/ui/icons.tsx";

const NAV = [
  { label: "Inicio", icon: InicioIcon },
  { label: "Casos", icon: CarpetaAbiertaIcon, count: 14, active: true },
  { label: "Miembros", icon: UsuariosIcon },
  { label: "Mi cuenta", icon: UsuarioIcon },
] as const;

const TOTALS = {
  open: 14,
  closed: 6,
  evidences: 312,
  pending_stamps: 1,
  custody_events: 4208,
};

type Row = {
  title: string;
  filing?: string;
  reference?: string;
  area: string;
  court?: string;
  evidence: Record<string, number>;
  actions: string[];
  actor: string;
  when: string;
  stamping?: boolean;
};

// Casos de ejemplo con radicados de 23 dígitos reales en su forma: despacho, especialidad,
// juzgado, año y consecutivo.
const ROWS: readonly Row[] = [
  {
    title: "Sucesión Gómez Pardo",
    filing: "05001311001220260038800",
    area: "Familia",
    court: "Juzgado 12 de Familia de Medellín",
    evidence: { document: 3, image: 1 },
    actions: [
      "case_created",
      "evidence_uploaded",
      "evidence_stamped",
      "evidence_uploaded",
    ],
    actor: "Andrés Ruiz",
    when: "hace 2 min",
    stamping: true,
  },
  {
    title: "Despido sin justa causa, Torres",
    filing: "11001310500320260014300",
    area: "Laboral",
    court: "Juzgado 3 Laboral de Bogotá",
    evidence: { chat: 8, email: 3, audio: 1 },
    actions: [
      "evidence_uploaded",
      "evidence_stamped",
      "evidence_uploaded",
      "evidence_stamped",
      "evidence_downloaded",
    ],
    actor: "Laura Gómez",
    when: "hoy a las 9:12 a. m.",
  },
  {
    title: "Acoso laboral, Contreras",
    reference: "RA-2026-031",
    area: "Laboral",
    evidence: { chat: 19, image: 6, audio: 2 },
    actions: [
      "evidence_stamped",
      "export_requested",
      "export_ready",
      "export_downloaded",
    ],
    actor: "Laura Gómez",
    when: "9 de noviembre",
  },
  {
    title: "Responsabilidad médica, Hernández",
    filing: "08001310300520250041200",
    area: "Civil",
    court: "Juzgado 5 Civil de Barranquilla",
    evidence: { document: 6, email: 3 },
    actions: [
      "evidence_uploaded",
      "evidence_stamped",
      "member_added",
      "evidence_downloaded",
    ],
    actor: "Camila Rojas",
    when: "3 de noviembre",
  },
];

function evidenceCount(evidence: Record<string, number>): number {
  return Object.values(evidence).reduce((sum, count) => sum + count, 0);
}

// El libro de casos del espacio de trabajo, construido con los mismos componentes de la
// aplicación (insignias, radicados, cadena y franja de la custodia) para que la imagen no se
// aparte del producto. Es una imagen: los lectores de pantalla reciben su descripción.
export function WorkspacePreview() {
  return (
    <div className={styles.wrap}>
      <p className="visually-hidden">
        Vista del espacio de trabajo: el libro de casos de una firma, con las
        evidencias de cada caso, su cadena de custodia y el estado de
        integridad. Un caso tiene un sello de tiempo en curso.
      </p>
      <div className={styles.window} aria-hidden="true">
        <div className={styles.topbar}>
          <span className={styles.brand}>
            <img src={logoUrl} alt="" width={20} height={20} />
            {WORDMARK}
          </span>
          <span className={styles.account}>
            <span className={styles.seal}>LG</span>
            <span className={styles.who}>
              <span className={styles.person}>Laura Gómez</span>
              <span className={styles.organization}>Ruiz & Asociados</span>
            </span>
            <ChevronAbajoIcon size={16} />
          </span>
        </div>

        <div className={styles.body}>
          <ul className={styles.nav}>
            {NAV.map((item) => (
              <li
                key={item.label}
                className={styles.navItem}
                data-active={"active" in item || undefined}
              >
                <item.icon size={16} />
                {item.label}
                {"count" in item && (
                  <span className={styles.count}>{item.count}</span>
                )}
              </li>
            ))}
          </ul>

          <div className={styles.main}>
            <div className={styles.head}>
              <div>
                <p className={styles.eyebrow}>Expedientes</p>
                <p className={styles.title}>Casos</p>
              </div>
              <span className={buttonClassName({ size: "sm" })}>
                <MasIcon size={16} />
                Abrir un caso
              </span>
            </div>

            <CustodyStrip totals={TOTALS} />

            <div className={styles.book}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Caso y radicado</th>
                    <th className={styles.courtColumn}>Despacho</th>
                    <th className={styles.evidenceColumn}>Evidencias</th>
                    <th className={styles.chainColumn}>Cadena de custodia</th>
                    <th className={styles.integrityColumn}>Integridad</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row) => (
                    <tr key={row.title}>
                      <td>
                        <span className={styles.caseTitle}>{row.title}</span>
                        {row.filing ? (
                          <FilingNumber digits={row.filing} />
                        ) : (
                          <span className={styles.noFiling}>
                            Sin radicado, referencia interna{" "}
                            <b>{row.reference}</b>
                          </span>
                        )}
                      </td>
                      <td className={styles.courtColumn}>
                        <span className={styles.area}>{row.area}</span>
                        <span className={styles.court}>
                          {row.court ?? "Aún sin despacho"}
                        </span>
                      </td>
                      <td className={styles.evidenceColumn}>
                        <span className={styles.evidenceCount}>
                          {evidenceCount(row.evidence)}
                        </span>
                        <span className={styles.evidenceTypes}>
                          {describeEvidenceByType(row.evidence)}
                        </span>
                      </td>
                      <td className={styles.chainColumn}>
                        <ChainStrip actions={row.actions} />
                        <span className={styles.when}>
                          <span className={styles.whenAction}>
                            {custodyActionLabel(row.actions.at(-1)!)}
                          </span>
                          {`${row.actor}, ${row.when}`}
                        </span>
                      </td>
                      <td className={styles.integrityColumn}>
                        {row.stamping ? (
                          <StatusBadge tone="pending">Sellando</StatusBadge>
                        ) : (
                          <StatusBadge tone="muted">Sin verificar</StatusBadge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
