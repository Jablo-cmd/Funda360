const KEY = 'funda360-offline-queue';

export type OfflineOperation = {
  id: string;
  createdAt: string;
  table: string;
  payload: Record<string, unknown>;
};

function read(): OfflineOperation[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as OfflineOperation[]; } catch { return []; }
}

function write(items: OfflineOperation[]) { localStorage.setItem(KEY, JSON.stringify(items)); }

export function queueOfflineOperation(table: string, payload: Record<string, unknown>) {
  const items = read();
  items.push({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), table, payload });
  write(items);
  return items.length;
}

export function getOfflineQueue() { return read(); }

export function clearOfflineQueue() { write([]); }

export function registerOfflineSync(onReconnect: () => void) {
  const handler = () => { if (navigator.onLine) onReconnect(); };
  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
}
