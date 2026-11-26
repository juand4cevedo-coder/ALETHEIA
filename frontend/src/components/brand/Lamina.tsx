import { guilloche, marcas, ojo } from "../../brand/geometria.ts";
import styles from "./Lamina.module.css";

// Láminas del blog y de las secciones: dibujos técnicos en la paleta de la marca, uno por tema.
// Son SVG en línea: nítidos en cualquier pantalla, livianos y en el color del tema. Cada una
// muestra la idea del artículo (un chat que pasa a ser evidencia, una cadena de custodia, dos
// sellos) y no una foto de banco.

export type Motivo =
  | "chat"
  | "cadena"
  | "procesos"
  | "sellos"
  | "huella"
  | "acceso"
  | "expediente";

const HEX = "88088bbae258de001fcfdf2393429559281dc88ffad645d889ebfabdcabcdc9a";

function Grabado() {
  return (
    <g className={styles.grabado}>
      {[0, 1].map((k) => (
        <path key={k} d={guilloche(520, 330, 210, 9, 40, k * Math.PI, 360)} />
      ))}
      {[0, 1].map((k) => (
        <path
          key={`b${k}`}
          d={guilloche(520, 330, 150, 7, 30, k * Math.PI, 300)}
        />
      ))}
    </g>
  );
}

function Sello({ x, y, r }: { x: number; y: number; r: number }) {
  const escala = r / 120;
  return (
    <g transform={`translate(${x - r} ${y - r}) scale(${escala})`}>
      <circle
        cx={120}
        cy={120}
        r={117}
        className={styles.trazoTinta}
        strokeWidth={2.4}
      />
      {marcas(120, 120, 104, 6, 12).map((m, i) => (
        <path
          key={i}
          d={m.d}
          className={styles.trazoTinta}
          strokeWidth={m.larga ? 2.4 : 1.4}
        />
      ))}
      {[0, 1, 2].map((k) => (
        <path
          key={k}
          d={guilloche(120, 120, 70, 8, 22, (k * 2 * Math.PI) / 3, 360)}
          className={styles.trazoLaton}
          strokeWidth={1}
        />
      ))}
      <path
        d={ojo(120, 120, 92, 36)}
        className={styles.trazoTinta}
        strokeWidth={4}
      />
      <circle
        cx={120}
        cy={120}
        r={17}
        className={styles.trazoTinta}
        strokeWidth={3.4}
      />
      <circle cx={120} cy={120} r={7} className={styles.rellenoLaton} />
    </g>
  );
}

function Documento({
  x,
  y,
  w,
  h,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={10} className={styles.papel} />
      {Array.from({ length: 6 }, (_, i) => (
        <rect
          key={i}
          x={x + 18}
          y={y + 24 + i * 18}
          width={i === 5 ? w * 0.4 : w - 36 - (i % 2) * 22}
          height={6}
          rx={3}
          className={styles.linea}
        />
      ))}
      <text x={x + 18} y={y + h - 20} className={styles.mono}>
        {HEX.slice(0, 16)}
      </text>
    </g>
  );
}

function Chat() {
  return (
    <g>
      <rect
        x={70}
        y={70}
        width={170}
        height={270}
        rx={26}
        className={styles.papel}
      />
      <rect
        x={130}
        y={84}
        width={50}
        height={6}
        rx={3}
        className={styles.linea}
      />
      {[
        [90, 112, 110],
        [116, 150, 104],
        [90, 188, 124],
        [130, 226, 90],
        [90, 264, 100],
      ].map(([x, y, w], i) => (
        <rect
          key={i}
          x={x}
          y={y}
          width={w}
          height={26}
          rx={10}
          className={i % 2 ? styles.burbujaPropia : styles.burbuja}
        />
      ))}
      <path
        d="M262 205 H318"
        className={styles.trazoTinta}
        strokeWidth={2.4}
        strokeDasharray="4 6"
      />
      <path
        d="M310 197 L322 205 L310 213"
        className={styles.trazoTinta}
        strokeWidth={2.4}
      />
      <Documento x={340} y={92} w={180} h={226} />
      <Sello x={500} y={300} r={58} />
    </g>
  );
}

function Cadena() {
  const nodos = [
    [110, 250, "Subido"],
    [230, 170, "Descargado"],
    [350, 230, "Exportado"],
    [470, 140, "Verificado"],
  ] as const;
  return (
    <g>
      <path
        d="M110 250 C170 250 170 170 230 170 S290 230 350 230 S410 140 470 140"
        className={styles.trazoTinta}
        strokeWidth={2.2}
      />
      {nodos.map(([x, y, texto], i) => (
        <g key={texto}>
          <circle cx={x} cy={y} r={30} className={styles.papel} />
          <circle
            cx={x}
            cy={y}
            r={30}
            className={styles.trazoTinta}
            strokeWidth={2}
          />
          <circle
            cx={x}
            cy={y}
            r={7}
            className={i === 3 ? styles.rellenoLaton : styles.rellenoTinta}
          />
          <text
            x={x}
            y={y + 54}
            className={styles.etiqueta}
            textAnchor="middle"
          >
            {texto}
          </text>
          <text x={x} y={y - 42} className={styles.mono} textAnchor="middle">
            {HEX.slice(i * 8, i * 8 + 8)}
          </text>
        </g>
      ))}
    </g>
  );
}

function Procesos() {
  return (
    <g>
      <path d="M90 150 L200 100 L310 150 Z" className={styles.papel} />
      <path
        d="M90 150 L200 100 L310 150 Z"
        className={styles.trazoTinta}
        strokeWidth={2}
      />
      {[110, 150, 190, 230, 270].map((x) => (
        <rect
          key={x}
          x={x}
          y={160}
          width={18}
          height={120}
          rx={4}
          className={styles.columna}
        />
      ))}
      <rect
        x={90}
        y={284}
        width={220}
        height={14}
        rx={4}
        className={styles.columna}
      />
      <path d="M340 190 H520" className={styles.trazoTinta} strokeWidth={2} />
      {[360, 410, 460, 510].map((x, i) => (
        <g key={x}>
          <circle
            cx={x}
            cy={190}
            r={8}
            className={i === 3 ? styles.rellenoLaton : styles.rellenoTinta}
          />
          <rect
            x={x - 22}
            y={214}
            width={44}
            height={6}
            rx={3}
            className={styles.linea}
          />
          <rect
            x={x - 16}
            y={228}
            width={32}
            height={6}
            rx={3}
            className={styles.linea}
          />
        </g>
      ))}
      <text x={340} y={160} className={styles.mono}>
        05001310500220260012300
      </text>
    </g>
  );
}

function Sellos() {
  return (
    <g>
      <Sello x={230} y={205} r={120} />
      <g opacity={0.9}>
        <circle
          cx={410}
          cy={205}
          r={118}
          className={styles.trazoLaton}
          strokeWidth={2.4}
        />
        <circle
          cx={410}
          cy={205}
          r={96}
          className={styles.trazoLaton}
          strokeWidth={1.2}
        />
        {marcas(410, 205, 112, 5, 5).map((m, i) =>
          i % 2 ? null : (
            <path
              key={i}
              d={m.d}
              className={styles.trazoLaton}
              strokeWidth={1.2}
            />
          ),
        )}
        <text
          x={410}
          y={200}
          className={styles.etiquetaLaton}
          textAnchor="middle"
        >
          ONAC
        </text>
        <text x={410} y={222} className={styles.mono} textAnchor="middle">
          estampado acreditado
        </text>
      </g>
    </g>
  );
}

function Huella() {
  return (
    <g>
      {Array.from({ length: 8 }, (_, fila) =>
        Array.from({ length: 8 }, (_, col) => {
          const i = fila * 8 + col;
          const distinto = i === 27;
          return (
            <g key={i}>
              <rect
                x={120 + col * 46}
                y={60 + fila * 36}
                width={40}
                height={30}
                rx={6}
                className={distinto ? styles.celdaLaton : styles.celda}
              />
              <text
                x={140 + col * 46}
                y={80 + fila * 36}
                className={styles.monoCelda}
                textAnchor="middle"
              >
                {HEX[i]}
                {HEX[(i * 7) % 64]}
              </text>
            </g>
          );
        }),
      )}
    </g>
  );
}

function Acceso() {
  const miembros = [
    [170, 120],
    [150, 290],
    [450, 110],
    [470, 290],
  ] as const;
  return (
    <g>
      <circle
        cx={310}
        cy={205}
        r={150}
        className={styles.trazoTinta}
        strokeWidth={1.4}
        strokeDasharray="3 7"
      />
      {miembros.map(([x, y], i) => (
        <g key={i}>
          <path
            d={`M310 205 L${x} ${y}`}
            className={i < 3 ? styles.trazoTinta : styles.trazoTenue}
            strokeWidth={1.6}
          />
          <circle cx={x} cy={y} r={26} className={styles.papel} />
          <circle
            cx={x}
            cy={y - 6}
            r={8}
            className={i < 3 ? styles.rellenoTinta : styles.rellenoTenue}
          />
          <path
            d={`M${x - 13} ${y + 14} Q${x} ${y + 2} ${x + 13} ${y + 14}`}
            className={i < 3 ? styles.trazoTinta : styles.trazoTenue}
            strokeWidth={3}
          />
        </g>
      ))}
      <rect
        x={250}
        y={160}
        width={120}
        height={90}
        rx={12}
        className={styles.papel}
      />
      <path
        d="M268 180 H352 M268 198 H330 M268 216 H342"
        className={styles.trazoTenue}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <circle cx={352} cy={236} r={8} className={styles.rellenoLaton} />
    </g>
  );
}

function Expediente() {
  return (
    <g>
      <rect
        x={140}
        y={70}
        width={330}
        height={260}
        rx={16}
        className={styles.papel}
      />
      <rect
        x={160}
        y={92}
        width={120}
        height={20}
        rx={6}
        className={styles.celdaLaton}
      />
      <text x={170} y={107} className={styles.etiquetaLaton}>
        RADICADO
      </text>
      <text x={160} y={146} className={styles.monoGrande}>
        05001 31 05 002
      </text>
      <text x={160} y={174} className={styles.monoGrande}>
        2026 00123 00
      </text>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <circle
            cx={176}
            cy={214 + i * 34}
            r={10}
            className={styles.rellenoTinta}
          />
          <rect
            x={196}
            y={209 + i * 34}
            width={i === 1 ? 140 : 200}
            height={9}
            rx={4}
            className={styles.linea}
          />
        </g>
      ))}
      <Sello x={455} y={320} r={52} />
    </g>
  );
}

const DIBUJOS: Record<Motivo, () => React.JSX.Element> = {
  chat: Chat,
  cadena: Cadena,
  procesos: Procesos,
  sellos: Sellos,
  huella: Huella,
  acceso: Acceso,
  expediente: Expediente,
};

/** Una lámina 3:2. Es decorativa: el texto que la acompaña ya dice lo mismo. */
export function Lamina({
  motivo,
  className,
}: {
  motivo: Motivo;
  className?: string;
}) {
  const Dibujo = DIBUJOS[motivo];
  return (
    <svg
      className={className ? `${styles.lamina} ${className}` : styles.lamina}
      viewBox="0 0 600 400"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <rect width={600} height={400} className={styles.fondo} />
      <Grabado />
      <Dibujo />
    </svg>
  );
}
