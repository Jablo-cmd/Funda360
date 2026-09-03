// Deno tests for the payment provider adapters.
// Run: deno test supabase/functions/_shared/providers/providers.test.ts

import { assert, assertEquals, assertNotEquals } from 'jsr:@std/assert@1';
import { hmacSha256Hex, sha256Hex, sha512Hex, timingSafeEqual } from './types.ts';
import { payfastAdapter, payfastSignature } from './payfast.ts';
import { ozowResponseHash, ozowAdapter } from './ozow.ts';
import { netcashAdapter } from './netcash.ts';
import { yocoAdapter } from './yoco.ts';

Deno.test('crypto helpers are deterministic and distinct', async () => {
  assertEquals(await sha256Hex('abc'), await sha256Hex('abc'));
  assertNotEquals(await sha256Hex('abc'), await sha256Hex('abd'));
  assert((await sha512Hex('abc')).length === 128);
  assertEquals(await hmacSha256Hex('key', 'msg'), await hmacSha256Hex('key', 'msg'));
  assertNotEquals(await hmacSha256Hex('key', 'msg'), await hmacSha256Hex('key2', 'msg'));
});

Deno.test('timingSafeEqual', () => {
  assert(timingSafeEqual('deadbeef', 'deadbeef'));
  assert(!timingSafeEqual('deadbeef', 'deadbee0'));
  assert(!timingSafeEqual('short', 'longer-string'));
});

Deno.test('PayFast signature is stable and passphrase-sensitive', async () => {
  const fields: [string, string][] = [
    ['merchant_id', '10000100'],
    ['merchant_key', '46f0cd694581a'],
    ['amount', '100.00'],
    ['item_name', 'Test Item'],
  ];
  const a = await payfastSignature(fields, undefined);
  const b = await payfastSignature(fields, undefined);
  const withPass = await payfastSignature(fields, 'my-passphrase');
  assertEquals(a, b);
  assertEquals(a.length, 32); // md5 hex
  assertNotEquals(a, withPass);
});

Deno.test('PayFast buildRedirect produces a signed POST form', async () => {
  const redirect = await payfastAdapter.buildRedirect(
    {
      reference: 'PI-abc',
      amount: 250.5,
      currency: 'ZAR',
      returnUrl: 'https://app.test/return',
      cancelUrl: 'https://app.test/cancel',
      notifyUrl: 'https://fn.test/webhook',
      itemName: 'School fees',
      itemDescription: 'Invoice payment',
    },
    { merchantConfig: { merchant_id: '10000100', merchant_key: '46f0cd694581a' }, secrets: {}, mode: 'test' },
  );
  assertEquals(redirect.method, 'POST');
  assert(redirect.url.includes('sandbox.payfast.co.za'));
  assertEquals(redirect.fields.amount, '250.50');
  assertEquals(redirect.fields.m_payment_id, 'PI-abc');
  assert(redirect.fields.signature.length === 32);
});

Deno.test('Ozow webhook: valid hash accepted, tampered hash rejected', async () => {
  const privateKey = 'test-private-key';
  const data: Record<string, string> = {
    SiteCode: 'TSTSTORE1',
    TransactionId: 'ozow-tx-1',
    TransactionReference: 'PI-xyz',
    Amount: '250.50',
    Status: 'Complete',
    CurrencyCode: 'ZAR',
    IsTest: 'true',
    StatusMessage: 'Test transaction',
  };
  const goodHash = await ozowResponseHash(data, privateKey);

  Deno.env.set('OZOW_PRIVATE_KEY', privateKey);

  const okReq = new Request('https://fn.test/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...data, Hash: goodHash }).toString(),
  });
  const okResult = await ozowAdapter.parseWebhook(okReq, {
    merchantConfig: {},
    secrets: { OZOW_PRIVATE_KEY: privateKey },
    mode: 'test',
  });
  assert(okResult.signatureValid);
  assertEquals(okResult.outcome, 'succeeded');
  assertEquals(okResult.reference, 'PI-xyz');
  assertEquals(okResult.amount, 250.5);

  const badReq = new Request('https://fn.test/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...data, Hash: goodHash.replace(/.$/, '0') }).toString(),
  });
  const badResult = await ozowAdapter.parseWebhook(badReq, {
    merchantConfig: {},
    secrets: { OZOW_PRIVATE_KEY: privateKey },
    mode: 'test',
  });
  assert(!badResult.signatureValid);
});

Deno.test('Netcash webhook: M1 service-key match is the signature check', async () => {
  const serviceKey = 'netcash-service-key';
  const okReq = new Request('https://fn.test/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ M1: serviceKey, p2: 'PI-1', Amount: '100.00', TransactionAccepted: 'true' }).toString(),
  });
  const ok = await netcashAdapter.parseWebhook(okReq, {
    merchantConfig: {},
    secrets: { NETCASH_PAYNOW_SERVICE_KEY: serviceKey },
    mode: 'live',
  });
  assert(ok.signatureValid);
  assertEquals(ok.outcome, 'succeeded');

  const badReq = new Request('https://fn.test/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ M1: 'wrong-key', p2: 'PI-1', Amount: '100.00', TransactionAccepted: 'true' }).toString(),
  });
  const bad = await netcashAdapter.parseWebhook(badReq, {
    merchantConfig: {},
    secrets: { NETCASH_PAYNOW_SERVICE_KEY: serviceKey },
    mode: 'live',
  });
  assert(!bad.signatureValid);
});

Deno.test('Yoco webhook: missing signature secret means signatureValid=false', async () => {
  const req = new Request('https://fn.test/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'webhook-id': 'evt_1', 'webhook-timestamp': '123' },
    body: JSON.stringify({ type: 'payment.succeeded', payload: { id: 'p_1', status: 'succeeded', amount: 10000, metadata: { reference: 'PI-1' } } }),
  });
  const result = await yocoAdapter.parseWebhook(req, { merchantConfig: {}, secrets: {}, mode: 'test' });
  assert(!result.signatureValid);
  assertEquals(result.outcome, 'succeeded');
  assertEquals(result.amount, 100);
});
