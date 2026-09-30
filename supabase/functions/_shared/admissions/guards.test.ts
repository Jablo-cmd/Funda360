import { assert, assertEquals, assertNotEquals } from 'jsr:@std/assert@1';
import { clientIp, ipActorId, isAcceptableDocument, isOwnDocumentPath, normaliseDate } from './guards.ts';

Deno.test('clientIp takes the first forwarded hop', () => {
  assertEquals(clientIp(new Headers({ 'x-forwarded-for': '41.1.2.3, 10.0.0.1' })), '41.1.2.3');
  assertEquals(clientIp(new Headers()), 'unknown');
});

Deno.test('ipActorId is stable, salted and UUID-shaped', async () => {
  const a = await ipActorId('41.1.2.3', 's1');
  assertEquals(a, await ipActorId('41.1.2.3', 's1'));
  assertNotEquals(a, await ipActorId('41.1.2.3', 's2'));
  assert(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(a));
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
