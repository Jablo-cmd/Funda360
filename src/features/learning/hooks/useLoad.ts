import { useCallback, useEffect, useRef, useState } from 'react';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface LoadState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Loads data when `key` changes (and `enabled` is true). A newer load always wins: a slow, stale
 * response can never overwrite the result of a later one (for example after switching class).
 */
export function useLoad<T>(loader: () => Promise<T>, key: string, enabled = true): LoadState<T> {
  const loaderRef = useRef(loader);
  const latest = useRef(0);
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loaderRef.current = loader;
  });

  const run = useCallback(async () => {
    const id = ++latest.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await loaderRef.current();
      if (id === latest.current) setData(result);
    } catch (err) {
      if (id === latest.current) {
        setData(null);
        setError(getDbErrorMessage(err, 'Something went wrong loading this. Please try again.'));
      }
    } finally {
      if (id === latest.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      latest.current += 1;
      setData(null);
      setIsLoading(false);
      return;
    }
    void run();
  }, [enabled, key, run]);

  return { data, isLoading, error, reload: run };
}
