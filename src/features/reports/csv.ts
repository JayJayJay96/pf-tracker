function safeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const raw = String(value);
  const protectedValue = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(protectedValue)
    ? `"${protectedValue.replaceAll('"', '""')}"`
    : protectedValue;
}

export function toCsv(
  columns: string[],
  rows: Record<string, unknown>[],
): string {
  const lines = [
    columns.map(safeCell).join(','),
    ...rows.map((row) => columns.map((column) => safeCell(row[column])).join(',')),
  ];
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
