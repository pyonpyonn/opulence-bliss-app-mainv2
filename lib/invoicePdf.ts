import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type ProviderInvoicePdfData = {
  invoiceNumber: string;
  issuedAt: string;
  status: string;
  professionalName: string;
  customerName: string;
  serviceName: string;
  address: string | null;
  propertySizeSqm: number | null;
  bookedAt: string;
  durationMinutes: number;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  grossAmount: number | null;
  platformFee: number | null;
  payoutAmount: number;
  payoutSchedule: string;
  payoutDueOn: string;
};

export type CustomerInvoicePdfData = {
  invoiceNumber: string;
  issuedAt: string;
  status: string;
  customerName: string;
  professionalName: string;
  serviceName: string;
  address: string | null;
  propertySizeSqm: number | null;
  bookedAt: string;
  durationMinutes: number;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  serviceAmount: number | null;
  tipAmount: number;
  membership: boolean;
};

export function customerInvoiceNumber(bookingId: string, issuedAt: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(issuedAt));
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  return `OB-${year}${month}-${bookingId.slice(0, 8).toUpperCase()}`;
}

const colours = {
  ink: rgb(22 / 255, 32 / 255, 42 / 255),
  muted: rgb(104 / 255, 113 / 255, 125 / 255),
  border: rgb(226 / 255, 225 / 255, 232 / 255),
  purple: rgb(109 / 255, 40 / 255, 217 / 255),
  purpleSoft: rgb(244 / 255, 236 / 255, 254 / 255),
  gold: rgb(246 / 255, 189 / 255, 70 / 255),
  blush: rgb(255 / 255, 239 / 255, 243 / 255),
};

const londonDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const londonDateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

function formatMoney(value: number | null) {
  return value === null ? "Not recorded" : `GBP ${value.toFixed(2)}`;
}

function formatDate(value: string | null, withTime = true) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return (withTime ? londonDateTime : londonDate).format(date);
}

function formatDuration(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;
  if (!hours) return `${remainder} min`;
  if (!remainder) return `${hours} hr${hours === 1 ? "" : "s"}`;
  return `${hours} hr${hours === 1 ? "" : "s"} ${remainder} min`;
}

function actualDuration(start: string | null, end: string | null) {
  if (!start || !end) return "Not recorded";
  const minutes = Math.max(
    0,
    Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000),
  );
  return formatDuration(minutes);
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = pdfSafeText(text).replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function pdfSafeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2022/g, "-")
    .replace(/\u00A3/g, "GBP ")
    .replace(/[^\x20-\x7E]/g, " ");
}

function drawLabelValue(
  page: PDFPage,
  fonts: { regular: PDFFont; bold: PDFFont },
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
) {
  page.drawText(label.toUpperCase(), {
    x,
    y,
    size: 8,
    font: fonts.bold,
    color: colours.muted,
  });
  const lines = wrapText(value, fonts.bold, 10.5, width);
  lines.slice(0, 2).forEach((line, index) => {
    page.drawText(line, {
      x,
      y: y - 16 - index * 13,
      size: 10.5,
      font: fonts.bold,
      color: colours.ink,
    });
  });
}

function drawSectionTitle(page: PDFPage, font: PDFFont, title: string, y: number) {
  page.drawText(title.toUpperCase(), {
    x: 48,
    y,
    size: 9,
    font,
    color: colours.purple,
  });
}

export async function generateProviderInvoicePdf(data: ProviderInvoicePdfData) {
  const document = await PDFDocument.create();
  document.setTitle(
    `${pdfSafeText(data.invoiceNumber)} - Opulence Bliss job invoice`,
  );
  document.setAuthor("Opulence Bliss");
  document.setSubject("Professional cleaning service invoice");
  document.setCreator("Opulence Bliss");

  const page = document.addPage([595.28, 841.89]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const fonts = { regular, bold };
  const pageWidth = page.getWidth();
  const contentWidth = pageWidth - 96;

  page.drawRectangle({ x: 0, y: 826, width: pageWidth * 0.34, height: 16, color: colours.gold });
  page.drawRectangle({ x: pageWidth * 0.34, y: 826, width: pageWidth * 0.31, height: 16, color: rgb(242 / 255, 162 / 255, 171 / 255) });
  page.drawRectangle({ x: pageWidth * 0.65, y: 826, width: pageWidth * 0.35, height: 16, color: colours.purple });

  page.drawText("OPULENCE BLISS", { x: 48, y: 785, size: 10, font: bold, color: colours.purple });
  page.drawText("Job invoice", { x: 48, y: 751, size: 27, font: bold, color: colours.ink });
  const invoiceNumber = pdfSafeText(data.invoiceNumber);
  page.drawText(invoiceNumber, {
    x: pageWidth - 48 - bold.widthOfTextAtSize(invoiceNumber, 12),
    y: 781,
    size: 12,
    font: bold,
    color: colours.ink,
  });
  const issued = `Issued ${formatDate(data.issuedAt, false)}`;
  page.drawText(issued, {
    x: pageWidth - 48 - regular.widthOfTextAtSize(issued, 9),
    y: 761,
    size: 9,
    font: regular,
    color: colours.muted,
  });
  page.drawLine({ start: { x: 48, y: 730 }, end: { x: pageWidth - 48, y: 730 }, thickness: 1.5, color: colours.ink });

  page.drawRectangle({ x: 48, y: 653, width: 239, height: 56, color: colours.purpleSoft });
  page.drawRectangle({ x: 308, y: 653, width: 239, height: 56, color: colours.blush });
  drawLabelValue(page, fonts, "Professional", data.professionalName, 62, 689, 210);
  drawLabelValue(page, fonts, "Customer", data.customerName, 322, 689, 210);

  drawSectionTitle(page, bold, "Booking details", 626);
  drawLabelValue(page, fonts, "Service", data.serviceName, 48, 598, 220);
  drawLabelValue(page, fonts, "Booked duration", formatDuration(data.durationMinutes), 308, 598, 220);
  drawLabelValue(page, fonts, "Scheduled", formatDate(data.bookedAt), 48, 548, 220);
  drawLabelValue(
    page,
    fonts,
    "Property size",
    data.propertySizeSqm === null ? "Not provided" : `${data.propertySizeSqm.toFixed(1)} m2`,
    308,
    548,
    220,
  );
  drawLabelValue(page, fonts, "Service location", data.address ?? "Not provided", 48, 498, contentWidth);

  drawSectionTitle(page, bold, "Session record", 448);
  const panelY = 369;
  const panelWidth = (contentWidth - 18) / 3;
  const sessionItems = [
    ["Checked in", formatDate(data.checkedInAt)],
    ["Checked out", formatDate(data.checkedOutAt)],
    ["Time on site", actualDuration(data.checkedInAt, data.checkedOutAt)],
  ];
  sessionItems.forEach(([label, value], index) => {
    const x = 48 + index * (panelWidth + 9);
    page.drawRectangle({ x, y: panelY, width: panelWidth, height: 58, color: index === 2 ? colours.purpleSoft : rgb(248 / 255, 249 / 255, 250 / 255), borderColor: colours.border, borderWidth: 0.7 });
    drawLabelValue(page, fonts, label, value, x + 11, panelY + 38, panelWidth - 22);
  });

  drawSectionTitle(page, bold, "Payment breakdown", 342);
  page.drawRectangle({ x: 48, y: 205, width: contentWidth, height: 116, color: rgb(250 / 255, 250 / 255, 252 / 255), borderColor: colours.border, borderWidth: 0.8 });
  const paymentRows: Array<[string, string, boolean]> = [
    ["Customer total", formatMoney(data.grossAmount), false],
    ["Platform commission", formatMoney(data.platformFee), false],
    ["Professional payout", formatMoney(data.payoutAmount), true],
  ];
  paymentRows.forEach(([label, value, strong], index) => {
    const y = 292 - index * 34;
    if (index > 0) page.drawLine({ start: { x: 62, y: y + 19 }, end: { x: pageWidth - 62, y: y + 19 }, thickness: 0.6, color: colours.border });
    page.drawText(label, { x: 62, y, size: strong ? 11 : 10, font: strong ? bold : regular, color: colours.ink });
    page.drawText(value, { x: pageWidth - 62 - (strong ? bold : regular).widthOfTextAtSize(value, strong ? 13 : 10), y: strong ? y - 1 : y, size: strong ? 13 : 10, font: strong ? bold : regular, color: strong ? colours.purple : colours.ink });
  });

  const schedule = data.payoutSchedule === "fortnightly" ? "Every 2 weeks" : `${data.payoutSchedule.charAt(0).toUpperCase()}${data.payoutSchedule.slice(1)}`;
  page.drawRectangle({ x: 48, y: 131, width: contentWidth, height: 49, color: colours.purpleSoft });
  page.drawText("PAYOUT SCHEDULE", { x: 62, y: 158, size: 8, font: bold, color: colours.purple });
  page.drawText(`${schedule} - due ${formatDate(`${data.payoutDueOn}T12:00:00Z`, false)}`, { x: 62, y: 141, size: 10.5, font: bold, color: colours.ink });

  page.drawLine({ start: { x: 48, y: 99 }, end: { x: pageWidth - 48, y: 99 }, thickness: 0.7, color: colours.border });
  page.drawText("Generated automatically when this cleaning session was completed.", { x: 48, y: 77, size: 8.5, font: regular, color: colours.muted });
  const status = pdfSafeText(data.status).toUpperCase();
  page.drawText(status, { x: pageWidth - 48 - bold.widthOfTextAtSize(status, 8.5), y: 77, size: 8.5, font: bold, color: colours.purple });

  return document.save();
}

export async function generateCustomerInvoicePdf(data: CustomerInvoicePdfData) {
  const document = await PDFDocument.create();
  const invoiceNumber = pdfSafeText(data.invoiceNumber);
  document.setTitle(`${invoiceNumber} - Opulence Bliss service invoice`);
  document.setAuthor("Opulence Bliss");
  document.setSubject("Customer cleaning service invoice");
  document.setCreator("Opulence Bliss");

  const page = document.addPage([595.28, 841.89]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const fonts = { regular, bold };
  const pageWidth = page.getWidth();
  const contentWidth = pageWidth - 96;

  page.drawRectangle({ x: 0, y: 826, width: pageWidth * 0.34, height: 16, color: colours.gold });
  page.drawRectangle({ x: pageWidth * 0.34, y: 826, width: pageWidth * 0.31, height: 16, color: rgb(242 / 255, 162 / 255, 171 / 255) });
  page.drawRectangle({ x: pageWidth * 0.65, y: 826, width: pageWidth * 0.35, height: 16, color: colours.purple });

  page.drawText("OPULENCE BLISS", { x: 48, y: 785, size: 10, font: bold, color: colours.purple });
  page.drawText("Service invoice", { x: 48, y: 751, size: 27, font: bold, color: colours.ink });
  page.drawText(invoiceNumber, {
    x: pageWidth - 48 - bold.widthOfTextAtSize(invoiceNumber, 12),
    y: 781,
    size: 12,
    font: bold,
    color: colours.ink,
  });
  const issued = `Issued ${formatDate(data.issuedAt, false)}`;
  page.drawText(issued, {
    x: pageWidth - 48 - regular.widthOfTextAtSize(issued, 9),
    y: 761,
    size: 9,
    font: regular,
    color: colours.muted,
  });
  page.drawLine({ start: { x: 48, y: 730 }, end: { x: pageWidth - 48, y: 730 }, thickness: 1.5, color: colours.ink });

  page.drawRectangle({ x: 48, y: 653, width: 239, height: 56, color: colours.purpleSoft });
  page.drawRectangle({ x: 308, y: 653, width: 239, height: 56, color: colours.blush });
  drawLabelValue(page, fonts, "Customer", data.customerName, 62, 689, 210);
  drawLabelValue(page, fonts, "Professional", data.professionalName, 322, 689, 210);

  drawSectionTitle(page, bold, "Booking details", 626);
  drawLabelValue(page, fonts, "Service", data.serviceName, 48, 598, 220);
  drawLabelValue(page, fonts, "Booked duration", formatDuration(data.durationMinutes), 308, 598, 220);
  drawLabelValue(page, fonts, "Scheduled", formatDate(data.bookedAt), 48, 548, 220);
  drawLabelValue(
    page,
    fonts,
    "Property size",
    data.propertySizeSqm === null ? "Not provided" : `${data.propertySizeSqm.toFixed(1)} m2`,
    308,
    548,
    220,
  );
  drawLabelValue(page, fonts, "Service location", data.address ?? "Not provided", 48, 498, contentWidth);

  drawSectionTitle(page, bold, "Session record", 448);
  const panelY = 369;
  const panelWidth = (contentWidth - 18) / 3;
  const sessionItems = [
    ["Checked in", formatDate(data.checkedInAt)],
    ["Checked out", formatDate(data.checkedOutAt)],
    ["Time on site", actualDuration(data.checkedInAt, data.checkedOutAt)],
  ];
  sessionItems.forEach(([label, value], index) => {
    const x = 48 + index * (panelWidth + 9);
    page.drawRectangle({ x, y: panelY, width: panelWidth, height: 58, color: index === 2 ? colours.purpleSoft : rgb(248 / 255, 249 / 255, 250 / 255), borderColor: colours.border, borderWidth: 0.7 });
    drawLabelValue(page, fonts, label, value, x + 11, panelY + 38, panelWidth - 22);
  });

  drawSectionTitle(page, bold, "Payment summary", 342);
  page.drawRectangle({ x: 48, y: 205, width: contentWidth, height: 116, color: rgb(250 / 255, 250 / 255, 252 / 255), borderColor: colours.border, borderWidth: 0.8 });
  const serviceAmount = data.membership
    ? "Included with membership"
    : formatMoney(data.serviceAmount);
  const totalPaid = (data.serviceAmount ?? 0) + data.tipAmount;
  const paymentRows: Array<[string, string, boolean]> = [
    ["Service", serviceAmount, false],
    ["Tip", data.tipAmount > 0 ? formatMoney(data.tipAmount) : "No tip added", false],
    ["Total paid", data.membership && data.tipAmount === 0 ? "Included with membership" : formatMoney(totalPaid), true],
  ];
  paymentRows.forEach(([label, value, strong], index) => {
    const y = 292 - index * 34;
    if (index > 0) page.drawLine({ start: { x: 62, y: y + 19 }, end: { x: pageWidth - 62, y: y + 19 }, thickness: 0.6, color: colours.border });
    page.drawText(label, { x: 62, y, size: strong ? 11 : 10, font: strong ? bold : regular, color: colours.ink });
    page.drawText(value, { x: pageWidth - 62 - (strong ? bold : regular).widthOfTextAtSize(value, strong ? 13 : 10), y: strong ? y - 1 : y, size: strong ? 13 : 10, font: strong ? bold : regular, color: strong ? colours.purple : colours.ink });
  });

  page.drawRectangle({ x: 48, y: 131, width: contentWidth, height: 49, color: colours.purpleSoft });
  page.drawText("PAYMENT STATUS", { x: 62, y: 158, size: 8, font: bold, color: colours.purple });
  page.drawText(pdfSafeText(data.status), { x: 62, y: 141, size: 10.5, font: bold, color: colours.ink });

  page.drawLine({ start: { x: 48, y: 99 }, end: { x: pageWidth - 48, y: 99 }, thickness: 0.7, color: colours.border });
  page.drawText("Thank you for choosing Opulence Bliss.", { x: 48, y: 77, size: 8.5, font: regular, color: colours.muted });
  page.drawText("CUSTOMER COPY", { x: pageWidth - 48 - bold.widthOfTextAtSize("CUSTOMER COPY", 8.5), y: 77, size: 8.5, font: bold, color: colours.purple });

  return document.save();
}
