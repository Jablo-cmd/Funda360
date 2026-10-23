# Government Data & Integration API (v1)

A versioned, authenticated, scope-aware API over the same government data model as the District and Provincial Dashboards.

**It is integration-ready, not an integration.** No connection to DBE, SA-SAMS, LURITS or any other government system exists or is claimed. Official data formats are not implemented; where one would be needed, this document says "External specification required before implementation."

The machine-readable contract is `docs/api/government-api-v1.openapi.yaml`.

## Architecture

```
client ──HTTPS──▶ Edge Function government-api ──service role──▶ gov_api_request()  (Postgres)
                  (HTTP adapter only)                              authenticate, rate limit,
                                                                   scope, dispatch, log
```

- **Base URL:** `https://<project-ref>.supabase.co/functions/v1/government-api`
  - Production: `https://rzkybmkzhpwovpvrjkxk.supabase.co/functions/v1/government-api`
  - Every route below is relative to it, for example `GET …/government-api/v1/schools`.
- **Edge Function** (`supabase/functions/government-api/index.ts` with `_shared/government/api.ts`):
  - parses the request and forwards one RPC call;
  - maps the RPC's envelope to an HTTP response.
  - It holds the service-role key server-side only; it is never sent to a browser.
  - It is deployed with `--no-verify-jwt`, because API tokens are not Supabase JWTs.
  - No CORS headers are sent: the API is for server-to-server use.
- **Database:** `gov_api_request()` (migration `20261009092000`) is executable by `service_role` only.
  1. It hashes the bearer token (SHA-256) and finds the client.
  2. It refuses revoked or expired clients.
  3. It applies the per-client rate limit.
  4. It sets the client context for this transaction only.
  5. It dispatches to one operation.
  6. It maps errors to stable codes.
  7. It writes the request to `government_api_requests`.
  - Operation functions (`gov_api_op_*`) refuse to run outside that context and are not executable by any client role.
- **Shared definitions:** the API calls the same functions as the dashboards. The rule that decides which schools are in scope is the same function in both (`reporting_school_ids()`, `reporting_resolve_schools()`, `reporting_learner_detail_allowed()`).
  - Figures come from `get_government_report()` and `get_provincial_report()`.
  - The attendance and assessment aggregates use the same learner population and formulas.
  - The RLS suite checks that the API totals equal the report figures.

## Authentication

- Header: `Authorization: Bearer f360g_<8 hex>_<48 hex>`. Tokens in query strings are ignored.
- **Issuing a token:** a platform administrator with an MFA session creates a client under **Education Areas → Integrations** (`/district/integrations`, RPC `create_government_api_client`).
  - The token is shown once.
  - Only its SHA-256 hash and its 8-character prefix are stored.
  - The hash column is not readable through PostgREST by any role.
- **Client settings:**
  - scope (exactly one education area, or one school);
  - permissions;
  - an optional learner-level grant;
  - rate limit (1–600 requests per minute, default 60);
  - optional expiry.
- **Revocation** (`revoke_government_api_client`) takes effect on the next request. Expired clients are refused the same way. To rotate a token, create a new client, then revoke the old one.

## Authorization

- **Scope:** an area client sees every school under its area (province → districts → circuits → schools); a school client sees its school.
  - Scope is decided in the database for every request.
  - Query parameters such as `province_id` or `district_id` only narrow it.
  - An id outside the scope returns **403**, and an unknown id returns the same 403, so existence cannot be probed.
- **Provincial reports** (`/v1/reports/provinces/{id}`) need a client scoped to that province. District, circuit and school clients get 403.
- **Permissions:** `schools`, `reports`, `attendance`, `assessments`, `staff`, `interventions`, `data_quality`, `learners`, `imports`. A missing permission returns 403 `permission_not_granted`.
- **Learner-level data:**
  - `/v1/learners` needs the `learners` permission **and** the client's learner-level grant.
  - `learner_id` in `/v1/interventions` is only returned with that grant.
  - Groups of fewer than 5 learners have their rates withheld without it, as on the dashboards.

## Endpoints

All endpoints are `GET` except `POST /v1/imports`.

| Endpoint | Permission | Returns |
| --- | --- | --- |
| `/v1/scope` | none | The client, its scope and its number of schools. |
| `/v1/areas` | none | Visible education areas, each with `in_scope`. Ancestors are named only. |
| `/v1/schools` | `schools` | School directory: id, EMIS number, name, status, province, district and circuit. Filters: `province_id`, `district_id`, `circuit_id`, `status`. |
| `/v1/schools/{id}` | `schools` | One school. |
| `/v1/learners?school_id=` | `learners` + grant | Enrolments: learner id, learner number, grade, class, enrolment and learner status, enrolment date. No names, dates of birth or ID numbers. Audited. |
| `/v1/attendance` | `attendance` | Per school: totals and `periods` (`granularity=week\|month`), with present, late, absent, excused and attendance rate. |
| `/v1/assessments` | `assessments` | Per school and subject: learners, results, average %, pass rate. Small groups are withheld. |
| `/v1/staff` | `staff` | Per school: staff, educators, learners enrolled, learners per educator. |
| `/v1/interventions` | `interventions` | Intervention records: status, opened, target and resolved dates, overdue, subject. Titles and notes are never returned. |
| `/v1/data-quality` | `data_quality` | Per school: data-quality issues and attention reasons. |
| `/v1/reports/summary` | `reports` | Summary, districts, grades, subjects and trends for the scope (same as the District Dashboard). |
| `/v1/reports/schools` | `reports` | Per-school indicators (same as Government Reports). |
| `/v1/reports/provinces/{id}` | `reports` + province scope | The provincial report without the school list. |
| `POST /v1/imports` | `imports` | Validate, preview, and store an import (see below). |
| `/v1/imports/{id}` | `imports` | The client's own import job. Other clients' jobs return 404. |

**Common filters:** `province_id`, `district_id`, `circuit_id`, `school_id`, `academic_year`, `term`, `start_date`, `end_date`, `grade`, plus `attendance_threshold` and `performance_threshold` where they apply.

- An unknown parameter, a repeated parameter or a malformed value is refused.
- A `GET` request with a body is refused.

## Pagination

- **Lists use keyset pagination.** The response is `{"data": [...], "page": {"limit": n, "next_cursor": "<uuid>" | null}}`. Pass `cursor=<next_cursor>` to get the next page.
- **Default and maximum `limit` per endpoint:**

| Endpoint | Default | Maximum |
| --- | --- | --- |
| `schools` | 100 | 500 |
| `learners`, `interventions` | 200 | 1000 |
| `attendance`, `assessments`, `staff`, `data-quality`, `reports/schools` | 25 schools | 100 schools |

- Per-school aggregates are computed only for the schools on the page, so a page costs the same however large the scope is.

## Imports: validate → preview → commit

Only `kind: "school_identifiers"` (EMIS numbers for schools already in the client's scope) is supported.

1. `POST /v1/imports` with `{"kind":"school_identifiers","dry_run":true,"rows":[{"school_id":"…","emis_number":"…"}]}` validates and returns a preview. Nothing is stored.
   - Each row gets an `action`: `set`, `change` or `unchanged`.
   - Error codes: `required`, `invalid_type`, `invalid_format`, `school_not_in_scope`, `duplicate_school`, `duplicate_emis_number`, `emis_number_in_use`.
   - Limits: at most 1,000 rows and 1 MB.
2. The same body without `dry_run`, plus an `idempotency_key` (8–128 characters from `[A-Za-z0-9._:-]`), stores the job as `validated` (or `failed`) and returns **201**.
   - Replaying the same key and payload returns the same job (**200**, `replayed: true`).
   - The same key with a different payload returns **409**.
3. Nothing is written to school records until a platform administrator with MFA commits the job under Integrations (`review_government_import_job`).
   - The commit validates again against the current records.
   - Each changed school is written to `audit_log` (`school_emis_number_changed`).
   - A job can be committed or rejected once.

The EMIS check is a Funda360 hygiene rule (1–32 letters, digits or hyphens), **not** the official EMIS format. **External specification required before implementation** of: official EMIS validation, and learner, attendance, assessment, staff or intervention imports.

## Errors

The error body is `{"error": {"code", "message", "request_id"}}`. Database text and stack traces are never returned.

| Status | Code | When |
| --- | --- | --- |
| 400 | `malformed_request` | Invalid JSON, or repeated or too many query parameters (more than 30). |
| 401 | `unauthenticated` | Missing, unknown, revoked or expired token. A `WWW-Authenticate: Bearer` header is sent. |
| 403 | `forbidden` | Outside the client's scope (including unknown ids). |
| 403 | `permission_not_granted` | The client lacks the endpoint's permission. |
| 404 | `not_found` | Unknown endpoint or version, or a resource that is not exposed (for example another client's import). |
| 405 | `method_not_allowed` | Wrong method. An `Allow` header is sent. |
| 409 | `conflict` | An idempotency key reused with a different payload. |
| 413 | `payload_too_large` | Body over 1 MB. |
| 415 | `unsupported_media_type` | A POST body that is not `application/json`. |
| 422 | `validation_failed` | An unknown parameter or an invalid value or body. |
| 429 | `rate_limited` | The per-client limit was exceeded. A `Retry-After: 60` header is sent. |
| 500 | `internal_error` | Anything else; quote the `request_id`. |

Every response carries `X-Request-Id`. A well-formed `X-Request-Id` sent by the client is kept, so requests can be traced end to end. Responses are `Cache-Control: no-store`.

## Rate limiting

- Each client has a rolling 60-second window, counted from the request log; every logged request counts, including errors.
- Concurrent requests can exceed the limit by up to the number in flight. The check is not serialised.
- Failed authentications are logged up to 120 per minute across all callers, so a flood of bad tokens cannot fill the table.

## Audit and retention

- **Request log:** `government_api_requests` holds one row per request.
  - Contents: request id, client, token prefix, method, path, operation, status, error code, row count, duration and allow-listed query parameters.
  - It never contains tokens, bodies or learner data.
  - It is append-only: a trigger refuses UPDATE and DELETE.
  - Platform administrators can read it.
- **Learner-level reads** are also written to `audit_log` as `government_api_learner_detail_viewed`.
- **Client administration** is written to `audit_log` as `government_api_client_created` and `government_api_client_revoked`. **Imports** are written as `government_import_committed`, `government_import_rejected` and `school_emis_number_changed`.
- **Retention:** no automatic pruning yet. The log grows by one row per request. A retention period must be decided (POPIA purpose limitation) before production use.

## Versioning

- The version is the first path segment (`/v1`).
- Within v1, changes are additive only: new endpoints, new optional parameters, new response fields.
- Removing or renaming a field, changing a meaning, or tightening validation needs `/v2`. v1 then stays available for a deprecation period announced to every client.
- Undocumented paths return 404 and are not part of the contract.

## Performance (synthetic data, local only)

Test data: a province with 4 districts and 20 schools, 6,004 learners and 240,000 attendance records. Each call went through `gov_api_request` as the service role, on warm runs.

| Call | Time |
| --- | --- |
| `schools` (20 rows) | 5–18 ms |
| `learners` (one school, 300 enrolments) | 14 ms |
| `interventions` | 3–5 ms |
| `attendance` (20 schools, monthly) | 0.50–0.54 s |
| `attendance` (5 schools) | 0.19–0.22 s |
| `assessments` (20 schools) | 1.03–1.06 s |
| `reports/schools` (20 schools) | 0.68–0.71 s |
| `staff` (20 schools) | 0.71–0.72 s |
| `data-quality` (20 schools) | 0.68–0.74 s |
| `reports/summary` | 0.65–0.74 s |
| `reports/provinces/{id}` | 0.81–1.00 s |

Through the real Edge Function and PostgREST on the small stack-test dataset, calls took 8–100 ms. **No production timing exists yet.**

## Tests

- **Database** (`zzz_provincial_and_api.test.sql`, `api:` checks):
  - client administration and MFA; only the token hash is stored and it cannot be read;
  - direct calls by users or anonymous callers are refused, and the client context cannot be forged;
  - 401, 403, 404, 405, 409 and 422 cases; scope and ID manipulation; pagination;
  - the learner grant and audit; definitions equal to the reports;
  - rate limit, revocation and expiry; the import workflow and idempotency;
  - the append-only, token-free request log.
- **Deno:** `supabase/functions/_shared/government/api.test.ts` covers parsing, parameter pollution, body limits, methods, the error model and no token echo.
- **Real stack:** `supabase/stack-tests/government-api.mjs` (34 checks) uses real GoTrue sign-in and TOTP, real PostgREST, and the real Edge Function run with Deno.
