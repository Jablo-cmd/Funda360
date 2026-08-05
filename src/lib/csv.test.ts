import { describe, it, expect } from 'vitest';
import { toCsv } from '@/lib/csv';

describe('toCsv', () => {
  it('serializes rows in the given column order, regardless of object key order', () => {
    const rows = [{ b: 'two', a: 'one' }];
    const csv = toCsv(rows, [
      { key: 'a', header: 'A' },
      { key: 'b', header: 'B' },
    ]);
    expect(csv).toBe('A,B\r\none,two');
  });

  it('produces only a header row for an empty list', () => {
    const csv = toCsv([] as { a: string }[], [{ key: 'a', header: 'A' }]);
    expect(csv).toBe('A');
  });

  it('quotes a cell containing a comma', () => {
    const csv = toCsv([{ name: 'Smith, John' }], [{ key: 'name', header: 'Name' }]);
    expect(csv).toBe('Name\r\n"Smith, John"');
  });

  it('escapes embedded double quotes by doubling them', () => {
    const csv = toCsv([{ note: 'He said "hi"' }], [{ key: 'note', header: 'Note' }]);
    expect(csv).toBe('Note\r\n"He said ""hi"""');
  });

  it('quotes a cell containing a newline', () => {
    const csv = toCsv([{ note: 'line one\nline two' }], [{ key: 'note', header: 'Note' }]);
    expect(csv).toBe('Note\r\n"line one\nline two"');
  });

  it('renders null and undefined as an empty cell', () => {
    const csv = toCsv([{ value: null }, { value: undefined }], [{ key: 'value', header: 'Value' }]);
    expect(csv).toBe('Value\r\n\r\n');
  });

  it('is deterministic for the same input', () => {
    const rows = [{ a: '1', b: '2' }];
    const columns = [
      { key: 'a' as const, header: 'A' },
      { key: 'b' as const, header: 'B' },
    ];
    expect(toCsv(rows, columns)).toBe(toCsv(rows, columns));
  });
});
