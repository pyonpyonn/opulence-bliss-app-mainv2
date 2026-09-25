export type BookingFrequency = "one_time" | "weekly" | "monthly";

/** A regular price must never be used for a single-visit checkout. */
export function bookingPolicyError(packageName: string, frequency: string): string | null {
  if (!["one_time", "weekly", "monthly"].includes(frequency)) {
    return "Choose a valid cleaning frequency.";
  }

  if (frequency !== "one_time") {
    return "Regular cleaning requires at least six visits booked together. Six-visit checkout is not available yet; please book a one-time visit for now.";
  }

  if (packageName === "Essential Clean") {
    return "Essential Clean at £18.90 per hour is for bookings of at least six visits. For one visit, choose One-Time Essential Clean.";
  }

  return null;
}
