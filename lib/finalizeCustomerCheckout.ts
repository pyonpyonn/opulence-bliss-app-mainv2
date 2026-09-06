import "server-only";
import type Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { isCleaning, validCleaningDuration, validPropertySize } from "@/lib/cleaningBooking";
import { appointmentFitsWindow, APPOINTMENT_WINDOW_MESSAGE } from "@/lib/appointmentWindow";
import { rotateBookingOffer } from "@/lib/offerRotation";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/** Used by both the browser return and the verified Stripe webhook. */
export async function finalizeCustomerCheckout(session: Stripe.Checkout.Session, pi: Stripe.PaymentIntent) {
  const customerId = session.client_reference_id;
  if (!customerId || pi.metadata.customer_id !== customerId || pi.metadata.kind !== "booking" ||
      !["requires_capture", "succeeded"].includes(pi.status)) throw new Error("Invalid customer checkout.");
  const { data: customer, error: customerError } = await admin.from("profiles").select("email, role").eq("id", customerId).single();
  if (customerError || customer?.role !== "customer") throw new Error("Customer account not found.");
      const m = pi.metadata ?? {};
      const packageId = m.package_id || null;
      const postcode = m.postcode || null;
      const request = m.request || null;
      const slot = m.slot || null;

      const { data: pkgRow } = await admin
        .from("packages")
        .select("service_type, duration_minutes")
        .eq("id", packageId ?? "")
        .maybeSingle();
      const serviceType = pkgRow?.service_type ?? null;
      const minutes = Number(m.duration_minutes);
      const size = m.property_size_sqm ? Number(m.property_size_sqm) : null;
      if (isCleaning(serviceType) && (!validCleaningDuration(minutes) || size === null || !validPropertySize(size))) {
        throw new Error("Invalid cleaning duration or property size.");
      }
      if (!slot || !appointmentFitsWindow(slot, minutes)) {
        throw new Error(APPOINTMENT_WINDOW_MESSAGE);
      }
      const compact = (postcode ?? "").toUpperCase().replace(/\s+/g, "");
      const district = compact.length > 4 ? compact.slice(0, compact.length - 3) : compact;

      const { data: allAreas } = await admin
        .from("service_areas")
        .select("id, postcode_prefixes")
        .eq("active", true);
      const areaIds = (allAreas ?? [])
        .filter((a) => (a.postcode_prefixes ?? []).includes(district))
        .map((a) => a.id);

      let candidateIds: string[] = [];
      if (areaIds.length) {
        const { data: links } = await admin
          .from("provider_service_areas")
          .select("provider_id")
          .in("service_area_id", areaIds);
        candidateIds = [...new Set((links ?? []).map((link) => link.provider_id))];
      }

      let matched: { id: string; profile_id: string }[] = [];
      if (candidateIds.length) {
        let query = admin
          .from("providers")
          .select("id, profile_id")
          .in("id", candidateIds)
          .eq("vetting_status", "approved")
          .eq("joining_fee_paid", true);
        if (serviceType) query = query.contains("services", [serviceType]);
        const { data } = await query;
        matched = data ?? [];
      }

      // The database locks the checkout reference and creates booking + payment
      // together, so refreshes and retries cannot create duplicate visits.
      const { data: bookingId, error: bookingError } = await admin.rpc("finalize_customer_checkout", {
        p_customer_id: customerId,
        p_session_id: session.id,
        p_payment_ref: pi.id,
        p_package_id: packageId,
        p_postcode: postcode,
        p_request: request,
        p_slot: slot,
        p_duration_minutes: minutes,
        p_property_size_sqm: size,
        p_preferred_provider_id: m.preferred_provider_id || null,
        p_amount: pi.amount / 100,
        p_platform: (pi.application_fee_amount ?? 0) / 100,
        p_email: customer?.email ?? null,
        p_payment_status: pi.status === "succeeded" ? "succeeded" : "authorised",
      });
      if (bookingError || !bookingId) throw bookingError ?? new Error("Booking insert failed");

      const preferred = m.preferred_provider_id;
      matched.sort((a, b) => Number(b.id === preferred) - Number(a.id === preferred));
      const { error: queueError } = await admin.rpc("system_initialize_booking_offer_queue", {
        p_booking_id: bookingId, p_provider_ids: matched.map((provider) => provider.id),
      });
      if (queueError) throw queueError;
      await rotateBookingOffer(admin, bookingId);
  return bookingId;
}
