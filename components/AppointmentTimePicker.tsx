"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { londonDateKey } from "@/lib/appointmentWindow";
import styles from "./AppointmentTimePicker.module.css";
import { MAX_OPTIONAL_BOOKING_TIMES } from "@/lib/bookingTimeChoices";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: "Europe/London",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function dateFromKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function monthFromKey(key: string) {
  return key.slice(0, 7);
}

function monthLabel(key: string) {
  return dateFromKey(`${key}-01`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function dateLabel(key: string) {
  return dateFromKey(key).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function moveMonth(key: string, delta: number) {
  const [year, month] = key.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

function timeRange(iso: string, durationMinutes: number) {
  const finish = new Date(new Date(iso).getTime() + durationMinutes * 60_000);
  return `${clock(iso)} – ${clock(finish.toISOString())}`;
}

export default function AppointmentTimePicker({
  slots,
  value,
  onChange,
  durationMinutes = 120,
  showDate = true,
  optionalValues,
  onOptionalValuesChange,
}: {
  slots: string[];
  value: string | null;
  onChange: (iso: string) => void;
  durationMinutes?: number | null;
  showDate?: boolean;
  optionalValues?: string[];
  onOptionalValuesChange?: (values: string[]) => void;
}) {
  const minutes = durationMinutes ?? 120;
  const supportsOptionalTimes = Boolean(onOptionalValuesChange);
  const alternatives = optionalValues ?? [];
  const [choiceMode, setChoiceMode] = useState<"preferred" | "optional">(
    "preferred",
  );
  const dates = useMemo(
    () => [...new Set(slots.map(londonDateKey))].sort(),
    [slots],
  );
  const availableDates = useMemo(() => new Set(dates), [dates]);
  const [draftDate, setDraftDate] = useState("");
  const initialDate = value ? londonDateKey(value) : dates[0] ?? "";
  const selectedDate =
    (draftDate && availableDates.has(draftDate) && draftDate) || initialDate;
  const [visibleMonth, setVisibleMonth] = useState(() =>
    initialDate ? monthFromKey(initialDate) : "",
  );

  const times = useMemo(
    () => slots.filter((iso) => londonDateKey(iso) === selectedDate),
    [selectedDate, slots],
  );
  const firstMonth = dates[0] ? monthFromKey(dates[0]) : "";
  const lastDate = dates.at(-1);
  const lastMonth = lastDate ? monthFromKey(lastDate) : "";

  const days = useMemo(() => {
    if (!visibleMonth) return [];
    const [year, month] = visibleMonth.split("-").map(Number);
    const first = new Date(Date.UTC(year, month - 1, 1));
    const leading = (first.getUTCDay() + 6) % 7;
    const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return [
      ...Array.from({ length: leading }, () => null),
      ...Array.from({ length: count }, (_, index) => {
        const day = index + 1;
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }),
    ];
  }, [visibleMonth]);

  if (!showDate) {
    return (
      <section className={`${styles.picker} ${styles.timeOnly}`} aria-label="Appointment time">
        <div className={styles.compactHeading}>
          <Clock3 size={19} aria-hidden="true" />
          <div><strong>Preferred start time</strong><span>London time</span></div>
        </div>
        <div className={styles.timeOnlyGrid} role="group" aria-label="Start time">
          {slots.map((iso) => (
            <button type="button" key={iso} aria-pressed={value === iso}
              className={`${styles.timeButton} ${value === iso ? styles.timeSelected : ""}`}
              onClick={() => onChange(iso)}>
              {clock(iso)}
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (!dates.length || !visibleMonth) {
    return (
      <section className={styles.picker} aria-label="Appointment date and time">
        <p className={styles.empty} role="status">No appointment dates are available.</p>
      </section>
    );
  }

  return (
    <section className={styles.picker} aria-label="Appointment date and time">
      <header className={styles.header}>
        <span className={styles.headerIcon}><CalendarDays aria-hidden="true" /></span>
        <div>
          <span className={styles.eyebrow}>Select date and time</span>
          <strong>{dateLabel(selectedDate)}</strong>
          <p>{value ? timeRange(value, minutes) : "Choose a start time"}<span aria-hidden="true"> · </span>London time</p>
        </div>
        <span className={styles.horizon}>Book up to 1 year ahead</span>
      </header>

      {supportsOptionalTimes && (
        <div className={styles.choiceTabs} aria-label="Time choice type">
          <button
            type="button"
            className={choiceMode === "preferred" ? styles.choiceTabActive : ""}
            aria-pressed={choiceMode === "preferred"}
            onClick={() => setChoiceMode("preferred")}
          >
            <b>1 Preferred Time</b>
            <span>Your first choice</span>
          </button>
          <button
            type="button"
            className={choiceMode === "optional" ? styles.choiceTabActive : ""}
            aria-pressed={choiceMode === "optional"}
            disabled={!value}
            onClick={() => setChoiceMode("optional")}
          >
            <b>Optional Times</b>
            <span>{alternatives.length}/{MAX_OPTIONAL_BOOKING_TIMES} added</span>
          </button>
        </div>
      )}

      <div className={styles.body}>
        <div className={styles.calendarCard}>
          <div className={styles.monthBar}>
            <button type="button" aria-label="Previous month" disabled={visibleMonth <= firstMonth}
              onClick={() => setVisibleMonth((month) => moveMonth(month, -1))}>
              <ChevronLeft aria-hidden="true" />
            </button>
            <strong aria-live="polite">{monthLabel(visibleMonth)}</strong>
            <button type="button" aria-label="Next month" disabled={visibleMonth >= lastMonth}
              onClick={() => setVisibleMonth((month) => moveMonth(month, 1))}>
              <ChevronRight aria-hidden="true" />
            </button>
          </div>

          <div className={styles.weekdays} aria-hidden="true">
            {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
          </div>
          <div className={styles.days}>
            {days.map((key, index) => {
              if (!key) return <span className={styles.blank} key={`blank-${index}`} />;
              const available = availableDates.has(key);
              const selected = key === selectedDate;
              return (
                <button type="button" key={key} disabled={!available}
                  aria-label={`${dateLabel(key)}${available ? ", available" : ", unavailable"}`}
                  aria-pressed={selected}
                  className={`${styles.day} ${available ? styles.available : ""} ${selected ? styles.daySelected : ""}`}
                  onClick={() => {
                    setDraftDate(key);
                    if (
                      choiceMode === "preferred" &&
                      (!value || londonDateKey(value) !== key)
                    ) {
                      onChange("");
                    }
                  }}>
                  <span>{Number(key.slice(-2))}</span>
                  {available && <i aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          <p className={styles.legend}><i aria-hidden="true" /> Available appointment date</p>
        </div>

        <div className={styles.timesCard}>
          <div className={styles.timesHeading}>
            <Clock3 aria-hidden="true" />
            <div>
              <strong>
                {choiceMode === "preferred"
                  ? "Choose your preferred time"
                  : "Add optional times"}
              </strong>
              <span>
                {choiceMode === "preferred"
                  ? `${times.length} start times available`
                  : `Choose up to ${MAX_OPTIONAL_BOOKING_TIMES} other times`}
              </span>
            </div>
          </div>
          <div className={styles.times} role="group" aria-label={`Start time for ${dateLabel(selectedDate)}`}>
            {times.map((iso) => {
              const selected =
                choiceMode === "preferred"
                  ? value === iso
                  : alternatives.includes(iso);
              return (
              <button type="button" key={iso} aria-pressed={selected}
                disabled={choiceMode === "optional" && value === iso}
                className={`${styles.timeButton} ${selected ? styles.timeSelected : ""}`}
                onClick={() => {
                  if (choiceMode === "preferred") {
                    onChange(iso);
                    onOptionalValuesChange?.(
                      alternatives.filter((candidate) => candidate !== iso),
                    );
                    return;
                  }
                  if (alternatives.includes(iso)) {
                    onOptionalValuesChange?.(
                      alternatives.filter((candidate) => candidate !== iso),
                    );
                  } else if (alternatives.length < MAX_OPTIONAL_BOOKING_TIMES) {
                    onOptionalValuesChange?.([...alternatives, iso]);
                  }
                }}>
                <span>{clock(iso)}</span>
                <small>
                  {value === iso && choiceMode === "optional"
                    ? "Preferred time"
                    : `until ${clock(new Date(new Date(iso).getTime() + minutes * 60_000).toISOString())}`}
                </small>
              </button>
            )})}
          </div>
        </div>
      </div>

      {supportsOptionalTimes && value && (
        <div className={styles.choiceSummary}>
          <div>
            <b>Preferred · first choice</b>
            <span>{dateLabel(londonDateKey(value))} at {clock(value)}</span>
          </div>
          <div>
            <b>Optional availability</b>
            <span>
              {alternatives.length
                ? alternatives
                    .map(
                      (iso) =>
                        `${dateLabel(londonDateKey(iso))} at ${clock(iso)}`,
                    )
                    .join(" · ")
                : "None added — add other times to give cleaners more flexibility."}
            </span>
          </div>
        </div>
      )}

      <footer className={styles.note}>
        <span aria-hidden="true">✓</span>
        Book online 24/7. Appointments start from 7:00 am and your full visit finishes by 8:00 pm.
      </footer>
    </section>
  );
}
