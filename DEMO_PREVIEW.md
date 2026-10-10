# Boutique demo preview

Open BizPilot with `?demo=boutique` on the URL to see the sample workspace. For example:

```text
https://blizpilot-alpha.vercel.app/?demo=boutique
```

The preview is read-only and uses fictional records stored in the frontend. It bypasses the account, API, and Supabase data-loading paths. Any attempt to save or delete business records is rejected in the preview.

The boutique name, owner, address, customers, and all sales records are fictional. Customer email addresses use the reserved `.invalid` domain, there are no phone numbers, and no real customer can be contacted from this dataset. Amounts use INR and item, invoice, payment, and expense totals are consistent sample values.

The fixtures are in `frontend/src/data/demoBoutique.ts`.
