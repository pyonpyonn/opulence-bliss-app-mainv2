// SETUP: mkdir -p "app/api/client-signup" && code "app/api/client-signup/route.ts"
//
// Create a customer account AND their profile in one go, from inside the
// booking flow. No confirmation email — they're mid-purchase.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { LEGAL_VERSION } from "@/lib/legal";
import { isValidUkPhone, normalizeUkPhone } from "@/lib/ukPhone";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { fullName, salutation, firstName, lastName, email, password, phone, address, postcode, consentAccepted, requireEmailConfirmation } =
      await req.json();

    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    const normalizedPhone = normalizeUkPhone(phone);

    if (!fullName || !email || !password) {
      return NextResponse.json(
        { error: "Please fill in your name, email and a password." },
        { status: 400 }
      );
    }
    if (!/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    if (phone && !isValidUkPhone(phone)) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }
    if (String(password).length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    const userMetadata = {
      salutation: salutation || null,
      first_name: firstName || null,
      last_name: lastName || null,
      address: address || null,
      ...(consentAccepted === true
        ? {
            legal_accepted: true,
            legal_version: LEGAL_VERSION,
            legal_accepted_at: new Date().toISOString(),
          }
        : {}),
    };
    const credentials = { email: normalizedEmail, password: String(password) };
    const { data: created, error } = requireEmailConfirmation === true
      ? await admin.auth.signUp({ ...credentials, options: { data: userMetadata } })
      : await admin.auth.admin.createUser({ ...credentials, email_confirm: true, user_metadata: userMetadata });

    if (error || !created.user) {
      const msg = error?.message ?? "Could not create your account.";
      const exists = /already|exists|registered/i.test(msg);
      return NextResponse.json(
        {
          error: exists
            ? "There's already an account with that email — sign in instead."
            : msg,
          exists,
        },
        { status: 400 }
      );
    }

    // Profile, filled in properly from the start.
    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: created.user.id,
        email: normalizedEmail,
        role: "customer",
        full_name: String(fullName).trim(),
        phone: phone ? normalizedPhone : null,
        address: address ? String(address).trim() : null,
        postcode: postcode ? String(postcode).trim().toUpperCase() : null,
      },
      { onConflict: "id" }
    );

    if (profileError) throw profileError;
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sign-up failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
