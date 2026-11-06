// Dependency-free client-side exports for admin reports/statements: CSV, Excel
// (Microsoft SpreadsheetML, opens natively in Excel/Google Sheets) and print/PDF
// (the browser print dialog → "Save as PDF"). No external libraries — safe to use
// anywhere in the admin without adding build weight.

export function downloadBlob(filename: string, mime: string, content: string | Blob) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Build a UTF-8 CSV (with BOM so Excel reads accents correctly). */
export function rowsToCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))];
  return "﻿" + lines.join("\r\n");
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  downloadBlob(filename.endsWith(".csv") ? filename : `${filename}.csv`, "text/csv;charset=utf-8", rowsToCsv(headers, rows));
}

const xmlEsc = (v: unknown) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Export an Excel spreadsheet (SpreadsheetML .xls — opens natively in Excel and
 *  Google Sheets, with a bold header row). Number cells stay numeric so totals work. */
export function downloadExcel(filename: string, sheetName: string, headers: string[], rows: (string | number)[][]) {
  const cell = (v: string | number) => {
    const isNum = typeof v === "number" && isFinite(v);
    return `<Cell><Data ss:Type="${isNum ? "Number" : "String"}">${xmlEsc(v)}</Data></Cell>`;
  };
  const headRow = `<Row>${headers.map((h) => `<Cell ss:StyleID="hdr"><Data ss:Type="String">${xmlEsc(h)}</Data></Cell>`).join("")}</Row>`;
  const bodyRows = rows.map((r) => `<Row>${r.map(cell).join("")}</Row>`).join("");
  const safeSheet = xmlEsc(sheetName).slice(0, 31).replace(/[\\/?*[\]]/g, " ") || "Sheet1";
  const xml =
    `<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n` +
    `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n` +
    `<Styles><Style ss:ID="hdr"><Font ss:Bold="1"/><Interior ss:Color="#EDE7F6" ss:Pattern="Solid"/></Style></Styles>\n` +
    `<Worksheet ss:Name="${safeSheet}"><Table>${headRow}${bodyRows}</Table></Worksheet>\n</Workbook>`;
  downloadBlob(filename.endsWith(".xls") ? filename : `${filename}.xls`, "application/vnd.ms-excel", xml);
}

/** Open the browser print dialog (the user can pick a printer or "Save as PDF"). */
export function printPage() {
  if (typeof window !== "undefined") window.print();
}
