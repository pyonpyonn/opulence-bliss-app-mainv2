"use client";

export default function PrintInvoiceButton({ invoiceId }: { invoiceId: string }) {
  return (
    <a
      href={`/api/worker/invoices/${invoiceId}/pdf`}
      download
      style={{ display: "inline-block", border: 0, borderRadius: 999, background: "#6d28d9", color: "#fff", padding: "9px 15px", fontWeight: 900, cursor: "pointer", textDecoration: "none" }}
    >
      Download PDF
    </a>
  );
}
