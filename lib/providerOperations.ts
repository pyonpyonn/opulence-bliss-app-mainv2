export const AUTO_CHECKOUT_GRACE_MINUTES = 10;

export function providerAutoCheckoutAt(
  scheduledAt: string,
  durationMinutes: number,
) {
  return new Date(
    new Date(scheduledAt).getTime() +
      (durationMinutes + AUTO_CHECKOUT_GRACE_MINUTES) * 60_000,
  );
}

export function nextFortnightlyPayoutAt(previous: string) {
  return new Date(
    new Date(previous).getTime() + 14 * 24 * 60 * 60 * 1000,
  );
}
