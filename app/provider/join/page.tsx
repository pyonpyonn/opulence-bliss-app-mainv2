"use client";

// Become a provider — sign up, then complete the approval process.
// Save at: app/provider/join/page.tsx  →  localhost:3000/provider/join

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Area = { id: string; name: string; postcode_prefixes: string[] };

export default function ProviderJoinPage() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [accountStep, setAccountStep] = useState<1 | 2>(1);
  const [salutation, setSalutation] = useState<"ms_mrs" | "mr" | "">("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
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
  const accountReady = Boolean(
    salutation &&
      firstName.trim() &&
      lastName.trim() &&
      email.trim() &&
      password.length >= 6 &&
      phone.trim() &&
      address.trim() &&
      dateOfBirth,
  );

  function continueToWorkDetails() {
    if (!accountReady) {
      setErr("Complete every account field. Your password must have at least 6 characters.");
      return;
    }
    setErr(null);
    setAccountStep(2);
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

  const ready = accountReady && skills.length && areaIds.length;

  return (
    <main className="wrap">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap"
      />

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

        {/* ---- The form ---- */}
        <section className="form">
          <h2>Create your provider account</h2>

          {accountStep === 1 ? (
            <div className="account-fields">
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
                placeholder="Email"
                autoComplete="email"
              />

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

              <div className="phone-field">
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
                  placeholder="Phone"
                  autoComplete="tel"
                />
              </div>

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
          ) : (
            <div className="work-fields">
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
                <button className="back" type="button" onClick={() => setAccountStep(1)} disabled={busy}>
                  Back
                </button>
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
          grid-template-columns: 1fr 1fr;
          gap: 48px;
          align-items: start;
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
          font-size: 34px;
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
        .account-fields,
        .work-fields {
          display: grid;
        }
        .title-options {
          display: flex;
          gap: 28px;
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
        input[type="date"] {
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
          background: #FFFFFF;
          border: 1.5px solid #EDEFF1;
          border-radius: 999px;
          padding: 9px 16px;
          font: inherit;
          font-size: 14px;
          color: #16202A;
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
            grid-template-columns: 1fr;
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
          .form-actions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
