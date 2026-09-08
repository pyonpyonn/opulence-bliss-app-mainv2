export type CancellationPolicyTier = "full" | "half" | "none";

export type CancellationPolicy = {
  tier: CancellationPolicyTier;
  hoursUntilBooking: number;
  refundPercent: 100 | 50 | 0;
  refundAmount: number;
  refundPence: number;
  cancellationCharge: number;
  cancellationChargePence: number;
  title: string;
  explanation: string;
};

export type CancellationPaymentAction = "release" | "capture" | "refund" | "none";

const HOUR_MS = 60 * 60 * 1000;

function pounds(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

/**
 * Customer cancellation terms. Exact boundaries are deliberate:
 * 48 hours receives a full refund; 24 hours receives a 50% refund.
 */
export function calculateCancellationPolicy(
  scheduledAt: string | Date,
  grossAmount: number,
  now: string | Date = new Date(),
): CancellationPolicy {
  const scheduledMs = new Date(scheduledAt).getTime();
  const nowMs = new Date(now).getTime();
  const hoursUntilBooking = (scheduledMs - nowMs) / HOUR_MS;
  const grossPence = Math.max(0, Math.round(Number(grossAmount || 0) * 100));

  const tier: CancellationPolicyTier =
    hoursUntilBooking >= 48
      ? "full"
      : hoursUntilBooking >= 24
        ? "half"
        : "none";
  const refundPercent = tier === "full" ? 100 : tier === "half" ? 50 : 0;
  const refundPence =
    refundPercent === 100
      ? grossPence
      : refundPercent === 50
        ? Math.round(grossPence / 2)
        : 0;
  const cancellationChargePence = grossPence - refundPence;

  const title =
    tier === "full"
      ? "Full refund"
      : tier === "half"
        ? "50% refund"
        : "No refund";
  const explanation =
    tier === "full"
      ? `This visit is at least 48 hours away. The full ${pounds(grossPence)} will be refunded or released.`
      : tier === "half"
        ? `This visit is between 24 and 48 hours away. ${pounds(refundPence)} will be refunded or released, and the cancellation charge is ${pounds(cancellationChargePence)}.`
        : `This visit is less than 24 hours away. The ${pounds(cancellationChargePence)} booking amount is non-refundable.`;

  return {
    tier,
    hoursUntilBooking,
    refundPercent,
    refundAmount: refundPence / 100,
    refundPence,
    cancellationCharge: cancellationChargePence / 100,
    cancellationChargePence,
    title,
    explanation,
  };
}

export function cancellationConfirmation(policy: CancellationPolicy) {
  return `Cancel this booking? ${policy.explanation}`;
}

export function cancellationPaymentAction(
  paymentStatus: string | null | undefined,
  policy: CancellationPolicy,
): CancellationPaymentAction {
  if (["succeeded", "partially_refunded"].includes(paymentStatus ?? "")) {
    return policy.refundPence > 0 ? "refund" : "none";
  }
  if (["authorised", "capture_failed"].includes(paymentStatus ?? "")) {
    return policy.cancellationChargePence > 0 ? "capture" : "release";
  }
  return "none";
}
