import { useEffect, useState } from 'react';
import type { BaseRecord } from './storage';

type StoreLike<T extends BaseRecord> = {
  list(): Promise<T[]>;
  subscribe(listener: () => void): () => void;
};

/**
 * Subscribe a component to a Store. Returns the current rows + a
 * `reload` thunk for manual refresh. Initial value is [] and is
 * replaced once the (synchronous) localStorage read resolves.
 */
export function useStore<T extends BaseRecord>(store: StoreLike<T>): {
  rows: T[];
  reload: () => void;
  loading: boolean;
} {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    store.list().then(r => {
      setRows(r);
      setLoading(false);
    });
  };

  useEffect(() => {
    reload();
    const unsub = store.subscribe(reload);
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  return { rows, reload, loading };
}
