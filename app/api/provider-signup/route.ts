// Provider sign-up — creates the account, profile, provider record,
// coverage areas and default hours in one go.
// Save at: app/api/provider-signup/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isValidUkPhone, normalizeUkPhone } from "@/lib/ukPhone";
import { LEGAL_VERSION } from "@/lib/legal";
import {
  canFinalizeProviderPartnership,
  isProviderCleaningExperienceTypes,
  isProviderCleaningExperienceYears,
  isOptionalUtrNumber,
  isProviderResidentStatus,
  isStrongProviderPassword,
  isProviderTravelDistance,
  isProviderWeeklyAvailability,
  isProviderWeeklyHours,
  providerAvailabilityRows,
} from "@/lib/providerOnboarding";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const {
      fullName,
      salutation,
      firstName,
      lastName,
      email,
      password,
      phone,
      address,
      dateOfBirth,
      weeklyHours,
      residentStatus,
      utrNumber,
      selfEmployed,
      rightToWork,
      currentlySelfEmployed,
      currentSelfEmploymentDetail,
      businessName,
      cleaningExperienceYears,
      cleaningExperienceTypes,
      otherCleaningExperience,
      maxTravelDistance,
      weeklyAvailability,
      skills,
      areaIds,
      professionalAgreementAccepted,
    } = await req.json();
    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    const normalizedPhone = normalizeUkPhone(phone);

    if (
      !email ||
      !password ||
      !fullName ||
      !salutation ||
      !firstName ||
      !lastName ||
      !phone ||
      !address ||
      !dateOfBirth ||
      !residentStatus
    ) {
      return NextResponse.json(
        { error: "Complete every account field before continuing." },
        { status: 400 }
      );
    }
    if (!/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(normalizedEmail)) {
      return NextResponse.json(
        { error: "Invalid email" },
        { status: 400 }
      );
    }
    if (!["miss", "mrs", "mr"].includes(String(salutation))) {
      return NextResponse.json(
        { error: "Select Miss, Mrs or Mr." },
        { status: 400 }
      );
    }
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(String(dateOfBirth)) ||
      Number.isNaN(Date.parse(`${dateOfBirth}T00:00:00Z`)) ||
      new Date(`${dateOfBirth}T00:00:00Z`) > new Date()
    ) {
      return NextResponse.json(
        { error: "Enter a valid date of birth." },
        { status: 400 }
      );
    }
    if (!isValidUkPhone(phone)) {
      return NextResponse.json(
        { error: "Invalid phone number" },
        { status: 400 }
      );
    }
    if (!isProviderWeeklyHours(weeklyHours)) {
      return NextResponse.json(
        { error: "Weekly availability must be between 0 and 40 hours." },
        { status: 400 }
      );
    }
    if (!isProviderResidentStatus(residentStatus)) {
      return NextResponse.json(
        { error: "Select a valid resident status in the UK." },
        { status: 400 }
      );
    }
    if (!isOptionalUtrNumber(utrNumber)) {
      return NextResponse.json(
        { error: "The UTR number must contain 10 digits, or be left blank." },
        { status: 400 }
      );
    }
    if (!canFinalizeProviderPartnership(selfEmployed)) {
      return NextResponse.json(
        { error: "Opulence Bliss can only partner with self-employed professionals." },
        { status: 400 }
      );
    }
    if (typeof rightToWork !== "boolean") {
      return NextResponse.json(
        { error: "Tell us whether you currently have the right to work in the UK." },
        { status: 400 }
      );
    }
    if (!["yes", "no", "other"].includes(String(currentlySelfEmployed))) {
      return NextResponse.json(
        { error: "Tell us whether you are currently self-employed." },
        { status: 400 }
      );
    }
    if (
      currentlySelfEmployed === "other" &&
      !String(currentSelfEmploymentDetail ?? "").trim()
    ) {
      return NextResponse.json(
        { error: "Describe your current self-employment status." },
        { status: 400 }
      );
    }
    if (!String(businessName ?? "").trim()) {
      return NextResponse.json(
        { error: "Enter your trading or business name, or write Not applicable." },
        { status: 400 }
      );
    }
    if (!isProviderCleaningExperienceYears(cleaningExperienceYears)) {
      return NextResponse.json(
        { error: "Enter your years of cleaning experience." },
        { status: 400 }
      );
    }
    if (!isProviderCleaningExperienceTypes(cleaningExperienceTypes)) {
      return NextResponse.json(
        { error: "Select at least one valid type of cleaning experience." },
        { status: 400 }
      );
    }
    if (
      cleaningExperienceTypes.includes("Other") &&
      !String(otherCleaningExperience ?? "").trim()
    ) {
      return NextResponse.json(
        { error: "Describe your other cleaning experience." },
        { status: 400 }
      );
    }
    if (!isProviderTravelDistance(maxTravelDistance)) {
      return NextResponse.json(
        { error: "Select the maximum distance you can travel." },
        { status: 400 }
      );
    }
    if (!isProviderWeeklyAvailability(weeklyAvailability)) {
      return NextResponse.json(
        { error: "Choose your availability for every day and include at least one working period." },
        { status: 400 }
      );
    }
    if (
      !Array.isArray(skills) ||
      !skills.includes("cleaning") ||
      skills.some((skill) => skill !== "cleaning")
    ) {
      return NextResponse.json(
        { error: "Home cleaning is the available provider service." },
        { status: 400 }
      );
    }
    if (!Array.isArray(areaIds) || areaIds.length === 0) {
      return NextResponse.json(
        { error: "Pick at least one area you cover." },
        { status: 400 }
      );
    }
    if (!isStrongProviderPassword(password)) {
      return NextResponse.json(
        { error: "Password must have at least 8 characters, including uppercase, lowercase, a number and a symbol." },
        { status: 400 }
      );
    }
    if (professionalAgreementAccepted !== true) {
      return NextResponse.json(
        { error: "Accept the Service Professional Partner Agreement to continue." },
        { status: 400 },
      );
    }

    const { data: agreementRow } = await admin
      .from("legal_documents")
      .select("version")
      .eq("slug", "professional-partner-agreement")
      .eq("published", true)
      .maybeSingle();
    const professionalAgreementVersion =
      agreementRow?.version ?? LEGAL_VERSION;

    // 1. Create the account, already confirmed (no confirmation email).
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          salutation,
          first_name: firstName,
          last_name: lastName,
          address,
          date_of_birth: dateOfBirth,
          professional_agreement_accepted: true,
          professional_agreement_version: professionalAgreementVersion,
          professional_agreement_accepted_at: new Date().toISOString(),
        },
      });

    if (createErr || !created.user) {
      const msg = createErr?.message ?? "Could not create the account.";
      const already = /already|exists|registered/i.test(msg);
      return NextResponse.json(
        {
          error: already
            ? "An account with that email already exists — log in instead."
            : msg,
        },
        { status: 400 }
      );
    }

    const userId = created.user.id;

    // 2. Profile with the provider role.
    await admin.from("profiles").upsert(
      {
        id: userId,
        email: normalizedEmail,
        role: "provider",
        full_name: fullName,
        phone: normalizedPhone,
        address,
      },
      { onConflict: "id" }
    );

    // 3. Provider record — work access begins after the admin approves it.
    const { data: prov, error: provErr } = await admin
      .from("providers")
      .insert({
        profile_id: userId,
        services: ["cleaning"],
        display_name: fullName,
        years_experience: cleaningExperienceYears,
        vetting_status: "pending",
      })
      .select("id")
      .single();

    if (provErr || !prov) {
      return NextResponse.json(
        { error: provErr?.message ?? "Could not create the provider record." },
        { status: 500 }
      );
    }

    // 4. Private onboarding details for application review.
    const { error: onboardingErr } = await admin
      .from("provider_onboarding_details")
      .insert({
        provider_id: prov.id,
        preferred_weekly_hours: weeklyHours,
        resident_status: residentStatus,
        utr_number: utrNumber ? String(utrNumber) : null,
        self_employed_confirmed: true,
        salutation,
        date_of_birth: dateOfBirth,
        right_to_work: rightToWork,
        current_self_employment_status: currentlySelfEmployed,
        current_self_employment_detail:
          currentlySelfEmployed === "other"
            ? String(currentSelfEmploymentDetail).trim()
            : null,
        business_name: String(businessName).trim(),
        cleaning_experience_years: cleaningExperienceYears,
        cleaning_experience_types: cleaningExperienceTypes,
        other_cleaning_experience: cleaningExperienceTypes.includes("Other")
          ? String(otherCleaningExperience).trim()
          : null,
        max_travel_distance: maxTravelDistance,
        weekly_availability: weeklyAvailability,
      });

    if (onboardingErr) {
      return NextResponse.json(
        { error: onboardingErr.message || "Could not save the professional onboarding details." },
        { status: 500 }
      );
    }

    // 5. Coverage areas.
    await admin.from("provider_service_areas").insert(
      (areaIds as string[]).map((id) => ({
        provider_id: prov.id,
        service_area_id: id,
      }))
    );

    // 6. Publish the applicant's selected periods as their initial matching hours.
    await admin.from("provider_availability").insert(
      providerAvailabilityRows(weeklyAvailability).map((row) => ({
        provider_id: prov.id,
        ...row,
      }))
    );

    return NextResponse.json({ ok: true, providerId: prov.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sign-up failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
