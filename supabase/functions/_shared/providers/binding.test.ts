import { assertEquals } from 'jsr:@std/assert@1';
import { type BindingInput, bindingProblems } from './binding.ts';

function input(overrides: Partial<BindingInput> = {}): BindingInput {
  return {
    provider: 'payfast',
    mode: 'live',
    intent: { school_id: 's1', provider: 'payfast', mode: 'live' },
    config: {
      school_id: 's1',
      provider: 'payfast',
      mode: 'live',
      enabled: true,
      merchant_config: { merchant_id: '10000100' },
    },
    raw: { merchant_id: '10000100', m_payment_id: 'REF-1' },
    secrets: { PAYFAST_PASSPHRASE: 'secret' },
    ...overrides,
  };
}

Deno.test('a correctly bound PayFast callback has no problems', () => {
  assertEquals(bindingProblems(input()), []);
});

Deno.test('an unknown reference cannot settle', () => {
  assertEquals(bindingProblems(input({ intent: null })), ['unknown_reference']);
});

Deno.test('a payment to another merchant cannot settle this school’s intent', () => {
  assertEquals(bindingProblems(input({ raw: { merchant_id: '99999999' } })), [
    'merchant_mismatch:merchant_id',
  ]);
});

Deno.test('a sandbox (mode=test) callback cannot settle a live intent', () => {
  const problems = bindingProblems(input({ mode: 'test' }));
  assertEquals(problems.includes('mode_mismatch'), true);
  assertEquals(problems.includes('config_mode_mismatch'), true);
});

Deno.test('a callback from a different provider cannot settle the intent', () => {
  const problems = bindingProblems(input({ provider: 'ozow', raw: { SiteCode: 'X' } }));
  assertEquals(problems.includes('provider_mismatch'), true);
});

Deno.test('a disabled gateway cannot settle', () => {
  const base = input();
  assertEquals(bindingProblems({ ...base, config: { ...base.config!, enabled: false } }), [
    'gateway_disabled',
  ]);
});

Deno.test('live PayFast requires a passphrase so its signature is a secret', () => {
  assertEquals(bindingProblems(input({ secrets: {} })), ['payfast_passphrase_required_in_live_mode']);
  assertEquals(
    bindingProblems(
      input({
        mode: 'test',
        intent: { school_id: 's1', provider: 'payfast', mode: 'test' },
        config: {
          school_id: 's1',
          provider: 'payfast',
          mode: 'test',
          enabled: true,
          merchant_config: { merchant_id: '10000100' },
        },
        secrets: {},
      }),
    ),
    [],
  );
});

Deno.test('Ozow callbacks must carry the school’s site code', () => {
  const ozow = input({
    provider: 'ozow',
    intent: { school_id: 's1', provider: 'ozow', mode: 'live' },
    config: {
      school_id: 's1',
      provider: 'ozow',
      mode: 'live',
      enabled: true,
      merchant_config: { site_code: 'SCH-001' },
    },
  });
  assertEquals(bindingProblems({ ...ozow, raw: { SiteCode: 'SCH-001' } }), []);
  assertEquals(bindingProblems({ ...ozow, raw: { SiteCode: 'OTHER' } }), ['merchant_mismatch:SiteCode']);
});
