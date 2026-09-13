// Provider sign-up — creates the account, profile, provider record,
// coverage areas and default hours in one go.
// Save at: app/api/provider-signup/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isValidUkPhone, normalizeUkPhone } from "@/lib/ukPhone";

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
      skills,
      areaIds,
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
      !dateOfBirth
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
    if (!isValidUkPhone(phone)) {
      return NextResponse.json(
        { error: "Invalid phone number" },
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
    if (String(password).length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

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

    // 4. Coverage areas.
    await admin.from("provider_service_areas").insert(
      (areaIds as string[]).map((id) => ({
        provider_id: prov.id,
        service_area_id: id,
      }))
    );

    // 5. Default hours: Mon–Fri, 09:00–17:00 (they can change these later).
    await admin.from("provider_availability").insert(
      [1, 2, 3, 4, 5].map((weekday) => ({
        provider_id: prov.id,
        weekday,
        start_time: "09:00",
        end_time: "17:00",
      }))
    );

    return NextResponse.json({ ok: true, providerId: prov.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sign-up failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
