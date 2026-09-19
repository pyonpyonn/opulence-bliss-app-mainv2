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

export const PROVIDER_CLEANING_EXPERIENCE_TYPES = [
  "Domestic cleaning",
  "Commercial cleaning",
  "Industrial cleaning",
  "Office cleaning",
  "End of tenancy / move-in cleaning",
  "Other",
] as const;

export const PROVIDER_TRAVEL_DISTANCES = [
  "Up to 2 miles",
  "Up to 5 miles",
  "Up to 10 miles",
  "Up to 15 miles",
  "20+ miles",
  "Depends on the job/location",
] as const;

export const PROVIDER_AVAILABILITY_PERIODS = [
  "unavailable",
  "all_day",
  "morning",
  "afternoon",
  "evening",
] as const;

export type ProviderAvailabilityPeriod =
  (typeof PROVIDER_AVAILABILITY_PERIODS)[number];

export const PROVIDER_WEEKDAYS = [
  { key: "monday", label: "Monday", weekday: 1 },
  { key: "tuesday", label: "Tuesday", weekday: 2 },
  { key: "wednesday", label: "Wednesday", weekday: 3 },
  { key: "thursday", label: "Thursday", weekday: 4 },
  { key: "friday", label: "Friday", weekday: 5 },
  { key: "saturday", label: "Saturday", weekday: 6 },
  { key: "sunday", label: "Sunday", weekday: 0 },
] as const;

export type ProviderWeeklyAvailability = Record<
  (typeof PROVIDER_WEEKDAYS)[number]["key"],
  ProviderAvailabilityPeriod
>;

const PERIOD_TIMES: Record<
  Exclude<ProviderAvailabilityPeriod, "unavailable">,
  { start_time: string; end_time: string }
> = {
  all_day: { start_time: "07:00", end_time: "20:00" },
  morning: { start_time: "07:00", end_time: "12:00" },
  afternoon: { start_time: "12:00", end_time: "17:00" },
  evening: { start_time: "17:00", end_time: "20:00" },
};

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

export function isProviderCleaningExperienceYears(value: unknown) {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 60;
}

export function isProviderCleaningExperienceTypes(value: unknown) {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) =>
      PROVIDER_CLEANING_EXPERIENCE_TYPES.includes(
        String(item) as (typeof PROVIDER_CLEANING_EXPERIENCE_TYPES)[number],
      ),
    )
  );
}

export function isProviderTravelDistance(value: unknown) {
  return PROVIDER_TRAVEL_DISTANCES.includes(
    String(value) as (typeof PROVIDER_TRAVEL_DISTANCES)[number],
  );
}

export function isProviderWeeklyAvailability(
  value: unknown,
): value is ProviderWeeklyAvailability {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const availability = value as Record<string, unknown>;
  return (
    PROVIDER_WEEKDAYS.every(({ key }) =>
      PROVIDER_AVAILABILITY_PERIODS.includes(
        String(availability[key]) as ProviderAvailabilityPeriod,
      ),
    ) &&
    PROVIDER_WEEKDAYS.some(({ key }) => availability[key] !== "unavailable")
  );
}

export function providerAvailabilityRows(
  availability: ProviderWeeklyAvailability,
) {
  return PROVIDER_WEEKDAYS.flatMap(({ key, weekday }) => {
    const period = availability[key];
    if (period === "unavailable") return [];
    return [{ weekday, ...PERIOD_TIMES[period] }];
  });
}
