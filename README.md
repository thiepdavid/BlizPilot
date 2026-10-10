# BizPilot

BizPilot is a boutique-first business manager with a responsive React dashboard, an Express API, Supabase/PostgreSQL integration, and local demo storage. It supports products and variants, inventory, invoices, payments, expenses, customer records, and reports. The Daily Brief uses rules on saved business records. Ask BizPilot can answer questions with OpenAI using aggregate business totals; it does not send customer names, contact details, or private notes. Payments can be recorded manually or, when enabled, collected through the business owner's connected Stripe account. WhatsApp delivery is not connected.

## Project structure

```text
bizpilot/
├── frontend/       # React, TypeScript, Vite, Tailwind CSS
├── backend/        # Node.js, Express, TypeScript
├── database/       # Supabase/PostgreSQL schema and RLS policies
├── package.json    # Workspace and development commands
└── README.md
```

## iOS and Android app foundation

The frontend is prepared to be packaged as native iOS and Android apps with Capacitor. The mobile apps load the same BizPilot interface and use the hosted BizPilot API and Supabase project; they do not run the Express server on the phone.

### Create the native projects

Use a Mac with current Xcode for iOS, and Android Studio with its SDK installed for Android. From the project root:

```bash
npm install
npm run mobile:build
npm run mobile:add:ios
npm run mobile:add:android
npm run mobile:sync
npm run mobile:open:ios
```

Open the Android project with `npm run mobile:open:android`. After frontend changes, run `npm run mobile:sync` to rebuild the web assets and copy them into both native projects. iOS builds and App Store uploads require an Apple Developer account; Play Store releases require a Google Play developer account.

The mobile build defaults to BizPilot's deployed Render API URL (`https://bizpilot-api-t8bl.onrender.com`), while local web development can keep using Vite's `/api` proxy. If the API URL changes, set `BIZPILOT_API_URL` before running `npm run mobile:build`. The API automatically allows Capacitor's local WebView origins `capacitor://localhost` (iOS) and `http://localhost` (Android); keep the website origin in Render's `CORS_ORIGIN`. In Supabase Auth URL Configuration, add the app's eventual deep-link callback URL before enabling native email-confirmation or OAuth return flows. The current app has not yet been configured with a branded deep link or push notifications.

This is only the native packaging foundation. Before store submission, configure app icons, launch screens, privacy disclosures, platform permissions, deep links, and store-specific subscriptions. Stripe Checkout/subscriptions on the website do not provide Apple In-App Purchase or Google Play Billing; those purchase flows and server-side receipt/transaction validation still need implementation and store product configuration. Do not advertise native subscription purchases until those flows are complete.

## Included features

- Business dashboard with sales, appointments, outstanding invoices, returning customers, and expenses
- Customer records, customer profiles, CSV import/export, and customer-specific appointment/invoice actions
- Service catalog with add, edit, and archive actions
- Appointment booking, search, date/status filters, status updates, rescheduling, and overlap checks
- Shareable public booking page; customer requests arrive as pending appointments for owner confirmation
- Invoice creation with an optional configurable tax rate, invoice preview/print, outstanding balances, and overdue filters
- Manual payment recording, Stripe Connect invoice checkout (after platform and business account setup), webhook-confirmed online payments, and copy-only reminders
- Expense tracking and month/category reports with CSV export
- Marketing message drafts that can be edited and copied; BizPilot does not send messages
- Search across saved business records and dashboard notifications for overdue invoices or pending appointments
- Daily Brief recommendations calculated from saved records, plus an OpenAI-powered assistant that uses aggregate business totals

## Requirements

- Node.js 22 or newer (required by the Capacitor mobile tooling)
- npm 10 or newer
- A Supabase project only if you want cloud storage and sign-in; demo mode can run without it

## Run locally

From the `bizpilot` folder:

```bash
npm install
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
npm run dev
```

Open <http://localhost:5173>. The Express API runs at <http://localhost:4000>; Vite proxies `/api` requests to it. Local demo records are stored as JSON under `backend/data/`.

If you already have `.env` files with your own values, keep them and skip the corresponding `cp` command. Restart the development server after changing environment values.

## Supabase setup

Create a Supabase project and follow the ordered SQL setup in [`database/README.md`](database/README.md). It includes the core schema, signup trigger, tenant-scoped RLS policies, and required feature migrations. In Supabase Authentication URL Configuration, set the local Site URL to `http://localhost:5173` and add it as a redirect URL. Then copy the project URL and publishable key (or legacy anon key) into both environment files and restart BizPilot.

`database/schema.sql` is for a **new** Supabase project. For a database already in use, back it up and compare its live schema before applying any SQL. Do not run the bootstrap over production data as a shortcut.

Use the same Supabase project URL and key in both apps:

- `frontend/.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `backend/.env`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`

The `VITE_API_URL` setting is optional for local development. `PORT` and `CORS_ORIGIN` configure the API. `DATABASE_URL` is not used by this starter; cloud access uses the Supabase API and RLS. Never put a Supabase service-role key in either app or the frontend.

Local JSON records are not automatically copied into Supabase. Configure both apps for Supabase before creating records you want stored in the cloud.

## Checks and production build

```bash
npm run typecheck
npm run build
```

`npm start` starts the compiled API on port 4000 by default. It does not serve the frontend; deploy the frontend and API as separate services or configure a reverse proxy.

## Still needed for a hosted deployment

- Push the project to a Git provider and connect it to Vercel and Render.
- Enter your production Supabase values and deployment URLs in the hosting dashboards.
- Apply and verify the schema in the production Supabase project.
- Set up Stripe Connect with test credentials to try online payments; use live credentials only after the platform and connected businesses are approved and the full payment flow has been tested. Existing Razorpay variables support the legacy webhook only; new payment links use Stripe Connect.


## Deployment starter (Vercel + Render)

The repository includes `vercel.json` for the Vite frontend and `render.yaml` for the Express API. These files prepare the build settings; deploying still requires a Git provider connection and your own hosting accounts.

1. Push the BizPilot folder to a Git repository.
2. In Render, create a Blueprint from that repository. When prompted, enter your Supabase project URL and publishable/anon key for `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Render builds the backend workspace and checks `/api/health`.
3. In Vercel, import the same repository and keep the project root at the repository root. Add `VITE_API_URL` with the Render API URL (for example, `https://bizpilot-api.onrender.com`, with no trailing slash), plus `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Deploy the frontend.
4. In Render, update `CORS_ORIGIN` to the exact Vercel site origin (for example, `https://bizpilot.vercel.app`, with no trailing slash), then redeploy the API.
5. In Supabase Authentication URL Configuration, set the production Site URL and allowed redirect URL to your Vercel domain.

The Render Blueprint initially allows the local development origin. Update `CORS_ORIGIN` after the frontend has a deployment URL. Set cloud storage in both apps before using production data; local JSON storage is not suitable for hosted persistence. Vite environment values are embedded into the frontend at build time, so redeploy Vercel after changing them. Keep service-role credentials out of Vercel and store them only as private Render environment variables.

## Account deletion

The signed-in app provides **Settings → Delete account**. Run `database/account-deletion.sql` in the Supabase SQL Editor, and confirm `SUPABASE_SERVICE_ROLE_KEY` is set as a private Render environment variable (never in Vercel or a frontend `.env`). The API checks the signed-in user's token, removes their membership and profile, deletes a business and its cascading records only when it is safe to do so, then deletes the Supabase Auth account. Shared workspaces owned by the deleting user require ownership transfer first. If database cleanup fails, the API refuses to delete the login account. Redeploy the API and frontend after setting this up.

## Input and upload safety

- Customer and inventory imports accept UTF-8 `.csv` files up to 5 MB and 500 data rows. The browser reads and parses these files locally; BizPilot does not upload or retain the original files.
- JSON text sent to the API is Unicode-normalized and stripped of non-printing control characters, with request and field size limits. User-provided text is rendered as ordinary React text, which HTML-escapes it; do not render it with `dangerouslySetInnerHTML` or direct HTML insertion.
- Stripe Checkout webhooks are checked against Stripe's signature and timestamp using the untouched raw request body before event data is parsed. Only paid Checkout events are passed to the payment-recording database function.

## Global online payments with Stripe Connect

Each business connects its own Stripe account. Checkout charges are created directly on that connected account, so payment proceeds settle to that business rather than a shared BizPilot account. Stripe verifies the business through its hosted onboarding. What the customer can use at checkout depends on the connected account's country, currency, Stripe approval, and enabled payment methods.

1. Apply `database/stripe-connect-payments.sql` as part of the ordered setup in [`database/README.md`](database/README.md). It creates a private mapping from BizPilot businesses to connected Stripe accounts and an idempotent, server-only payment recording function.
2. BizPilot needs a Stripe Connect platform account in a country where Stripe supports it. Add the platform's **test secret key** as `STRIPE_SECRET_KEY` in Render → `bizpilot-api` → **Environment**. Also set `CLIENT_ORIGIN` to the exact deployed frontend origin, such as `https://blizpilot-alpha.vercel.app`. Keep the Stripe key and Supabase service-role key on the backend only.
3. In Stripe Dashboard → **Webhooks**, create a Connect webhook that listens to events from connected accounts. Set the endpoint URL to `https://bizpilot-api-t8bl.onrender.com/api/payments/stripe/webhook` and select `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Save its signing secret in Render as `STRIPE_CONNECT_WEBHOOK_SECRET`.
4. Save the Render environment changes and redeploy the API. In BizPilot, open **Payments → Connect Stripe** for each business and complete Stripe's hosted onboarding. The business country must already be selected in Settings.
5. Create a payment link for an unpaid invoice and share it with the customer. Stripe hosts checkout in the invoice currency; after Stripe confirms payment, its signed webhook records the payment and updates the invoice.

For local development, use Stripe **test mode** credentials and configure Stripe CLI/webhook forwarding to `http://localhost:4000/api/payments/stripe/webhook`. India-based Stripe accounts currently require an invitation from Stripe, and every connected business must independently meet Stripe's country-specific identity and payout requirements. A successful test does not enable live payments. Before launch, test the full onboarding, checkout, webhook, refund, and payout flows with the real platform country and supported business countries. Any payment links issued by the older shared Razorpay integration should be cancelled in Razorpay before using this connected-account flow for live payments.

## Public appointment booking

Apply `database/public-booking.sql` once in Supabase SQL Editor. After deploying the changes, open **Appointments → Share booking page** and send the link to customers. They can choose an active service and request a time within the next 90 days; requests are added as **Pending** and block overlapping bookings until you confirm, reschedule, or cancel them. The public form asks for a phone number or email so the business can follow up. No Razorpay setup is needed.

### Set public booking hours

After applying `database/public-booking.sql`, run `database/public-booking-hours.sql` in the Supabase SQL Editor. In BizPilot, open **Appointments → Share booking page → Manage hours** to set open days and times. Customers will only be offered available 15-minute start times within those hours, using the business time zone. The default schedule is Monday through Saturday, 9:00 AM–6:00 PM, with Sunday closed.

To initialize new booking pages in the business owner's browser time zone, run `database/public-booking-owner-timezone.sql` after `database/public-booking-hours.sql`. Existing booking pages keep their current time zone; change it under **Manage hours** if needed.

### Block one-off dates

After applying `database/public-booking-hours.sql`, run `database/public-booking-closures.sql` in the Supabase SQL Editor. Under **Appointments → Share booking page → Manage hours**, add and save holiday or time-off dates. The public booking page will show those dates as closed and the API will reject requests for them.

### Hide already-booked appointment times

After applying `database/public-booking-closures.sql`, run `database/public-booking-availability.sql` in the Supabase SQL Editor. The public form checks existing bookings for the selected date and only displays non-overlapping times; customer details are never returned by this availability lookup.


### Customer notes and service preferences

Before deploying the customer-notes update, run `database/customer-notes.sql` once in the Supabase SQL Editor. It adds a business-private notes field to customer records (up to 2,000 characters). Customer notes are also included in CSV import and export.


### Ask BizPilot AI

Add `OPENAI_API_KEY` to the backend environment (local `backend/.env` or Render → `bizpilot-api` → Environment). The key stays on the backend and must never be added to Vercel or a `VITE_` variable. `OPENAI_MODEL` defaults to `gpt-5.6-luna`. Each question sends aggregate business totals and the question to OpenAI; customer names, phone numbers, email addresses, and private notes are excluded. OpenAI API usage may incur charges based on your account and model.


### Business currency

After `database/public-booking-closures.sql`, run `database/business-currency.sql` in the Supabase SQL Editor before deploying the business-currency update. In **Settings → Business profile**, choose your business accounting currency. BizPilot formats service prices, invoices, payments, expenses, and reports in that currency. It does not convert existing amounts; the API prevents changing the currency after prices or financial records exist. Stripe Checkout uses the invoice's business currency when that currency and account are supported.

Run `database/business-location.sql` in Supabase before deploying the business-location update. Businesses can save their country, district, mailing address, and tax identifier in **Settings → Business profile**. Saved address details appear on printed invoices.

Address suggestions use Geoapify's address autocomplete, filtered to the selected country. Create a Geoapify API key, restrict it to your local site origin and production Vercel domain, then add `VITE_GEOAPIFY_API_KEY` to `frontend/.env` and to the Vercel project's environment variables. Redeploy Vercel after changing environment variables. The key is used in the browser, so restrict its allowed origins in Geoapify. Without a key, owners can still fill in the address fields manually. Selecting a suggestion fills street address, city/town, district, region, and postal code where the place data contains them; not every country or address has every level.

On public booking pages, visitors can choose a display currency. BizPilot suggests one from the visitor's browser region and fetches a daily reference rate from [Frankfurter](https://frankfurter.dev/). Converted prices are marked as estimates and show the original business price, rate date, and the currency the business charges in. The business and customer records are never converted. This feature needs outbound HTTPS access from the backend to `api.frankfurter.dev`; no API key or database migration is required. If a currency pair is unavailable, the page falls back to the business currency.
