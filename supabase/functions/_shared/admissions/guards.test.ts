import { assert, assertEquals, assertNotEquals } from 'jsr:@std/assert@1';
import {
  clientIp,
  FAIL_CLOSED_ACTIONS,
  hashedActorId,
  isAcceptableDocument,
  isOwnDocumentPath,
  limitKey,
  normaliseDate,
} from './guards.ts';

Deno.test('clientIp prefers the Cloudflare-set address over anything the client sends (S-3)', () => {
  const headers = new Headers({
    'cf-connecting-ip': '41.1.2.3',
    'x-forwarded-for': '6.6.6.6, 41.1.2.3, 172.16.0.1',
  });
  assertEquals(clientIp(headers), { ip: '41.1.2.3', source: 'cf-connecting-ip' });
});

Deno.test('clientIp never trusts the first (client-chosen) X-Forwarded-For hop', () => {
  assertEquals(clientIp(new Headers({ 'x-real-ip': '41.1.2.3', 'x-forwarded-for': '6.6.6.6' })), {
    ip: '41.1.2.3',
    source: 'x-real-ip',
  });
  assertEquals(clientIp(new Headers({ 'x-forwarded-for': '6.6.6.6, 41.1.2.3' })), {
    ip: '41.1.2.3',
    source: 'x-forwarded-for-last',
  });
  assertEquals(clientIp(new Headers()), { ip: 'unknown', source: 'none' });
});

Deno.test('rotating the spoofable header does not change the rate-limit key', async () => {
  const salt = 's1';
  const keys = new Set<string>();
  for (const spoofed of ['1.1.1.1', '2.2.2.2', '3.3.3.3']) {
    const { ip } = clientIp(new Headers({ 'cf-connecting-ip': '41.1.2.3', 'x-forwarded-for': spoofed }));
    keys.add(await hashedActorId(ip, salt));
  }
  assertEquals(keys.size, 1);
});

Deno.test('hashedActorId is stable, salted and UUID-shaped', async () => {
  const a = await hashedActorId('41.1.2.3', 's1');
  assertEquals(a, await hashedActorId('41.1.2.3', 's1'));
  assertNotEquals(a, await hashedActorId('41.1.2.3', 's2'));
  assert(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(a));
});

Deno.test('keyed limits normalise the reference and email they are keyed on', () => {
  assertEquals(limitKey('  ADM-2026-0001-AB12CD '), 'adm-2026-0001-ab12cd');
  assertEquals(limitKey('Parent@Example.COM'), 'parent@example.com');
  assertEquals(limitKey(undefined), '');
});

Deno.test('limiters fail closed for actions that create data or test a secret', () => {
  for (const action of ['start', 'resume', 'upload-url', 'register-doc']) {
    assert(FAIL_CLOSED_ACTIONS.has(action));
  }
  for (const action of ['config', 'get', 'save']) assert(!FAIL_CLOSED_ACTIONS.has(action));
});

Deno.test('documents can only be registered inside their own application folder', () => {
  assert(isOwnDocumentPath('s1/app1/abc-birth.pdf', 's1', 'app1'));
  assert(!isOwnDocumentPath('s1/app2/abc-birth.pdf', 's1', 'app1'), 'another application');
  assert(!isOwnDocumentPath('s2/app1/abc-birth.pdf', 's1', 'app1'), 'another school');
  assert(!isOwnDocumentPath('s1/app1/../app2/x.pdf', 's1', 'app1'), 'traversal');
  assert(!isOwnDocumentPath('s1/app1/nested/x.pdf', 's1', 'app1'), 'nested');
  assert(!isOwnDocumentPath('s1/app1/', 's1', 'app1'), 'empty name');
});

Deno.test('only PDF/PNG/JPEG up to 10 MB are accepted', () => {
  assert(isAcceptableDocument('application/pdf', 1024));
  assert(!isAcceptableDocument('text/html', 1024));
  assert(!isAcceptableDocument('application/pdf', 20 * 1024 * 1024));
  assert(!isAcceptableDocument('application/pdf', 0));
});

Deno.test('normaliseDate', () => {
  assertEquals(normaliseDate('2014-03-01'), '2014-03-01');
  assertEquals(normaliseDate('2014-03-01T00:00:00Z'), '2014-03-01');
  assertEquals(normaliseDate('01/03/2014'), null);
});
