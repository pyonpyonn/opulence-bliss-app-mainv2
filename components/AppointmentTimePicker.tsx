"use client";

import { useMemo, useState } from "react";
import { londonDateKey } from "@/lib/appointmentWindow";

const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", {
  timeZone: "Europe/London", hour: "numeric", minute: "2-digit", hour12: true,
});

export default function AppointmentTimePicker({
  slots, value, onChange, durationMinutes = 120, showDate = true,
}: {
  slots: string[];
  value: string | null;
  onChange: (iso: string) => void;
  durationMinutes?: number | null;
  showDate?: boolean;
}) {
  const dates = useMemo(() => [...new Set(slots.map(londonDateKey))].sort(), [slots]);
  const [draftDate, setDraftDate] = useState("");
  const date = value ? londonDateKey(value) : draftDate || (showDate ? "" : dates[0] ?? "");
  const times = slots.filter((iso) => londonDateKey(iso) === date);
  const end = value ? new Date(new Date(value).getTime() + (durationMinutes ?? 120) * 60000).toISOString() : null;

  return (
    <section style={{ border: "1px solid #dfd1f4", borderRadius: 18, padding: 20, background: "#fff", color: "#241b2f" }} aria-label="Appointment date and time">
      {showDate && <label style={{ display: "grid", gap: 8, fontWeight: 800 }}>
        Booking date
        <input type="date" aria-label="Booking date" required min={dates[0]} max={dates[dates.length - 1]} value={date}
          onChange={(event) => { setDraftDate(event.target.value); onChange(""); }}
          style={{ padding: 12, border: "1px solid #ccb9ee", borderRadius: 10, font: "inherit", color: "#241b2f", background: "#fff" }} />
      </label>}
      <p style={{ fontSize: 13, color: "#736a7d" }}>Start between 7:00 AM and 8:00 PM, London time. Morning, afternoon and evening options are welcome—choose what suits you. Cleaner matching follows booking.</p>
      {!date ? <p>Select a date using the calendar to see times.</p> : times.length === 0 ? <p role="status">No times on this date. Please choose another date.</p> : (
        <div role="group" aria-label="Start time" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {times.map((iso) => <button type="button" key={iso} aria-pressed={value === iso} onClick={() => onChange(iso)}
            style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ccb9ee", cursor: "pointer", background: value === iso ? "#6d28d9" : "#faf7ff", color: value === iso ? "#fff" : "#47256a", font: "inherit" }}>
            {clock(iso)}
          </button>)}
        </div>
      )}
      {value && end && <p role="status"><strong>{clock(value)} – {clock(end)}{londonDateKey(value) !== londonDateKey(end) ? " (next day)" : ""}</strong></p>}
    </section>
  );
}
