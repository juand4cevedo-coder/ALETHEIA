// Exporta una tabla de la consola a CSV que Excel abre bien en español: separador punto y coma,
// BOM para las tildes y cada celda entre comillas. Una celda que empieza con =, +, - o @ se
// antepone con un apóstrofo para que la hoja de cálculo no la ejecute como fórmula.
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function toCsv(
  header: readonly string[],
  rows: readonly string[][],
): string {
  return [header, ...rows].map((row) => row.map(cell).join(";")).join("\r\n");
}

export function downloadCsv(
  filename: string,
  header: readonly string[],
  rows: readonly string[][],
): void {
  const blob = new Blob(["﻿", toCsv(header, rows)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
