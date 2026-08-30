import { describe, it, expect } from 'vitest';
import { toCsv, parseCsv } from '@/lib/csv';

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

describe('parseCsv', () => {
  it('parses a simple header + data row', () => {
    expect(parseCsv('A,B\r\none,two')).toEqual([
      ['A', 'B'],
      ['one', 'two'],
    ]);
  });

  it('handles bare \\n line endings, not just \\r\\n', () => {
    expect(parseCsv('A,B\none,two\nthree,four')).toEqual([
      ['A', 'B'],
      ['one', 'two'],
      ['three', 'four'],
    ]);
  });

  it('un-quotes a cell that was quoted because it contained a comma', () => {
    expect(parseCsv('Name\r\n"Smith, John"')).toEqual([['Name'], ['Smith, John']]);
  });

  it('un-escapes doubled quotes inside a quoted cell', () => {
    expect(parseCsv('Note\r\n"He said ""hi"""')).toEqual([['Note'], ['He said "hi"']]);
  });

  it('preserves an embedded newline inside a quoted cell as a single cell, not a new row', () => {
    expect(parseCsv('Note\r\n"line one\nline two"')).toEqual([['Note'], ['line one\nline two']]);
  });

  it('does not produce a phantom empty row from a trailing newline', () => {
    expect(parseCsv('A,B\r\none,two\r\n')).toEqual([
      ['A', 'B'],
      ['one', 'two'],
    ]);
  });

  it('parses a file with no trailing newline at all', () => {
    expect(parseCsv('A,B\r\none,two')).toEqual([
      ['A', 'B'],
      ['one', 'two'],
    ]);
  });

  it('returns an empty array for an empty string', () => {
    expect(parseCsv('')).toEqual([]);
  });

  it('round-trips through toCsv for a representative set of tricky values', () => {
    const rows = [
      { name: 'Smith, John', note: 'He said "hi"\nTwice.' },
      { name: 'Plain', note: 'Nothing special' },
    ];
    const columns = [
      { key: 'name' as const, header: 'Name' },
      { key: 'note' as const, header: 'Note' },
    ];
    const csv = toCsv(rows, columns);
    const parsed = parseCsv(csv);
    expect(parsed).toEqual([['Name', 'Note'], ...rows.map((r) => [r.name, r.note])]);
  });
});
