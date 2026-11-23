import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";

import type { Me } from "../../api/generated";
import { listCasesOptions } from "../../api/generated/@tanstack/react-query.gen.ts";
import {
  BuscarIcon,
  CarpetaAbiertaIcon,
  FlechaDerechaIcon,
  type IconComponent,
} from "../../components/ui/icons.tsx";
import { ROUTES } from "../../config/routes.ts";
import { formatFilingNumber } from "../cases/filingNumber.ts";
import styles from "./CommandPalette.module.css";
import { visibleSections } from "./sections.ts";

type Entry = {
  key: string;
  to: string;
  label: string;
  detail?: string;
  icon: IconComponent;
  group: "Ir a" | "Casos";
};

/** Sin tildes ni mayúsculas, para que «auditoria» encuentre «Auditoría». */
function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function useDebounced(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// Paleta de comandos: Ctrl K (o Cmd K) abre una ventana para saltar a cualquier sección de
// su rol o a un caso, escribiendo unas letras. Es solo navegación: no cambia datos, y los
// permisos los sigue decidiendo el servidor al abrir cada pantalla.
export function CommandPalette({
  me,
  open,
  onClose,
}: {
  me: Me;
  open: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const term = useDebounced(query.trim(), 180);
  const canSearchCases = me.organization != null && !me.platform_admin;

  const cases = useQuery({
    ...listCasesOptions({
      query: { status: "all", search: term, limit: 6 },
    }),
    enabled: open && canSearchCases && term.length >= 2,
  });

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
      setQuery("");
      setActive(0);
      requestAnimationFrame(() => input.current?.focus());
    }
    if (!open && element.open) element.close();
  }, [open]);

  const entries = useMemo<Entry[]>(() => {
    const needle = fold(query.trim());
    const sections = visibleSections(me)
      .filter(
        (section) => needle === "" || fold(section.label).includes(needle),
      )
      .map<Entry>((section) => ({
        key: `ir-${section.to}`,
        to: section.to,
        label: section.label,
        icon: section.icon,
        group: "Ir a",
      }));
    const found =
      term.length >= 2 && fold(query.trim()) === fold(term)
        ? (cases.data?.items ?? []).map<Entry>((item) => ({
            key: `caso-${item.id}`,
            to: `${ROUTES.cases}/${item.id}`,
            label: item.title,
            detail: [
              item.filing_number
                ? formatFilingNumber(item.filing_number)
                : null,
              item.court,
            ]
              .filter(Boolean)
              .join(", "),
            icon: CarpetaAbiertaIcon,
            group: "Casos",
          }))
        : [];
    return [...sections, ...found];
  }, [me, query, term, cases.data]);

  // El índice se acota al leer: si la lista se acorta al escribir, la selección no queda fuera.
  const activeIndex = Math.min(active, Math.max(entries.length - 1, 0));

  // Con el foco en el campo de búsqueda, el navegador no desplaza la lista al mover la selección:
  // se hace aquí para que la opción elegida siempre se vea antes de pulsar Enter.
  useEffect(() => {
    if (!open) return;
    document
      .getElementById(`${listId}-${activeIndex}`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [open, listId, activeIndex]);

  function choose(entry: Entry | undefined) {
    if (!entry) return;
    onClose();
    void navigate(entry.to);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => (current + 1) % Math.max(entries.length, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(
        (current) =>
          (current - 1 + Math.max(entries.length, 1)) %
          Math.max(entries.length, 1),
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(entries[activeIndex]);
    }
  }

  const groups = (["Ir a", "Casos"] as const)
    .map((name) => ({
      name,
      items: entries.filter((entry) => entry.group === name),
    }))
    .filter((group) => group.items.length > 0);
  const searching = term.length >= 2 && cases.isFetching;

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-label="Buscar y saltar a una pantalla"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialog.current?.close();
      }}
    >
      <div className={styles.search}>
        <BuscarIcon size={20} aria-hidden="true" />
        <input
          ref={input}
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            entries[activeIndex] ? `${listId}-${activeIndex}` : undefined
          }
          placeholder="Busque una pantalla o un caso"
          value={query}
          maxLength={80}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
        <kbd className={styles.key}>Esc</kbd>
      </div>
      <div className={styles.results} id={listId} role="listbox">
        {groups.map((group) => (
          <div key={group.name} role="presentation">
            <p className={styles.heading}>{group.name}</p>
            {group.items.map((entry) => {
              const index = entries.indexOf(entry);
              const Icon = entry.icon;
              return (
                <div
                  key={entry.key}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  data-active={index === activeIndex}
                  className={styles.option}
                  onPointerMove={() => setActive(index)}
                  onClick={() => choose(entry)}
                >
                  <span className={styles.icon} aria-hidden="true">
                    <Icon size={18} />
                  </span>
                  <span className={styles.label}>
                    <strong>{entry.label}</strong>
                    {entry.detail && <small>{entry.detail}</small>}
                  </span>
                  <FlechaDerechaIcon
                    className={styles.go}
                    size={16}
                    aria-hidden="true"
                  />
                </div>
              );
            })}
          </div>
        ))}
        {entries.length === 0 && (
          <p className={styles.empty} role="status">
            {searching
              ? "Buscando casos"
              : "No encontramos nada con ese texto."}
          </p>
        )}
      </div>
      <p className={styles.hint}>
        Flechas para moverse, Enter para abrir y Esc para cerrar.
      </p>
    </dialog>
  );
}
