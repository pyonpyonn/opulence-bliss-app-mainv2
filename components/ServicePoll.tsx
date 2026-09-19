"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { COMING_SOON, type ComingSoonKey } from "@/lib/comingSoon";
import styles from "./ServicePoll.module.css";

type Props = {
  /** The dropdown only loads the saved vote once opened. */
  enabled?: boolean;
  /** "compact" for the header dropdown, "page" for /coming-soon. */
  variant?: "compact" | "page";
};

export default function ServicePoll({
  enabled = true,
  variant = "compact",
}: Props) {
  const [selected, setSelected] = useState<ComingSoonKey | null>(null);
  const [suggestion, setSuggestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!enabled || loaded) return;
    let active = true;

    async function loadVote() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;
      if (!user) {
        setSignedOut(true);
        setLoaded(true);
        return;
      }

      const { data } = await supabase.rpc("my_customer_service_interest");
      if (!active) return;
      const vote = Array.isArray(data) ? data[0] : null;
      // A key retired from the poll would not match any radio; ignore it
      // rather than leaving the form in an unselectable state.
      if (
        vote?.service_key &&
        COMING_SOON.some((s) => s.key === vote.service_key)
      ) {
        setSelected(vote.service_key as ComingSoonKey);
      }
      if (vote?.suggestion) setSuggestion(vote.suggestion);
      setLoaded(true);
    }

    void loadVote();
    return () => {
      active = false;
    };
  }, [enabled, loaded]);

  async function submitVote() {
    if (!selected) {
      setMessage("Choose the service you would most like us to add.");
      return;
    }

    setLoading(true);
    setMessage(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSignedOut(true);
      setMessage("Sign in to save your vote.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.rpc("submit_customer_service_interest", {
      p_service_key: selected,
      p_suggestion: suggestion.trim() || null,
    });

    setLoading(false);
    if (error) {
      setSaved(false);
      setMessage(error.message);
      return;
    }

    setSignedOut(false);
    setSaved(true);
    setMessage("Thanks, your vote has been saved.");
  }

  return (
    <div className={`${styles.poll} ${styles[variant]}`}>
      <div className={styles.heading}>
        <span className={styles.eyebrow}>Help shape what comes next</span>
        <p className={styles.title}>
          Which of these services would you like us to add?
        </p>
        <p className={styles.sub}>
          Pick one, and add an idea of your own if you have one.
        </p>
      </div>

      <div className={styles.formPanel}>
        <fieldset className={styles.options}>
          <legend className={styles.srOnly}>Choose a future service</legend>
          {COMING_SOON.map(({ key, title, detail }) => {
            const checked = selected === key;
            return (
              <label
                className={`${styles.option} ${checked ? styles.optionOn : ""}`}
                key={key}
              >
                <input
                  type="radio"
                  name={`future-service-${variant}`}
                  value={key}
                  checked={checked}
                  onChange={() => {
                    setSelected(key);
                    setMessage(null);
                    setSaved(false);
                  }}
                />
                <span className={styles.copy}>
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </span>
                <span className={styles.radio} aria-hidden="true">
                  {checked && <Check size={14} strokeWidth={3} />}
                </span>
              </label>
            );
          })}
        </fieldset>

        <label className={styles.suggestionLabel}>
          Suggest something else <span>(optional)</span>
          <textarea
            rows={2}
            maxLength={500}
            value={suggestion}
            onChange={(event) => setSuggestion(event.target.value)}
            placeholder="What other service would make life easier?"
          />
        </label>

        {message && (
          <p
            className={saved ? styles.success : styles.error}
            role="status"
            aria-live="polite"
          >
            {saved && <Check size={15} />}
            {message}
          </p>
        )}

        {signedOut ? (
        <Link className={styles.submit} href="/login">
          Sign in to vote
        </Link>
        ) : (
          <button
            className={styles.submit}
            type="button"
            disabled={loading || !selected}
            onClick={() => void submitVote()}
          >
            {loading ? "Saving…" : "Submit my vote"}
          </button>
        )}
      </div>
    </div>
  );
}
