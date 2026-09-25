import {
  appointmentFitsWindow,
  appointmentWithinBookingHorizon,
  londonDate,
  londonParts,
} from "./appointmentWindow";

export const REGULAR_VISIT_COUNT = 6;
export type RegularFrequency = "weekly" | "monthly";

/** Keep the chosen London wall-clock time across BST/GMT changes. */
export function regularVisitSlots(
  firstSlot: string,
  frequency: RegularFrequency,
  durationMinutes: number,
  now: Date | string | number = Date.now(),
): string[] {
  if (frequency !== "weekly" && frequency !== "monthly") {
    throw new Error("Choose weekly or monthly for a six-visit booking.");
  }
  const first = new Date(firstSlot);
  if (!appointmentFitsWindow(first, durationMinutes)) {
    throw new Error("Choose a valid first appointment time.");
  }
  const anchor = londonParts(first);
  const slots: string[] = [];
  for (let index = 0; index < REGULAR_VISIT_COUNT; index += 1) {
    let date: Date;
    if (frequency === "weekly") {
      const day = new Date(Date.UTC(anchor.year, anchor.month - 1, anchor.day + 7 * index));
      date = londonDate(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), anchor.hour, anchor.minute);
    } else {
      const month = new Date(Date.UTC(anchor.year, anchor.month - 1 + index, 1));
      const year = month.getUTCFullYear();
      const monthNumber = month.getUTCMonth() + 1;
      const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
      date = londonDate(year, monthNumber, Math.min(anchor.day, lastDay), anchor.hour, anchor.minute);
    }
    if (!appointmentFitsWindow(date, durationMinutes) || !appointmentWithinBookingHorizon(date, now)) {
      throw new Error("All six visits must fall within one year and finish by 8:00 pm. Choose an earlier first date or time.");
    }
    slots.push(date.toISOString());
  }
  if (slots[0] !== first.toISOString()) {
    throw new Error("Choose a valid London appointment time.");
  }
  return slots;
}

/** Spread a single captured charge across six visit ledgers without losing pennies. */
export function allocateRegularPayment(grossPence: number, platformPence: number) {
  if (!Number.isInteger(grossPence) || !Number.isInteger(platformPence) ||
      grossPence <= 0 || platformPence < 0 || platformPence >= grossPence) {
    throw new Error("Invalid six-visit payment allocation.");
  }
  const split = (total: number) => Array.from(
    { length: REGULAR_VISIT_COUNT },
    (_, index) => Math.floor(total / REGULAR_VISIT_COUNT) + (index < total % REGULAR_VISIT_COUNT ? 1 : 0),
  );
  const gross = split(grossPence);
  const platform = split(platformPence);
  if (gross.some((amount, index) => amount <= 0 || platform[index] >= amount)) {
    throw new Error("Invalid six-visit payment allocation.");
  }
  return gross.map((amount, index) => ({
    grossPence: amount,
    platformPence: platform[index],
    providerPence: amount - platform[index],
  }));
}
