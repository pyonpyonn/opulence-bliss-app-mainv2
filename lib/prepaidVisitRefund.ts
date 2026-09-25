import "server-only";

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import {
  claimMoneyOperation,
  systemFinaliseMoneyOperation,
  systemTransitionPayment,
} from "@/lib/bookingState";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/** Refund only this visit's allocation from the shared upfront charge. */
export async function refundUnfilledPrepaidVisit(bookingId: string) {
  const { data: booking } = await admin.from("bookings")
    .select("regular_series_id, status").eq("id", bookingId).single();
  if (!booking?.regular_series_id || booking.status !== "cancelled") {
    throw new Error("Only an unfilled, cancelled regular visit can be refunded here.");
  }
  const { data: payment, error } = await admin.from("payments")
    .select("id, stripe_payment_ref, status, gross_amount")
    .eq("booking_id", bookingId)
    .or("kind.is.null,kind.neq.tip")
    .limit(1)
    .single();
  if (error || !payment?.stripe_payment_ref) throw new Error("Prepaid visit payment is missing.");
  if (payment.status === "refunded") return true;
  const amountPence = Math.round(Number(payment.gross_amount) * 100);
  if (!Number.isInteger(amountPence) || amountPence <= 0) throw new Error("Invalid prepaid visit amount.");

  const operationKey = `refund:booking:${bookingId}:unfilled`;
  if (payment.status === "succeeded") {
    await systemTransitionPayment(admin, payment.id, "refund_pending", {
      reason: "No professional could be found for this prepaid visit",
    });
  } else if (payment.status !== "refund_pending") {
    throw new Error(`Cannot refund prepaid payment in ${payment.status} state.`);
  }
  const operation = await claimMoneyOperation(admin, {
    operationKey, operationType: "refund", bookingId, amount: amountPence / 100,
  });
  if (operation.status === "succeeded") {
    await systemTransitionPayment(admin, payment.id, "refunded");
    return true;
  }
  if (!operation.should_run) throw new Error("Refund outcome requires reconciliation.");
  try {
    const refund = await stripe.refunds.create({
      payment_intent: payment.stripe_payment_ref,
      amount: amountPence,
      metadata: { operation_key: operationKey, booking_id: bookingId, reason: "unfilled_visit" },
    }, { idempotencyKey: operationKey });
    if (refund.status !== "succeeded") {
      if (refund.status === "failed" || refund.status === "canceled") {
        await systemFinaliseMoneyOperation(admin, operation.id, "failed", { error: `Stripe refund ${refund.status}` });
        await systemTransitionPayment(admin, payment.id, "succeeded", { reason: `Stripe refund ${refund.status}` });
      } else {
        await systemFinaliseMoneyOperation(admin, operation.id, "ambiguous", {
          stripeObjectId: refund.id, error: `Stripe refund ${refund.status}`,
        });
      }
      throw new Error(`Stripe refund ${refund.status}; review required.`);
    }
    await systemFinaliseMoneyOperation(admin, operation.id, "succeeded", { stripeObjectId: refund.id });
    await systemTransitionPayment(admin, payment.id, "refunded");
    return true;
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : "Unfilled visit refund failed";
    const definite = cause instanceof Stripe.errors.StripeInvalidRequestError;
    await systemFinaliseMoneyOperation(admin, operation.id, definite ? "failed" : "ambiguous", { error: reason }).catch(() => undefined);
    await admin.rpc("open_review_case", {
      p_booking_id: bookingId,
      p_category: "payment_failure",
      p_priority: "high",
      p_blocks_payment: true,
      p_blocks_payout: true,
      p_notes: reason,
      p_created_by: null,
    });
    throw cause;
  }
}
