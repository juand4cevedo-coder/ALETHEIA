import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router";

import type { Me, TaskInboxItem } from "../api/generated";
import { taskCalendarOptions } from "../api/generated/@tanstack/react-query.gen.ts";
import { Button } from "../components/ui/Button.tsx";
import { DescargarIcon, FlechaDerechaIcon } from "../components/ui/icons.tsx";
import { EmptyState } from "../components/ui/EmptyState.tsx";
import { Notice } from "../components/ui/Notice.tsx";
import { PageHeader } from "../components/ui/PageHeader.tsx";
import { ROUTES } from "../config/routes.ts";
import { pageTitle } from "../config/site.ts";
import {
  addMonths,
  currentMonth,
  dayKey,
  dayLabel,
  monthGrid,
  monthLabel,
  monthRange,
  timeLabel,
} from "../features/calendar/calendar.ts";
import { buildIcs } from "../features/calendar/ics.ts";
import styles from "./CalendarPage.module.css";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;

const PRIORITY_LABELS: Record<TaskInboxItem["priority"], string> = {
  urgent: "Urgente",
  high: "Alta",
  normal: "Normal",
  low: "Baja",
};

const STATUS_LABELS: Record<TaskInboxItem["status"], string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  completed: "Completada",
  canceled: "Cancelada",
};

function download(content: string, filename: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/calendar;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// Calendario de plazos: las tareas con fecha de los casos que la persona ve, por mes. El
// asistente solo ve las suyas. Es de consulta: las tareas se crean y se completan dentro de
// cada caso.
export function CalendarPage() {
  const me = useOutletContext<Me>();
  const [month, setMonth] = useState(() => currentMonth());
  // Hoy se fija al abrir la pantalla: el calendario no se mueve solo si pasa la medianoche.
  const [today] = useState(() => dayKey(new Date().toISOString()));
  const [selected, setSelected] = useState<string>(today);
  const range = monthRange(month);
  const calendar = useQuery({
    ...taskCalendarOptions({ query: range }),
    enabled: me.organization != null && !me.platform_admin,
    placeholderData: keepPreviousData,
  });

  const byDay = useMemo(() => {
    const map = new Map<string, TaskInboxItem[]>();
    for (const task of calendar.data?.items ?? []) {
      if (!task.due_at) continue;
      const key = dayKey(task.due_at);
      map.set(key, [...(map.get(key) ?? []), task]);
    }
    return map;
  }, [calendar.data]);

  const weeks = monthGrid(month);
  const chosen = byDay.get(selected) ?? [];
  const total = calendar.data?.items.length ?? 0;

  function move(delta: number) {
    const next = addMonths(month, delta);
    setMonth(next);
    const key = `${next.year}-${String(next.month).padStart(2, "0")}-01`;
    setSelected(key);
  }

  function exportIcs() {
    const ics = buildIcs(calendar.data?.items ?? []);
    if (ics)
      download(
        ics,
        `plazos-aletheia-${month.year}-${String(month.month).padStart(2, "0")}.ics`,
      );
  }

  return (
    <div className={styles.screen}>
      <title>{pageTitle("Calendario de plazos")}</title>
      <meta name="robots" content="noindex" />
      <PageHeader
        title="Calendario de plazos"
        description="Las fechas límite de las tareas de sus casos, mes a mes."
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={exportIcs}
            disabled={total === 0}
          >
            <DescargarIcon size={16} aria-hidden="true" />
            Llevar a mi calendario
          </Button>
        }
      />
      <div className={styles.bar}>
        <div className={styles.nav}>
          <button
            type="button"
            className={styles.step}
            onClick={() => move(-1)}
            aria-label="Mes anterior"
          >
            <FlechaDerechaIcon
              className={styles.flip}
              size={18}
              aria-hidden="true"
            />
          </button>
          <h2 className={styles.month} aria-live="polite">
            {monthLabel(month)}
          </h2>
          <button
            type="button"
            className={styles.step}
            onClick={() => move(1)}
            aria-label="Mes siguiente"
          >
            <FlechaDerechaIcon size={18} aria-hidden="true" />
          </button>
        </div>
        <Button
          variant="text"
          size="sm"
          onClick={() => {
            setMonth(currentMonth());
            setSelected(today);
          }}
        >
          Hoy
        </Button>
      </div>

      {calendar.isError && (
        <Notice tone="error">
          No pudimos cargar los plazos. Inténtelo de nuevo en un momento.
        </Notice>
      )}
      {calendar.data?.truncated && (
        <Notice tone="warning">
          Este mes tiene más plazos de los que se muestran. Se ven los primeros.
        </Notice>
      )}

      <div className={styles.grid} role="grid" aria-label={monthLabel(month)}>
        <div className={styles.weekdays} role="row">
          {WEEKDAYS.map((name) => (
            <span key={name} role="columnheader">
              {name}
            </span>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0]!.key} className={styles.week} role="row">
            {week.map((cell) => {
              const items = byDay.get(cell.key) ?? [];
              return (
                <button
                  key={cell.key}
                  type="button"
                  role="gridcell"
                  className={styles.cell}
                  data-outside={!cell.inMonth || undefined}
                  data-today={cell.key === today || undefined}
                  aria-selected={cell.key === selected}
                  aria-label={`${dayLabel(cell.key)}: ${
                    items.length === 0
                      ? "sin plazos"
                      : items.length === 1
                        ? "1 plazo"
                        : `${items.length} plazos`
                  }`}
                  onClick={() => setSelected(cell.key)}
                >
                  <span className={styles.number}>{cell.day}</span>
                  <span className={styles.chips} aria-hidden="true">
                    {items.slice(0, 2).map((task) => (
                      <span
                        key={task.id}
                        className={styles.chip}
                        data-priority={task.priority}
                        data-done={task.status === "completed" || undefined}
                      >
                        {task.title}
                      </span>
                    ))}
                    {items.length > 2 && (
                      <span className={styles.more}>
                        +{items.length - 2} más
                      </span>
                    )}
                  </span>
                  {items.length > 0 && (
                    <span className={styles.dots} aria-hidden="true">
                      {items.slice(0, 3).map((task) => (
                        <i key={task.id} data-priority={task.priority} />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <section className={styles.day} aria-labelledby="calendar-day">
        <h2 id="calendar-day" className={styles.dayTitle}>
          {dayLabel(selected)}
        </h2>
        {chosen.length === 0 ? (
          total === 0 && !calendar.isPending ? (
            <EmptyState
              title="Este mes no tiene plazos"
              description="Las tareas con fecha límite aparecen aquí. Se crean dentro de cada caso, en la pestaña Tareas y plazos."
              actions={
                <Link to={ROUTES.cases} className={styles.link}>
                  Ir a mis casos
                </Link>
              }
            />
          ) : (
            <p className={styles.empty}>No hay plazos este día.</p>
          )
        ) : (
          <ul className={styles.list}>
            {chosen.map((task) => (
              <li key={task.id} className={styles.item}>
                <span className={styles.time}>{timeLabel(task.due_at!)}</span>
                <div className={styles.body}>
                  <Link to={ROUTES.caseDetail(task.case_id)}>{task.title}</Link>
                  <small>
                    {task.case_title}. Responsable: {task.assignee_name}.
                  </small>
                </div>
                <span className={styles.tags}>
                  <span className={styles.tag} data-priority={task.priority}>
                    {PRIORITY_LABELS[task.priority]}
                  </span>
                  <span className={styles.tag}>
                    {STATUS_LABELS[task.status]}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
