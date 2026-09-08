export const PUBLIC_REVIEW_MIN_RATING = 4;

export type ReviewVisibility = "public" | "private";

export function isPositiveCleanerReview(rating: number) {
  return Math.round(rating) >= PUBLIC_REVIEW_MIN_RATING;
}

export function effectiveReviewVisibility(
  rating: number,
  requested: string | null | undefined,
): ReviewVisibility {
  return isPositiveCleanerReview(rating) && requested === "public"
    ? "public"
    : "private";
}

