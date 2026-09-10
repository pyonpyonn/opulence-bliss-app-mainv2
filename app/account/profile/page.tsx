"use client";

// Client profile — your details, saved for faster booking.
// Save at: app/account/profile/page.tsx

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type ReceivedReview = {
  id: string;
  rating: number;
  comment: string | null;
  visibility: "public" | "private";
  created_at: string;
  bookings:
    | {
        providers:
          | { display_name: string | null }
          | { display_name: string | null }[]
          | null;
        packages: { name: string } | { name: string }[] | null;
      }
    | {
        providers:
          | { display_name: string | null }
          | { display_name: string | null }[]
          | null;
        packages: { name: string } | { name: string }[] | null;
      }[];
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default function ClientProfilePage() {
  const [uid, setUid] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [ratingCount, setRatingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [receivedReviews, setReceivedReviews] = useState<ReceivedReview[]>([]);
  const [reviewsError, setReviewsError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUid(user.id);
      setEmail(user.email ?? "");

      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone, address, postcode, client_rating_avg, client_rating_count")
        .eq("id", user.id)
        .maybeSingle();

      setRating(data?.client_rating_avg == null ? null : Number(data.client_rating_avg));
      setRatingCount(data?.client_rating_count ?? 0);
      setName(data?.full_name ?? "");
      setPhone(data?.phone ?? "");
      setAddress(data?.address ?? "");
      setPostcode(data?.postcode ?? "");

      const { data: reviews, error: reviewError } = await supabase
        .from("reviews")
        .select(
          "id, rating, comment, visibility, created_at, bookings!inner(customer_id, providers(display_name), packages(name))",
        )
        .eq("reviewer", "provider")
        .eq("bookings.customer_id", user.id)
        .order("created_at", { ascending: false });
      setReceivedReviews((reviews ?? []) as unknown as ReceivedReview[]);
      setReviewsError(
        reviewError ? "Your reviews could not be loaded. Please refresh." : null,
      );
      setLoading(false);
    })();
  }, []);

  async function save() {
    if (!uid) return;
    setSaving(true);
    setMsg(null);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: name.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        postcode: postcode.trim().toUpperCase() || null,
      })
      .eq("id", uid);
    setMsg(error ? error.message : "Saved — we'll use these next time you book.");
    setSaving(false);
  }

  return (
    <main className="wrap">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500&family=Hanken+Grotesk:wght@400;500;600&display=swap"
      />

      <div className="inner">
        <p className="eyebrow">Your account</p>
        <h1>Your details</h1>
        <p className="lede">
          Save your address once and your bookings get quicker. Your provider only
          sees these after they accept a job.
        </p>

        {loading ? (
          <p className="muted">Loading…</p>
        ) : !uid ? (
          <div className="card center">
            <p>Log in to manage your details.</p>
            <a className="cta" href="/login">
              Go to log in
            </a>
          </div>
        ) : (
          <>
            <div className="card" aria-label="Customer rating"><strong>{rating === null || ratingCount === 0 ? "Not yet rated" : `★ ${rating.toFixed(1)} / 5`}</strong><p>{ratingCount} cleaner review{ratingCount === 1 ? "" : "s"}</p></div>
            <div className="card">
              <label>Email</label>
              <input value={email} disabled />

              <label>Full name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Morgan"
              />

              <label>Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07700 900000"
              />

              <label>Address</label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                placeholder="Flat 4, 12 Elm Gardens, London"
              />

              <label>Postcode</label>
              <input
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                placeholder="SW3 1AA"
                style={{ textTransform: "uppercase" }}
              />
            </div>

            <button className="cta" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save details"}
            </button>
            {msg && <p className="msg">{msg}</p>}

            <section className="card received" aria-labelledby="received-reviews-title">
              <div className="review-heading">
                <div>
                  <p className="review-eyebrow">Reviews you received</p>
                  <h2 id="received-reviews-title">Professional feedback</h2>
                </div>
                <span className="review-count">{receivedReviews.length}</span>
              </div>
              <p className="review-help">
                Public feedback can be seen by everyone. Private feedback is
                visible here only to you.
              </p>
              {reviewsError ? (
                <p className="review-error">{reviewsError}</p>
              ) : receivedReviews.length === 0 ? (
                <p className="review-empty">No professional feedback yet.</p>
              ) : (
                <div className="review-list">
                  {receivedReviews.map((review) => {
                    const booking = one(review.bookings);
                    const provider = one(booking?.providers);
                    const service = one(booking?.packages);
                    return (
                      <article className="review" key={review.id}>
                        <div className="review-top">
                          <span className="stars">
                            {"★".repeat(review.rating)}
                            {"☆".repeat(5 - review.rating)}
                          </span>
                          <span className={`visibility ${review.visibility}`}>
                            {review.visibility === "public" ? "Public" : "Private"}
                          </span>
                        </div>
                        <strong className="reviewer">
                          {provider?.display_name ?? "Your professional"}
                          {service?.name ? ` · ${service.name}` : ""}
                        </strong>
                        <p className={review.comment ? "review-comment" : "review-comment muted"}>
                          {review.comment || "Rating submitted without a comment."}
                        </p>
                        <time dateTime={review.created_at}>
                          {new Date(review.created_at).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </time>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        <p className="links">
          <a href="/account">← My bookings</a>
          <a href="/book">Book a service</a>
        </p>
      </div>

      <style jsx>{`
        .wrap {
          min-height: 100vh;
          background: transparent;
          color: var(--ob-text);
          font-family: "Hanken Grotesk", system-ui, sans-serif;
          padding: 0 20px 80px;
        }
        .inner {
          max-width: 560px;
          margin: 0 auto;
          padding-top: 40px;
        }
        .eyebrow {
          text-transform: uppercase;
          letter-spacing: 0.14em;
          font-size: 12px;
          font-weight: 600;
          color: var(--ob-purple);
          margin: 0 0 6px;
        }
        h1 {
          font-family: "Fraunces", serif;
          font-weight: 500;
          font-size: 36px;
          color: var(--ob-text);
          margin: 0 0 8px;
        }
        .lede {
          color: var(--ob-muted);
          margin: 0 0 26px;
        }
        .card {
          background: var(--ob-surface-raised);
          border: 1px solid var(--ob-border);
          border-radius: 16px;
          padding: 24px 22px;
          margin-bottom: 20px;
        }
        .card.center {
          text-align: center;
        }
        .received {
          margin-top: 22px;
        }
        .review-heading,
        .review-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .review-eyebrow {
          margin: 0 0 3px;
          color: var(--ob-purple);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        h2 {
          margin: 0;
          font-family: "Fraunces", serif;
          font-size: 22px;
          font-weight: 500;
        }
        .review-count {
          display: grid;
          place-items: center;
          min-width: 34px;
          height: 34px;
          border-radius: 999px;
          background: var(--ob-purple-soft);
          color: var(--ob-purple);
          font-weight: 800;
        }
        .review-help {
          margin: 9px 0 18px;
          color: var(--ob-muted);
          font-size: 13.5px;
          line-height: 1.5;
        }
        .review-list {
          display: grid;
          gap: 10px;
        }
        .review {
          padding: 14px;
          border: 1px solid var(--ob-border);
          border-radius: 12px;
          background: var(--ob-surface-soft);
        }
        .stars {
          color: var(--ob-purple);
          letter-spacing: 1px;
        }
        .visibility {
          border-radius: 999px;
          padding: 4px 9px;
          font-size: 11px;
          font-weight: 800;
        }
        .visibility.public {
          background: #e4f6ec;
          color: #137b4e;
        }
        .visibility.private {
          background: var(--ob-purple-soft);
          color: var(--ob-purple);
        }
        .reviewer {
          display: block;
          margin-top: 9px;
          color: var(--ob-text);
          font-size: 13px;
        }
        .review-comment {
          margin: 5px 0;
          color: var(--ob-text);
          font-size: 14px;
          line-height: 1.45;
        }
        .review time {
          color: var(--ob-muted);
          font-size: 11.5px;
        }
        .review-empty,
        .review-error {
          margin: 0;
          padding: 14px;
          border-radius: 11px;
          background: var(--ob-surface-soft);
          color: var(--ob-muted);
          font-size: 13.5px;
        }
        .review-error {
          color: #b0384f;
        }
        label {
          display: block;
          font-size: 13.5px;
          color: var(--ob-muted);
          margin: 0 0 6px;
        }
        input,
        textarea {
          width: 100%;
          box-sizing: border-box;
          padding: 12px 14px;
          border: 1.5px solid var(--ob-border);
          border-radius: 12px;
          font: inherit;
          font-size: 15.5px;
          background: var(--ob-surface-soft);
          color: var(--ob-text);
          margin-bottom: 18px;
          resize: vertical;
        }
        input:disabled {
          background: var(--ob-surface-soft);
          color: var(--ob-muted);
        }
        input:focus-visible,
        textarea:focus-visible {
          outline: none;
          border-color: #2f4a3a;
        }
        .cta {
          background: #2f4a3a;
          color: #fbf7f0;
          border: none;
          border-radius: 999px;
          padding: 13px 26px;
          font: inherit;
          font-weight: 600;
          font-size: 15px;
          cursor: pointer;
          text-decoration: none;
          display: inline-block;
        }
        .cta:disabled {
          opacity: 0.65;
          cursor: wait;
        }
        .msg {
          background: var(--ob-mint);
          color: var(--ob-success-text);
          padding: 12px 14px;
          border-radius: 10px;
          font-size: 14.5px;
          margin: 16px 0 0;
        }
        .muted {
          color: var(--ob-muted);
        }
        .links {
          display: flex;
          gap: 18px;
          margin-top: 30px;
        }
        .links a {
          color: var(--ob-purple);
          font-size: 14px;
          text-decoration: none;
        }
      `}</style>
    </main>
  );
}
