"use client";

import InvoiceDownloadButton from "@/components/InvoiceDownloadButton";
import type { ProviderInvoicePdfData } from "@/lib/invoicePdf";

export default function PrintInvoiceButton({
  invoice,
}: {
  invoice: ProviderInvoicePdfData;
}) {
  return (
    <InvoiceDownloadButton
      invoice={invoice}
      label="Download PDF"
      style={{ display: "inline-block", border: 0, borderRadius: 999, background: "#6d28d9", color: "#fff", padding: "9px 15px", fontWeight: 900, cursor: "pointer", textDecoration: "none" }}
    />
  );
}
