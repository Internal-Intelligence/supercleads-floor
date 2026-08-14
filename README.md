# SuperC Floor

The SuperC-Leads sales whiteboard. Dealership-style X board, CRM, 1099 desk, and pay.

[![CI](https://github.com/Internal-Intelligence/supercleads-floor/actions/workflows/ci.yml/badge.svg)](https://github.com/Internal-Intelligence/supercleads-floor/actions/workflows/ci.yml)
[![CD](https://github.com/Internal-Intelligence/supercleads-floor/actions/workflows/cd.yml/badge.svg)](https://github.com/Internal-Intelligence/supercleads-floor/actions/workflows/cd.yml)

- Sign in with Google or work email
- Draw an X when you close
- Pipeline, follow-up sequences, commission
- Admin: `teamconnect@supercleads.com`

## Local

```bash
npm install
npm run dev
```

## Vercel + GitHub

The project is linked as **`supercleads-floor`** on team `internal-intelligence-5094s-projects`
(`prj_IV4JgO6ms75yo0ZScasjD9Z3Yo1P`). Config lives in [`vercel.json`](./vercel.json) and [`.vercel/project.json`](./.vercel/project.json).

**Connect the GitHub app (one time, required for auto-deploy):**

1. Install [Vercel for GitHub](https://github.com/apps/vercel) on `Internal-Intelligence` and grant **supercleads-floor**
2. Open the project → **Settings → Git** and confirm the repo is `Internal-Intelligence/supercleads-floor`, production branch `main`
3. Push to `main` (production) or open a PR (preview). Vercel comments the URL on the commit / PR

Dashboard: [vercel.com/internal-intelligence-5094s-projects/supercleads-floor](https://vercel.com/internal-intelligence-5094s-projects/supercleads-floor)

## CI / CD

| Workflow | When | What |
| --- | --- | --- |
| **CI** | Every push and pull request | `npm ci` → typecheck → test → production build |
| **Vercel GitHub app** | Push / PR (once the app is installed) | Preview and production deploys |
| **CD** | Push / PR | CLI fallback if repo secret `VERCEL_TOKEN` is set |

Optional CLI fallback: Vercel → Account Settings → [Tokens](https://vercel.com/account/tokens) → add as repo secret `VERCEL_TOKEN`.

Production needs `DATABASE_URL` on the Vercel project for live data. Auth uses the Grok broker (`GROK_AUTH_*`) when those env vars are set.
