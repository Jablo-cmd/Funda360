// government-api — the Government Data & Integration API (v1).
//
// Route: https://<project>.supabase.co/functions/v1/government-api/v1/...
// Authentication: Authorization: Bearer f360g_<prefix>_<secret>, issued by a
// platform administrator under Education Areas -> Integrations. The token is
// not a Supabase JWT, so this function is deployed with --no-verify-jwt.
//
// The function holds the service-role key only to call one RPC,
// gov_api_request(), which is executable by the service role alone and does
// all authentication, authorisation, scoping, rate limiting and request
// logging in the database. See docs/GOVERNMENT_API.md.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleGovernmentApi } from '../_shared/government/api.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

Deno.serve((req) =>
  handleGovernmentApi(req, async (args) => {
    const { data, error } = await db.rpc('gov_api_request', args);
    return { data, error };
  })
);
