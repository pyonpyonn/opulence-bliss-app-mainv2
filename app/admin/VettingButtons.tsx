"use client";

// Approve / reject a provider. Save at: app/admin/VettingButtons.tsx

import { useState, useTransition } from "react";
import { approveProvider, rejectProvider } from "./actions";

export default function VettingButtons({
  id,
  dbsVerified,
}: {
  id: string;
  dbsVerified: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const base: React.CSSProperties = {
    borderRadius: 999,
    padding: "9px 18px",
    fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
    fontSize: 13.5,
    fontWeight: 600,
    cursor: pending ? "wait" : "pointer",
    opacity: pending ? 0.6 : 1,
  };

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          disabled={pending || !dbsVerified}
          title={dbsVerified ? "Approve professional" : "Verify DBS before approval"}
          onClick={() => {
            setError(null);
            start(async () => {
              try {
                await approveProvider(id);
              } catch (reason) {
                setError(reason instanceof Error ? reason.message : "Approval failed.");
              }
            });
          }}
          style={{
            ...base,
            background: dbsVerified ? "#2f4a3a" : "#d9dde2",
            color: dbsVerified ? "#fbf7f0" : "#7a828c",
            border: "none",
            cursor: pending ? "wait" : dbsVerified ? "pointer" : "not-allowed",
            opacity: pending ? 0.6 : dbsVerified ? 1 : 0.85,
          }}
        >
          {pending ? "…" : "Approve"}
        </button>
        <button
          disabled={pending}
          onClick={() => {
            if (!window.confirm("Reject this provider?")) return;
            setError(null);
            start(async () => {
              try {
                await rejectProvider(id);
              } catch (reason) {
                setError(reason instanceof Error ? reason.message : "Rejection failed.");
              }
            });
          }}
          style={{
            ...base,
            background: "transparent",
            color: "#8a4b26",
            border: "1.5px solid #e6c4b0",
          }}
        >
          Reject
        </button>
      </div>
      {!dbsVerified ? (
        <small style={{ color: "#8a5a00", fontWeight: 800 }}>
          Verify DBS before approval.
        </small>
      ) : null}
      {error ? (
        <small style={{ color: "#a52e47", fontWeight: 800 }}>{error}</small>
      ) : null}
    </div>
  );
}
