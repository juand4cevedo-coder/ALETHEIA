import {
  type DragEvent,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import styles from "./FileDropzone.module.css";
import { ArchivoSubirIcon, CerrarIcon, DocumentoIcon } from "./icons.tsx";

type FileDropzoneProps = {
  id: string;
  name: string;
  required?: boolean;
  disabled?: boolean;
  describedBy?: string;
  /** Avance de la subida, de 0 a 100. Con null no se muestra la barra. */
  progress?: number | null;
};

function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// Zona para elegir un archivo: se puede hacer clic, arrastrar uno encima o llegar con el
// teclado. El control real es un input de archivo, así que el formulario, los lectores de
// pantalla y las pruebas lo ven como siempre; lo único que cambia es cómo se dibuja.
export function FileDropzone({
  id,
  name,
  required,
  disabled,
  describedBy,
  progress = null,
}: FileDropzoneProps) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [over, setOver] = useState(false);

  // Al reiniciar el formulario, el input se vacía solo; la zona debe volver a su estado inicial.
  useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    const reset = () => setFile(null);
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, []);

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setOver(false);
    if (disabled || !input.current) return;
    const dropped = event.dataTransfer.files;
    if (dropped.length === 0) return;
    // Solo el primero: cada evidencia es un archivo y el servidor recibe uno por solicitud.
    const transfer = new DataTransfer();
    transfer.items.add(dropped[0]!);
    input.current.files = transfer.files;
    setFile(dropped[0]!);
  }

  function clear() {
    if (input.current) input.current.value = "";
    setFile(null);
    input.current?.focus();
  }

  return (
    <div className={styles.root}>
      <label
        htmlFor={id}
        className={styles.zone}
        data-over={over}
        data-filled={file !== null}
        data-disabled={disabled || undefined}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <span className={styles.icon} aria-hidden="true">
          {file ? <DocumentoIcon size={26} /> : <ArchivoSubirIcon size={26} />}
        </span>
        <span className={styles.text}>
          {file ? (
            <>
              <strong>{file.name}</strong>
              <small>{sizeLabel(file.size)}</small>
            </>
          ) : (
            <>
              <strong>Arrastre un archivo aquí</strong>
              <small>o haga clic para elegirlo en su equipo</small>
            </>
          )}
        </span>
      </label>
      <input
        ref={input}
        id={id}
        name={name}
        type="file"
        required={required}
        disabled={disabled}
        aria-describedby={describedBy}
        className={styles.input}
        onChange={onChange}
      />
      {file && !disabled && (
        <button type="button" className={styles.clear} onClick={clear}>
          <CerrarIcon size={14} aria-hidden="true" />
          Quitar el archivo
        </button>
      )}
      {progress !== null && (
        <div
          className={styles.bar}
          role="progressbar"
          aria-label="Avance de la subida"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <span style={{ inlineSize: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}
