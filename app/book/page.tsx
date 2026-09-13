"use client";

// SETUP: mkdir -p "app/book" && code "app/book/page.tsx"
//
// Booking: Where → Session → Time → Confirm. One question per screen.

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CLEANING_DURATIONS, isCleaning, bookingPricePence, cleaningHourlyRatePence, compareCleaningSessions } from "@/lib/cleaningBooking";
import ConsentCheckbox from "@/components/ConsentCheckbox";
import AppointmentTimePicker from "@/components/AppointmentTimePicker";

const supabase = createClient();

type Pkg = {
  id: string;
  name: string;
  description: string | null;
  inclusions: string[] | null;
  good_to_know: string[] | null;
  price: number;
  service_type: string | null;
  duration_minutes: number | null;
};

type Area = { name: string; postcode_prefixes: string[] };

const STEPS = ["Address", "Session", "Frequency", "Hours", "Time", "Confirm"];

type BookingFrequency = "one_time" | "weekly" | "monthly";

const FREQUENCIES: Array<{
  value: BookingFrequency;
  title: string;
  note: string;
}> = [
  { value: "one_time", title: "One time", note: "Just this visit" },
  { value: "weekly", title: "Every week", note: "A weekly cleaning preference" },
  { value: "monthly", title: "Every month", note: "A monthly cleaning preference" },
];

function frequencyLabel(value: BookingFrequency) {
  return FREQUENCIES.find((item) => item.value === value)?.title ?? "One time";
}

function outwardCode(pc: string) {
  const s = pc.toUpperCase().replace(/\s+/g, "");
  return s.length <= 4 ? s : s.slice(0, s.length - 3);
}

const money = (n: number) => "£" + Number(n).toFixed(2);
function dayLabel(iso: string) {
  const d = new Date(iso);
  const t = new Date();
  const tm = new Date();
  tm.setDate(t.getDate() + 1);
  if (d.toDateString() === t.toDateString()) return "Today";
  if (d.toDateString() === tm.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
const fullLabel = (iso: string) => `${dayLabel(iso)}, ${timeLabel(iso)}`;

function duration(mins: number | null) {
  if (!mins) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h} hr${h > 1 ? "s" : ""}`;
  return `${m} min`;
}

export default function BookPage() {
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [serviceType, setServiceType] = useState<string | null>("clean");

  const [step, setStep] = useState(0);
  const [postcode, setPostcode] = useState("");
  const [address, setAddress] = useState("");
  const [gate, setGate] = useState<null | { ok: boolean; area?: string }>(null);
  const [selected, setSelected] = useState<Pkg | null>(null);

  const [cleaningMinutes, setCleaningMinutes] = useState(120);
  const [frequency, setFrequency] = useState<BookingFrequency>("one_time");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [previousCleaners, setPreviousCleaners] = useState<{ provider_id: string; display_name: string }[]>([]);
  const [preferredCleaner, setPreferredCleaner] = useState("");
  const cleaning = isCleaning(selected?.service_type);
  const minutes = cleaning ? cleaningMinutes : selected?.duration_minutes ?? 120;
  const addressValid = address.trim().length >= 5;

  const [slots, setSlots] = useState<string[] | null>(null);
  const [slot, setSlot] = useState<string | null>(null);

  const [request, setRequest] = useState("");
  const [promo, setPromo] = useState("");
  const [promoInfo, setPromoInfo] = useState<{
    ok: boolean;
    msg: string;
    discount?: number;
    total?: number;
  } | null>(null);

  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [handoffError, setHandoffError] = useState<string | null>(null);

  const [mode, setMode] = useState<"new" | "existing">("new");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  /* ---------- load ---------- */
  useEffect(() => {
    (async () => {
      const [{ data: pkgs }, { data: ars }] = await Promise.all([
        supabase
          .from("packages")
          .select("*")
          .eq("active", true)
          .eq("billing_type", "per_visit")
          .ilike("service_type", "%clean%")
          .order("price"),
        supabase
          .from("service_areas")
          .select("name, postcode_prefixes")
          .eq("active", true),
      ]);

      const list = ((pkgs ?? []) as Pkg[]).sort(compareCleaningSessions);
      const areaList = (ars ?? []) as Area[];
      setPackages(list);
      setAreas(areaList);
      const essential =
        list.find((item) => item.name === "Essential Clean") ?? list[0] ?? null;
      setSelected(essential);
      if (essential) {
        setCleaningMinutes(Math.max(120, essential.duration_minutes ?? 120));
      }

      let savedPc: string | null = null;
      let savedAddress: string | null = null;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setSignedIn(!!user);
      if (user) {
        const { data: p } = await supabase
          .from("profiles")
          .select("role, postcode, address")
          .eq("id", user.id)
          .maybeSingle();
        setRole(p?.role ?? null);
        const { data: cleaners } = await supabase.rpc("my_previous_cleaners");
        setPreviousCleaners(cleaners ?? []);
        if (p?.postcode) {
          savedPc = p.postcode;
          setPostcode(p.postcode);
        }
        if (p?.address) {
          savedAddress = p.address;
          setAddress(p.address);
        }
      }

      const q = new URLSearchParams(window.location.search);
      const wantPc = q.get("pc");
      const wantType = q.get("type");
      const wantService = q.get("service");
      const wantSlot = q.get("slot");
      const reviewHandoff = q.get("review") === "1";

      if (wantType === "clean") setServiceType("clean");
      if (wantPc) setPostcode(wantPc);

      // Already know where they live? Verify it quietly — no need to ask again.
      const pcToCheck = wantPc ?? savedPc;
      let covered = false;
      if (pcToCheck) {
        const hit = areaList.find((a) =>
          a.postcode_prefixes.includes(outwardCode(pcToCheck))
        );
        covered = !!hit;
        setGate(hit ? { ok: true, area: hit.name } : { ok: false });
      }

      const match =
        (wantService ? list.find((p) => p.id === wantService) : undefined) ??
        essential;
      if (match) {
        setSelected(match);
        setCleaningMinutes(Math.max(120, match.duration_minutes ?? 120));
      }
      const hasAddress = (savedAddress ?? "").trim().length >= 5;

      // Assistant handoffs are checked against the current permitted booking
      // window before opening the payment summary. A saved full address is
      // required before an assistant can skip the first screen.
      if (reviewHandoff && match && wantSlot && pcToCheck && hasAddress) {
        try {
          const response = await fetch(
            `/api/slots?postcode=${encodeURIComponent(
              pcToCheck,
            )}&service=${encodeURIComponent(
              match.service_type ?? "",
            )}&duration=${encodeURIComponent(
              String(match.duration_minutes ?? 120),
            )}`,
            { cache: "no-store" },
          );
          const data = await response.json();
          const liveSlots = (data.slots ?? []) as string[];
          const wantedTime = new Date(wantSlot).getTime();
          const liveSlot = liveSlots.find(
            (candidate) => new Date(candidate).getTime() === wantedTime,
          );

          setSelected(match);
          setSlots(liveSlots);
          setGate(
            data.covered
              ? { ok: true, area: areaList.find((area) =>
                  area.postcode_prefixes.includes(outwardCode(pcToCheck)),
                )?.name }
              : { ok: false },
          );

          if (data.covered && liveSlot) {
            setSlot(liveSlot);
            setStep(5);
          } else {
            setStep(data.covered ? 4 : 0);
            setHandoffError(
              data.covered
                ? "That time was just taken. Choose another live time below."
                : "That postcode is not currently in our service area.",
            );
          }
        } catch {
          setStep(4);
          setHandoffError(
            "We could not recheck that time. Please choose a live time below.",
          );
          loadSlots(
            pcToCheck,
            match.service_type ?? "",
            match.duration_minutes,
          );
        }
      } else if (reviewHandoff) {
        setHandoffError(
          hasAddress
            ? "That booking link is incomplete. Please ask the assistant to prepare it again."
            : "Confirm your full service address before continuing.",
        );
        setStep(0);
      } else if (match && wantSlot && covered && hasAddress) {
        setSlot(wantSlot);
        setStep(5);
      } else {
        // Every normal booking starts by confirming the service address.
        setStep(0);
      }

      setLoading(false);
    })();
  }, []);

  /* ---------- actions ---------- */
  function checkPostcode() {
    const hit = areas.find((a) =>
      a.postcode_prefixes.includes(outwardCode(postcode))
    );
    if (hit) {
      setGate({ ok: true, area: hit.name });
    } else setGate({ ok: false });
  }

  async function loadSlots(
    pc: string,
    serviceType: string,
    durationMinutes: number | null = minutes,
  ) {
    setSlots(null);
    setSlot(null);
    try {
      const res = await fetch(
        `/api/slots?postcode=${encodeURIComponent(pc)}&service=${encodeURIComponent(
          serviceType
        )}&duration=${encodeURIComponent(String(durationMinutes ?? 120))}`
      );
      const data = await res.json();
      const list: string[] = data.slots ?? [];
      setSlots(list);
    } catch {
      setSlots([]);
    }
  }

  function pick(p: Pkg) {
    setSelected(p);
    setPromoInfo(null);
    setPreferredCleaner("");
    setCleaningMinutes(Math.max(120, p.duration_minutes ?? 120));
    setSlot(null);
  }

  function goToFrequency() {
    if (!selected) return;
    setStep(2);
  }

  function goToTimes() {
    if (!selected) return;
    setStep(4);
    loadSlots(
      postcode,
      selected.service_type ?? "",
      minutes,
    );
  }

  async function checkPromo() {
    if (!selected) return;
    setPromoInfo(null);
    try {
      const res = await fetch("/api/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promo, packageId: selected.id, durationMinutes: minutes }),
      });
      const d = await res.json();
      setPromoInfo(
        d.valid
          ? { ok: true, msg: `${d.code} applied`, discount: d.discount, total: d.total }
          : { ok: false, msg: d.error ?? "That code isn't valid." }
      );
    } catch {
      setPromoInfo({ ok: false, msg: "Couldn't check that code." });
    }
  }

  async function accountThenPay() {
    setPaying(true);
    setPayError(null);
    try {
      if (mode === "new") {
        if (!consentAccepted) throw new Error("Accept the Terms & Conditions and Privacy Policy to sign up.");
        const res = await fetch("/api/client-signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fullName, email, password, phone, address, postcode, consentAccepted }),
        });
        const data = await res.json();
        if (!data.ok) {
          if (data.exists) setMode("existing");
          throw new Error(data.error || "Could not create your account");
        }
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw new Error(error.message);
      setSignedIn(true);
      if (mode === "existing" && cleaning) {
        const { data: cleaners } = await supabase.rpc("my_previous_cleaners");
        setPreviousCleaners(cleaners ?? []);
        if (cleaners?.length) {
          setPaying(false);
          setStep(1);
          setHandoffError("You’re signed in. You can now request a cleaner from a previous visit.");
          return;
        }
      }
      await startCheckout();
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "Something went wrong");
      setPaying(false);
    }
  }

  function checkout() {
    if (signedIn === false) return accountThenPay();
    return startCheckout();
  }

  async function startCheckout() {
    if (!selected || !addressValid || !slot) return;
    setPaying(true);
    setPayError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId: selected.id,
          durationMinutes: minutes,
          address,
          frequency,
          preferredProviderId: cleaning ? preferredCleaner || null : null,
          postcode,
          request,
          slot,
          promoCode: promoInfo?.ok ? promo.trim().toUpperCase() : null,
        }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else throw new Error(data.error || "Could not start checkout");
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "Checkout failed");
      setPaying(false);
    }
  }

  /* ---------- provider guard ---------- */
  if (role === "provider") {
    return (
      <main className="guard">
        <div className="gcard">
          <div style={{ fontSize: 38 }}>🧹</div>
          <h1>This is the customer booking page</h1>
          <p>Your jobs and hours are in the provider portal.</p>
          <a className="btn" href="/worker/current">
            Go to my current job
          </a>
        </div>
        <style jsx>{`
          .guard {
            min-height: 70vh;
            display: grid;
            place-items: center;
            padding: 24px;
            font-family: "Nunito", system-ui, sans-serif;
          }
          .gcard {
            background: #fff;
            border: 2px solid #edeff1;
            border-radius: 24px;
            padding: 34px 30px;
            max-width: 420px;
            text-align: center;
          }
          h1 {
            font-size: 23px;
            font-weight: 900;
            color: #16202a;
            margin: 10px 0 6px;
          }
          p {
            color: #7a828c;
            font-weight: 600;
            margin: 0 0 22px;
          }
          .btn {
            display: inline-block;
            background: linear-gradient(100deg, #f5c542, #c86fc9 55%, #7b2ff7);
            color: #fff;
            padding: 13px 26px;
            border-radius: 999px;
            text-decoration: none;
            font-weight: 900;
          }
        `}</style>
      </main>
    );
  }

  const shown = (serviceType
    ? packages.filter((p) => (p.service_type ?? "").includes(serviceType))
    : packages
  ).sort(serviceType === "clean" ? compareCleaningSessions : () => 0);

  const total = selected
    ? promoInfo?.ok && promoInfo.total !== undefined
      ? promoInfo.total
      : bookingPricePence(selected, minutes) / 100
    : 0;

  return (
    <div className="wrap">
      <div className="grid">
        {/* ================= MAIN ================= */}
        <main>
          {handoffError && <p className="handoffError">{handoffError}</p>}
          {/* progress */}
          <p className="stepline">
            Step {step + 1} of 4 · <strong>{STEPS[step]}</strong>
          </p>
          <div className="prog">
            <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>

          {/* ---- 0 ADDRESS ---- */}
          {step === 0 && (
            <section>
              <p className="eyebrow">Home cleaning</p>
              <h1>Where should we clean?</h1>
              <p className="lede">Start with the address for this visit.</p>

              <p className="label">Full service address</p>
              <input
                className="field bigAddress"
                placeholder="e.g. 21 Baker Street, London"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                autoComplete="street-address"
                aria-label="Full service address"
              />

              <p className="label">Postcode</p>
              <div className="inline">
                <input
                  className="field big"
                  placeholder="e.g. SW3 1AA"
                  value={postcode}
                  onChange={(e) => {
                    setPostcode(e.target.value);
                    setGate(null);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && checkPostcode()}
                  aria-label="Postcode"
                />
                <button className="go" onClick={checkPostcode}>
                  Check area
                </button>
              </div>

              {gate?.ok && (
                <div className="covered">
                  <strong>✓ We cover this address</strong>
                  <span>{gate.area}</span>
                </div>
              )}
              {gate && !gate.ok && (
                <div className="alert">
                  <strong>We&apos;re not in your area just yet.</strong>
                  <span>
                    Right now we cover {areas.map((a) => a.name).join(", ")}.
                  </span>
                </div>
              )}

              <button
                className="next"
                onClick={() => setStep(1)}
                disabled={!addressValid || !gate?.ok}
              >
                {!addressValid
                  ? "Add your full address"
                  : !gate?.ok
                    ? "Check your postcode"
                    : "Continue to sessions"}
              </button>

              <ul className="trust">
                <li>
                  <em>✓</em> Vetted &amp; insured professionals
                </li>
                <li>
                  <em>✓</em> Card held, not charged until the visit is done
                </li>
                <li>
                  <em>✓</em> Full refund when cancelled 48+ hours before
                </li>
              </ul>
            </section>
          )}

          {/* ---- 1 SESSION ---- */}
          {step === 1 && (
            <section>
              <h1>Choose your session</h1>
              <p className="lede">
                Essential Clean is selected to get you started. Pick another
                session to see its details.
              </p>

              {loading ? (
                <p className="muted">Loading…</p>
              ) : (
                <div className="list">
                  {shown.map((p) => (
                    <button
                      key={p.id}
                      className={selected?.id === p.id ? "opt on" : "opt"}
                      onClick={() => pick(p)}
                    >
                      <span className="optbody">
                        {p.name === "Essential Clean" && (
                          <span className="popular">Popular</span>
                        )}
                        <span className="optTop">
                          <strong>{p.name}</strong>
                          <b>
                            {money(cleaningHourlyRatePence(p) / 100)} / hr
                          </b>
                        </span>
                        <span className="optMeta">
                          2–10 hours · 30-minute steps · Cleaning
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {selected && (
                <div className="sessionDetails">
                  <div>
                    <span>Selected session</span>
                    <strong>{selected.name}</strong>
                    <p>{selected.description ?? "Professional home cleaning tailored to this visit."}</p>
                  </div>
                  {(selected.inclusions?.length || selected.good_to_know?.length) && (
                    <ul>
                      {[...(selected.inclusions ?? []), ...(selected.good_to_know ?? [])]
                        .slice(0, 4)
                        .map((item) => <li key={item}>✓ {item}</li>)}
                    </ul>
                  )}
                </div>
              )}

              <button
                className="next"
                onClick={goToFrequency}
                disabled={!selected}
              >
                {selected ? `Continue with ${selected.name}` : "Choose a session"}
              </button>

              <button className="back" onClick={() => setStep(0)}>
                ← Change address
              </button>
            </section>
          )}

          {/* ---- 2 FREQUENCY ---- */}
          {step === 2 && selected && (
            <section>
              <h1>How often?</h1>
              <p className="lede">Choose how regularly you would like this cleaning.</p>

              <div className="frequencyGrid">
                {FREQUENCIES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={frequency === item.value ? "frequency on" : "frequency"}
                    onClick={() => setFrequency(item.value)}
                  >
                    <span className="choiceDot" />
                    <strong>{item.title}</strong>
                    <small>{item.note}</small>
                  </button>
                ))}
              </div>

              <p className="frequencyNote">
                Your payment today secures this session. The frequency is saved
                as your preference for future scheduling.
              </p>

              <button className="next" onClick={() => setStep(3)}>
                Continue · {frequencyLabel(frequency)}
              </button>
              <button className="back" onClick={() => setStep(1)}>
                ← Change session
              </button>
            </section>
          )}

          {/* ---- 3 HOURS ---- */}
          {step === 3 && selected && (
            <section>
              <h1>How many hours?</h1>
              <p className="lede">Choose from 2 to 10 hours in 30-minute steps.</p>

              <div className="hoursCard">
                <div className="hoursTop">
                  <div>
                    <span>Cleaning time</span>
                    <strong>{duration(cleaningMinutes)}</strong>
                  </div>
                  <div className="sessionPrice">
                    <span>Per session</span>
                    <strong>{money(bookingPricePence(selected, cleaningMinutes) / 100)}</strong>
                  </div>
                </div>
                <input
                  className="hoursRange"
                  type="range"
                  min={CLEANING_DURATIONS[0]}
                  max={CLEANING_DURATIONS[CLEANING_DURATIONS.length - 1]}
                  step={30}
                  value={cleaningMinutes}
                  onChange={(event) => {
                    setCleaningMinutes(Number(event.target.value));
                    setPromoInfo(null);
                    setSlot(null);
                  }}
                  aria-label="Cleaning duration"
                />
                <div className="rangeLabels"><span>2 hours</span><span>10 hours</span></div>
              </div>

              {previousCleaners.length > 0 && (
                <div className="previousCleaner">
                  <label className="label" htmlFor="preferred-cleaner">Request a previous cleaner (optional)</label>
                  <select id="preferred-cleaner" className="field" value={preferredCleaner} onChange={(e) => setPreferredCleaner(e.target.value)}>
                    <option value="">Match me with any available cleaner</option>
                    {previousCleaners.map((p) => <option key={p.provider_id} value={p.provider_id}>{p.display_name}</option>)}
                  </select>
                  <p className="muted">We’ll ask them first. Assignment still depends on their acceptance.</p>
                </div>
              )}

              <button className="next" onClick={goToTimes}>
                Continue · {duration(cleaningMinutes)}
              </button>
              <button className="back" onClick={() => setStep(2)}>
                ← Change frequency
              </button>
            </section>
          )}

          {/* ---- 4 TIME ---- */}
          {step === 4 && selected && (
            <section>
              <h1>When suits you?</h1>
              <p className="lede">
                Choose the time you want. We&apos;ll find your professional after
                you book.
              </p>

              {slots === null && <p className="muted">Finding times…</p>}

              {slots !== null && slots.length === 0 && (
                <div className="alert">
                  <strong>No appointment times are available.</strong>
                  <span>Try another session or contact support.</span>
                </div>
              )}

              {slots !== null && slots.length > 0 && (
                <AppointmentTimePicker
                  slots={slots}
                  value={slot}
                  onChange={setSlot}
                  durationMinutes={minutes}
                />
              )}

              {slots !== null && slots.length > 0 && (
                <button
                  className="next"
                  onClick={() => setStep(5)}
                  disabled={!slot}
                >
                  {slot ? `Continue · ${fullLabel(slot)}` : "Pick a time"}
                </button>
              )}

              <button className="back" onClick={() => setStep(3)}>
                ← Change hours
              </button>
            </section>
          )}

          {/* ---- 5 CONFIRM ---- */}
          {step === 5 && selected && (
            <section>
              <h1>Review and pay</h1>
              <p className="lede">
                Check your visit and payment before continuing to secure checkout.
              </p>

              <div className="reviewCard">
                <div>
                  <span>Service</span>
                  <strong>{selected.name}</strong>
                  <small>{duration(minutes) ?? "Visit"}</small>
                </div>
                <div>
                  <span>Date and time</span>
                  <strong>{slot ? fullLabel(slot) : "Choose a time"}</strong>
                  <small>{address}, {postcode.toUpperCase()}</small>
                </div>
                <div>
                  <span>Amount</span>
                  <strong>{money(total)}</strong>
                  <small>Held now, charged after completion</small>
                </div>
              </div>

              <p>{frequencyLabel(frequency)} · {duration(minutes)}{preferredCleaner ? ` · Requested cleaner: ${previousCleaners.find((p) => p.provider_id === preferredCleaner)?.display_name ?? "Previous cleaner"}` : ""}</p>
              <p className="label">Requests (optional)</p>
              <textarea
                className="field"
                rows={3}
                value={request}
                onChange={(e) => setRequest(e.target.value)}
                placeholder="e.g. key is under the mat, please avoid the study"
              />

              <p className="label">Promo code (optional)</p>
              <div className="inline">
                <input
                  className="field"
                  placeholder="WELCOME10"
                  value={promo}
                  onChange={(e) => {
                    setPromo(e.target.value);
                    setPromoInfo(null);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && checkPromo()}
                />
                <button className="ghost" onClick={checkPromo}>
                  Apply
                </button>
              </div>
              {promoInfo && (
                <p className={promoInfo.ok ? "flash ok" : "flash no"}>
                  {promoInfo.msg}
                  {promoInfo.ok && promoInfo.discount !== undefined
                    ? ` — ${money(promoInfo.discount)} off`
                    : ""}
                </p>
              )}

              {signedIn === false && (
                <div className="acct">
                  <p className="label" style={{ marginTop: 0 }}>
                    Your details
                  </p>
                  <div className="toggle">
                    <button
                      className={mode === "new" ? "tg on" : "tg"}
                      onClick={() => setMode("new")}
                    >
                      I&apos;m new
                    </button>
                    <button
                      className={mode === "existing" ? "tg on" : "tg"}
                      onClick={() => setMode("existing")}
                    >
                      I have an account
                    </button>
                  </div>

                  {mode === "new" && (
                    <input
                      className="field"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Full name"
                    />
                  )}
                  <input
                    className="field"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    autoComplete="email"
                  />
                  <input
                    className="field"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "new" ? "Password (6+ characters)" : "Password"}
                    autoComplete={mode === "new" ? "new-password" : "current-password"}
                  />
                  {mode === "new" && (
                    <>
                      <ConsentCheckbox checked={consentAccepted} onChange={setConsentAccepted} />
                      <input
                        className="field"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Phone (optional)"
                      />
                    </>
                  )}
                </div>
              )}

              <div className="held">
                <strong>Your card is held, not charged</strong>
                <span>
                  You pay once the visit is complete. If no pro accepts, the hold
                  is released and you pay nothing.
                </span>
              </div>

              {payError && <p className="flash no">{payError}</p>}

              <button className="back" onClick={() => setStep(4)}>
                ← Change time
              </button>
            </section>
          )}
        </main>

        {/* ================= BASKET ================= */}
        {step > 0 && (
          <aside className="basket">
            <p className="bhead">Your booking</p>

            <div className="brow">
              <span className="k">Address</span>
              <span className="v">
                {address}<br />{postcode.toUpperCase()}
                <button className="chg" onClick={() => setStep(0)}>
                  Change
                </button>
              </span>
            </div>

            <div className="brow">
              <span className="k">Service</span>
              <span className="v">Cleaning</span>
            </div>

            {selected && step >= 2 && (
              <div className="brow">
                <span className="k">Cleaning type</span>
                <span className="v">{selected.name}</span>
              </div>
            )}
            {step >= 3 && (
              <div className="brow">
                <span className="k">Frequency</span>
                <span className="v">{frequencyLabel(frequency)}</span>
              </div>
            )}
            {step >= 4 && selected && (
              <>
                <div className="brow">
                  <span className="k">Hours</span>
                  <span className="v">{duration(minutes) ?? "—"}</span>
                </div>
                {step >= 5 && (
                  <div className="brow">
                    <span className="k">When</span>
                    <span className="v">{slot ? fullLabel(slot) : "Not picked"}</span>
                  </div>
                )}

                {promoInfo?.ok && promoInfo.discount !== undefined && (
                  <div className="brow">
                    <span className="k">{promo.toUpperCase()}</span>
                    <span className="v disc">−{money(promoInfo.discount)}</span>
                  </div>
                )}

                <div className="total">
                  <span>Total per session</span>
                  <strong>{money(total)}</strong>
                </div>
                <p className="fee">Service fee included</p>
              </>
            )}

            {step === 1 && (
              <p className="hint">Choose a cleaning session on the left.</p>
            )}
            {step === 2 && (
              <p className="hint">Now choose how often you would like it.</p>
            )}
            {step === 5 && (
              <button className="pay" onClick={checkout} disabled={paying || !slot || !addressValid || (signedIn === false && mode === "new" && !consentAccepted)}>
                {paying
                  ? "Taking you to checkout…"
                  : signedIn === false
                  ? mode === "new"
                    ? "Create account & pay"
                    : "Sign in & pay"
                  : "Confirm & pay"}
              </button>
            )}

            <p className="alt">
              Booking often? <a href="/subscribe">Try a membership →</a>
            </p>
          </aside>
        )}
      </div>

      <style jsx>{`
        .wrap {
          --ink: #16202a;
          --muted: #7a828c;
          --line: #edeff1;
          --purple: #6d28d9;
          --grad: linear-gradient(100deg, #f5c542, #c86fc9 55%, #7b2ff7);
          --tint: #f8f3ff;
          min-height: 100vh;
          background: #fff;
          color: var(--ink);
          font-family: "Nunito", system-ui, sans-serif;
        }
        .grid {
          max-width: 1040px;
          margin: 0 auto;
          padding: 30px 20px 96px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 320px;
          gap: 34px;
          align-items: start;
        }
        /* Without this, a wide grid child stops the column shrinking and
           pushes content off screen. */
        main {
          min-width: 0;
          overflow-wrap: anywhere;
        }
        main section {
          min-width: 0;
        }
        .next {
          width: 100%;
          margin-top: 26px;
          background: var(--grad);
          color: #fff;
          border: none;
          border-radius: 999px;
          padding: 16px;
          font: inherit;
          font-size: 16.5px;
          font-weight: 900;
          cursor: pointer;
        }
        .next:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        /* progress */
        .stepline {
          font-size: 13.5px;
          font-weight: 700;
          color: var(--muted);
          margin: 0 0 8px;
        }
        .stepline strong {
          color: var(--purple);
          font-weight: 900;
        }
        .types {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 190px), 1fr));
          gap: 12px;
          margin-bottom: 6px;
        }
        .type {
          background: #fff;
          border: 2px solid var(--line);
          border-radius: 18px;
          padding: 22px 20px;
          text-align: left;
          font: inherit;
          cursor: pointer;
          transition: border-color 0.15s ease, transform 0.15s ease;
        }
        .type:hover {
          border-color: #c9b6f2;
          transform: translateY(-2px);
        }
        .type.on {
          border-color: var(--purple);
          background: var(--tint);
        }
        .typeIcon {
          display: grid;
          place-items: center;
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: var(--grad);
          color: #fff;
          font-size: 18px;
          margin-bottom: 12px;
        }
        .type strong {
          display: block;
          font-size: 19px;
          font-weight: 900;
          margin-bottom: 3px;
        }
        .type small {
          color: var(--muted);
          font-size: 13.5px;
          font-weight: 600;
        }
        .chg {
          background: none;
          border: none;
          padding: 0 0 0 8px;
          font: inherit;
          font-size: 12.5px;
          font-weight: 800;
          color: var(--purple);
          cursor: pointer;
          text-decoration: underline;
        }
        .pcEdit {
          display: flex;
          gap: 6px;
          padding: 10px 0 4px;
        }
        .pcEdit input {
          flex: 1;
          min-width: 0;
          border: 2px solid var(--line);
          border-radius: 10px;
          padding: 9px 11px;
          font: inherit;
          font-size: 14px;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--ink);
        }
        .pcEdit input:focus-visible {
          outline: none;
          border-color: var(--purple);
        }
        .pcEdit button {
          background: var(--grad);
          color: #fff;
          border: none;
          border-radius: 10px;
          padding: 9px 14px;
          font: inherit;
          font-size: 13.5px;
          font-weight: 900;
          cursor: pointer;
        }
        .prog {
          height: 8px;
          background: #f1f2f4;
          border-radius: 999px;
          overflow: hidden;
          margin-bottom: 26px;
        }
        .prog span {
          display: block;
          height: 100%;
          background: var(--grad);
          border-radius: 999px;
          transition: width 0.3s ease;
        }

        h1 {
          font-size: clamp(26px, 4vw, 34px);
          font-weight: 900;
          letter-spacing: -0.025em;
          margin: 0 0 6px;
        }
        .eyebrow {
          margin: 0 0 7px;
          color: var(--purple);
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.11em;
          text-transform: uppercase;
        }
        .lede {
          color: var(--muted);
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 24px;
        }
        .handoffError {
          margin: 0 0 16px;
          padding: 12px 14px;
          border: 1.5px solid #f0c36a;
          border-radius: 13px;
          background: #fff9e8;
          color: #7a5200;
          font-size: 14px;
          font-weight: 800;
        }
        .label {
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted);
          margin: 22px 0 9px;
        }
        .muted {
          color: var(--muted);
          font-weight: 600;
        }

        /* fields */
        .field {
          width: 100%;
          box-sizing: border-box;
          padding: 14px 16px;
          border: 2px solid var(--line);
          border-radius: 14px;
          font: inherit;
          font-size: 16px;
          font-weight: 600;
          color: var(--ink);
          background: #fff;
          margin-bottom: 12px;
          resize: vertical;
        }
        .field:focus-visible {
          outline: none;
          border-color: var(--purple);
        }
        .field.big {
          font-size: 19px;
          font-weight: 800;
          text-transform: uppercase;
          padding: 17px 18px;
          margin-bottom: 0;
        }
        .field.bigAddress {
          padding: 17px 18px;
          font-size: 18px;
          font-weight: 800;
        }
        .inline {
          display: flex;
          gap: 10px;
          align-items: flex-start;
        }
        .inline .field {
          flex: 1;
          min-width: 0;
        }
        .go,
        .ghost {
          border: none;
          border-radius: 14px;
          padding: 16px 26px;
          font: inherit;
          font-size: 16px;
          font-weight: 900;
          cursor: pointer;
          white-space: nowrap;
        }
        .go {
          background: var(--grad);
          color: #fff;
        }
        .ghost {
          background: #fff;
          color: var(--purple);
          border: 2px solid var(--line);
          padding: 14px 22px;
        }
        .covered {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-top: 14px;
          padding: 13px 15px;
          border: 1.5px solid #bfe7cf;
          border-radius: 14px;
          background: #effaf4;
          color: #137b4e;
          font-size: 14px;
          font-weight: 800;
        }

        /* trust */
        .trust {
          list-style: none;
          padding: 24px 0 0;
          margin: 26px 0 0;
          border-top: 1px solid var(--line);
          display: grid;
          gap: 12px;
        }
        .trust li {
          display: flex;
          gap: 10px;
          align-items: center;
          font-size: 15px;
          font-weight: 700;
          color: var(--ink);
        }
        .trust em {
          font-style: normal;
          color: #137b4e;
          font-weight: 900;
        }

        /* session options */
        .list {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }
        .opt {
          display: block;
          min-width: 0;
          min-height: 92px;
          text-align: left;
          background: #fff;
          border: 2px solid var(--line);
          border-radius: 15px;
          padding: 11px 12px;
          font: inherit;
          cursor: pointer;
          transition: border-color 0.15s ease, transform 0.15s ease;
        }
        .opt:hover {
          border-color: #c9b6f2;
          transform: translateY(-1px);
        }
        .opt.on {
          border-color: var(--purple);
          background: var(--tint);
        }
        .optbody {
          display: block;
          min-width: 0;
        }
        .popular {
          display: inline-flex;
          margin-bottom: 5px;
          border-radius: 999px;
          padding: 3px 7px;
          background: var(--grad);
          color: #fff;
          font-size: 9.5px;
          font-weight: 900;
          letter-spacing: 0.07em;
          text-transform: uppercase;
        }
        .optTop {
          display: grid;
          gap: 3px;
        }
        .optTop strong {
          font-size: 14px;
          font-weight: 900;
          line-height: 1.18;
        }
        .optTop b {
          font-size: 13px;
          font-weight: 900;
          color: var(--purple);
          white-space: nowrap;
        }
        .optMeta {
          display: block;
          font-size: 10.5px;
          font-weight: 700;
          color: var(--muted);
          margin-top: 4px;
          line-height: 1.25;
        }
        .sessionDetails {
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
          gap: 18px;
          margin-top: 12px;
          padding: 14px 16px;
          border: 1.5px solid #e3d7f5;
          border-radius: 15px;
          background: #faf7ff;
        }
        .sessionDetails span {
          display: block;
          color: var(--purple);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .sessionDetails strong {
          display: block;
          margin-top: 2px;
          font-size: 15px;
          font-weight: 900;
        }
        .sessionDetails p {
          margin: 4px 0 0;
          color: var(--muted);
          font-size: 12px;
          font-weight: 650;
          line-height: 1.4;
        }
        .sessionDetails ul {
          margin: 0;
          padding: 0;
          list-style: none;
          color: #4c5967;
          font-size: 11.5px;
          font-weight: 750;
          line-height: 1.5;
        }

        /* frequency and duration */
        .frequencyGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }
        .frequency {
          display: grid;
          justify-items: start;
          gap: 5px;
          min-height: 128px;
          padding: 18px;
          border: 2px solid var(--line);
          border-radius: 17px;
          background: #fff;
          color: var(--ink);
          text-align: left;
          font: inherit;
          cursor: pointer;
        }
        .frequency:hover,
        .frequency.on {
          border-color: var(--purple);
        }
        .frequency.on {
          background: var(--tint);
        }
        .choiceDot {
          width: 19px;
          height: 19px;
          border: 2px solid #ced3da;
          border-radius: 50%;
        }
        .frequency.on .choiceDot {
          border-color: var(--purple);
          background: var(--grad);
          box-shadow: inset 0 0 0 3px #fff;
        }
        .frequency strong {
          font-size: 17px;
          font-weight: 900;
        }
        .frequency small {
          color: var(--muted);
          font-size: 12.5px;
          font-weight: 700;
          line-height: 1.35;
        }
        .frequencyNote {
          margin: 14px 0 0;
          padding: 12px 14px;
          border-radius: 13px;
          background: #f5f1fc;
          color: #685d78;
          font-size: 12.5px;
          font-weight: 700;
        }
        .hoursCard {
          padding: 24px;
          border: 2px solid #e5d9f7;
          border-radius: 20px;
          background: linear-gradient(145deg, #fff, #faf7ff);
        }
        .hoursTop {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: end;
          margin-bottom: 24px;
        }
        .hoursTop span {
          display: block;
          color: var(--muted);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.07em;
          text-transform: uppercase;
        }
        .hoursTop strong {
          display: block;
          margin-top: 4px;
          font-size: 30px;
          font-weight: 900;
        }
        .sessionPrice {
          text-align: right;
        }
        .sessionPrice strong {
          color: var(--purple);
        }
        .hoursRange {
          width: 100%;
          accent-color: var(--purple);
          cursor: pointer;
        }
        .rangeLabels {
          display: flex;
          justify-content: space-between;
          margin-top: 5px;
          color: var(--muted);
          font-size: 11.5px;
          font-weight: 800;
        }
        .previousCleaner {
          margin-top: 16px;
          padding: 2px 16px 10px;
          border-radius: 16px;
          background: #fafafa;
        }

        /* times */
        .times {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(min(100%, 74px), 1fr));
          gap: 8px;
        }
        .time {
          padding: 11px 6px;
          font-size: 14.5px;
          border-width: 1.5px;
          border-radius: 10px;
        }

        /* confirm */
        .reviewCard {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 24px;
        }
        .reviewCard > div {
          min-width: 0;
          padding: 15px 16px;
          border: 1.5px solid #e8e2f2;
          border-radius: 16px;
          background: linear-gradient(145deg, #fff, #faf7ff);
        }
        .reviewCard span,
        .reviewCard strong,
        .reviewCard small {
          display: block;
        }
        .reviewCard span {
          margin-bottom: 6px;
          color: #8b92a0;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.07em;
          text-transform: uppercase;
        }
        .reviewCard strong {
          color: var(--ink);
          font-size: 15px;
          font-weight: 900;
          line-height: 1.3;
          overflow-wrap: anywhere;
        }
        .reviewCard small {
          margin-top: 4px;
          color: var(--muted);
          font-size: 12.5px;
          font-weight: 700;
          line-height: 1.35;
        }
        .acct {
          background: #fbfaff;
          border: 2px solid #ece5fb;
          border-radius: 18px;
          padding: 18px 20px 8px;
          margin: 22px 0 0;
        }
        .toggle {
          display: flex;
          gap: 8px;
          margin-bottom: 14px;
        }
        .tg {
          background: #fff;
          border: 2px solid var(--line);
          border-radius: 999px;
          padding: 9px 16px;
          font: inherit;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          color: var(--ink);
        }
        .tg.on {
          background: var(--purple);
          border-color: var(--purple);
          color: #fff;
        }
        .held {
          background: #f4fbf7;
          border: 2px solid #cdead9;
          border-radius: 16px;
          padding: 15px 18px;
          margin-top: 22px;
          display: grid;
          gap: 4px;
        }
        .held strong {
          color: #137b4e;
          font-size: 15.5px;
          font-weight: 900;
        }
        .held span {
          color: #4b6b58;
          font-size: 14px;
          font-weight: 600;
          line-height: 1.5;
        }

        .alert {
          background: #fff5d9;
          border: 2px solid #ffe09e;
          border-radius: 16px;
          padding: 15px 18px;
          margin-top: 16px;
          display: grid;
          gap: 3px;
          color: #8a5a00;
        }
        .alert strong {
          font-size: 15.5px;
          font-weight: 900;
        }
        .alert span {
          font-size: 14px;
          font-weight: 600;
        }
        .flash {
          font-size: 14.5px;
          font-weight: 800;
          padding: 11px 14px;
          border-radius: 12px;
          margin: 0 0 6px;
        }
        .flash.ok {
          background: #e4f6ec;
          color: #137b4e;
        }
        .flash.no {
          background: #ffe6ea;
          color: #b0384f;
        }
        .back {
          display: inline-block;
          margin-top: 26px;
          background: none;
          border: none;
          color: var(--muted);
          font: inherit;
          font-size: 14.5px;
          font-weight: 800;
          cursor: pointer;
          padding: 6px 0;
        }
        .back:hover {
          color: var(--purple);
        }

        /* basket */
        .basket {
          background: #fff;
          border: 2px solid var(--line);
          border-radius: 22px;
          padding: 22px 22px 20px;
          position: sticky;
          top: 20px;
        }
        .bhead {
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--muted);
          margin: 0 0 14px;
        }
        .brow {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 11px 0;
          border-bottom: 1px solid #f4f5f7;
        }
        .k {
          font-size: 13.5px;
          font-weight: 700;
          color: var(--muted);
        }
        .v {
          font-size: 14.5px;
          font-weight: 800;
          text-align: right;
          overflow-wrap: anywhere;
        }
        .v.disc {
          color: #137b4e;
        }
        .total {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          padding: 16px 0 2px;
        }
        .total span {
          font-size: 15px;
          font-weight: 800;
          color: var(--muted);
        }
        .total strong {
          font-size: 28px;
          font-weight: 900;
        }
        .fee {
          text-align: right;
          font-size: 12.5px;
          font-weight: 700;
          color: var(--muted);
          margin: 0 0 18px;
        }
        .hint {
          font-size: 14px;
          font-weight: 700;
          color: var(--muted);
          text-align: center;
          margin: 16px 0;
        }
        .pay {
          width: 100%;
          background: var(--grad);
          color: #fff;
          border: none;
          border-radius: 999px;
          padding: 16px;
          font: inherit;
          font-size: 16.5px;
          font-weight: 900;
          cursor: pointer;
        }
        .pay:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .alt {
          margin: 18px 0 0;
          padding-top: 16px;
          border-top: 1px solid #f4f5f7;
          font-size: 13.5px;
          font-weight: 700;
          color: var(--muted);
          text-align: center;
        }
        .alt a {
          color: var(--purple);
          font-weight: 900;
          text-decoration: none;
        }

        @media (max-width: 760px) {
          .list {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .sessionDetails {
            grid-template-columns: 1fr;
          }
          .frequencyGrid {
            grid-template-columns: 1fr;
          }
          .frequency {
            min-height: 0;
          }
          .reviewCard {
            grid-template-columns: 1fr;
          }
          .picker {
            grid-template-columns: minmax(0, 1fr);
          }
          .picker .pickerCol:last-child {
            order: -1;
          }
        }
        @media (max-width: 900px) {
          .grid {
            grid-template-columns: 1fr;
            gap: 24px;
          }
          .basket {
            position: static;
            order: 2;
          }
          main {
            order: 1;
          }
        }
        @media (max-width: 470px) {
          .list {
            grid-template-columns: 1fr;
          }
          .inline {
            flex-direction: column;
          }
          .inline .go {
            width: 100%;
          }
          .covered,
          .hoursTop {
            align-items: flex-start;
            flex-direction: column;
          }
          .sessionPrice {
            text-align: left;
          }
        }
      `}</style>
    </div>
  );
}
