# Supabase database setup

## New Supabase project

Run these files in the Supabase SQL Editor in the listed order. Wait for a
successful result before moving to the next file.


`razorpay-payments.sql` is an optional legacy integration. New online payment
links use Stripe Connect; do not apply the Razorpay migration unless you still
need its legacy webhook.

## Existing project

Do **not** run `schema.sql` blindly on the live BizPilot database. It is a
bootstrap for a new project. First take a database backup and compare the live
schema, constraints, policies, and function definitions with these files. The
previous setup was applied manually and some of its SQL was not saved in Git,
so this repository cannot prove that the live database matches this bootstrap.
Apply only missing, reviewed changes to the live database, then confirm them
with a two-account tenant-isolation check before relying on production data.

## Security model

- Signed-in users can see and edit rows only for a business in
  `business_users`. The membership lookup is a narrow `SECURITY DEFINER`
  boolean helper to prevent recursive membership-table policies.
- Signup creates `users`, `businesses`, and `business_users` atomically from
  bounded auth metadata.
- Invoices and payments are readable by business members but not directly
  writable through PostgREST. Invoice creation and payment recording use
  narrow database functions with authorization, amount, stock, and balance
  checks.
- Connected Stripe account mappings are inaccessible to `anon` and
  `authenticated`; only the server's private service-role client can use them.
- Public booking data is returned through constrained functions. Apply
  `security-hardening.sql` last so anonymous users cannot call internal booking
  write/read RPCs directly.

This is source-level setup documentation, not proof that an already deployed
Supabase project has these exact policies. Verify the actual project before
launch.
