export const CLEANING_DURATIONS = Array.from({ length: 13 }, (_, i) => 120 + i * 30);

export function isCleaning(serviceType: string | null | undefined) {
  return (serviceType ?? "").toLowerCase().includes("clean");
}

export function validCleaningDuration(minutes: number) {
  return Number.isInteger(minutes) && minutes >= 120 && minutes <= 480 && minutes % 30 === 0;
}

export function validPropertySize(size: number) {
  return Number.isFinite(size) && size > 0 && size <= 100000;
}

/** Planning estimate: 35 square metres per cleaner-hour, rounded up to 30 minutes. */
export function recommendedCleaningMinutes(squareMetres: number) {
  if (!validPropertySize(squareMetres)) return 120;
  return Math.max(120, Math.min(480, Math.ceil(squareMetres / 35 * 2) * 30));
}

export function durationLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  return minutes % 60 ? `${hours}h 30m` : `${hours}h`;
}

/** Round exactly once, in pence; checkout and promotional previews share this rule. */
export function bookingPricePence(pkg: {
  price: number | string;
  duration_minutes: number | null;
  service_type?: string | null;
}, minutes: number) {
  const baseMinutes = pkg.duration_minutes ?? 120;
  const price = Number(pkg.price);
  if (!Number.isFinite(price) || price <= 0 || baseMinutes <= 0) {
    throw new Error("This package needs a valid price and duration.");
  }
  if (isCleaning(pkg.service_type) && !validCleaningDuration(minutes)) {
    throw new Error("Choose a cleaning duration from 2 to 8 hours in 30-minute steps.");
  }
  return Math.round(price * 100 * (isCleaning(pkg.service_type) ? minutes / baseMinutes : 1));
}
