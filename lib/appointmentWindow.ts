export const APPOINTMENT_TIME_ZONE = "Europe/London";
export const APPOINTMENT_START_HOUR = 7;
export const APPOINTMENT_END_HOUR = 19;
export const DEFAULT_APPOINTMENT_DURATION_MINUTES = 120;

type LondonParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

const partsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: APPOINTMENT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  weekday: "short",
});

const weekdays: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function londonParts(value: Date | string | number): LondonParts {
  const date = value instanceof Date ? value : new Date(value);
  const parts = Object.fromEntries(
    partsFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: weekdays[parts.weekday] ?? 0,
  };
}

/** Build a real instant from a London wall-clock date, including BST/GMT. */
export function londonDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
) {
  const wanted = Date.UTC(year, month - 1, day, hour, minute);
  let instant = wanted;

  // Two passes resolve the timezone offset on either side of a DST boundary.
  for (let pass = 0; pass < 2; pass += 1) {
    const actual = londonParts(instant);
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
    );
    instant += wanted - actualAsUtc;
  }

  return new Date(instant);
}

export function londonDateKey(value: Date | string | number) {
  const part = londonParts(value);
  return `${part.year}-${String(part.month).padStart(2, "0")}-${String(
    part.day,
  ).padStart(2, "0")}`;
}

export function appointmentFitsWindow(
  value: Date | string | number,
  durationMinutes = DEFAULT_APPOINTMENT_DURATION_MINUTES,
) {
  const date = value instanceof Date ? value : new Date(value);
  if (
    Number.isNaN(date.getTime()) ||
    !Number.isFinite(durationMinutes) ||
    durationMinutes <= 0
  ) {
    return false;
  }

  const start = londonParts(date);
  const end = londonParts(date.getTime() + durationMinutes * 60_000);
  const startMinute = start.hour * 60 + start.minute;
  const endMinute = end.hour * 60 + end.minute;
  const finishesSameDay =
    start.year === end.year &&
    start.month === end.month &&
    start.day === end.day;

  return (
    startMinute >= APPOINTMENT_START_HOUR * 60 &&
    finishesSameDay &&
    endMinute <= APPOINTMENT_END_HOUR * 60 &&
    start.minute % 30 === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  );
}

export const APPOINTMENT_WINDOW_MESSAGE =
  "Appointments must start at or after 7:00 am and finish by 7:00 pm (London time), with start times on the hour or half hour.";

export function appointmentTimeLabel(value: Date | string | number) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleTimeString("en-GB", {
    timeZone: APPOINTMENT_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
