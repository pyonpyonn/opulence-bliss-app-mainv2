import AdminNav from "../AdminNav";
import ReviewList from "../ReviewList";
import { requireAdminPage } from "@/lib/adminSession";
import { loadAdminReviews } from "@/lib/adminReviews";

export default async function AdminReviewsPage() {
  const { supabase, user } = await requireAdminPage();
  const { reviews, error } = await loadAdminReviews(supabase, 100);

  return (
    <main style={page}>
      <AdminNav email={user.email ?? "Admin"} />
      <div style={inner}>
        <p style={eyebrow}>App activity</p>
        <h1 style={title}>All recent reviews</h1>
        <p style={lede}>
          Cleaner and client reviews, newest first. Select a review to open the
          reviewer&apos;s profile, or use the reviewed-profile link to inspect the
          recipient.
        </p>

        <section style={card} aria-label="Recent app reviews">
          {error ? (
            <p style={errorBox}>{error}</p>
          ) : (
            <ReviewList reviews={reviews} />
          )}
        </section>
      </div>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  paddingBottom: 80,
  background: "#f7f8fa",
  color: "#16202a",
  fontFamily: "'Nunito', system-ui, sans-serif",
};
const inner: React.CSSProperties = { maxWidth: 1050, margin: "0 auto", padding: "0 20px" };
const eyebrow: React.CSSProperties = { margin: "0 0 5px", color: "#6d28d9", fontSize: 11, fontWeight: 900, letterSpacing: "0.13em", textTransform: "uppercase" };
const title: React.CSSProperties = { margin: "0 0 6px", fontSize: 34, fontWeight: 900 };
const lede: React.CSSProperties = { maxWidth: 720, margin: "0 0 24px", color: "#68717d", fontSize: 14.5, lineHeight: 1.55 };
const card: React.CSSProperties = { padding: "6px 20px", border: "1px solid #e5e7eb", borderRadius: 16, background: "#fff" };
const errorBox: React.CSSProperties = { margin: "14px 0", padding: 14, borderRadius: 12, background: "#fff1f3", color: "#a52e47" };
