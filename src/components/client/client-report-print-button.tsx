"use client";

export function ClientReportPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded border border-white/20 px-4 py-2 print:hidden"
    >
      Print / Save as PDF
    </button>
  );
}
