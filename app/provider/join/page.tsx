"use client";

// Become a provider — sign up, then complete the approval process.
// Save at: app/provider/join/page.tsx  →  localhost:3000/provider/join

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isValidUkPhone } from "@/lib/ukPhone";
import {
  estimateProviderMonthlyEarnings,
  isOptionalUtrNumber,
  PROVIDER_ESTIMATED_HOURLY_EARNINGS,
  PROVIDER_MAX_WEEKLY_HOURS,
  PROVIDER_RESIDENT_STATUSES,
} from "@/lib/providerOnboarding";

const supabase = createClient();

type Area = { id: string; name: string; postcode_prefixes: string[] };

type JoinStep = "estimate" | "account" | "status" | "work";

export default function ProviderJoinPage() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [joinStep, setJoinStep] = useState<JoinStep>("estimate");
  const [weeklyHours, setWeeklyHours] = useState(20);
  const [salutation, setSalutation] = useState<"ms_mrs" | "mr" | "">("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [address, setAddress] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [residentStatus, setResidentStatus] = useState("");
  const [utrNumber, setUtrNumber] = useState("");
  const [selfEmployed, setSelfEmployed] = useState<"agree" | "disagree" | "">("");
  const skills = ["cleaning"];
  const [areaIds, setAreaIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("service_areas")
        .select("id, name, postcode_prefixes")
        .eq("active", true);
      setAreas(data ?? []);
    })();
  }, []);

  function toggle(list: string[], v: string) {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
  const emailValid = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email.trim());
  const phoneValid = isValidUkPhone(phone);
  const accountFieldsPresent = Boolean(
    salutation &&
      firstName.trim() &&
      lastName.trim() &&
      email.trim() &&
      password.length >= 6 &&
      phone.trim() &&
      address.trim() &&
      dateOfBirth,
  );
  const accountReady = Boolean(
    accountFieldsPresent && emailValid && phoneValid,
  );

  function continueToWorkDetails() {
    setEmailTouched(true);
    setPhoneTouched(true);
    if (!accountFieldsPresent) {
      setErr("Complete every account field. Your password must have at least 6 characters.");
      return;
    }
    if (!emailValid || !phoneValid) {
      setErr(null);
      return;
    }
    setErr(null);
    setJoinStep("status");
  }

  function continueToWorkAreas() {
    if (!residentStatus) {
      setErr("Select your resident status in the UK.");
      return;
    }
    if (selfEmployed !== "agree") {
      setErr("You must agree to work as self-employed to continue.");
      return;
    }
    if (!isOptionalUtrNumber(utrNumber)) {
      setErr("Enter all 10 digits of your UTR number, or leave it blank.");
      return;
    }
    setErr(null);
    setJoinStep("work");
  }

  async function submit() {
    setBusy(true);
    setErr(null);

    try {
      // 1. Create the provider account
      setStep("Creating your account…");
      const res = await fetch("/api/provider-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          salutation,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          password,
          phone: phone.trim(),
          address: address.trim(),
          dateOfBirth,
          weeklyHours,
          residentStatus,
          utrNumber: utrNumber.trim() || null,
          selfEmployed: selfEmployed === "agree",
          skills,
          areaIds,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Sign-up failed");

      // 2. Sign them in
      setStep("Signing you in…");
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInErr) throw new Error(signInErr.message);

      // 3. No joining payment: continue directly to the provider portal.
      setStep("Opening your provider portal…");
      window.location.href = "/worker";
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
      setStep("");
    }
  }

  const ready = accountReady && residentStatus && selfEmployed === "agree" && skills.length && areaIds.length;
  const monthlyEstimate = estimateProviderMonthlyEarnings(weeklyHours);

  return (
    <main className="wrap">
      <div className="grid">
        {/* ---- The pitch ---- */}
        <section className="pitch">
          <Link className="brand" href="/">
            Opulence&nbsp;Bliss
          </Link>
          <p className="eyebrow">Work with us</p>
          <h1>Good work, fair pay, your own hours.</h1>
          <p className="lede">
            Join our vetted network of home cleaners across London. You set
            your availability — we bring you the clients.
          </p>

          <div className="fee">
            <p className="fee-amount">No joining fee</p>
            <p className="fee-note">
              Create your account without an upfront payment. Our team reviews
              every application before jobs are unlocked.
            </p>
            <ul>
              <li>Background check &amp; onboarding</li>
              <li>Your profile live on the platform</li>
              <li>Jobs matched to your skills and area</li>
              <li>Paid automatically after each visit</li>
            </ul>
          </div>

          <ol className="steps">
            <li>
              <span>1</span> Create your professional account
            </li>
            <li>
              <span>2</span> Complete approval and set your hours
            </li>
            <li>
              <span>3</span> Accept jobs and get paid per visit
            </li>
          </ol>

          <p className="already">
            Already a provider? <a href="/provider/login">Log in</a>
          </p>
        </section>

        {/* ---- In-page application ---- */}
        <section className="form">
          {joinStep === "estimate" && (
            <div className="estimate-step">
              <p className="form-kicker">See what your schedule could look like</p>
              <h2>Choose your weekly availability</h2>
              <p className="section-intro">
                Move the slider to estimate your earnings. You can change these hours whenever you need to.
              </p>

              <div className="availability-card">
                <div className="availability-heading">
                  <b>Your availability</b>
                  <strong>{weeklyHours}hr per week</strong>
                </div>
                <input
                  className="hours-slider"
                  type="range"
                  min="0"
                  max={PROVIDER_MAX_WEEKLY_HOURS}
                  step="1"
                  value={weeklyHours}
                  onChange={(event) => setWeeklyHours(Number(event.target.value))}
                  aria-label="Weekly availability in hours"
                />
                <div className="range-labels" aria-hidden="true">
                  <span>0hr</span>
                  <span>40hr</span>
                </div>

                <div className="simulation">
                  <p>Your simulation</p>
                  <div>
                    <span>On average<strong>£{PROVIDER_ESTIMATED_HOURLY_EARNINGS}/hr</strong></span>
                    <span>That&apos;s about<strong>£{monthlyEstimate.toLocaleString("en-GB")}/month</strong></span>
                  </div>
                </div>
                <p className="estimate-note">Estimate before tax, based on the hours you choose.</p>
              </div>

              <button className="go" type="button" onClick={() => setJoinStep("account")}>
                Join for free
              </button>
              <p className="small">No joining fee. Your application stays on this page.</p>
            </div>
          )}

          {joinStep === "account" && (
            <div className="account-fields">
              <button className="step-back" type="button" onClick={() => setJoinStep("estimate")}>
                ← Back
              </button>
              <p className="form-kicker">Professional application</p>
              <h2>Create your provider account</h2>
              <fieldset className="title-options">
                <legend className="sr-only">Title</legend>
                <label className="title-option">
                  <input
                    type="radio"
                    name="salutation"
                    checked={salutation === "ms_mrs"}
                    onChange={() => setSalutation("ms_mrs")}
                  />
                  <span aria-hidden="true" /> Ms / Mrs
                </label>
                <label className="title-option">
                  <input
                    type="radio"
                    name="salutation"
                    checked={salutation === "mr"}
                    onChange={() => setSalutation("mr")}
                  />
                  <span aria-hidden="true" /> Mr
                </label>
              </fieldset>

              <label className="sr-only" htmlFor="provider-first-name">First name</label>
              <input
                id="provider-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                autoComplete="given-name"
              />

              <label className="sr-only" htmlFor="provider-last-name">Last name</label>
              <input
                id="provider-last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                autoComplete="family-name"
              />

              <label className="sr-only" htmlFor="provider-email">Email</label>
              <input
                id="provider-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setEmailTouched(true)}
                placeholder="Email"
                autoComplete="email"
                className={emailTouched && !emailValid ? "invalid" : undefined}
                aria-invalid={emailTouched && !emailValid}
                aria-describedby={emailTouched && !emailValid ? "provider-email-error" : undefined}
              />
              {emailTouched && !emailValid && (
                <p className="field-error" id="provider-email-error">Invalid email</p>
              )}

              <div className="password-field">
                <label className="sr-only" htmlFor="provider-password">Password</label>
                <input
                  id="provider-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((shown) => !shown)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              <div className={`phone-field ${phoneTouched && !phoneValid ? "invalid" : ""}`}>
                <svg
                  className="uk-flag"
                  viewBox="0 0 60 30"
                  role="img"
                  aria-label="United Kingdom"
                >
                  <rect width="60" height="30" fill="#012169" />
                  <path d="M0 0 60 30M60 0 0 30" stroke="#fff" strokeWidth="8" />
                  <path d="M0 0 60 30M60 0 0 30" stroke="#C8102E" strokeWidth="4" />
                  <path d="M30 0V30M0 15H60" stroke="#fff" strokeWidth="10" />
                  <path d="M30 0V30M0 15H60" stroke="#C8102E" strokeWidth="6" />
                </svg>
                <span className="phone-code">+44</span>
                <label className="sr-only" htmlFor="provider-phone">Phone</label>
                <input
                  id="provider-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={() => setPhoneTouched(true)}
                  placeholder="Phone"
                  autoComplete="tel"
                  inputMode="numeric"
                  aria-invalid={phoneTouched && !phoneValid}
                  aria-describedby={phoneTouched && !phoneValid ? "provider-phone-error" : undefined}
                />
              </div>
              {phoneTouched && !phoneValid && (
                <p className="field-error" id="provider-phone-error">Invalid phone number</p>
              )}

              <label className="sr-only" htmlFor="provider-address">Address</label>
              <input
                id="provider-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Address"
                autoComplete="street-address"
              />

              <label className="sr-only" htmlFor="provider-dob">Date of birth</label>
              <input
                id="provider-dob"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                aria-label="Date of birth"
              />

              <button className="go next" type="button" onClick={continueToWorkDetails}>
                Next
              </button>
            </div>
          )}

          {joinStep === "status" && selfEmployed !== "disagree" && (
            <div className="status-fields">
              <button className="step-back" type="button" onClick={() => setJoinStep("account")}>
                ← Back
              </button>
              <p className="form-kicker">Professional application</p>
              <h2>What&apos;s your professional status?</h2>

              <label htmlFor="provider-resident-status">Resident status in the UK</label>
              <select
                id="provider-resident-status"
                value={residentStatus}
                onChange={(event) => setResidentStatus(event.target.value)}
              >
                <option value="" disabled>Select your resident status</option>
                {PROVIDER_RESIDENT_STATUSES.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>

              <label htmlFor="provider-utr">UTR number <span>(optional)</span></label>
              <input
                id="provider-utr"
                value={utrNumber}
                onChange={(event) => setUtrNumber(event.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="Enter your 10-digit UTR if you have one"
                inputMode="numeric"
                autoComplete="off"
              />
              <p className="help-copy">You can continue if you do not have a UTR number yet.</p>

              <div className="employment-card">
                <h3>Partnership with Opulence Bliss</h3>
                <p>Professionals using Opulence Bliss work on a self-employed basis.</p>
                <fieldset className="employment-options">
                  <legend>Do you agree to work as self-employed?</legend>
                  <label>
                    <input type="radio" name="self-employed" checked={selfEmployed === "agree"} onChange={() => setSelfEmployed("agree")} />
                    <span aria-hidden="true" /> Agree
                  </label>
                  <label>
                    <input type="radio" name="self-employed" checked={false} onChange={() => setSelfEmployed("disagree")} />
                    <span aria-hidden="true" /> Disagree
                  </label>
                </fieldset>
              </div>

              <button className="go next" type="button" onClick={continueToWorkAreas}>
                Next
              </button>
            </div>
          )}

          {joinStep === "status" && selfEmployed === "disagree" && (
            <div className="unable-panel" role="status">
              <button className="step-back" type="button" onClick={() => setSelfEmployed("")}>
                ← Change answer
              </button>
              <div className="unable-heading">
                <span aria-hidden="true">😥</span>
                <h2>Unable to finalize partnership</h2>
              </div>
              <div className="unable-copy">
                <p>Opulence Bliss only works with self-employed professionals.</p>
                <p>To become an Opulence Bliss partner, you must want to be self-employed.</p>
                <p>If you change your mind, choose “Change answer” and select Agree.</p>
                <p>We look forward to hearing from you.</p>
              </div>
            </div>
          )}

          {joinStep === "work" && (
            <div className="work-fields">
              <button className="step-back" type="button" onClick={() => setJoinStep("status")} disabled={busy}>
                ← Back
              </button>
              <p className="form-kicker">Final step</p>
              <h2>Where would you like to work?</h2>
              <p className="section-intro">
                Choose where you would like to work. You can change your hours later in the professional portal.
              </p>

              <label>What do you offer?</label>
              <div className="checks">
                <span className="chk on">Home cleaning</span>
              </div>

              <label>Where do you work?</label>
              <div className="checks">
                {areas.length === 0 ? (
                  <span className="muted">Loading areas…</span>
                ) : (
                  areas.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className={areaIds.includes(a.id) ? "chk on" : "chk"}
                      onClick={() => setAreaIds((l) => toggle(l, a.id))}
                      title={(a.postcode_prefixes ?? []).join(", ")}
                    >
                      {a.name}
                    </button>
                  ))
                )}
              </div>

              <div className="form-actions">
                <button className="go" type="button" onClick={submit} disabled={busy || !ready}>
                  {busy ? step || "Working…" : "Create professional account"}
                </button>
              </div>
              <p className="small">
                There is no joining charge. Jobs unlock after your application is approved.
              </p>
            </div>
          )}

          {err && <p className="err">{err}</p>}
        </section>
      </div>

      <style jsx>{`
        .wrap {
          min-height: 100vh;
          min-height: 100dvh;
          overflow-x: clip;
          background: #fff;
          color: #16202A;
          font-family: "Nunito", system-ui, sans-serif;
          padding: 0 20px 70px;
        }
        .grid {
          max-width: 1040px;
          margin: 0 auto;
          padding-top: 44px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 48px;
          align-items: start;
        }
        /* Grid items default to min-width:auto, which lets a wide child
           stretch the track and push the whole page sideways. */
        .pitch,
        .form {
          min-width: 0;
        }
        .brand {
          font-family: "Nunito", system-ui, sans-serif;
          font-size: 19px;
          font-weight: 600;
          color: #16202A;
          text-decoration: none;
          display: inline-block;
          margin-bottom: 26px;
        }
        .eyebrow {
          text-transform: uppercase;
          letter-spacing: 0.14em;
          font-size: 12px;
          font-weight: 600;
          color: #6D28D9;
          margin: 0 0 8px;
        }
        h1 {
          font-family: "Nunito", system-ui, sans-serif;
          font-weight: 900;
          font-size: clamp(32px, 4.6vw, 46px);
          line-height: 1.06;
          color: #16202A;
          margin: 0 0 14px;
        }
        h2 {
          font-family: "Nunito", system-ui, sans-serif;
          font-weight: 900;
          font-size: 24px;
          color: #16202A;
          margin: 0 0 20px;
        }
        h3 {
          margin: 0 0 8px;
          color: #16202A;
          font-size: 17px;
          font-weight: 900;
        }
        .lede {
          color: #7A828C;
          font-size: 17px;
          line-height: 1.6;
          margin: 0 0 26px;
        }
        .fee {
          background: #fff;
          border: 1.5px solid #F5C542;
          border-radius: 18px;
          padding: 24px 26px;
          margin-bottom: 26px;
        }
        .fee-amount {
          font-family: "Nunito", system-ui, sans-serif;
          font-size: clamp(27px, 7vw, 34px);
          color: #16202A;
          margin: 0 0 4px;
        }
        .fee-amount span {
          font-family: "Nunito", sans-serif;
          font-size: 14px;
          color: #7A828C;
        }
        .fee-note {
          color: #7A828C;
          font-size: 14px;
          margin: 0 0 16px;
        }
        .fee ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 8px;
        }
        .fee li {
          font-size: 14.5px;
          padding-left: 22px;
          position: relative;
        }
        .fee li::before {
          content: "✿";
          position: absolute;
          left: 0;
          color: #F5C542;
          font-size: 12px;
        }
        .steps {
          list-style: none;
          padding: 0;
          margin: 0 0 22px;
          display: grid;
          gap: 12px;
        }
        .steps li {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 15px;
          color: #16202A;
        }
        .steps span {
          display: grid;
          place-items: center;
          width: 28px;
          height: 28px;
          flex-shrink: 0;
          border-radius: 50%;
          background: #F4ECFE;
          color: #16202A;
          font-family: "Nunito", system-ui, sans-serif;
          font-size: 14px;
        }
        .already {
          font-size: 14.5px;
          color: #7A828C;
        }
        .already a {
          color: #16202A;
          font-weight: 600;
        }
        .form {
          background: #fff;
          border: 1px solid #E7DCFA;
          border-top: 5px solid #6D28D9;
          border-radius: 24px;
          padding: 34px 32px;
          box-shadow: 0 20px 54px rgba(76,29,149, 0.12);
        }
        .form-kicker {
          margin: 0 0 7px;
          color: #6D28D9;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .step-back {
          width: max-content;
          margin: 0 0 24px;
          padding: 0;
          border: 0;
          background: transparent;
          color: #6D28D9;
          font: inherit;
          font-size: 13px;
          font-weight: 900;
          cursor: pointer;
        }
        .availability-card {
          padding: 22px;
          border: 1px solid #E2D5F8;
          border-radius: 18px;
          background: linear-gradient(145deg, #FFF8E7 0%, #F4ECFE 100%);
        }
        .availability-heading {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          gap: 6px 16px;
          align-items: center;
          margin-bottom: 15px;
          color: #16202A;
          font-size: 15px;
        }
        .availability-heading strong {
          white-space: nowrap;
          font-weight: 900;
        }
        input.hours-slider {
          width: 100%;
          min-height: 0;
          height: 22px;
          margin: 0;
          padding: 0;
          border: 0;
          border-radius: 999px;
          background: transparent;
          box-shadow: none;
          accent-color: #7B2FF7;
          cursor: pointer;
        }
        input.hours-slider:focus-visible {
          box-shadow: none;
          outline: 3px solid rgba(109,40,217,0.2);
          outline-offset: 5px;
        }
        .range-labels {
          display: flex;
          justify-content: space-between;
          margin-top: 1px;
          color: #7A828C;
          font-size: 11px;
          font-weight: 800;
        }
        .simulation {
          margin-top: 18px;
          padding: 18px;
          border: 1.5px solid #16202A;
          border-radius: 14px;
          background: rgba(255,255,255,0.58);
        }
        .simulation > p {
          margin: 0 0 14px;
          color: #6D28D9;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .simulation > div {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }
        .simulation span {
          display: grid;
          min-width: 0;
          gap: 3px;
          color: #535D69;
          font-size: 12px;
        }
        .simulation strong {
          color: #16202A;
          font-size: clamp(19px, 5.4vw, 24px);
          font-weight: 900;
          line-height: 1.05;
          overflow-wrap: anywhere;
        }
        .estimate-note {
          margin: 12px 0 0;
          color: #7A828C;
          font-size: 11px;
          text-align: center;
        }
        label {
          display: block;
          font-size: 13.5px;
          color: #7A828C;
          margin: 0 0 6px;
        }
        input {
          width: 100%;
          box-sizing: border-box;
          min-height: 56px;
          padding: 15px 16px;
          border: 1.5px solid #D9DDE3;
          border-radius: 13px;
          font: inherit;
          font-size: 15.5px;
          background: #fff;
          color: #16202A;
          margin-bottom: 14px;
        }
        input:focus-visible {
          outline: none;
          border-color: #6D28D9;
          box-shadow: 0 0 0 3px rgba(109,40,217, 0.09);
        }
        select {
          width: 100%;
          min-height: 56px;
          box-sizing: border-box;
          margin: 0 0 18px;
          padding: 14px 44px 14px 16px;
          border: 1.5px solid #D9DDE3;
          border-radius: 13px;
          background: #fff;
          color: #16202A;
          font: inherit;
          font-size: 15px;
        }
        select:focus-visible {
          border-color: #6D28D9;
          outline: none;
          box-shadow: 0 0 0 3px rgba(109,40,217,0.09);
        }
        input.invalid,
        input.invalid:focus-visible {
          border-color: #E5394F;
          box-shadow: 0 0 0 3px rgba(229,57,79, 0.08);
        }
        .account-fields,
        .status-fields,
        .work-fields {
          display: grid;
        }
        .help-copy {
          margin: -8px 2px 20px;
          color: #7A828C;
          font-size: 12px;
        }
        .status-fields label > span {
          color: #8C95A0;
          font-weight: 600;
        }
        .employment-card {
          margin: 2px 0 18px;
          padding: 19px;
          border: 1px solid #E2D5F8;
          border-radius: 15px;
          background: #FAF7FF;
        }
        .employment-card > p {
          margin: 0 0 16px;
          color: #68717D;
          font-size: 13.5px;
          line-height: 1.5;
        }
        .employment-options {
          position: relative;
          display: grid;
          gap: 12px;
          margin: 0;
          padding: 0;
          border: 0;
        }
        .employment-options legend {
          margin-bottom: 12px;
          color: #16202A;
          font-size: 13.5px;
          font-weight: 900;
        }
        .employment-options label {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 0;
          color: #16202A;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
        }
        .employment-options input {
          position: absolute;
          width: 1px;
          height: 1px;
          min-height: 0;
          margin: 0;
          opacity: 0;
        }
        .employment-options label > span {
          width: 22px;
          height: 22px;
          box-sizing: border-box;
          border: 1.5px solid #8E96A1;
          border-radius: 50%;
          background: #fff;
          box-shadow: inset 0 0 0 5px #fff;
        }
        .employment-options input:checked + span {
          border-color: #6D28D9;
          background: #6D28D9;
        }
        .employment-options input:focus-visible + span {
          outline: 3px solid rgba(109,40,217,0.18);
          outline-offset: 2px;
        }
        .unable-panel {
          display: grid;
          min-height: 440px;
          align-content: center;
          padding: 4px;
        }
        .unable-heading {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          margin-bottom: 20px;
        }
        .unable-heading > span {
          order: 2;
          font-size: 36px;
        }
        .unable-heading h2 {
          margin-bottom: 8px;
          font-size: clamp(29px, 4vw, 38px);
          line-height: 1.02;
        }
        .unable-copy {
          padding: 20px;
          border: 1px solid #DDD1F5;
          border-radius: 16px;
          background: linear-gradient(145deg, #FFF8E7, #F4ECFE);
        }
        .unable-copy p {
          margin: 0 0 14px;
          color: #343D48;
          font-size: 14px;
          line-height: 1.55;
        }
        .unable-copy p:last-child {
          margin-bottom: 0;
        }
        .title-options {
          position: relative;
          display: flex;
          flex-wrap: wrap;
          gap: 12px 28px;
          margin: 0 0 16px;
          padding: 0;
          border: 0;
        }
        .title-option {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          margin: 0;
          color: #16202A;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
        }
        .title-option input {
          position: absolute;
          width: 1px;
          height: 1px;
          min-height: 0;
          margin: 0;
          opacity: 0;
        }
        .title-option span {
          width: 22px;
          height: 22px;
          box-sizing: border-box;
          border: 1.5px solid #8E96A1;
          border-radius: 50%;
          background: #fff;
          box-shadow: inset 0 0 0 5px #fff;
        }
        .title-option input:checked + span {
          border-color: #6D28D9;
          background: #6D28D9;
        }
        .title-option input:focus-visible + span {
          outline: 3px solid rgba(109,40,217, 0.18);
          outline-offset: 2px;
        }
        .password-field,
        .phone-field {
          position: relative;
        }
        .password-field input {
          padding-right: 54px;
        }
        .password-field button {
          position: absolute;
          top: 9px;
          right: 9px;
          display: grid;
          width: 38px;
          height: 38px;
          place-items: center;
          border: 0;
          background: transparent;
          color: #16202A;
          cursor: pointer;
        }
        .phone-field {
          display: grid;
          grid-template-columns: auto auto minmax(0, 1fr);
          align-items: center;
          min-height: 56px;
          margin-bottom: 14px;
          padding-left: 15px;
          border: 1.5px solid #D9DDE3;
          border-radius: 13px;
          background: #fff;
        }
        .phone-field:focus-within {
          border-color: #6D28D9;
          box-shadow: 0 0 0 3px rgba(109,40,217, 0.09);
        }
        .phone-field.invalid,
        .phone-field.invalid:focus-within {
          border-color: #E5394F;
          box-shadow: 0 0 0 3px rgba(229,57,79, 0.08);
        }
        .phone-code {
          margin: 0 7px;
          color: #5F6874;
          font-size: 14px;
          font-weight: 800;
        }
        .uk-flag {
          display: block;
          width: 24px;
          height: 16px;
          overflow: hidden;
          border-radius: 2px;
          box-shadow: 0 0 0 1px rgba(22,32,42, 0.15);
        }
        .phone-field input {
          min-height: 53px;
          margin: 0;
          padding-left: 4px;
          border: 0;
          box-shadow: none;
        }
        .phone-field input:focus-visible {
          box-shadow: none;
        }
        .field-error {
          margin: -7px 2px 14px;
          color: #D82F45;
          font-size: 12.5px;
          font-weight: 700;
          line-height: 1.3;
        }
        input[type="date"] {
          /* iOS Safari gives date inputs an intrinsic width that ignores
             width:100%, which pushes them past the card edge. */
          -webkit-appearance: none;
          appearance: none;
          min-width: 0;
          max-width: 100%;
          color: #7A828C;
        }
        .section-intro {
          margin: -5px 0 22px;
          color: #68717D;
          font-size: 14px;
          line-height: 1.5;
        }
        .checks {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 18px;
        }
        .chk {
          max-width: 100%;
          background: #FFFFFF;
          border: 1.5px solid #EDEFF1;
          border-radius: 999px;
          padding: 9px 16px;
          font: inherit;
          font-size: 14px;
          color: #16202A;
          text-align: left;
          overflow-wrap: anywhere;
          cursor: pointer;
        }
        .chk:hover {
          border-color: #6D28D9;
        }
        .chk.on {
          background: #F4ECFE;
          border-color: #16202A;
          color: #16202A;
          font-weight: 600;
        }
        .go {
          width: 100%;
          background: linear-gradient(100deg,#F5C542,#C86FC9 55%,#7B2FF7);
          color: #fff;
          border: none;
          border-radius: 999px;
          padding: 14px;
          font: inherit;
          font-weight: 600;
          font-size: 16px;
          cursor: pointer;
          margin-top: 6px;
        }
        .go:hover:not(:disabled) {
          background: #4C1D95;
        }
        .go.next {
          width: auto;
          min-width: 128px;
          justify-self: center;
          padding-inline: 30px;
        }
        .go:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .small {
          font-size: 12.5px;
          color: #7A828C;
          text-align: center;
          margin: 12px 0 0;
        }
        .form-actions {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 10px;
          align-items: end;
        }
        .back {
          min-height: 50px;
          padding: 0 20px;
          border: 1.5px solid #DCCBFA;
          border-radius: 999px;
          background: #FAF7FF;
          color: #6D28D9;
          font: inherit;
          font-weight: 800;
          cursor: pointer;
        }
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        .err {
          background: #FFE6EA;
          color: #B0384F;
          padding: 12px 14px;
          border-radius: 10px;
          font-size: 14px;
          margin: 16px 0 0;
        }
        .muted {
          color: #7A828C;
          font-size: 14px;
        }
        @media (max-width: 880px) {
          .grid {
            grid-template-columns: minmax(0, 1fr);
            gap: 34px;
          }
        }
        @media (max-width: 520px) {
          .wrap {
            padding-inline: 14px;
          }
          .grid {
            padding-top: 26px;
          }
          .form {
            padding: 28px 20px;
          }
          .fee {
            padding: 22px 18px;
          }
          .form-actions {
            grid-template-columns: 1fr;
          }
          /* Drops to a single column on its own once two columns no longer
             fit the currency figures, so there is no magic breakpoint. */
          .simulation > div {
            grid-template-columns: repeat(auto-fit, minmax(128px, 1fr));
            gap: 14px;
          }
        }
        @media (max-width: 400px) {
          .form {
            padding: 24px 16px;
            border-radius: 20px;
          }
          .availability-card {
            padding: 16px;
          }
          .simulation {
            padding: 14px;
          }
          .employment-card {
            padding: 16px;
          }
          .unable-copy {
            padding: 16px;
          }
          .title-options {
            gap: 12px 20px;
          }
        }
      `}</style>
    </main>
  );
}  const [phoneTouched, setPhoneTouched] = useState(false);
  const [address, setAddress] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [residentStatus, setResidentStatus] = useState("");
  const [utrNumber, setUtrNumber] = useState("");
  const [selfEmployed, setSelfEmployed] = useState<"agree" | "disagree" | "">("");
  const skills = ["cleaning"];
  const [areaIds, setAreaIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("service_areas")
        .select("id, name, postcode_prefixes")
        .eq("active", true);
      setAreas(data ?? []);
    })();
  }, []);

  function toggle(list: string[], v: string) {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
  const emailValid = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email.trim());
  const phoneValid = isValidUkPhone(phone);
  const accountFieldsPresent = Boolean(
    salutation &&
      firstName.trim() &&
      lastName.trim() &&
      email.trim() &&
      password.length >= 6 &&
      phone.trim() &&
      address.trim() &&
      dateOfBirth,
  );
  const accountReady = Boolean(
    accountFieldsPresent && emailValid && phoneValid,
  );

  function continueToWorkDetails() {
    setEmailTouched(true);
    setPhoneTouched(true);
    if (!accountFieldsPresent) {
      setErr("Complete every account field. Your password must have at least 6 characters.");
      return;
    }
    if (!emailValid || !phoneValid) {
      setErr(null);
      return;
    }
    setErr(null);
    setJoinStep("status");
  }

  function continueToWorkAreas() {
    if (!residentStatus) {
      setErr("Select your resident status in the UK.");
      return;
    }
    if (selfEmployed !== "agree") {
      setErr("You must agree to work as self-employed to continue.");
      return;
    }
    if (!isOptionalUtrNumber(utrNumber)) {
      setErr("Enter all 10 digits of your UTR number, or leave it blank.");
      return;
    }
    setErr(null);
    setJoinStep("work");
  }

  async function submit() {
    setBusy(true);
    setErr(null);

    try {
      // 1. Create the provider account
      setStep("Creating your account…");
      const res = await fetch("/api/provider-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          salutation,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          password,
          phone: phone.trim(),
          address: address.trim(),
          dateOfBirth,
          weeklyHours,
          residentStatus,
          utrNumber: utrNumber.trim() || null,
          selfEmployed: selfEmployed === "agree",
          skills,
          areaIds,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Sign-up failed");

      // 2. Sign them in
      setStep("Signing you in…");
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInErr) throw new Error(signInErr.message);

      // 3. No joining payment: continue directly to the provider portal.
      setStep("Opening your provider portal…");
      window.location.href = "/worker";
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
      setStep("");
    }
  }

  const ready = accountReady && residentStatus && selfEmployed === "agree" && skills.length && areaIds.length;
  const monthlyEstimate = estimateProviderMonthlyEarnings(weeklyHours);

  return (
    <main className="wrap">
      <div className="grid">
        {/* ---- The pitch ---- */}
        <section className="pitch">
          <Link className="brand" href="/">
            Opulence&nbsp;Bliss
          </Link>
          <p className="eyebrow">Work with us</p>
          <h1>Good work, fair pay, your own hours.</h1>
          <p className="lede">
            Join our vetted network of home cleaners across London. You set
            your availability — we bring you the clients.
          </p>

          <div className="fee">
            <p className="fee-amount">No joining fee</p>
            <p className="fee-note">
              Create your account without an upfront payment. Our team reviews
              every application before jobs are unlocked.
            </p>
            <ul>
              <li>Background check &amp; onboarding</li>
              <li>Your profile live on the platform</li>
              <li>Jobs matched to your skills and area</li>
              <li>Paid automatically after each visit</li>
            </ul>
          </div>

          <ol className="steps">
            <li>
              <span>1</span> Create your professional account
            </li>
            <li>
              <span>2</span> Complete approval and set your hours
            </li>
            <li>
              <span>3</span> Accept jobs and get paid per visit
            </li>
          </ol>

          <p className="already">
            Already a provider? <a href="/provider/login">Log in</a>
          </p>
        </section>

        {/* ---- In-page application ---- */}
        <section className="form">
          {joinStep === "estimate" && (
            <div className="estimate-step">
              <p className="form-kicker">See what your schedule could look like</p>
              <h2>Choose your weekly availability</h2>
              <p className="section-intro">
                Move the slider to estimate your earnings. You can change these hours whenever you need to.
              </p>

              <div className="availability-card">
                <div className="availability-heading">
                  <b>Your availability</b>
                  <strong>{weeklyHours}hr per week</strong>
                </div>
                <input
                  className="hours-slider"
                  type="range"
                  min="0"
                  max={PROVIDER_MAX_WEEKLY_HOURS}
                  step="1"
                  value={weeklyHours}
                  onChange={(event) => setWeeklyHours(Number(event.target.value))}
                  aria-label="Weekly availability in hours"
                />
                <div className="range-labels" aria-hidden="true">
                  <span>0hr</span>
                  <span>40hr</span>
                </div>

                <div className="simulation">
                  <p>Your simulation</p>
                  <div>
                    <span>On average<strong>£{PROVIDER_ESTIMATED_HOURLY_EARNINGS}/hr</strong></span>
                    <span>That&apos;s about<strong>£{monthlyEstimate.toLocaleString("en-GB")}/month</strong></span>
                  </div>
                </div>
                <p className="estimate-note">Estimate before tax, based on the hours you choose.</p>
              </div>

              <button className="go" type="button" onClick={() => setJoinStep("account")}>
                Join for free
              </button>
              <p className="small">No joining fee. Your application stays on this page.</p>
            </div>
          )}

          {joinStep === "account" && (
            <div className="account-fields">
              <button className="step-back" type="button" onClick={() => setJoinStep("estimate")}>
                ← Back
              </button>
              <p className="form-kicker">Professional application</p>
              <h2>Create your provider account</h2>
              <fieldset className="title-options">
                <legend className="sr-only">Title</legend>
                <label className="title-option">
                  <input
                    type="radio"
                    name="salutation"
                    checked={salutation === "ms_mrs"}
                    onChange={() => setSalutation("ms_mrs")}
                  />
                  <span aria-hidden="true" /> Ms / Mrs
                </label>
                <label className="title-option">
                  <input
                    type="radio"
                    name="salutation"
                    checked={salutation === "mr"}
                    onChange={() => setSalutation("mr")}
                  />
                  <span aria-hidden="true" /> Mr
                </label>
              </fieldset>

              <label className="sr-only" htmlFor="provider-first-name">First name</label>
              <input
                id="provider-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                autoComplete="given-name"
              />

              <label className="sr-only" htmlFor="provider-last-name">Last name</label>
              <input
                id="provider-last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                autoComplete="family-name"
              />

              <label className="sr-only" htmlFor="provider-email">Email</label>
              <input
                id="provider-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setEmailTouched(true)}
                placeholder="Email"
                autoComplete="email"
                className={emailTouched && !emailValid ? "invalid" : undefined}
                aria-invalid={emailTouched && !emailValid}
                aria-describedby={emailTouched && !emailValid ? "provider-email-error" : undefined}
              />
              {emailTouched && !emailValid && (
                <p className="field-error" id="provider-email-error">Invalid email</p>
              )}

              <div className="password-field">
                <label className="sr-only" htmlFor="provider-password">Password</label>
                <input
                  id="provider-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((shown) => !shown)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              <div className={`phone-field ${phoneTouched && !phoneValid ? "invalid" : ""}`}>
                <svg
                  className="uk-flag"
                  viewBox="0 0 60 30"
                  role="img"
                  aria-label="United Kingdom"
                >
                  <rect width="60" height="30" fill="#012169" />
                  <path d="M0 0 60 30M60 0 0 30" stroke="#fff" strokeWidth="8" />
                  <path d="M0 0 60 30M60 0 0 30" stroke="#C8102E" strokeWidth="4" />
                  <path d="M30 0V30M0 15H60" stroke="#fff" strokeWidth="10" />
                  <path d="M30 0V30M0 15H60" stroke="#C8102E" strokeWidth="6" />
                </svg>
                <span className="phone-code">+44</span>
                <label className="sr-only" htmlFor="provider-phone">Phone</label>
                <input
                  id="provider-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={() => setPhoneTouched(true)}
                  placeholder="Phone"
                  autoComplete="tel"
                  inputMode="numeric"
                  aria-invalid={phoneTouched && !phoneValid}
                  aria-describedby={phoneTouched && !phoneValid ? "provider-phone-error" : undefined}
                />
              </div>
              {phoneTouched && !phoneValid && (
                <p className="field-error" id="provider-phone-error">Invalid phone number</p>
              )}

              <label className="sr-only" htmlFor="provider-address">Address</label>
              <input
                id="provider-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Address"
                autoComplete="street-address"
              />

              <label className="sr-only" htmlFor="provider-dob">Date of birth</label>
              <input
                id="provider-dob"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                aria-label="Date of birth"
              />

              <button className="go next" type="button" onClick={continueToWorkDetails}>
                Next
              </button>
            </div>
          )}

          {joinStep === "status" && selfEmployed !== "disagree" && (
            <div className="status-fields">
              <button className="step-back" type="button" onClick={() => setJoinStep("account")}>
                ← Back
              </button>
              <p className="form-kicker">Professional application</p>
              <h2>What&apos;s your professional status?</h2>

              <label htmlFor="provider-resident-status">Resident status in the UK</label>
              <select
                id="provider-resident-status"
                value={residentStatus}
                onChange={(event) => setResidentStatus(event.target.value)}
              >
                <option value="" disabled>Select your resident status</option>
                {PROVIDER_RESIDENT_STATUSES.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>

              <label htmlFor="provider-utr">UTR number <span>(optional)</span></label>
              <input
                id="provider-utr"
                value={utrNumber}
                onChange={(event) => setUtrNumber(event.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="Enter your 10-digit UTR if you have one"
                inputMode="numeric"
                autoComplete="off"
              />
              <p className="help-copy">You can continue if you do not have a UTR number yet.</p>

              <div className="employment-card">
                <h3>Partnership with Opulence Bliss</h3>
                <p>Professionals using Opulence Bliss work on a self-employed basis.</p>
                <fieldset className="employment-options">
                  <legend>Do you agree to work as self-employed?</legend>
                  <label>
                    <input type="radio" name="self-employed" checked={selfEmployed === "agree"} onChange={() => setSelfEmployed("agree")} />
                    <span aria-hidden="true" /> Agree
                  </label>
                  <label>
                    <input type="radio" name="self-employed" checked={false} onChange={() => setSelfEmployed("disagree")} />
                    <span aria-hidden="true" /> Disagree
                  </label>
                </fieldset>
              </div>

              <button className="go next" type="button" onClick={continueToWorkAreas}>
                Next
              </button>
            </div>
          )}

          {joinStep === "status" && selfEmployed === "disagree" && (
            <div className="unable-panel" role="status">
              <button className="step-back" type="button" onClick={() => setSelfEmployed("")}>
                ← Change answer
              </button>
              <div className="unable-heading">
                <span aria-hidden="true">😥</span>
                <h2>Unable to finalize partnership</h2>
              </div>
              <div className="unable-copy">
                <p>Opulence Bliss only works with self-employed professionals.</p>
                <p>To become an Opulence Bliss partner, you must want to be self-employed.</p>
                <p>If you change your mind, choose “Change answer” and select Agree.</p>
                <p>We look forward to hearing from you.</p>
              </div>
            </div>
          )}

          {joinStep === "work" && (
            <div className="work-fields">
              <button className="step-back" type="button" onClick={() => setJoinStep("status")} disabled={busy}>
                ← Back
              </button>
              <p className="form-kicker">Final step</p>
              <h2>Where would you like to work?</h2>
              <p className="section-intro">
                Choose where you would like to work. You can change your hours later in the professional portal.
              </p>

              <label>What do you offer?</label>
              <div className="checks">
                <span className="chk on">Home cleaning</span>
              </div>

              <label>Where do you work?</label>
              <div className="checks">
                {areas.length === 0 ? (
                  <span className="muted">Loading areas…</span>
                ) : (
                  areas.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className={areaIds.includes(a.id) ? "chk on" : "chk"}
                      onClick={() => setAreaIds((l) => toggle(l, a.id))}
                      title={(a.postcode_prefixes ?? []).join(", ")}
                    >
                      {a.name}
                    </button>
                  ))
                )}
              </div>

              <div className="form-actions">
                <button className="go" type="button" onClick={submit} disabled={busy || !ready}>
                  {busy ? step || "Working…" : "Create professional account"}
                </button>
              </div>
              <p className="small">
                There is no joining charge. Jobs unlock after your application is approved.
              </p>
            </div>
          )}

          {err && <p className="err">{err}</p>}
        </section>
      </div>

      <style jsx>{`
        .wrap {
          min-height: 100vh;
          min-height: 100dvh;
          overflow-x: clip;
          background: #fff;
          color: #16202A;
          font-family: "Nunito", system-ui, sans-serif;
          padding: 0 20px 70px;
        }
        .grid {
          max-width: 1040px;
          margin: 0 auto;
          padding-top: 44px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 48px;
          align-items: start;
        }
        /* Grid items default to min-width:auto, which lets a wide child
           stretch the track and push the whole page sideways. */
        .pitch,
        .form {
          min-width: 0;
        }
        .brand {
          font-family: "Nunito", system-ui, sans-serif;
          font-size: 19px;
          font-weight: 600;
          color: #16202A;
          text-decoration: none;
          display: inline-block;
          margin-bottom: 26px;
        }
        .eyebrow {
          text-transform: uppercase;
          letter-spacing: 0.14em;
          font-size: 12px;
          font-weight: 600;
          color: #6D28D9;
          margin: 0 0 8px;
        }
        h1 {
          font-family: "Nunito", system-ui, sans-serif;
          font-weight: 900;
          font-size: clamp(32px, 4.6vw, 46px);
          line-height: 1.06;
          color: #16202A;
          margin: 0 0 14px;
        }
        h2 {
          font-family: "Nunito", system-ui, sans-serif;
          font-weight: 900;
          font-size: 24px;
          color: #16202A;
          margin: 0 0 20px;
        }
        h3 {
          margin: 0 0 8px;
          color: #16202A;
          font-size: 17px;
          font-weight: 900;
        }
        .lede {
          color: #7A828C;
          font-size: 17px;
          line-height: 1.6;
          margin: 0 0 26px;
        }
        .fee {
          background: #fff;
          border: 1.5px solid #F5C542;
          border-radius: 18px;
          padding: 24px 26px;
          margin-bottom: 26px;
        }
        .fee-amount {
          font-family: "Nunito", system-ui, sans-serif;
          font-size: clamp(27px, 7vw, 34px);
          color: #16202A;
          margin: 0 0 4px;
        }
        .fee-amount span {
          font-family: "Nunito", sans-serif;
          font-size: 14px;
          color: #7A828C;
        }
        .fee-note {
          color: #7A828C;
          font-size: 14px;
          margin: 0 0 16px;
        }
        .fee ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 8px;
        }
        .fee li {
          font-size: 14.5px;
          padding-left: 22px;
          position: relative;
        }
        .fee li::before {
          content: "✿";
          position: absolute;
          left: 0;
          color: #F5C542;
          font-size: 12px;
        }
        .steps {
          list-style: none;
          padding: 0;
          margin: 0 0 22px;
          display: grid;
          gap: 12px;
        }
        .steps li {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 15px;
          color: #16202A;
        }
        .steps span {
          display: grid;
          place-items: center;
          width: 28px;
          height: 28px;
          flex-shrink: 0;
          border-radius: 50%;
          background: #F4ECFE;
          color: #16202A;
          font-family: "Nunito", system-ui, sans-serif;
          font-size: 14px;
        }
        .already {
          font-size: 14.5px;
          color: #7A828C;
        }
        .already a {
          color: #16202A;
          font-weight: 600;
        }
        .form {
          background: #fff;
          border: 1px solid #E7DCFA;
          border-top: 5px solid #6D28D9;
          border-radius: 24px;
          padding: 34px 32px;
          box-shadow: 0 20px 54px rgba(76,29,149, 0.12);
        }
        .form-kicker {
          margin: 0 0 7px;
          color: #6D28D9;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .step-back {
          width: max-content;
          margin: 0 0 24px;
          padding: 0;
          border: 0;
          background: transparent;
          color: #6D28D9;
          font: inherit;
          font-size: 13px;
          font-weight: 900;
          cursor: pointer;
        }
        .availability-card {
          padding: 22px;
          border: 1px solid #E2D5F8;
          border-radius: 18px;
          background: linear-gradient(145deg, #FFF8E7 0%, #F4ECFE 100%);
        }
        .availability-heading {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          gap: 6px 16px;
          align-items: center;
          margin-bottom: 15px;
          color: #16202A;
          font-size: 15px;
        }
        .availability-heading strong {
          white-space: nowrap;
          font-weight: 900;
        }
        input.hours-slider {
          width: 100%;
          min-height: 0;
          height: 22px;
          margin: 0;
          padding: 0;
          border: 0;
          border-radius: 999px;
          background: transparent;
          box-shadow: none;
          accent-color: #7B2FF7;
          cursor: pointer;
        }
        input.hours-slider:focus-visible {
          box-shadow: none;
          outline: 3px solid rgba(109,40,217,0.2);
          outline-offset: 5px;
        }
        .range-labels {
          display: flex;
          justify-content: space-between;
          margin-top: 1px;
          color: #7A828C;
          font-size: 11px;
          font-weight: 800;
        }
        .simulation {
          margin-top: 18px;
          padding: 18px;
          border: 1.5px solid #16202A;
          border-radius: 14px;
          background: rgba(255,255,255,0.58);
        }
        .simulation > p {
          margin: 0 0 14px;
          color: #6D28D9;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .simulation > div {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }
        .simulation span {
          display: grid;
          min-width: 0;
          gap: 3px;
          color: #535D69;
          font-size: 12px;
        }
        .simulation strong {
          color: #16202A;
          font-size: clamp(19px, 5.4vw, 24px);
          font-weight: 900;
          line-height: 1.05;
          overflow-wrap: anywhere;
        }
        .estimate-note {
          margin: 12px 0 0;
          color: #7A828C;
          font-size: 11px;
          text-align: center;
        }
        label {
          display: block;
          font-size: 13.5px;
          color: #7A828C;
          margin: 0 0 6px;
        }
        input {
          width: 100%;
          box-sizing: border-box;
          min-height: 56px;
          padding: 15px 16px;
          border: 1.5px solid #D9DDE3;
          border-radius: 13px;
          font: inherit;
          font-size: 15.5px;
          background: #fff;
          color: #16202A;
          margin-bottom: 14px;
        }
        input:focus-visible {
          outline: none;
          border-color: #6D28D9;
          box-shadow: 0 0 0 3px rgba(109,40,217, 0.09);
        }
        select {
          width: 100%;
          min-height: 56px;
          box-sizing: border-box;
          margin: 0 0 18px;
          padding: 14px 44px 14px 16px;
          border: 1.5px solid #D9DDE3;
          border-radius: 13px;
          background: #fff;
          color: #16202A;
          font: inherit;
          font-size: 15px;
        }
        select:focus-visible {
          border-color: #6D28D9;
          outline: none;
          box-shadow: 0 0 0 3px rgba(109,40,217,0.09);
        }
        input.invalid,
        input.invalid:focus-visible {
          border-color: #E5394F;
          box-shadow: 0 0 0 3px rgba(229,57,79, 0.08);
        }
        .account-fields,
        .status-fields,
        .work-fields {
          display: grid;
        }
        .help-copy {
          margin: -8px 2px 20px;
          color: #7A828C;
          font-size: 12px;
        }
        .status-fields label > span {
          color: #8C95A0;
          font-weight: 600;
        }
        .employment-card {
          margin: 2px 0 18px;
          padding: 19px;
          border: 1px solid #E2D5F8;
          border-radius: 15px;
          background: #FAF7FF;
        }
        .employment-card > p {
          margin: 0 0 16px;
          color: #68717D;
          font-size: 13.5px;
          line-height: 1.5;
        }
        .employment-options {
          position: relative;
          display: grid;
          gap: 12px;
          margin: 0;
          padding: 0;
          border: 0;
        }
        .employment-options legend {
          margin-bottom: 12px;
          color: #16202A;
          font-size: 13.5px;
          font-weight: 900;
        }
        .employment-options label {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 0;
          color: #16202A;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
        }
        .employment-options input {
          position: absolute;
          width: 1px;
          height: 1px;
          min-height: 0;
          margin: 0;
          opacity: 0;
        }
        .employment-options label > span {
          width: 22px;
          height: 22px;
          box-sizing: border-box;
          border: 1.5px solid #8E96A1;
          border-radius: 50%;
          background: #fff;
          box-shadow: inset 0 0 0 5px #fff;
        }
        .employment-options input:checked + span {
          border-color: #6D28D9;
          background: #6D28D9;
        }
        .employment-options input:focus-visible + span {
          outline: 3px solid rgba(109,40,217,0.18);
          outline-offset: 2px;
        }
        .unable-panel {
          display: grid;
          min-height: 440px;
          align-content: center;
          padding: 4px;
        }
        .unable-heading {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          margin-bottom: 20px;
        }
        .unable-heading > span {
          order: 2;
          font-size: 36px;
        }
        .unable-heading h2 {
          margin-bottom: 8px;
          font-size: clamp(29px, 4vw, 38px);
          line-height: 1.02;
        }
        .unable-copy {
          padding: 20px;
          border: 1px solid #DDD1F5;
          border-radius: 16px;
          background: linear-gradient(145deg, #FFF8E7, #F4ECFE);
        }
        .unable-copy p {
          margin: 0 0 14px;
          color: #343D48;
          font-size: 14px;
          line-height: 1.55;
        }
        .unable-copy p:last-child {
          margin-bottom: 0;
        }
        .title-options {
          position: relative;
          display: flex;
          flex-wrap: wrap;
          gap: 12px 28px;
          margin: 0 0 16px;
          padding: 0;
          border: 0;
        }
        .title-option {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          margin: 0;
          color: #16202A;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
        }
        .title-option input {
          position: absolute;
          width: 1px;
          height: 1px;
          min-height: 0;
          margin: 0;
          opacity: 0;
        }
        .title-option span {
          width: 22px;
          height: 22px;
          box-sizing: border-box;
          border: 1.5px solid #8E96A1;
          border-radius: 50%;
          background: #fff;
          box-shadow: inset 0 0 0 5px #fff;
        }
        .title-option input:checked + span {
          border-color: #6D28D9;
          background: #6D28D9;
        }
        .title-option input:focus-visible + span {
          outline: 3px solid rgba(109,40,217, 0.18);
          outline-offset: 2px;
        }
        .password-field,
        .phone-field {
          position: relative;
        }
        .password-field input {
          padding-right: 54px;
        }
        .password-field button {
          position: absolute;
          top: 9px;
          right: 9px;
          display: grid;
          width: 38px;
          height: 38px;
          place-items: center;
          border: 0;
          background: transparent;
          color: #16202A;
          cursor: pointer;
        }
        .phone-field {
          display: grid;
          grid-template-columns: auto auto minmax(0, 1fr);
          align-items: center;
          min-height: 56px;
          margin-bottom: 14px;
          padding-left: 15px;
          border: 1.5px solid #D9DDE3;
          border-radius: 13px;
          background: #fff;
        }
        .phone-field:focus-within {
          border-color: #6D28D9;
          box-shadow: 0 0 0 3px rgba(109,40,217, 0.09);
        }
        .phone-field.invalid,
        .phone-field.invalid:focus-within {
          border-color: #E5394F;
          box-shadow: 0 0 0 3px rgba(229,57,79, 0.08);
        }
        .phone-code {
          margin: 0 7px;
          color: #5F6874;
          font-size: 14px;
          font-weight: 800;
        }
        .uk-flag {
          display: block;
          width: 24px;
          height: 16px;
          overflow: hidden;
          border-radius: 2px;
          box-shadow: 0 0 0 1px rgba(22,32,42, 0.15);
        }
        .phone-field input {
          min-height: 53px;
          margin: 0;
          padding-left: 4px;
          border: 0;
          box-shadow: none;
        }
        .phone-field input:focus-visible {
          box-shadow: none;
        }
        .field-error {
          margin: -7px 2px 14px;
          color: #D82F45;
          font-size: 12.5px;
          font-weight: 700;
          line-height: 1.3;
        }
        input[type="date"] {
          /* iOS Safari gives date inputs an intrinsic width that ignores
             width:100%, which pushes them past the card edge. */
          -webkit-appearance: none;
          appearance: none;
          min-width: 0;
          max-width: 100%;
          color: #7A828C;
        }
        .section-intro {
          margin: -5px 0 22px;
          color: #68717D;
          font-size: 14px;
          line-height: 1.5;
        }
        .checks {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 18px;
        }
        .chk {
          max-width: 100%;
          background: #FFFFFF;
          border: 1.5px solid #EDEFF1;
          border-radius: 999px;
          padding: 9px 16px;
          font: inherit;
          font-size: 14px;
          color: #16202A;
          text-align: left;
          overflow-wrap: anywhere;
          cursor: pointer;
        }
        .chk:hover {
          border-color: #6D28D9;
        }
        .chk.on {
          background: #F4ECFE;
          border-color: #16202A;
          color: #16202A;
          font-weight: 600;
        }
        .go {
          width: 100%;
          background: linear-gradient(100deg,#F5C542,#C86FC9 55%,#7B2FF7);
          color: #fff;
          border: none;
          border-radius: 999px;
          padding: 14px;
          font: inherit;
          font-weight: 600;
          font-size: 16px;
          cursor: pointer;
          margin-top: 6px;
        }
        .go:hover:not(:disabled) {
          background: #4C1D95;
        }
        .go.next {
          width: auto;
          min-width: 128px;
          justify-self: center;
          padding-inline: 30px;
        }
        .go:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .small {
          font-size: 12.5px;
          color: #7A828C;
          text-align: center;
          margin: 12px 0 0;
        }
        .form-actions {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 10px;
          align-items: end;
        }
        .back {
          min-height: 50px;
          padding: 0 20px;
          border: 1.5px solid #DCCBFA;
          border-radius: 999px;
          background: #FAF7FF;
          color: #6D28D9;
          font: inherit;
          font-weight: 800;
          cursor: pointer;
        }
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        .err {
          background: #FFE6EA;
          color: #B0384F;
          padding: 12px 14px;
          border-radius: 10px;
          font-size: 14px;
          margin: 16px 0 0;
        }
        .muted {
          color: #7A828C;
          font-size: 14px;
        }
        @media (max-width: 880px) {
          .grid {
            grid-template-columns: minmax(0, 1fr);
            gap: 34px;
          }
        }
        @media (max-width: 520px) {
          .wrap {
            padding-inline: 14px;
          }
          .grid {
            padding-top: 26px;
          }
          .form {
            padding: 28px 20px;
          }
          .fee {
            padding: 22px 18px;
          }
          .form-actions {
            grid-template-columns: 1fr;
          }
          /* Drops to a single column on its own once two columns no longer
             fit the currency figures, so there is no magic breakpoint. */
          .simulation > div {
            grid-template-columns: repeat(auto-fit, minmax(128px, 1fr));
            gap: 14px;
          }
        }
        @media (max-width: 400px) {
          .form {
            padding: 24px 16px;
            border-radius: 20px;
          }
          .availability-card {
            padding: 16px;
          }
          .simulation {
            padding: 14px;
          }
          .employment-card {
            padding: 16px;
          }
          .unable-copy {
            padding: 16px;
          }
          .title-options {
            gap: 12px 20px;
          }
        }
      `}</style>
    </main>
  );
}
