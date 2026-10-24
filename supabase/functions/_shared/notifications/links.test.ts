import { assertEquals } from 'jsr:@std/assert@1';
import { absoluteLink } from './links.ts';

Deno.test('an app path becomes a full link on the app host', () => {
  assertEquals(absoluteLink('/parent/fees'), 'https://app.funda360.aurisnexus.co.za/parent/fees');
  assertEquals(absoluteLink('/x', 'https://staging.example.test/'), 'https://staging.example.test/x');
});

Deno.test('absolute http(s) links are kept; anything else is dropped', () => {
  assertEquals(absoluteLink('https://example.test/a'), 'https://example.test/a');
  assertEquals(absoluteLink('javascript:alert(1)'), '');
  assertEquals(absoluteLink('//evil.test/x'), '');
  assertEquals(absoluteLink('parent/fees'), '');
});
