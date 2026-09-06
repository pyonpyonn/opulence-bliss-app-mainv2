import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { automaticallyCompleteBooking } from "@/lib/automaticBookingCompletion";
import {
  AUTO_CHECKOUT_GRACE_MINUTES,
  nextFortnightlyPayoutAt,
  providerAutoCheckoutAt,
} from "@/lib/providerOperations";

export const maxDuration = 60;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const secret = process.env.CRON_SECRET;
  if (!secret || (key !== secret && bearer !== secret)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }
  const dry = req.nextUrl.searchParams.get("dry") === "1";
  const now = Date.now();
  const completed: string[] = [];
  const failed: string[] = [];

  const { data: running, error: runningError } = await admin
    .from("bookings")
    .select("id, scheduled_at, duration_minutes, packages(duration_minutes), check_ins(arrived_at, left_at)")
    .eq("status", "in_progress")
    .limit(200);
  if (runningError) return NextResponse.json({ error: runningError.message }, { status: 500 });

  for (const booking of running ?? []) {
    const pkg = one(booking.packages as { duration_minutes: number | null } | { duration_minutes: number | null }[] | null);
    const checkIn = one(booking.check_ins as { arrived_at: string | null; left_at: string | null } | { arrived_at: string | null; left_at: string | null }[] | null);
    if (!checkIn?.arrived_at || checkIn.left_at) continue;
    const minutes = booking.duration_minutes ?? pkg?.duration_minutes ?? 120;
    const autoCheckoutAt = providerAutoCheckoutAt(booking.scheduled_at, minutes).getTime();
    if (now < autoCheckoutAt) continue;
    completed.push(booking.id);
    if (!dry) {
      try { await automaticallyCompleteBooking(booking.id); }
      catch (error) { failed.push(`${booking.id}: ${error instanceof Error ? error.message : "failed"}`); }
    }
  }

  const fortnightly: string[] = [];
  if (!dry) {
    const { data: providers } = await admin
      .from("providers")
      .select("id, stripe_account_id, next_payout_at")
      .eq("payout_schedule", "fortnightly")
      .eq("is_suspended", false)
      .lte("next_payout_at", new Date(now).toISOString())
      .limit(100);

    for (const provider of providers ?? []) {
      const scheduledFor = provider.next_payout_at;
      if (!scheduledFor || !provider.stripe_account_id) continue;
      try {
        const balance = await stripe.balance.retrieve({}, { stripeAccount: provider.stripe_account_id });
        const amount = balance.available.filter((item) => item.currency === "gbp").reduce((sum, item) => sum + item.amount, 0);
        let payoutId: string | null = null;
        if (amount > 0) {
          const payout = await stripe.payouts.create(
            { amount, currency: "gbp", metadata: { provider_id: provider.id, schedule: "fortnightly" } },
            { stripeAccount: provider.stripe_account_id, idempotencyKey: `fortnightly:${provider.id}:${scheduledFor}` },
          );
          payoutId = payout.id;
        }
        await admin.from("provider_payout_runs").upsert({
          provider_id: provider.id,
          scheduled_for: scheduledFor,
          amount: amount / 100,
          currency: "GBP",
          stripe_payout_ref: payoutId,
          status: amount > 0 ? "paid" : "empty",
          note: amount > 0 ? null : "No available GBP balance at this payout run.",
        }, { onConflict: "provider_id,scheduled_for" });
        await admin.from("providers").update({ next_payout_at: nextFortnightlyPayoutAt(scheduledFor).toISOString() }).eq("id", provider.id);
        fortnightly.push(provider.id);
      } catch (error) {
        failed.push(`${provider.id}: ${error instanceof Error ? error.message : "payout failed"}`);
      }
    }
  }

  return NextResponse.json({
    ok: failed.length === 0,
    mode: dry ? "dry-run" : "applied",
    auto_checkout_grace_minutes: AUTO_CHECKOUT_GRACE_MINUTES,
    eligible_auto_checkouts: completed,
    fortnightly_payouts: fortnightly,
    failed,
  }, { status: failed.length ? 207 : 200 });
}
