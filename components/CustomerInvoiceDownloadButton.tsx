"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import type { CustomerInvoicePdfData } from "@/lib/invoicePdf";

export default function CustomerInvoiceDownloadButton({
  invoice,
  className,
  label = "Invoice",
  style,
}: {
  invoice: CustomerInvoicePdfData;
  className?: string;
  label?: string;
  style?: React.CSSProperties;
}) {
  const [pending, setPending] = useState(false);

  async function download() {
    if (pending) return;
    setPending(true);
    try {
      const { generateCustomerInvoicePdf } = await import("@/lib/invoicePdf");
      const bytes = await generateCustomerInvoicePdf(invoice);
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      const url = URL.createObjectURL(
        new Blob([copy], { type: "application/pdf" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `${invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch {
      window.alert(
        "We couldn't create this invoice. Please refresh the booking page and try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={download}
      disabled={pending}
      title={`Download ${invoice.invoiceNumber}`}
    >
      <FileText size={18} /> {pending ? "Creating PDF..." : label}
    </button>
  );
}
