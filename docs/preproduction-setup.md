# Production and pre-production setup

## Release flow

- `main` is the production branch.
- `staging` is the persistent pre-production branch and receives a Vercel Preview URL.
- Test changes on `staging`, then merge the approved commit into `main`.
- Preview pages display a testing banner and tell search engines not to index them.

## Environment isolation

Vercel Preview and Production must use separate service credentials before testers create bookings, payments or accounts:

- Preview: a staging Supabase project, Stripe test keys and staging webhook.
- Production: the production Supabase project and the intended production Stripe mode.
- Use separate cron secrets and email sender settings where possible.

Do not run destructive test resets against Preview while it shares the Production Supabase project.

## Google customer authentication

1. Create separate Google OAuth clients for staging and production.
2. Enable Google under Supabase Authentication → Sign In / Providers.
3. In Google, use the Supabase Auth callback URL shown by the Google provider setup.
4. In Supabase URL Configuration, keep the exact production callback and add:
   - `http://localhost:3000/**`
   - `https://*-muad500s-projects.vercel.app/**`
5. Test a new Google customer, an existing Google customer, and rejection of a professional account on the customer login.

## Release checks

- Customer email and Google sign-in.
- Cleaning booking, reschedule and cancellation.
- Handyman quote requires a signed-in customer.
- Cleaner offer acceptance, OTP check-in, checkout and review.
- Stripe test payment, cancellation adjustment, payout and invoice.
- Admin bookings, quotes, customers, cleaners, FAQs and reports.
