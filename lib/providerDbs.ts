export const DBS_CERTIFICATE_MAX_BYTES = 8 * 1024 * 1024;
export const DBS_CERTIFICATE_ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

const MIME_EXTENSION: Record<string, "pdf" | "jpg" | "png"> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

export function normalizeDbsCertificateNumber(value: unknown) {
  return String(value ?? "").replace(/\D/g, "").slice(0, 12);
}

export function isDbsCertificateNumber(value: unknown) {
  return /^\d{12}$/.test(normalizeDbsCertificateNumber(value));
}

export function isDbsIssueDate(value: unknown, now: Date = new Date()) {
  const date = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  if (parsed.toISOString().slice(0, 10) !== date) return false;
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  return parsed <= today && parsed.getUTCFullYear() >= 2000;
}

export function dbsCertificateExtension(name: unknown, mimeType: unknown) {
  const mime = String(mimeType ?? "").toLowerCase();
  const extension = String(name ?? "").toLowerCase().split(".").pop();
  const nameExtension =
    extension === "pdf" || extension === "png"
      ? extension
      : extension === "jpg" || extension === "jpeg"
        ? "jpg"
        : null;
  const mimeExtension = mime ? MIME_EXTENSION[mime] ?? null : null;
  if (!nameExtension || (mime && !mimeExtension)) return null;
  if (mimeExtension && mimeExtension !== nameExtension) return null;
  return nameExtension;
}

export function isSupportedDbsCertificate(
  name: unknown,
  mimeType: unknown,
  size: unknown,
) {
  const bytes = Number(size);
  return Boolean(
    dbsCertificateExtension(name, mimeType) &&
      Number.isFinite(bytes) &&
      bytes > 0 &&
      bytes <= DBS_CERTIFICATE_MAX_BYTES,
  );
}
