# SuperC Floor

The SuperC-Leads sales whiteboard. Dealership-style X board, CRM, 1099 desk, and pay.

- Sign in with Google or work email
- Draw an X when you close
- Pipeline, follow-up sequences, commission
- Admin: `teamconnect@supercleads.com`

## Local

```bash
npm install
npm run dev
```

## Deploy

Vercel build: `npm run build` (TanStack Start + Nitro `vercel` preset).
Needs `DATABASE_URL` in production. Auth uses the Grok broker (`GROK_AUTH_*`) when those env vars are set.
