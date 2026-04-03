const LIMIT = 10;
const WINDOW_MS = 60 * 1000;

const store = new Map<
  string,
  { count: number; resetAt: number }
>();

export function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = store.get(userId);

  if (!entry) {
    store.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (now >= entry.resetAt) {
    store.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (entry.count >= LIMIT) {
    return false;
  }

  entry.count++;
  return true;
}
