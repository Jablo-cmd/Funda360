import { describe, expect, it, vi } from 'vitest';
import { fetchAllRows } from './pagination';

describe('fetchAllRows', () => {
  it('returns every row in a single page when the result is under the page size', async () => {
    const page = vi.fn().mockResolvedValue({ data: [1, 2, 3], error: null });
    const result = await fetchAllRows(page, 1000);
    expect(result).toEqual([1, 2, 3]);
    expect(page).toHaveBeenCalledTimes(1);
    expect(page).toHaveBeenCalledWith(0, 999);
  });

  it('pages through multiple full pages and stops at the first short page — the exact scenario that used to silently truncate', async () => {
    const pageSize = 2;
    const allRows = [1, 2, 3, 4, 5];
    const page = vi.fn(async (from: number, to: number) => ({ data: allRows.slice(from, to + 1), error: null }));

    const result = await fetchAllRows(page, pageSize);

    expect(result).toEqual([1, 2, 3, 4, 5]);
    expect(page).toHaveBeenCalledTimes(3);
    expect(page).toHaveBeenNthCalledWith(1, 0, 1);
    expect(page).toHaveBeenNthCalledWith(2, 2, 3);
    expect(page).toHaveBeenNthCalledWith(3, 4, 5);
  });

  it('stops immediately and returns an empty array when the first page is empty', async () => {
    const page = vi.fn().mockResolvedValue({ data: [], error: null });
    const result = await fetchAllRows(page);
    expect(result).toEqual([]);
    expect(page).toHaveBeenCalledTimes(1);
  });

  it('stops immediately on a null data response, treating it the same as empty', async () => {
    const page = vi.fn().mockResolvedValue({ data: null, error: null });
    const result = await fetchAllRows(page);
    expect(result).toEqual([]);
  });

  it('throws the underlying error rather than swallowing it, without issuing a further page', async () => {
    const page = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(fetchAllRows(page)).rejects.toEqual({ message: 'boom' });
    expect(page).toHaveBeenCalledTimes(1);
  });

  it('exactly-page-size-multiple result still terminates (does not loop forever on an exact final page)', async () => {
    const pageSize = 2;
    const allRows = [1, 2, 3, 4];
    const page = vi.fn(async (from: number, to: number) => ({ data: allRows.slice(from, to + 1), error: null }));

    const result = await fetchAllRows(page, pageSize);

    expect(result).toEqual([1, 2, 3, 4]);
    // one extra call after the exact-multiple page confirms it's actually empty, not just short
    expect(page).toHaveBeenCalledTimes(3);
  });
});
