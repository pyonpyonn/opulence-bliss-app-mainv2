"use client";

import { useActionState } from "react";
import { savePayoutSchedule, type PayoutScheduleState } from "./actions";

const initial: PayoutScheduleState = { ok: false, message: "" };

export default function PayoutScheduleForm({ current }: { current: string }) {
  const [state, action, pending] = useActionState(savePayoutSchedule, initial);
  return (
    <form action={action} className="schedule-card">
      <div>
        <h2>Payment schedule</h2>
        <p>Choose when available earnings move from Stripe to your bank.</p>
      </div>
      <div className="controls">
        <select name="schedule" defaultValue={current} aria-label="Payment schedule">
          <option value="weekly">Weekly · Mondays</option>
          <option value="fortnightly">Every 2 weeks</option>
          <option value="monthly">Monthly · 1st</option>
        </select>
        <button disabled={pending}>{pending ? "Saving…" : "Save schedule"}</button>
      </div>
      {state.message && <p className={state.ok ? "result ok" : "result error"}>{state.message}</p>}
      <style jsx>{`
        .schedule-card { display:grid; gap:14px; margin:0 0 30px; padding:20px 22px; border:1px solid var(--ob-border); border-radius:16px; background:var(--ob-surface); }
        h2 { margin:0 0 3px; color:var(--ob-text); font-size:20px; font-weight:900; }
        p { margin:0; color:var(--ob-muted); font-size:13.5px; }
        .controls { display:flex; gap:10px; flex-wrap:wrap; }
        select { min-width:220px; border:1px solid var(--ob-border); border-radius:10px; background:var(--ob-surface-soft); color:var(--ob-text); padding:10px 12px; font:inherit; }
        button { border:0; border-radius:999px; background:var(--ob-purple); color:white; padding:10px 18px; font:inherit; font-weight:900; cursor:pointer; }
        button:disabled { opacity:.65; cursor:wait; }
        .result { grid-column:1/-1; border-radius:9px; padding:9px 11px; font-weight:800; }
        .ok { background:var(--ob-mint); color:var(--ob-success-text); }
        .error { background:var(--ob-blush); color:var(--ob-danger-text); }
      `}</style>
    </form>
  );
}
