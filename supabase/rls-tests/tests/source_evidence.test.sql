-- Source evidence ladder (20261003090000): indexed -> retrieved -> identity verified -> content reviewed.
-- These are four different facts. None may be claimed without its evidence, and none implies curriculum verification.
-- Fixtures are created here and removed at the end.

create or replace function test_util.become(p_uid uuid, p_role text, p_tenant uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', test_util.jwt_claims(p_uid, p_role, p_tenant), true);
  execute 'set local role authenticated';
end $$;

create or replace function test_util.err_of(p_sql text) returns text language plpgsql as $$
declare v_msg text;
begin
  begin
    execute p_sql;
    return 'ok';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    return v_msg;
  end;
end $$;
grant execute on function test_util.err_of(text) to authenticated, anon;

create table test_util.src_ctx (k text primary key, v uuid);
grant select, insert on test_util.src_ctx to authenticated;

-- A RECORD line as printed by docs/sources/verify-dbe-sources.sh: RECORD n state http redirects size sha256 content_type final_url requested_url
create or replace function test_util.rec(p_url text, p_state text default 'retrieved', p_http text default '200', p_size text default '1234',
  p_sha text default null, p_final text default null) returns text language sql as $$
  select concat_ws(E'\t', 'RECORD', '1', p_state, p_http, '0', p_size, coalesce(p_sha, repeat('ab', 32)), 'application/pdf', coalesce(p_final, p_url), p_url)
$$;

-- ---------------------------------------------------------------------------
-- 1. Climbing the ladder, one step at a time
-- ---------------------------------------------------------------------------
do $$
declare
  v_id uuid; v_lvl text; v_row public.curriculum_sources; e text; n int; n_ver_before int; n_ver_after int;
  v_sha text := repeat('ab', 32);
  v_url text := 'https://example.org/ladder';
begin
  select count(*) into n_ver_before from public.content_verifications;
  perform test_util.become('44444444-4444-4444-4444-444444444444', 'platform_administrator', null);
  e := test_util.err_of($q$select public.register_curriculum_source('Bad', 'Test publisher', 'other', 'Fixture licence', 'https://example.org/x', null, false, repeat('a', 64), current_date)$q$);
  call test_util.record('a client cannot hand over a checksum at registration', e like 'invalid_argument%checksum cannot be supplied%', e);
  e := test_util.err_of($q$select public.register_curriculum_source('Bad', 'Test publisher', 'other', 'Fixture licence', 'https://example.org/x', null, false, null, null, null, null, null, null, array['http://insecure.example'])$q$);
  call test_util.record('alternate URLs must be https', e like 'invalid_argument%https%', e);
  v_id := public.register_curriculum_source('Ladder test document', 'Test publisher', 'other', 'Fixture licence', v_url, '2026', false, null, null, 'note',
    'South Africa', 'Mathematics', 'Intermediate Phase', array['https://example.org/ladder-alias'], '978-0-00-000000-0');
  insert into test_util.src_ctx values ('src', v_id);
  execute 'reset role';
  select * into v_row from public.curriculum_sources where id = v_id;
  v_lvl := public.source_evidence_level(v_row);
  call test_util.record('a new source is only registered: no evidence yet, full description stored',
    v_lvl = 'registered' and v_row.jurisdiction = 'South Africa' and v_row.subject = 'Mathematics' and v_row.grade_phase = 'Intermediate Phase'
    and v_row.alternate_urls = array['https://example.org/ladder-alias'] and v_row.isbn = '978-0-00-000000-0' and v_row.licence_status = 'unreviewed'
    and v_row.retrieval_status = 'not_attempted', v_lvl);

  perform test_util.become('44444444-4444-4444-4444-444444444444', 'platform_administrator', null);
  perform public.record_source_evidence(v_id, 'indexed', null, date '2026-10-01', 'Seen in the publisher index');
  execute 'reset role';
  select * into v_row from public.curriculum_sources where id = v_id;
  call test_util.record('indexed: found at a location, and nothing more is claimed', public.source_evidence_level(v_row) = 'indexed' and v_row.indexed_on = date '2026-10-01'
    and v_row.checksum_sha256 is null and v_row.status = 'registered', public.source_evidence_level(v_row));

  perform test_util.become('44444444-4444-4444-4444-444444444444', 'platform_administrator', null);
  e := test_util.err_of(format('select public.record_source_review(%L, ''identity'', ''verified'', ''looks right'')', v_id));
  call test_util.record('identity cannot be verified without the downloaded bytes', e like 'invalid_state%actual bytes%', e);
  e := test_util.err_of(format('select public.verify_curriculum_source(%L)', v_id));
  call test_util.record('the older verify entry point is just as strict', e like 'invalid_state%actual bytes%', e);
  e := test_util.err_of(format('select public.record_source_review(%L, ''document'', ''reviewed'', ''read it'')', v_id));
  call test_util.record('a document cannot be reviewed before its identity is verified', e like 'invalid_state%identity first%', e);
  e := test_util.err_of(format('select public.record_source_evidence(%L, ''retrieved'', %L, current_date - 1)', v_id, v_sha));
  call test_util.record('the client cannot supply a checksum and date: retrieval comes from the script output', e like 'invalid_argument%verify-dbe-sources%', e);
  e := test_util.err_of(format('select public.record_source_evidence(%L, ''content_reviewed'', null, null, ''read it'')', v_id));
  call test_util.record('a document review is a decision, not a one-line evidence record', e like 'invalid_argument%record_source_review%', e);

  e := test_util.err_of(format('select public.record_source_retrieval(%L, %L)', v_id, upper(v_sha)));
  call test_util.record('free text is not a retrieval record', e like 'invalid_argument%RECORD line%', e);
  e := test_util.err_of(format('select public.record_source_retrieval(%L, %L)', v_id, test_util.rec(v_url, p_sha => upper(v_sha))));
  call test_util.record('a checksum must be 64 lowercase hexadecimal characters (upper case refused)', e like 'invalid_argument%SHA-256%', e);
  e := test_util.err_of(format('select public.record_source_retrieval(%L, %L)', v_id, test_util.rec(v_url, p_sha => 'abc123')));
  call test_util.record('a short checksum is refused', e like 'invalid_argument%SHA-256%', e);
  e := test_util.err_of(format('select public.record_source_retrieval(%L, %L)', v_id, test_util.rec('https://elsewhere.example/doc.pdf')));
  call test_util.record('the requested URL must be a registered location of this source', e like 'invalid_argument%registered location%', e);
  e := test_util.err_of(format('select public.record_source_retrieval(%L, %L)', v_id, test_util.rec(v_url, p_http => '404')));
  call test_util.record('a retrieved file needs an HTTP success status', e like 'invalid_argument%HTTP success%', e);
  e := test_util.err_of(format('select public.record_source_retrieval(%L, %L)', v_id, test_util.rec(v_url, p_size => '0')));
  call test_util.record('a retrieved file has a size above zero', e like 'invalid_argument%size%', e);
  e := test_util.err_of(format('select public.record_source_retrieval(%L, %L)', v_id, test_util.rec(v_url, p_final => 'http://example.org/insecure.pdf')));
  call test_util.record('the final URL must be https', e like 'invalid_argument%https%', e);
  e := test_util.err_of(format('select public.record_source_evidence(%L, ''banana'', null, null, null)', v_id));
  call test_util.record('an unknown evidence level is refused', e like 'invalid_argument%', e);

  perform public.record_source_retrieval(v_id, test_util.rec(v_url, p_state => 'inaccessible', p_http => '403', p_size => '0', p_sha => '-'));
  execute 'reset role';
  select * into v_row from public.curriculum_sources where id = v_id;
  call test_util.record('an inaccessible attempt is recorded as such and gives no checksum', v_row.retrieval_status = 'inaccessible' and v_row.checksum_sha256 is null
    and public.source_evidence_level(v_row) = 'indexed', v_row.retrieval_status);

  perform test_util.become('44444444-4444-4444-4444-444444444444', 'platform_administrator', null);
  perform public.record_source_retrieval(v_id, test_util.rec('https://example.org/ladder-alias', p_sha => v_sha, p_size => '2048', p_final => 'https://example.org/final.pdf'));
  execute 'reset role';
  select * into v_row from public.curriculum_sources where id = v_id;
  call test_util.record('retrieved: bytes recorded from the script output, dated by the server, identity still not verified',
    public.source_evidence_level(v_row) = 'retrieved' and v_row.status = 'registered' and v_row.checksum_sha256 = v_sha and v_row.retrieved_on = current_date
    and v_row.retrieval_size_bytes = 2048 and v_row.retrieval_content_type = 'application/pdf' and v_row.retrieval_final_url = 'https://example.org/final.pdf'
    and v_row.retrieval_status = 'retrieved' and v_row.retrieval_record like 'RECORD%' and v_row.retrieval_recorded_by = '44444444-4444-4444-4444-444444444444',
    public.source_evidence_level(v_row));

  perform test_util.become('44444444-4444-4444-4444-444444444444', 'platform_administrator', null);
  perform public.record_source_retrieval(v_id, test_util.rec(v_url, p_sha => v_sha, p_size => '2048'));
  call test_util.record('recording the same bytes again is harmless', true, 'no error');
  e := test_util.err_of(format('select public.record_source_retrieval(%L, %L)', v_id, test_util.rec(v_url, p_sha => repeat('cd', 32))));
  call test_util.record('a different checksum cannot replace the recorded one without the correction workflow', e like 'invalid_state%correction workflow%', e);

  perform public.record_source_review(v_id, 'identity', 'needs_information', 'Cannot tell the edition from the cover');
  execute 'reset role';
  select * into v_row from public.curriculum_sources where id = v_id;
  call test_util.record('an identity decision other than verified changes nothing about the source', v_row.status = 'registered', v_row.status);
  perform test_util.become('44444444-4444-4444-4444-444444444444', 'platform_administrator', null);
  e := test_util.err_of(format('select public.record_source_review(%L, ''identity'', ''verified'', %L)', v_id, ''));
  call test_util.record('every review needs notes', e like 'invalid_argument%notes%', e);
  perform public.record_source_review(v_id, 'identity', 'verified', 'Compared with the publisher page');
  execute 'reset role';
  select * into v_row from public.curriculum_sources where id = v_id;
  call test_util.record('identity verified: needs the bytes, and is recorded with who and when', public.source_evidence_level(v_row) = 'identity_verified'
    and v_row.status = 'verified' and v_row.verified_by = '44444444-4444-4444-4444-444444444444' and v_row.verified_at is not null and v_row.content_reviewed_at is null,
    public.source_evidence_level(v_row));

  perform test_util.become('44444444-4444-4444-4444-444444444444', 'platform_administrator', null);
  e := test_util.err_of(format('select public.record_source_review(%L, ''document'', ''reviewed'', %L)', v_id, ''));
  call test_util.record('a document review must say what was reviewed', e like 'invalid_argument%', e);
  e := test_util.err_of(format('select public.record_source_review(%L, ''document'', ''issues_found'', ''Read it'')', v_id));
  call test_util.record('issues found must be described', e like 'invalid_argument%issues%', e);
  perform public.record_source_review(v_id, 'document', 'issues_found', 'Read section 3.3.1', 'Page numbering differs from the project record');
  execute 'reset role';
  select * into v_row from public.curriculum_sources where id = v_id;
  call test_util.record('a review that found issues is recorded but does not count as reviewed', v_row.content_reviewed_at is null and public.source_evidence_level(v_row) = 'identity_verified', public.source_evidence_level(v_row));
  perform test_util.become('44444444-4444-4444-4444-444444444444', 'platform_administrator', null);
  perform public.record_source_review(v_id, 'document', 'reviewed', 'Read section 3.3.1 of the 2011 edition');
  execute 'reset role';
  select * into v_row from public.curriculum_sources where id = v_id;
  call test_util.record('content reviewed: a person read the actual document, recorded with who, when and what',
    public.source_evidence_level(v_row) = 'content_reviewed' and v_row.content_reviewed_by = '44444444-4444-4444-4444-444444444444'
    and v_row.content_reviewed_at is not null and v_row.content_review_note like 'Read section 3.3.1%', public.source_evidence_level(v_row));

  perform test_util.become('44444444-4444-4444-4444-444444444444', 'platform_administrator', null);
  e := test_util.err_of(format('select public.record_source_review(%L, ''licence'', ''maybe'', ''x y z'')', v_id));
  call test_util.record('a licence decision must be one of the defined values', e like 'invalid_argument%licence%', e);
  perform public.record_source_review(v_id, 'licence', 'restricted', 'Reference and paraphrase only');
  execute 'reset role';
  select * into v_row from public.curriculum_sources where id = v_id;
  call test_util.record('licence reviewed: status, reviewer and note recorded', v_row.licence_status = 'restricted' and v_row.licence_reviewed_by = '44444444-4444-4444-4444-444444444444'
    and v_row.licence_reviewed_at is not null, v_row.licence_status);

  select count(*) into n from public.curriculum_source_reviews where source_id = v_id;
  call test_util.record('every decision is kept in the source history (needs_information, verified, issues_found, reviewed, licence)', n = 5, 'rows: ' || n);
  e := test_util.err_of(format('update public.curriculum_source_reviews set notes = ''changed'' where source_id = %L', v_id));
  call test_util.record('the source history is append-only (update refused)', e like 'invalid_state%append-only%', e);
  e := test_util.err_of(format('delete from public.curriculum_source_reviews where source_id = %L', v_id));
  call test_util.record('the source history is append-only (delete refused)', e like 'invalid_state%append-only%', e);

  select count(*) into n from public.audit_log where entity_id = v_id and action in
    ('curriculum_source_registered', 'curriculum_source_indexed', 'curriculum_source_retrieved', 'curriculum_source_review_identity', 'curriculum_source_review_document', 'curriculum_source_review_licence');
  call test_util.record('every step is in the audit log', n >= 7, 'rows: ' || n);

  select count(*) into n_ver_after from public.content_verifications;
  call test_util.record('a fully reviewed source does not make any lesson verified: curriculum verification is separate', n_ver_before = n_ver_after, format('before=%s after=%s', n_ver_before, n_ver_after));

  -- Explicit correction: clears the retrieval and every later step; the old values stay in history and audit.
  perform test_util.become('44444444-4444-4444-4444-444444444444', 'platform_administrator', null);
  e := test_util.err_of(format('select public.correct_source_evidence(%L, ''typo'')', v_id));
  call test_util.record('a correction needs a real reason', e like 'invalid_argument%reason%', e);
  perform public.correct_source_evidence(v_id, 'The wrong file was hashed: the script was run against an old URL');
  execute 'reset role';
  select * into v_row from public.curriculum_sources where id = v_id;
  call test_util.record('a correction clears retrieval, identity and document review so they must be redone',
    v_row.checksum_sha256 is null and v_row.retrieved_on is null and v_row.status = 'registered' and v_row.verified_at is null and v_row.content_reviewed_at is null
    and v_row.retrieval_status = 'not_attempted' and public.source_evidence_level(v_row) = 'indexed', public.source_evidence_level(v_row));
  select count(*) into n from public.curriculum_source_reviews where source_id = v_id and kind = 'correction' and checksum_at_review = v_sha;
  call test_util.record('the corrected checksum is kept in the history', n = 1, 'rows: ' || n);
  select count(*) into n from public.audit_log where entity_id = v_id and action = 'curriculum_source_evidence_corrected';
  call test_util.record('the correction is audited', n = 1, 'rows: ' || n);
  perform test_util.become('44444444-4444-4444-4444-444444444444', 'platform_administrator', null);
  perform public.record_source_retrieval(v_id, test_util.rec(v_url, p_sha => v_sha, p_size => '2048'));
  perform public.record_source_review(v_id, 'identity', 'verified', 'Re-verified after the correction');
  execute 'reset role';
  select * into v_row from public.curriculum_sources where id = v_id;
  call test_util.record('after a correction the ladder can be climbed again', v_row.status = 'verified', v_row.status);
end $$;

-- ---------------------------------------------------------------------------
-- 2. The database refuses impossible states, even for direct SQL
-- ---------------------------------------------------------------------------
do $$
declare v_id uuid := (select v from test_util.src_ctx where k = 'src'); e text; v_other uuid;
begin
  e := test_util.err_of(format('update public.curriculum_sources set checksum_sha256 = %L where id = %L', repeat('ef', 32), v_id));
  call test_util.record('a recorded checksum cannot be overwritten, even by direct SQL', e like 'invalid_state%different checksum%', e);

  insert into public.curriculum_sources (title, publisher, doc_type, licence, status) values ('Verified without bytes', 'Test publisher', 'other', 'x', 'registered') returning id into v_other;
  e := test_util.err_of(format('update public.curriculum_sources set status = ''verified'' where id = %L', v_other));
  call test_util.record('identity cannot be "verified" without a checksum and date, even by direct SQL', e like '%curriculum_sources_verified_needs_bytes%', e);
  e := test_util.err_of(format('update public.curriculum_sources set content_reviewed_at = now() where id = %L', v_other));
  call test_util.record('a content review cannot be recorded before identity is verified, even by direct SQL', e like '%curriculum_sources_review_needs_identity%', e);
  e := test_util.err_of(format('update public.curriculum_sources set status = ''retired'' where id = %L', v_other));
  call test_util.record('a source can still be retired', e = 'ok', e);
  perform test_util.become('44444444-4444-4444-4444-444444444444', 'platform_administrator', null);
  e := test_util.err_of(format('select public.record_source_evidence(%L, ''indexed'', null, null, null)', v_other));
  call test_util.record('a retired source takes no new evidence', e like 'invalid_state%retired%', e);
  e := test_util.err_of('select public.record_source_evidence(''00000000-0000-0000-0000-00000000dead'', ''indexed'', null, null, null)');
  call test_util.record('an unknown source is not found', e like 'not_found%', e);
  execute 'reset role';
end $$;

-- ---------------------------------------------------------------------------
-- 3. Who may record evidence
-- ---------------------------------------------------------------------------
do $$
declare v_id uuid := (select v from test_util.src_ctx where k = 'src'); e text; n int;
begin
  perform test_util.become('11111111-1111-1111-1111-111111111111', 'teacher', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  e := test_util.err_of(format('select public.record_source_evidence(%L, ''indexed'', null, null, null)', v_id));
  call test_util.record('a teacher cannot record source evidence', e like 'insufficient_privilege%', e);
  e := test_util.err_of(format('select public.verify_curriculum_source(%L)', v_id));
  call test_util.record('a teacher cannot verify a source', e like 'insufficient_privilege%', e);
  select count(*) into n from public.curriculum_sources;
  call test_util.record('a teacher cannot read the source register', n = 0, 'visible: ' || n);
  e := test_util.err_of(format('update public.curriculum_sources set status = ''verified'' where id = %L', v_id));
  call test_util.record('a teacher cannot write a source directly', e <> 'ok' or n = 0, e);
  perform test_util.become('22222222-2222-2222-2222-222222222222', 'school_owner', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  e := test_util.err_of(format('select public.record_source_retrieval(%L, %L)', v_id, test_util.rec('https://example.org/ladder')));
  call test_util.record('a school owner cannot record source evidence', e like 'insufficient_privilege%', e);
  execute 'reset role';
  call test_util.record('anonymous users cannot call the evidence functions',
    not has_function_privilege('anon', 'public.record_source_evidence(uuid, text, text, date, text)', 'execute')
    and not has_function_privilege('anon', 'public.verify_curriculum_source(uuid, text)', 'execute')
    and not has_function_privilege('anon', 'public.record_source_retrieval(uuid, text)', 'execute')
    and not has_function_privilege('anon', 'public.record_source_review(uuid, text, text, text, text)', 'execute')
    and not has_function_privilege('anon', 'public.correct_source_evidence(uuid, text)', 'execute'), 'anon execute');
  call test_util.record('the evidence helpers are internal',
    not has_function_privilege('authenticated', 'public.source_evidence_level(public.curriculum_sources)', 'execute')
    and not has_function_privilege('authenticated', 'public.curriculum_sources_protect_evidence()', 'execute'), 'authenticated execute');
  select count(*) into n from pg_proc p where p.proname in ('record_source_evidence', 'verify_curriculum_source', 'ai_begin_generation', 'record_source_retrieval', 'record_source_review', 'correct_source_evidence', 'register_curriculum_source') and p.prosecdef
     and not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%');
  call test_util.record('the new and replaced functions pin their search_path', n = 0, 'unpinned: ' || n);
end $$;

-- ---------------------------------------------------------------------------
-- 4. A superseded version takes no new AI drafts (the draft belongs in its replacement)
-- ---------------------------------------------------------------------------
do $$
declare v_old uuid; v_new uuid; v_topic uuid; v_obj uuid; e text; v_req_before int; v_req_after int;
begin
  insert into public.curriculum_versions (code, name, source) values ('SUPERSEDE-OLD', 'Old version', 'test') returning id into v_old;
  insert into public.curriculum_versions (code, name, source, supersedes_version_id) values ('SUPERSEDE-NEW', 'New version', 'test', v_old) returning id into v_new;
  insert into test_util.src_ctx values ('v_old', v_old), ('v_new', v_new);
  select count(*) into v_req_before from public.ai_generation_requests;
  perform test_util.become('44444444-4444-4444-4444-444444444444', 'platform_administrator', null);
  e := test_util.err_of(format('select public.ai_begin_generation(%L, %L, array[%L]::uuid[], null, ''en'', ''mock'', ''mock-model-1'', ''p1'')', v_old, v_old, v_old));
  call test_util.record('AI drafting against a superseded version is refused before anything else', e like 'invalid_state%superseded%replacement%', e);
  e := test_util.err_of(format('select public.ai_begin_generation(%L, %L, array[%L]::uuid[], null, ''en'', ''mock'', ''mock-model-1'', ''p1'')', v_new, v_new, v_new));
  call test_util.record('the replacement is not treated as superseded', e not like '%superseded%', e);
  execute 'reset role';
  select count(*) into v_req_after from public.ai_generation_requests;
  call test_util.record('a refused request creates no generation record', v_req_before = v_req_after, format('before=%s after=%s', v_req_before, v_req_after));
end $$;

-- ---------------------------------------------------------------------------
-- 5. Teardown
-- ---------------------------------------------------------------------------
reset role;
set session_replication_role = replica;
delete from public.audit_log where entity_id in (select id from public.curriculum_sources where title in ('Ladder test document', 'Verified without bytes'));
delete from public.curriculum_source_reviews where source_id in (select id from public.curriculum_sources where title in ('Ladder test document', 'Verified without bytes'));
delete from public.curriculum_sources where title in ('Ladder test document', 'Verified without bytes');
delete from public.curriculum_versions where code in ('SUPERSEDE-NEW', 'SUPERSEDE-OLD');
set session_replication_role = origin;
drop table test_util.src_ctx;
drop function test_util.rec(text, text, text, text, text, text);
