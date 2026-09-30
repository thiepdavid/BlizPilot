# BizPilot

BizPilot is a working SaaS starter for small service businesses. It includes a responsive React dashboard, an Express API, Supabase/PostgreSQL integration with row-level security, and local demo storage. The Daily Brief uses simple rules on saved business records; it does not call an AI service. Payment recording only updates BizPilot records and does not move money. WhatsApp and other message delivery are not connected.

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
- Invoice creation with optional GST, invoice preview/print, outstanding balances, and overdue filters
- Manual payment recording, partial payments, and copy-only payment reminders
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

The `VITE_API_URL` setting is optional for local development. `PORT` and `CORS_ORIGIN` configure the API. `DATABASE_URL` is not used by this starter; cloud access uses the Supabase API and RLS. Never put a Supabase service-role key in either app.

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
- Add a real payment processor or messaging provider only if those integrations become part of the product scope.


## Deployment starter (Vercel + Render)

The repository includes `vercel.json` for the Vite frontend and `render.yaml` for the Express API. These files prepare the build settings; deploying still requires a Git provider connection and your own hosting accounts.

1. Push the BizPilot folder to a Git repository.
2. In Render, create a Blueprint from that repository. When prompted, enter your Supabase project URL and publishable/anon key for `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Render builds the backend workspace and checks `/api/health`.
3. In Vercel, import the same repository and keep the project root at the repository root. Add `VITE_API_URL` with the Render API URL (for example, `https://bizpilot-api.onrender.com`, with no trailing slash), plus `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Deploy the frontend.
4. In Render, update `CORS_ORIGIN` to the exact Vercel site origin (for example, `https://bizpilot.vercel.app`, with no trailing slash), then redeploy the API.
5. In Supabase Authentication URL Configuration, set the production Site URL and allowed redirect URL to your Vercel domain.

The Render Blueprint initially allows the local development origin. Update `CORS_ORIGIN` after the frontend has a deployment URL. Set cloud storage in both apps before using production data; local JSON storage is not suitable for hosted persistence. Vite environment values are embedded into the frontend at build time, so redeploy Vercel after changing them. Keep service-role credentials out of Vercel and Render.
