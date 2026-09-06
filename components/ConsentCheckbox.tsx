"use client";
import { TERMS_URL, PRIVACY_URL, legalLinksReady } from "@/lib/legal";

export default function ConsentCheckbox({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  if (!legalLinksReady) return <p role="status">Registration is temporarily unavailable while our Terms &amp; Conditions and Privacy Policy are being published.</p>;
  return <label style={{ display: "flex", alignItems: "flex-start", gap: 10, margin: "16px 0", fontSize: 14, lineHeight: 1.5 }}>
    <input type="checkbox" required checked={checked} onChange={(event) => onChange(event.target.checked)} style={{ width: 18, minWidth: 18, height: 18, marginTop: 3 }} />
    <span>I accept the <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>Terms &amp; Conditions</a> and <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>Privacy Policy</a>.</span>
  </label>;
}
