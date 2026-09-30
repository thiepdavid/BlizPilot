# BizPilot

BizPilot is a working SaaS starter for small service businesses. It includes a responsive React dashboard, an Express API, Supabase/PostgreSQL integration with row-level security, and local demo storage. The Daily Brief uses simple rules on saved business records; it does not call an AI service. Payments can be recorded manually or collected through Razorpay Payment Links. The Razorpay connection starts in test mode; WhatsApp and other message delivery are not connected.

## Project structure

```text
bizpilot/
├── frontend/       # React, TypeScript, Vite, Tailwind CSS
├── backend/        # Node.js, Express, TypeScript
├── database/       # Supabase/PostgreSQL schema and RLS policies
├── package.json    # Workspace and development commands
└── README.md
```

## Included features

- Business dashboard with sales, appointments, outstanding invoices, returning customers, and expenses
- Customer records, customer profiles, CSV import/export, and customer-specific appointment/invoice actions
- Service catalog with add, edit, and archive actions
- Appointment booking, search, date/status filters, status updates, rescheduling, and overlap checks
- Shareable public booking page; customer requests arrive as pending appointments for owner confirmation
- Invoice creation with optional GST, invoice preview/print, outstanding balances, and overdue filters
- Manual payment recording, invoice payment links through Razorpay, webhook-confirmed online payments, and copy-only reminders
- Expense tracking and month/category reports with CSV export
- Marketing message drafts that can be edited and copied; BizPilot does not send messages
- Search across saved business records and dashboard notifications for overdue invoices or pending appointments
- Daily Brief recommendations calculated from saved records, without an AI integration

## Requirements

- Node.js 20 or newer
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

1. Create a Supabase project.
2. In the Supabase SQL Editor, run `database/schema.sql`.
3. In Supabase Authentication URL Configuration, set the Site URL to `http://localhost:5173` and add it as a redirect URL.
4. Copy the project URL and its publishable key (or legacy anon key) into both environment files. Use the variable names shown below.
5. Restart BizPilot, create an account, and confirm the email if Supabase requires it.

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
- Set up Razorpay and its test credentials to try online payments; switch to live credentials only after the Razorpay account is approved and the payment flow has been tested.


## Deployment starter (Vercel + Render)

The repository includes `vercel.json` for the Vite frontend and `render.yaml` for the Express API. These files prepare the build settings; deploying still requires a Git provider connection and your own hosting accounts.

1. Push the BizPilot folder to a Git repository.
2. In Render, create a Blueprint from that repository. When prompted, enter your Supabase project URL and publishable/anon key for `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Render builds the backend workspace and checks `/api/health`.
3. In Vercel, import the same repository and keep the project root at the repository root. Add `VITE_API_URL` with the Render API URL (for example, `https://bizpilot-api.onrender.com`, with no trailing slash), plus `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Deploy the frontend.
4. In Render, update `CORS_ORIGIN` to the exact Vercel site origin (for example, `https://bizpilot.vercel.app`, with no trailing slash), then redeploy the API.
5. In Supabase Authentication URL Configuration, set the production Site URL and allowed redirect URL to your Vercel domain.

The Render Blueprint initially allows the local development origin. Update `CORS_ORIGIN` after the frontend has a deployment URL. Set cloud storage in both apps before using production data; local JSON storage is not suitable for hosted persistence. Vite environment values are embedded into the frontend at build time, so redeploy Vercel after changing them. Keep service-role credentials out of Vercel and store them only as private Render environment variables.

## Razorpay payment links (test mode first)

1. In Supabase SQL Editor, run `database/razorpay-payments.sql`. This adds an idempotency table and a server-only function so verified payment webhooks update the right invoice once.
2. In Razorpay, activate a merchant account if prompted, then create **Test Mode** API keys. Never paste secret keys into chat or the frontend.
3. In Render → `bizpilot-api` → **Environment**, add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `SUPABASE_SERVICE_ROLE_KEY`. The service-role key is available in your Supabase project API settings. Keep all three only on the backend.
4. In Razorpay Dashboard → **Account & Settings → Webhooks**, add `https://bizpilot-api-t8bl.onrender.com/api/payments/razorpay/webhook`, choose the `payment_link.paid` event, and set a webhook secret. Add that same secret to Render as `RAZORPAY_WEBHOOK_SECRET`.
5. Save Render environment changes and redeploy the API. In BizPilot, open **Payments → Create pay link** for an unpaid invoice, then share the copied Razorpay URL with your customer. After the test payment, Razorpay's signed webhook adds the payment and updates the invoice balance.

For local development, put the same test values in `backend/.env` and configure Razorpay webhook delivery to reach your local API through a secure webhook-forwarding tool. Payment links require a signed-in Supabase account and an invoice stored in Supabase. Test mode simulates payment; it does not transfer real money. Live charges require Razorpay approval, live API keys, and successful end-to-end testing.

## Public appointment booking

Apply `database/public-booking.sql` once in Supabase SQL Editor. After deploying the changes, open **Appointments → Share booking page** and send the link to customers. They can choose an active service and request a time within the next 90 days; requests are added as **Pending** and block overlapping bookings until you confirm, reschedule, or cancel them. The public form asks for a phone number or email so the business can follow up. No Razorpay setup is needed.

### Set public booking hours

After applying `database/public-booking.sql`, run `database/public-booking-hours.sql` in the Supabase SQL Editor. In BizPilot, open **Appointments → Share booking page → Manage hours** to set open days and times. Customers will only be offered available 15-minute start times within those hours, using the business time zone. The default schedule is Monday through Saturday, 9:00 AM–6:00 PM, with Sunday closed.

### Block one-off dates

After applying `database/public-booking-hours.sql`, run `database/public-booking-closures.sql` in the Supabase SQL Editor. Under **Appointments → Share booking page → Manage hours**, add and save holiday or time-off dates. The public booking page will show those dates as closed and the API will reject requests for them.
