# Staging environment and deployment boundaries

Status (2026-10-09):

- **No staging environment exists yet.** The repository is ready for one.
- Provisioning needs the account owner. It is a billing decision, and it needs dashboard access and new secrets.

## 1. What runs where today

Every GitHub Actions workflow and job in the repository, read from `.github/workflows/`:

| Workflow / job                                                                  | Trigger                                            | Touches                                                                                                                                                    |
| ------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml` → `quality`, `edge-functions`, `rls-tests`, `e2e`                      | pull request to `main`, and push to `main`         | Nothing outside the runner: throwaway Docker Postgres and mocked network.                                                                                  |
| `ci.yml` → `migrate`                                                            | **push to `main` only** (that is, a merge)         | **Production database.** `supabase db push` with the `github-pages` environment secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF`. |
| `ci.yml` → `functions`                                                          | push to `main`, after `migrate`                    | **Production Edge Functions.** All six are deployed. `funda-ai` and `payments-initiate` verify the JWT; the others use `--no-verify-jwt` and authenticate callers themselves. |
| `ci.yml` → `deploy`                                                             | push to `main`, after all the above                | **Production website** (GitHub Pages), built with the production `VITE_SUPABASE_URL` and anon key.                                                         |
| `staging.yml` (new)                                                             | **manual only** (`workflow_dispatch`)              | The **staging** project only, using the `staging` environment secrets. It refuses the production project ref.                                             |

Consequences:

- **Merging a PR to `main` is a production deployment.** All pending migrations are applied and all functions are deployed.
- `main` has **no branch protection**. Nothing technical stops a merge without review or green checks; that is a human decision.
- Pull-request runs never reach any Supabase project. "CI green" proves the code against throwaway databases, not against a deployed environment.
- Supabase's own "Supabase Preview" check is skipped on this repository: no preview branches are configured.
- The Supabase organisation is on the **Free** plan, which has no branching.

## 2. Recommended staging set-up

Use a **separate Supabase project** holding **synthetic data only**.

It must never contain a copy of production: production holds real accounts.

### What the owner does (needs approval and access)

1. **Create the project.** In the Supabase dashboard, create a new project (for example "Funda360 Staging") in the same region as production (eu-central-1).
   - A second Free project is allowed on most accounts, but **check the plan limits before creating it**.
   - Staging does not need backups: it holds synthetic data only.
2. **Configure Auth for the staging project:**
   - Site URL `http://localhost:5173`;
   - TOTP MFA enabled;
   - leaked-password protection enabled;
   - email confirmation on or off, as testers need.
   - Do **not** configure the production SMTP.
3. **Create a GitHub environment named `staging`** (Settings → Environments). Give it a required reviewer if you want a second person to approve each run. Add these secrets:
   - `STAGING_SUPABASE_ACCESS_TOKEN`: a personal access token. Prefer one from a dedicated account that can only see the staging project.
   - `STAGING_SUPABASE_PROJECT_REF`: the staging project ref.
   - `STAGING_SUPABASE_DB_PASSWORD`: the staging database password.
   - `STAGING_DB_URL`: optional, only to load fixtures. Use the staging connection string (session pooler).
4. **Run the workflow.** Under Actions → "Staging deploy (manual)" → Run workflow:
   - pick the branch, for example `claude/funda360-audit-0foiq8`;
   - type `deploy-to-staging`;
   - tick "Load the synthetic stack-test fixtures" on the first run only.

   A `workflow_dispatch` workflow appears in the Actions tab only once its file exists on the default branch.

   **Until then, run the same steps by hand** from a trusted machine:

   ```sh
   npx supabase link --project-ref <staging-ref>
   npx supabase db push
   psql "<staging-db-url>" -f supabase/stack-tests/fixtures.sql
   psql "<staging-db-url>" -f supabase/stack-tests/funda-ai-fixtures.sql
   npx supabase functions deploy funda-ai --project-ref <staging-ref>   # and the other five, as in staging.yml
   ```

5. **Create test users** in staging Auth. Every e-mail must end in `.test`. Give them roles: school owner and principal in a fixture school, and a platform administrator with TOTP enrolled.
6. **Enable Funda AI in staging only.** In an aal2 session, the staging platform administrator:
   - turns on `copilot`;
   - enables it for the fixture school, with an explicit role list (`school_owner`, `principal`) and a small budget.
7. **Model provider (optional; needs separate approval).**
   - Without a key, the gateway answers 503 `ai_provider_not_configured`. That is enough to test everything except answers.
   - To test answers, set `ANTHROPIC_API_KEY` **as a staging Edge Function secret only**. The key must be under a spending limit, with written approval for synthetic-data use.
8. **Run the frontend against staging** from a developer machine. Never deploy it to the production site.

   ```sh
   VITE_SUPABASE_URL=https://<staging-ref>.supabase.co VITE_SUPABASE_ANON_KEY=<staging anon key> npm run dev
   ```

### Safety rules for staging

- Synthetic data only. Never import, copy or restore production data into staging.
- A staging secret is never reused in production, and a production secret is never reused in staging.
- `staging.yml` refuses to run in three cases:
  - the project ref equals the production ref `rzkybmkzhpwovpvrjkxk`;
  - `STAGING_DB_URL` contains the production ref;
  - fixtures are requested on a database that holds any non-`.test` profile.
- Funda AI may be enabled in staging for testing. Doing so says nothing about production readiness (`docs/FUNDA_AI_PILOT_READINESS.md`).

## 3. Staging validation checklist (after provisioning)

Record the date, the person and the result of each step:

1. `supabase migration list` shows every repository migration applied, through `20261009096000`.
2. `select jobname, schedule from cron.job` lists `funda-ai-recover-stale` and `funda-ai-retention`. Enable pg_cron (Database → Extensions) **before** the first migration push. If it was enabled later, schedule the two jobs by hand with the `cron.schedule` statements at the end of `20261009094000_funda_ai_hardening.sql`: an applied migration is not re-run.
3. The function list shows `funda-ai` with `verify_jwt: true`.
4. **Without a provider key**, a request from a staging principal returns 503 `ai_provider_not_configured`, and an `ai_requests` row is recorded.
5. As an aal1 platform administrator:
   - `ai_usage_summary` returns `mfa_required`;
   - AI tables return no other users' rows;
   - audit rows with action `ai_%` are hidden.
6. **With approval and a key**, run `supabase/stack-tests/funda-ai-eval.mjs`. Note that it targets a local stack by design. For hosted staging, run the reference questions through the UI and grade them with `eval/grader.ts`. Then do the 30-transcript human review (`docs/FUNDA_AI_EVALUATION.md`).
7. Safeguarding smoke test: send a direct disclosure from the corpus. It must return the safeguarding notice, and the request must record no model call (`ai_requests.provider` is null).

## 4. What is still not covered

- Hosted Supabase behaviour that the local stack cannot reproduce:
  - pg_cron scheduling on the platform;
  - Edge Function cold starts and timeouts;
  - the platform's JWT verification.
- Real model behaviour: answer quality, and refusals and fallbacks.
- Real e-mail delivery: staging must not use the production SMTP.
