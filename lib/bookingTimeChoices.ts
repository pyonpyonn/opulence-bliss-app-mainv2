import {
  appointmentFitsWindow,
  appointmentWithinBookingHorizon,
} from "./appointmentWindow";

export const MAX_OPTIONAL_BOOKING_TIMES = 5;

export function normaliseOptionalBookingTimes(
  input: unknown,
  preferredTime: string,
  durationMinutes: number,
  now: Date | string | number | null = Date.now(),
) {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) throw new Error("Optional times must be a list.");
  if (input.length > MAX_OPTIONAL_BOOKING_TIMES) {
    throw new Error(`Choose up to ${MAX_OPTIONAL_BOOKING_TIMES} optional times.`);
  }

  const preferred = new Date(preferredTime).getTime();
  const seen = new Set<number>();
  const result: string[] = [];

  for (const value of input) {
    if (typeof value !== "string") throw new Error("Choose valid optional times.");
    const timestamp = new Date(value).getTime();
    if (
      Number.isNaN(timestamp) ||
      timestamp === preferred ||
      seen.has(timestamp) ||
      !appointmentFitsWindow(value, durationMinutes) ||
      (now !== null && !appointmentWithinBookingHorizon(value, now))
    ) {
      throw new Error("Choose valid, distinct optional times.");
    }
    seen.add(timestamp);
    result.push(new Date(timestamp).toISOString());
  }

  return result.sort(
    (left, right) => new Date(left).getTime() - new Date(right).getTime(),
  );
}
