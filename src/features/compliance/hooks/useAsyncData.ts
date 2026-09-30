import { useCallback, useEffect, useRef, useState } from 'react';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface AsyncData<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Loads `loader()` whenever `deps` change and ignores responses from stale
 * requests (a slower earlier request can never overwrite a newer one).
 */
export function useAsyncData<T>(
  loader: () => Promise<T>,
  deps: readonly unknown[],
  fallbackError: string,
): AsyncData<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const requestId = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- the caller's deps define when to reload
  const load = useCallback(loader, deps);

  useEffect(() => {
    const id = ++requestId.current;
    setIsLoading(true);
    setError(null);
    load()
      .then((result) => {
        if (id === requestId.current) setData(result);
      })
      .catch((err: unknown) => {
        if (id === requestId.current) setError(getDbErrorMessage(err, fallbackError));
      })
      .finally(() => {
        if (id === requestId.current) setIsLoading(false);
      });
  }, [load, nonce, fallbackError]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, isLoading, error, reload };
}
