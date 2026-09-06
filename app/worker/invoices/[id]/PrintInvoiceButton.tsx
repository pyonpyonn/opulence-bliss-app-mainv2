"use client";

export default function PrintInvoiceButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={{ border: 0, borderRadius: 999, background: "#6d28d9", color: "#fff", padding: "9px 15px", fontWeight: 900, cursor: "pointer" }}
    >
      Print / save PDF
    </button>
  );
}
