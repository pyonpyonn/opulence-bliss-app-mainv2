"use client";
import { useEffect, useState } from "react";

export default function SessionCountdown({ bookingId, status, startedAt, durationMinutes }: {
  bookingId: string; status: string; startedAt: string | null; durationMinutes: number | null;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (status !== "in_progress" || !startedAt) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [status, startedAt, bookingId]);
  if (status !== "in_progress" || !startedAt || !durationMinutes || now === null) return null;
  const end = new Date(startedAt).getTime() + durationMinutes * 60000;
  const seconds = Math.max(0, Math.ceil((end - now) / 1000));
  const remaining = `${Math.floor(seconds / 3600).toString().padStart(2, "0")}:${Math.floor(seconds % 3600 / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  return <section style={{ padding: 18, margin: "16px 0", borderRadius: 14, background: seconds <= 1800 ? "#fff3d6" : "#f3edff", color: "#382251" }}>
    <strong>Session time remaining</strong>
    <div role="timer" aria-live="off" style={{ fontSize: 30, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{remaining}</div>
    <p role="status" style={{ margin: "4px 0" }}>{seconds === 0 ? "Your booked time has ended. Your cleaner will confirm completion." : seconds <= 1800 ? "30 minutes or less remain in this session." : "Time is measured from your cleaner’s check-in."}</p>
  </section>;
}
