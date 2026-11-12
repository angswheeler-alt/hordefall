// A minimal in-memory localStorage so GameState can save and load under Node.
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  /** Test helper: every key currently stored. */
  keys: () => [...store.keys()],
};

// Rare Pasta drops never fire in tests unless a test turns them on (tests/arena-shop.test.ts).
import { pastaLuck } from '../src/arenaShop';
pastaLuck.roll = () => 1;
