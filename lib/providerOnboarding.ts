export const PROVIDER_RESIDENT_STATUSES = [
  "British or Irish citizen",
  "Asylum Seeker",
  "Dependent / spouse Visa",
  "Limited leave to remain",
  "Refugee",
  "Indefinite leave to remain / settled status",
  "Sponsored Visa",
  "Student Visa",
] as const;

export const PROVIDER_ESTIMATED_HOURLY_EARNINGS = 15;
export const PROVIDER_MAX_WEEKLY_HOURS = 40;
const AVERAGE_WEEKS_PER_MONTH = 4.3;

export function estimateProviderMonthlyEarnings(weeklyHours: number) {
  return Math.round(
    weeklyHours * PROVIDER_ESTIMATED_HOURLY_EARNINGS * AVERAGE_WEEKS_PER_MONTH,
  );
}

export function isProviderWeeklyHours(value: unknown): value is number {
  return (
    Number.isInteger(value) &&
    Number(value) >= 0 &&
    Number(value) <= PROVIDER_MAX_WEEKLY_HOURS
  );
}

export function isProviderResidentStatus(value: unknown) {
  return PROVIDER_RESIDENT_STATUSES.includes(
    String(value) as (typeof PROVIDER_RESIDENT_STATUSES)[number],
  );
}

export function isOptionalUtrNumber(value: unknown) {
  return value == null || value === "" || /^\d{10}$/.test(String(value));
}

export function canFinalizeProviderPartnership(selfEmployed: unknown) {
  return selfEmployed === true;
}
