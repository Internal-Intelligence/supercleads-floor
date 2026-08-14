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

## CI / CD

GitHub Actions on this repo:

| Workflow | When | What |
| --- | --- | --- |
| **CI** | Every push and pull request | `npm ci` → typecheck → test → production build |
| **CD** | Pull request | Vercel **preview** URL (commented on the PR) |
| **CD** | Push to `main` | Vercel **production** |

Add one repo secret so CD can talk to Vercel:

1. Vercel → Account Settings → [Tokens](https://vercel.com/account/tokens) → create
2. GitHub → repo **Settings → Secrets and variables → Actions** → `VERCEL_TOKEN`

Org and project IDs are already in the workflow (`team_UkqIRVcpfg7Xz46nHOcppuoI` / `prj_IV4JgO6ms75yo0ZScasjD9Z3Yo1P`). Override with repo variables `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` if you move the project.

CI does not need the token. CD skips deploy (and posts a notice) until the secret is set.

Production also needs `DATABASE_URL` on the Vercel project for live data. Auth uses the Grok broker (`GROK_AUTH_*`) when those env vars are set.
