// SETUP: mkdir -p "app/api/client-signup" && code "app/api/client-signup/route.ts"
//
// Create a customer account and profile. Standalone registration sends a
// confirmation email; booking-flow accounts are confirmed immediately.

import { NextRequest, NextResponse } from "next/server";
import { createClient, type User } from "@supabase/supabase-js";
import { LEGAL_VERSION } from "@/lib/legal";
import { isValidUkPhone, normalizeUkPhone } from "@/lib/ukPhone";
import { sendEmail } from "@/lib/email";

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
    const confirmationRequired = requireEmailConfirmation === true;
    let createdUser: User | null = null;
    let confirmationTokenHash: string | null = null;
    let creationError: string | null = null;

    if (confirmationRequired) {
      const { data, error } = await admin.auth.admin.generateLink({
          type: "signup",
          ...credentials,
          options: { data: userMetadata },
        });
      createdUser = data.user;
      confirmationTokenHash = data.properties?.hashed_token ?? null;
      creationError = error?.message ?? null;
    } else {
      const { data, error } = await admin.auth.admin.createUser({
          ...credentials,
          email_confirm: true,
          user_metadata: userMetadata,
        });
      createdUser = data.user;
      creationError = error?.message ?? null;
    }

    if (creationError || !createdUser) {
      const msg = creationError ?? "Could not create your account.";
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
        id: createdUser.id,
        email: normalizedEmail,
        role: "customer",
        full_name: String(fullName).trim(),
        phone: phone ? normalizedPhone : null,
        address: address ? String(address).trim() : null,
        postcode: postcode ? String(postcode).trim().toUpperCase() : null,
      },
      { onConflict: "id" }
    );

    if (profileError) {
      await admin.auth.admin.deleteUser(createdUser.id);
      throw profileError;
    }

    if (confirmationRequired) {
      if (!confirmationTokenHash) {
        await admin.auth.admin.deleteUser(createdUser.id);
        return NextResponse.json(
          { error: "Could not create your confirmation link. Please try again." },
          { status: 503 },
        );
      }

      const origin = new URL(req.url).origin;
      const confirmationUrl = `${origin}/auth/confirm?token_hash=${encodeURIComponent(confirmationTokenHash)}&type=signup&next=${encodeURIComponent("/login")}`;
      const delivery = await sendEmail({
        to: normalizedEmail,
        subject: "Confirm your Opulence Bliss account",
        title: "Confirm your email address",
        body: "Thanks for joining Opulence Bliss. Confirm your email address to activate your client account.",
        cta: { text: "Confirm my email", url: confirmationUrl },
      });

      if (delivery.ok !== true) {
        await admin.auth.admin.deleteUser(createdUser.id);
        const error =
          delivery.reason === "not_configured"
            ? "Confirmation email is not configured yet. Please contact support."
            : delivery.reason === "sender_not_verified"
              ? "The confirmation email sender is not verified yet. Please contact support."
              : "We could not send the confirmation email. Please try again in a moment.";
        return NextResponse.json(
          { error },
          { status: 503 },
        );
      }
    }

    return NextResponse.json({ ok: true, confirmationEmailSent: confirmationRequired });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sign-up failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
