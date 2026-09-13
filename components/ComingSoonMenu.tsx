"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import styles from "./ComingSoonMenu.module.css";

const OPTIONS = [
  {
    key: "moving_support",
    title: "House movers",
    detail: "Moving support, packing, unpacking and organising.",
  },
  {
    key: "maintenance",
    title: "Maintenance",
    detail:
      "Handyman and renovation add-ons, painting, small carpentry and furniture assembly.",
  },
] as const;

type ServiceKey = (typeof OPTIONS)[number]["key"];

export default function ComingSoonMenu() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ServiceKey | null>(null);
  const [suggestion, setSuggestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open || loaded) return;
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
      if (vote?.service_key) setSelected(vote.service_key as ServiceKey);
      if (vote?.suggestion) setSuggestion(vote.suggestion);
      setLoaded(true);
    }

    void loadVote();
    return () => {
      active = false;
    };
  }, [loaded, open]);

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
      setMessage("Sign in as a client to save your vote.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.rpc("submit_customer_service_interest", {
      p_service_key: selected,
      p_suggestion: suggestion.trim() || null,
    });

    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }

    setSignedOut(false);
    setMessage("Thanks — your vote has been saved.");
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger
        className={styles.trigger}
        aria-label="Open coming soon service poll"
      >
        Coming soon
        <ChevronDown
          size={16}
          className={open ? styles.chevronOpen : styles.chevron}
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        sideOffset={8}
        collisionPadding={12}
        style={{ zIndex: 10050 }}
        className={styles.menu}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <div className={styles.heading}>
          <span className={styles.eyebrow}>Help shape what comes next</span>
          <h2>Which service would you like us to add?</h2>
          <p>Choose one, then share an idea of your own if you have one.</p>
        </div>

        <div className={styles.form}>
          <fieldset className={styles.options}>
            <legend className={styles.srOnly}>Choose a future service</legend>
            {OPTIONS.map(({ key, title, detail }) => {
              const checked = selected === key;
              return (
                <label
                  className={`${styles.option} ${checked ? styles.optionSelected : ""}`}
                  key={key}
                >
                  <input
                    type="radio"
                    name="future-service"
                    value={key}
                    checked={checked}
                    onChange={() => {
                      setSelected(key);
                      setMessage(null);
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
              className={
                message.startsWith("Thanks")
                  ? styles.success
                  : styles.formMessage
              }
              role="status"
            >
              {message.startsWith("Thanks") && <Check size={15} />}
              {message}
            </p>
          )}

          {signedOut ? (
            <Link className={styles.submit} href="/login">
              Sign in as a client to vote
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
