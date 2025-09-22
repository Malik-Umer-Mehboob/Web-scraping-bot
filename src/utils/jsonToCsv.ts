export function jsonToCsv(jsonData: Record<string, unknown>[]): string {
  if (!jsonData || jsonData.length === 0) {
    return "";
  }

  const keys = Object.keys(jsonData[0]);
  const header = keys.join(',');

  const rows = jsonData.map(row => {
    return keys.map(key => {
      let value = row[key] ?? "";
      if (typeof value === 'string') {
        value = `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',');
  });

  return [header, ...rows].join('\n');
}